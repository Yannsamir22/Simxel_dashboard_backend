import prisma from "../config/db";

export class NotificationService {
  // Get all notifications for a business (newest first)
  static async getAll(businessId: string, unreadOnly = false) {
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
    const count = await prisma.notification.count({
      where: { businessId, isRead: false },
    });
    return { count };
  }
}
