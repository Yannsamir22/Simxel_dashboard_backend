import prisma from "../config/db.js";

const SALE_INCLUDE = {
  items: {
    include: { product: true, service: true, package: true, employee: true },
  },
  paymentType: true,
  employee: { select: { id: true, name: true } },
};

type DashboardPeriod = "Today" | "Yesterday" | "This week" | "This month" | "This year";

export class SaleService {
  static getAll(businessId: string, opts?: { startDate?: Date; endDate?: Date; limit?: number; offset?: number }) {
    const where: any = { businessId };
    if (opts?.startDate || opts?.endDate) {
      where.saleDate = {};
      if (opts?.startDate) where.saleDate.gte = opts.startDate;
      if (opts?.endDate)   where.saleDate.lte = opts.endDate;
    }
    return prisma.$transaction([
      prisma.sale.findMany({
        where,
        include:  SALE_INCLUDE,
        orderBy:  { saleDate: "desc" },
        take:     opts?.limit  ?? 50,
        skip:     opts?.offset ?? 0,
      }),
      prisma.sale.count({ where }),
    ]);
  }

  static getById(businessId: string, id: string) {
    return prisma.sale.findFirst({ where: { id, businessId }, include: SALE_INCLUDE });
  }

  static getByYear(businessId: string, year: number) {
    return prisma.sale.findMany({
      where: {
        businessId,
        saleDate: { gte: new Date(year, 0, 1), lt: new Date(year + 1, 0, 1) },
      },
      include:  SALE_INCLUDE,
      orderBy:  { saleDate: "desc" },
    });
  }

  static async getDashboardStats(businessId: string, period: DashboardPeriod) {
    const { start, end } = SaleService._periodDates(period);

    const sales = await prisma.sale.findMany({
      where: { businessId, saleDate: { gte: start, lte: end } },
      include: {
        items:       { include: { product: true, service: true, package: true, employee: true } },
        paymentType: true,
      },
    });

    const totalRevenue   = sales.reduce((s, sale) => s + sale.totalAmount, 0);
    const salesCount     = sales.length;
    const avgTransaction = salesCount > 0 ? totalRevenue / salesCount : 0;

    // Payment breakdown
    const payments: Record<string, number> = { CASH: 0, OM: 0, MOMO: 0, CARD: 0 };
    sales.forEach((sale) => {
      (sale.paymentType as any[]).forEach((p) => {
        payments[p.method] = (payments[p.method] || 0) + p.amount;
      });
    });

    // Top items
    const itemMap: Record<string, { name: string; type: string; revenue: number; quantity: number }> = {};
    sales.forEach((sale) => {
      (sale.items as any[]).forEach((item) => {
        let name = "Unknown", type = "UNKNOWN", key = "";
        if (item.product)       { name = item.product.name;  type = "PRODUCT";  key = `p-${item.product.id}`;  }
        else if (item.service)  { name = item.service.name;  type = "SERVICE";  key = `s-${item.service.id}`;  }
        else if (item.package)  { name = item.package.name;  type = "PACKAGE";  key = `pk-${item.package.id}`; }
        if (!key) return;
        if (!itemMap[key]) itemMap[key] = { name, type, revenue: 0, quantity: 0 };
        itemMap[key].revenue  += item.total;
        itemMap[key].quantity += item.quantity || 1;
      });
    });

    const allItems    = Object.values(itemMap).sort((a, b) => b.revenue - a.revenue);
    const topProducts = allItems.filter((i) => i.type === "PRODUCT").slice(0, 6);
    const topServices = allItems.filter((i) => i.type === "SERVICE").slice(0, 6);
    const topPackages = allItems.filter((i) => i.type === "PACKAGE").slice(0, 6);

    // Top employees
    const empMap: Record<string, { name: string; revenue: number }> = {};
    sales.forEach((sale) => {
      (sale.items as any[]).forEach((item) => {
        if (!item.employee) return;
        const id = item.employee.id;
        if (!empMap[id]) empMap[id] = { name: item.employee.name, revenue: 0 };
        empMap[id].revenue += item.total;
      });
    });
    const topEmployees = Object.values(empMap).sort((a, b) => b.revenue - a.revenue).slice(0, 6);

    // Chart data
    const chartMap: Record<string, number> = {};
    sales.forEach((sale) => {
      const label = SaleService._chartLabel(new Date(sale.saleDate), period);
      chartMap[label] = (chartMap[label] || 0) + sale.totalAmount;
    });
    const chartData = Object.entries(chartMap).map(([name, total]) => ({ name, total }));

    return {
      period,
      overview: [
        { label: "revenue",      value: Math.round(totalRevenue),   unit: "FCFA" },
        { label: "transactions", value: salesCount,                  unit: ""     },
        { label: "average",      value: Math.round(avgTransaction),  unit: "FCFA" },
        { label: "items",        value: allItems.length,             unit: ""     },
      ],
      payments,
      topProducts,
      topServices,
      topPackages,
      topEmployees,
      chartData,
    };
  }

  private static _periodDates(period: DashboardPeriod) {
    const now   = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const end   = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    if      (period === "Yesterday")  { start.setDate(start.getDate() - 1); end.setDate(end.getDate() - 1); }
    else if (period === "This week")  { start.setDate(start.getDate() - ((start.getDay() + 6) % 7)); }
    else if (period === "This month") { start.setDate(1); }
    else if (period === "This year")  { start.setMonth(0, 1); }

    return { start, end };
  }

  private static _chartLabel(date: Date, period: DashboardPeriod) {
    if (period === "Today" || period === "Yesterday") {
      return date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
    }
    return date.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
  }

}


export function groupSaleItems(items: any[]){
  const grouped: any[] = [];
  const packageMap: Record<string, any> = {};
  
  for(const item of items) {
    if(item.type === "PACKAGE" && item.pacakgeId) {
      if(!packageMap[item.packageId]){
        packageMap[item.packageId] = {
          type: "PACKAGE",
          packageId: item.packageId,
          package: item.package,
          total: 0,
          quantity: 1,
          services: []
        }
        grouped.push(packageMap[item.packageId]);
      
      }

      packageMap[item.packageId].total += item.total;
      packageMap[item.packageId].services.push({
        name: item.service?.name,
        share: item.total,
        employeeId: item.employeeId,
      })
    } else{
      grouped.push(item);
    
    }
  }
  return grouped;

}