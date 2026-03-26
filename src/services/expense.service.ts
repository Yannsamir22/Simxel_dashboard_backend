import prisma from "../config/db.js";

export class ExpenseService {
  static getAll(businessId: string) {
    return prisma.expense.findMany({
      where: { businessId, isDeleted: false },
      orderBy: { date: "desc" },
    });
  }

  static getById(businessId: string, id: string) {
    return prisma.expense.findFirst({ where: { id, businessId, isDeleted: false } });
  }

  static getByRange(businessId: string, start: Date, end: Date) {
    return prisma.expense.findMany({
      where: { businessId, isDeleted: false, date: { gte: start, lte: end } },
      orderBy: { date: "desc" },
    });
  }

  static create(businessId: string, data: { type: string; amount: number; note?: string; date?: string }) {
    return prisma.expense.create({
      data: {
        type:  data.type.trim(),
        amount: data.amount,
        note:   data.note,
        date:   data.date ? new Date(data.date) : new Date(),
        businessId,
        isSynced: false,
      },
    });
  }

  static update(businessId: string, id: string, data: { type?: string; amount?: number; note?: string; date?: string }) {
    const payload: any = { isSynced: false };
    if (data.type   !== undefined) payload.type   = data.type.trim();
    if (data.amount !== undefined) payload.amount = data.amount;
    if (data.note   !== undefined) payload.note   = data.note;
    if (data.date   !== undefined) payload.date   = new Date(data.date);
    return prisma.expense.update({ where: { id, businessId }, data: payload });
  }

  static delete(businessId: string, id: string) {
    return prisma.expense.update({ where: { id, businessId }, data: { isDeleted: true, isSynced: false } });
  }
}
