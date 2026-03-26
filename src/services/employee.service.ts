import prisma from "../config/db.js";

export class EmployeeService {
  static getAll(businessId: string) {
    return prisma.employee.findMany({
      where: { businessId, isDeleted: false },
      orderBy: { name: "asc" },
    });
  }

  static getById(businessId: string, id: string) {
    return prisma.employee.findFirst({ where: { id, businessId, isDeleted: false } });
  }

  static create(businessId: string, data: {
    name: string; role?: string; dateOfBirth?: string; commissionRate?: number;
  }) {
    return prisma.employee.create({
      data: {
        name:           data.name.trim(),
        role:           data.role || "EMPLOYEE",
        dateOfBirth:    data.dateOfBirth ? new Date(data.dateOfBirth) : new Date(),
        commissionRate: data.commissionRate ?? 0.1,
        businessId,
        isSynced: false,
      },
    });
  }

  static update(businessId: string, id: string, data: {
    name?: string; role?: string; dateOfBirth?: string; commissionRate?: number;
  }) {
    const payload: any = { isSynced: false };
    if (data.name)                          payload.name           = data.name.trim();
    if (data.role)                          payload.role           = data.role;
    if (data.dateOfBirth)                   payload.dateOfBirth    = new Date(data.dateOfBirth);
    if (data.commissionRate !== undefined)  payload.commissionRate = data.commissionRate;
    return prisma.employee.update({ where: { id, businessId }, data: payload });
  }

  static delete(businessId: string, id: string) {
    return prisma.employee.update({ where: { id, businessId }, data: { isDeleted: true, isSynced: false } });
  }
}
