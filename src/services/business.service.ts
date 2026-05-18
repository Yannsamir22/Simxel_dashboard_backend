import { randomUUID } from "crypto";
import prisma from "../config/db.js";
import { formatTimeAgo } from "../helper/formatTime.js";
import { createNotification } from "../utils/notification.js";
import { hashPassword, verifyPassword } from "../utils/password.js";

// In-memory cache to deduplicate POS sync warnings during the server lifecycle
const generatedWarnings = new Set<string>();

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
      create: {
        id: randomUUID(),
        businessId,
        mainPasswordHash,
        adminPasswordHash,
        updatedAt: new Date(),
      },
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
    const [latestSale, config] = await Promise.all([
      prisma.sale.findFirst({
        where: { businessId },
        orderBy: { saleDate: "desc" },
        select: { updatedAt: true }
      }),
      prisma.config.findUnique({
        where: { businessId },
        select: { updatedAt: true }
      })
    ]);

    // If POS config doesn't exist, POS is not even activated yet, so no warnings
    if (!config) {
      return {
        status: "never_synced" as const,
        label: "Not activated",
        lastSyncAt: null,
        minutesAgo: null,
        humanReadable: null
      };
    }

    const warningKey = latestSale
      ? `${businessId}-sale-${new Date(latestSale.updatedAt).getTime()}`
      : `${businessId}-config-${new Date(config.updatedAt).getTime()}`;

    if (!latestSale) {
      const configMinutesAgo = Math.floor(
        (Date.now() - new Date(config.updatedAt).getTime()) / 60_000
      );

      // Auto-create a SYNC_WARNING if POS config is older than 24 hours but no sales synced
      if (configMinutesAgo >= 1440 && !generatedWarnings.has(warningKey)) {
        const { count } = await prisma.notification.count({
          where: {
            businessId,
            type: "SYNC_WARNING",
            createdAt: { gte: new Date(config.updatedAt) }
          }
        }) as any;

        if (!count) {
          await createNotification({
            businessId,
            type: "SYNC_WARNING",
            title: "POS never synchronised",
            message: `Your POS was activated ${formatTimeAgo(configMinutesAgo)} but has never synchronised sales.`
          });
        }
        generatedWarnings.add(warningKey);
      }

      return {
        status: "never_synced" as const,
        label: "Never synchronised",
        lastSyncAt: null,
        minutesAgo: configMinutesAgo,
        humanReadable: "Never"
      };
    }

    const minutesAgo = Math.floor(
      (Date.now() - new Date(latestSale.updatedAt).getTime()) / 60_000
    );

    // POS considered offline if last sync > 60 minutes ago
    const isOnline = minutesAgo < 60;

    // Auto-create a SYNC_WARNING NOTIFICATION IF POS has been offline for more than 24 hours
    if (!isOnline && minutesAgo >= 1440 && !generatedWarnings.has(warningKey)) {
      const { count } = await prisma.notification.count({
        where: {
          businessId,
          type: "SYNC_WARNING",
          createdAt: { gte: new Date(latestSale.updatedAt) }
        }
      }) as any;

      // Only create if not already in the database since the last sync date
      if (!count) {
        await createNotification({
          businessId,
          type: "SYNC_WARNING",
          title: "POS is offline",
          message: `Your POS has not synchronised since ${formatTimeAgo(minutesAgo)}. Verify your internet.`
        });
      }
      generatedWarnings.add(warningKey);
    }

    return {
      status: isOnline ? ("online" as const) : ("offline" as const),
      label: isOnline ? "Online" : "Offline",
      lastSyncAt: latestSale.updatedAt,
      minutesAgo,
      humanReadable: formatTimeAgo(minutesAgo)
    };
  }
}
