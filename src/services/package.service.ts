import prisma from "../config/db.js";

const INCLUDE = { items: { include: { service: true } } };

export class PackageService {
  static getAll(businessId: string) {
    return prisma.package.findMany({
      where: { businessId, isDeleted: false },
      include: INCLUDE,
      orderBy: { name: "asc" },
    });
  }

  static getById(businessId: string, id: string) {
    return prisma.package.findFirst({ where: { id, businessId, isDeleted: false }, include: INCLUDE });
  }

  static async create(businessId: string, data: { name: string; price: number; serviceIds: string[] }) {
    return prisma.package.create({
      data: {
        name:  data.name.trim(),
        price: data.price,
        businessId,
        isSynced: false,
        items: { create: data.serviceIds.map((sid) => ({ service: { connect: { id: sid } } })) },
      },
      include: INCLUDE,
    });
  }

  static async update(businessId: string, id: string, data: { name?: string; price?: number; serviceIds?: string[] }) {
    const payload: any = { isSynced: false };
    if (data.name  !== undefined) payload.name  = data.name.trim();
    if (data.price !== undefined) payload.price = data.price;
    if (Array.isArray(data.serviceIds)) {
      payload.items = {
        deleteMany: {},
        create: data.serviceIds.map((sid) => ({ service: { connect: { id: sid } } })),
      };
    }
    return prisma.package.update({ where: { id, businessId }, data: payload, include: INCLUDE });
  }

  static delete(businessId: string, id: string) {
    return prisma.package.update({ where: { id, businessId }, data: { isDeleted: true, isSynced: false } });
  }
}
