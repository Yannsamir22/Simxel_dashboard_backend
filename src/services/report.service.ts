import prisma from "../config/db.js";

export class ReportService {
  static async getSalesSummary(businessId: string, startDate: Date, endDate: Date) {
    const sales = await prisma.sale.findMany({
      where: { businessId, saleDate: { gte: startDate, lte: endDate } },
      include: { paymentTypes: true },
    });
    const totalRevenue      = sales.reduce((s, sale) => s + sale.totalAmount, 0);
    const totalTransactions = sales.length;
    const avgTransaction    = totalTransactions > 0 ? totalRevenue / totalTransactions : 0;
    const paymentBreakdown: Record<string, number> = {};
    sales.forEach((sale) => {
      (sale.paymentTypes as any[]).forEach((p) => {
        paymentBreakdown[p.method] = (paymentBreakdown[p.method] || 0) + p.amount;
      });
    });
    return { totalRevenue, totalTransactions, averageTransaction: Math.round(avgTransaction), paymentBreakdown };
  }

  static async getTopItems(businessId: string, startDate: Date, endDate: Date, limit = 10) {
    const sales = await prisma.sale.findMany({
      where: { businessId, saleDate: { gte: startDate, lte: endDate } },
      include: { saleItems: { include: { product: true, service: true, package: true } } },
    });
    const stats: Record<string, { name: string; type: string; quantity: number; revenue: number }> = {};
    sales.forEach((sale) => {
      (sale.saleItems as any[]).forEach((item) => {
        let name = "?", key = "", type = "";
        if      (item.product) { name = item.product.name; key = `p-${item.product.id}`;  type = "PRODUCT"; }
        else if (item.service) { name = item.service.name; key = `s-${item.service.id}`;  type = "SERVICE"; }
        else if (item.package) { name = item.package.name; key = `pk-${item.package.id}`; type = "PACKAGE"; }
        if (!key) return;
        if (!stats[key]) stats[key] = { name, type, quantity: 0, revenue: 0 };
        stats[key].quantity += item.quantity || 1;
        stats[key].revenue  += item.total;
      });
    });
    return Object.values(stats).sort((a, b) => b.revenue - a.revenue).slice(0, limit);
  }

  static async getStaffPerformance(businessId: string, startDate: Date, endDate: Date) {
    const employees = await prisma.employee.findMany({
      where: { businessId, isDeleted: false },
      include: {
        saleItems: {
          where: { sale: { saleDate: { gte: startDate, lte: endDate } } },
          include: { sale: true },
        },
      },
    });
    return employees
      .map((emp) => {
        const pres           = emp.saleItems.filter((p: any) => p.sale !== null);
        const totalGenerated = pres.reduce((s: number, p: any) => s + (p.total || 0), 0);
        const commission     = Math.round(pres.reduce((s: number, p: any) => s + (p.commission || 0), 0));
        return { employeeId: emp.id, employeeName: emp.name, prestationCount: pres.length, totalGenerated, commission };
      })
      .filter((s) => s.prestationCount > 0)
      .sort((a, b) => b.totalGenerated - a.totalGenerated);
  }

  static async getFinancialBalance(businessId: string, startDate: Date, endDate: Date) {
    const [sales, expenses] = await prisma.$transaction([
      prisma.sale.findMany({
        where: { businessId, saleDate: { gte: startDate, lte: endDate } },
        include: { saleItems: true, paymentTypes: true },
      }),
      prisma.expense.findMany({
        where: { businessId, isDeleted: false, date: { gte: startDate, lte: endDate } },
      }),
    ]);
    const totalRevenue  = sales.reduce((s, sale) => s + sale.totalAmount, 0);
    const productCost   = sales.reduce((s, sale) =>
      s + (sale.saleItems as any[]).reduce((ss: number, item: any) => ss + (item.purchasePrice || 0) * (item.quantity || 1), 0), 0);
    const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);
    const expenseBreakdown: Record<string, number> = {};
    expenses.forEach((e) => { expenseBreakdown[e.type] = (expenseBreakdown[e.type] || 0) + e.amount; });
    return {
      totalRevenue,
      productCost,
      totalExpenses,
      netProfit: totalRevenue - productCost - totalExpenses,
      expenseBreakdown,
    };
  }

  static async getStockStatus(businessId: string) {
    const products = await prisma.product.findMany({
      where: { businessId, isDeleted: false },
      orderBy: { name: "asc" },
    });
    return products.map((p) => ({
      productId:     p.id,
      productName:   p.name,
      currentStock:  p.stock,
      minStockAlert: p.minStockAlert,
      status:        p.stock <= p.minStockAlert ? "ALERT" : "OK",
    }));
  }

  static async getSalesJournal(businessId: string, startDate: Date, endDate: Date) {
    return prisma.sale.findMany({
      where: { businessId, saleDate: { gte: startDate, lte: endDate } },
      include: {
        saleItems:       { include: { product: true, service: true, package: true } },
        paymentTypes: true,
        employee:    { select: { name: true } },
      },
      orderBy: { saleDate: "asc" },
    });
  }
}
