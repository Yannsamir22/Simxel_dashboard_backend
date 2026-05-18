import prisma from "../config/db.js";
import { BusinessService } from "./business.service.js";

export class NotificationService {
  // Get all notifications for a business (newest first)
  static async getAll(businessId: string, unreadOnly = false) {
    try {
      // Trigger POS sync status check to auto-create sync warnings in the DB if offline
      await BusinessService.getPosSyncStatus(businessId);
    } catch (err) {
      console.error("Failed to run POS sync status check in getAll notifications:", err);
    }

    const [notifications, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where: {
          businessId,
          ...(unreadOnly ? { isRead: false } : {}),
        },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
      prisma.notification.count({
        where: { businessId, isRead: false },
      }),
    ]);
    return { notifications, unreadCount };
  }

  // Mark a notification as read
  static async markAsRead(businessId: string, notificationId: string) {
    return prisma.notification.update({
      where: { id: notificationId, businessId },
      data: { isRead: true },
    });
  }

  // Mark all notifications as read
  static async markAllAsRead(businessId: string) {
    const { count } = await prisma.notification.updateMany({
      where: { businessId, isRead: false },
      data: { isRead: true },
    });
    return { count };
  }

  // Delete a notification
  static async delete(businessId: string, notificationId: string) {
    return prisma.notification.deleteMany({
      where: { id: notificationId, businessId },
    });
  }

  // Delete all notifications
  static async clearRead(businessId: string) {
    return prisma.notification.deleteMany({
      where: { businessId, isRead: true },
    });
  }

  // Unread count only - for the badge
  static async getUnreadCount(businessId: string) {
    try {
      // Trigger POS sync status check to auto-create sync warnings in the DB if offline
      await BusinessService.getPosSyncStatus(businessId);
    } catch (err) {
      console.error("Failed to run POS sync status check in getUnreadCount:", err);
    }

    const count = await prisma.notification.count({
      where: { businessId, isRead: false },
    });
    return { count };
  }

  static async getSystemNotification(businessId: string) {
    const now = new Date();

    const notifications = await prisma.systemNotification.findMany({
      where: {
        OR: [
          {isGlobal: true},
          {targetBusinessId: businessId!}
        ],
        AND: {
          OR: [
            {expiresAt: null},
            {expiresAt: {gt: now}}
          ]
        }
      },
      orderBy: {createdAt: 'desc'}
    })

    return {notifications}
  }
}
