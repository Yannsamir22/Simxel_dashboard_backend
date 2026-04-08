import prisma from "../config/db.js";
import { formatTimeAgo } from "../helper/formatTime.js";
import { createNotification } from "../utils/notification.js";
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
      exists: !!config,
      isSynced: config?.isSynced ?? false,
      lastUpdated: config?.updatedAt ?? null,
    };
  }

  static async resetPosPasswords(businessId: string, mainPassword: string, adminPassword: string) {
    const mainPasswordHash = await hashPassword(mainPassword);
    const adminPasswordHash = await hashPassword(adminPassword);
    await prisma.config.upsert({
      where: { businessId },
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

  // POS sync Status
  static async getPosSyncStatus(businessId: string) {
    const latestSale = await prisma.sale.findFirst({
      where: { businessId },
      orderBy: { saleDate: "desc" },
      select: { updatedAt: true }

    });
    if (!latestSale) {
      return {
        status: "never_synced" as const,
        label: "Never synchronised",
        lastSyncAt: null,
        minutesAgo: null,
        humanReadable: null
      }
    }

    const minutesAgo = Math.floor(
      (Date.now() - new Date(latestSale.updatedAt).getTime()) / 60_000
    );

    // POS considered offline if last sync > 60 minutes ago
    const isOnline = minutesAgo < 60;

    // Auto-create a SYNC_WARNING NOTIFICATION IF POS has been offline for more than 24 hours
    if (!isOnline && minutesAgo >= 1440) {
      const { count } = await prisma.notification.count({
        where: {
          businessId,
          type: "SYNC_WARNING",
          createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
        }
      }) as any;

      // Only create one warning per day to avoid spam
      if (!count) {
        await createNotification({
          businessId,
          type: "SYNC_WARNING",
          title: "POS if offline",
          message: `Your POS has not synchronised since ${formatTimeAgo(minutesAgo)}. Verify your internet.`
        })
      }
    }

    return {
      status: isOnline ? ("online" as const) : ("offline" as const),
      label: isOnline ? "Online" : "Offline",
      lastSyncAt: latestSale.updatedAt,
      minutesAgo,
      humanReadable: formatTimeAgo(minutesAgo)

    }

  }
}



