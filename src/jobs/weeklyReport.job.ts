import cron from "node-cron"
import prisma from "../config/db.js"
import { sendWeeklyReportEmail } from "../utils/email.js"
import { createNotification } from "../utils/notification.js"


export function startWeeklyReportJob(): void {
    // Every saturday at 8:00 AM
    cron.schedule("0 8 * * 6", async () => {
        console.log("[WeeklyReport] Job started...");

        const now = new Date();
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

        try {
            const businesses = await prisma.business.findMany({
                where: { isActivated: true },
                include: { owner: true }
            })

            for (const business of businesses) {
                try {
                    await processReport(business, weekAgo, now)
                } catch (error) {
                    console.error(`[WeeklyReport] Failed to process report for business ${business.name}`, error)
                }
            }

            console.log(`[WeeklyReport] Job completed successfully with ${businesses.length} businesses. `)
        } catch (error) {
            console.error("[WeeklyReport] Job crashed: ", error)
        }

    })
    console.log("[WeeklyReport] Job scheduled to run every Saturday at 8:00 AM")
}

// Per business processing function
async function processReport(
    business: {
        id: string; name: string; currency: string; owner: { email: string; name: string | null };
    },
    from: Date,
    to: Date
): Promise<void> {
    const businessId = business.id;

    // Revenue & sales count

    const salesAgg = await prisma.sale.aggregate({
        where: { businessId, saleDate: { gte: from, lte: to } },
        _sum: { totalAmount: true },
        _count: { id: true }
    })

    // Total expense
    const expenseAgg = await prisma.expense.aggregate({
        where: { businessId, isDeleted: false, date: { gte: from, lte: to } },
        _sum: { amount: true }
    })

    const totalRevenue = salesAgg._sum.totalAmount ?? 0;
    const totalSales = salesAgg._count.id ?? 0;
    const totalExpenses = expenseAgg._sum.amount ?? 0;
    const netProfit = totalRevenue - totalExpenses;

    // Top product
    const topProduct = await prisma.saleItem.groupBy({
        by: ["productId"],
        where: { Sale: { businessId, saleDate: { gte: from, lte: to } } },
        _sum: { quantity: true },
        orderBy: { _sum: { quantity: "desc" } },
        take: 1
    })

    let topProductName = "-";
    if (topProduct[0]?.productId) {
        const product = await prisma.product.findUnique({
            where: { id: topProduct[0].productId! },
            select: { name: true }
        })
        topProductName = product?.name || "-"
    }

    // Top service
    const topService = await prisma.saleItem.groupBy({
        by: ["serviceId"],
        where: { Sale: { businessId, saleDate: { gte: from, lte: to } } },
        _sum: { quantity: true },
        orderBy: { _sum: { quantity: "desc" } },
        take: 1
    })

    let topServiceName = "-";
    if (topService[0]?.serviceId) {
        const service = await prisma.service.findUnique({
            where: { id: topService[0].serviceId! },
            select: { name: true }
        })
        topServiceName = service?.name || "-"
    }

    await sendWeeklyReportEmail(business.owner.email, {
        ownerName: business.owner.name ?? "",
        businessName: business.name,
        currency: business.currency,
        totalRevenue,
        totalSales,
        totalExpenses,
        netProfit,
        topProductName,
        topServiceName,
        from,
        to
    })
    // Send email
    console.log(`[WeeklyReport] Sent report to ${business.owner.email} for business ${business.name}`);

    // Create notification
    await createNotification({
        businessId,
        title: "Weekly Report",
        message: `Your Weekly report from ${from.toLocaleDateString("fr-FR")} to ${to.toLocaleDateString("fr-FR")} has been sent to your email for ${business.name}.`,
        type: "WEEKLY_SUMMARY"
    })
}