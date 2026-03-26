import prisma from "../config/db.js";

export class StockService {
  static getAll(businessId: string) {
    return prisma.stockMovement.findMany({
      where: { businessId },
      include: { product: true },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
  }

  static getByProduct(businessId: string, productId: string) {
    return prisma.stockMovement.findMany({
      where: { businessId, productId },
      orderBy: { createdAt: "desc" },
    });
  }

  static async adjust(businessId: string, data: {
    productId: string;
    type: "IN" | "OUT" | "ADJUSTMENT";
    quantity: number;
    reason?: string;
  }) {
    const product = await prisma.product.findFirst({
      where: { id: data.productId, businessId, isDeleted: false },
    });
    if (!product) throw new Error("Product not found.");

    const qty = data.type === "OUT" ? -Math.abs(data.quantity) : Math.abs(data.quantity);

    return prisma.$transaction(async (tx) => {
      await tx.stockMovement.create({
        data: {
          productId:  data.productId,
          quantity:   qty,
          type:       data.type,
          businessId,
          isSynced:   false,
        },
      });
      return tx.product.update({
        where: { id: data.productId },
        data:  { stock: { increment: qty }, isSynced: false },
      });
    });
  }
}
