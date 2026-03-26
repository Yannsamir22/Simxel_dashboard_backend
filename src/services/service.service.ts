import prisma from "../config/db.js";

export class ServiceService {
  static getAll(businessId: string) {
    return prisma.service.findMany({
      where: { businessId, isDeleted: false },
      orderBy: { name: "asc" },
    });
  }

  static getById(businessId: string, id: string) {
    return prisma.service.findFirst({ where: { id, businessId, isDeleted: false } });
  }

  static create(businessId: string, data: { name: string; price: number }) {
    return prisma.service.create({
      data: { name: data.name.trim(), price: data.price, businessId, isSynced: false },
    });
  }

  static update(businessId: string, id: string, data: { name?: string; price?: number }) {
    const payload: any = { isSynced: false };
    if (data.name  !== undefined) payload.name  = data.name.trim();
    if (data.price !== undefined) payload.price = data.price;
    return prisma.service.update({ where: { id, businessId }, data: payload });
  }

  static delete(businessId: string, id: string) {
    return prisma.service.update({ where: { id, businessId }, data: { isDeleted: true, isSynced: false } });
  }
}
