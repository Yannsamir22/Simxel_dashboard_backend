import prisma from "../config/db.js";

export class ProductService {
  static getAll(businessId: string) {
    return prisma.product.findMany({
      where: { businessId, isDeleted: false },
      orderBy: { name: "asc" },
    });
  }

  static getLowStock(businessId: string) {
    return prisma.product.findMany({
      where: { businessId, isDeleted: false, stock: { lte: prisma.product.fields.minStockAlert } },
    });
  }

  static getById(businessId: string, id: string) {
    return prisma.product.findFirst({ where: { id, businessId, isDeleted: false } });
  }

  static create(businessId: string, data: {
    name: string; salePrice: number; unitCost?: number; stock?: number; minStockAlert?: number;
  }) {
    return prisma.product.create({
      data: {
        name:          data.name.trim(),
        salePrice:     data.salePrice,
        unitCost:      data.unitCost  ?? 0,
        stock:         data.stock     ?? 0,
        minStockAlert: data.minStockAlert ?? 5,
        businessId,
        isSynced: false,
      },
    });
  }

  static update(businessId: string, id: string, data: {
    name?: string; salePrice?: number; unitCost?: number; stock?: number; minStockAlert?: number;
  }) {
    const payload: any = { isSynced: false };
    if (data.name          !== undefined) payload.name          = data.name.trim();
    if (data.salePrice     !== undefined) payload.salePrice     = data.salePrice;
    if (data.unitCost      !== undefined) payload.unitCost      = data.unitCost;
    if (data.stock         !== undefined) payload.stock         = data.stock;
    if (data.minStockAlert !== undefined) payload.minStockAlert = data.minStockAlert;
    return prisma.product.update({ where: { id, businessId }, data: payload });
  }

  static delete(businessId: string, id: string) {
    return prisma.product.update({ where: { id, businessId }, data: { isDeleted: true, isSynced: false } });
  }
}
