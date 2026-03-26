import prisma from "../config/db.js";
import { hashPassword, verifyPassword } from "../utils/password.js";

export class BusinessService {
  static async getOwnerBusinesses(ownerId: string) {
    return prisma.business.findMany({ where: { ownerId }, orderBy: { createdAt: "desc" } });
  }

  static async getOne(businessId: string) {
    return prisma.business.findUnique({ where: { id: businessId } });
  }

  static async update(businessId: string, data: { name?: string; currency?: string; type?: string }) {
    return prisma.business.update({ where: { id: businessId }, data });
  }

  // ── POS Config ────────────────────────────────────────────────────────────
  static async getPosConfigStatus(businessId: string) {
    const config = await prisma.config.findUnique({ where: { businessId } });
    return {
      exists:      !!config,
      isSynced:    config?.isSynced ?? false,
      lastUpdated: config?.updatedAt ?? null,
    };
  }

  static async resetPosPasswords(businessId: string, mainPassword: string, adminPassword: string) {
    const mainPasswordHash  = await hashPassword(mainPassword);
    const adminPasswordHash = await hashPassword(adminPassword);
    await prisma.config.upsert({
      where:  { businessId },
      update: { mainPasswordHash, adminPasswordHash, isSynced: false },
      create: { businessId, mainPasswordHash, adminPasswordHash },
    });
    return { ok: true, message: "Passwords reset. Changes will apply on next POS sync." };
  }

  static async changePosMainPassword(
    businessId: string,
    currentAdminPassword: string,
    newMainPassword: string,
  ) {
    const config = await prisma.config.findUnique({ where: { businessId } });
    if (!config) return { ok: false, error: "POS not activated yet." };

    const valid = await verifyPassword(currentAdminPassword, config.adminPasswordHash);
    if (!valid) return { ok: false, error: "Current admin password is incorrect." };

    const mainPasswordHash = await hashPassword(newMainPassword);
    await prisma.config.update({ where: { businessId }, data: { mainPasswordHash, isSynced: false } });
    return { ok: true, message: "Manager password updated. Will apply on next sync." };
  }

  static async changePosAdminPassword(
    businessId: string,
    currentAdminPassword: string,
    newAdminPassword: string,
  ) {
    const config = await prisma.config.findUnique({ where: { businessId } });
    if (!config) return { ok: false, error: "POS not activated yet." };

    const valid = await verifyPassword(currentAdminPassword, config.adminPasswordHash);
    if (!valid) return { ok: false, error: "Current admin password is incorrect." };

    const adminPasswordHash = await hashPassword(newAdminPassword);
    await prisma.config.update({ where: { businessId }, data: { adminPasswordHash, isSynced: false } });
    return { ok: true, message: "Admin password updated. Will apply on next sync." };
  }
}
