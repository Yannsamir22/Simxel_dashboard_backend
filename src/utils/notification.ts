import prisma from "../config/db.js"

export type NotificationType =
    | "LOW_STOCK"
    | "SYNC_WARNING"
    | "WEEKLY_SUMMARY"
    | "INFO"


export interface CreateNotificationParams {
    title: string;
    message: string;
    type: NotificationType;
    businessId: string;
}

// Create a notification for a business.
export async function createNotification(params: CreateNotificationParams) {
    try {
        await prisma.notification.create({
            data: {
                businessId: params.businessId,
                title: params.title,
                message: params.message,
                type: params.type,
            }
        })
    } catch (error) {
        console.error("[Notification] Error creating notification:", error);
    }
}

/**
 * Bulk create notifications for multiple businesses at once.
 * Used by cron jobs that process all businesses in a loop.
 */
export async function createNotifications(
    params: CreateNotificationParams[],
): Promise<void> {
    try {
        await prisma.notification.createMany({
            data: params,
        })
    } catch (error) {
        console.error("[Notification] Error creating multiple notifications:", error);
    }
}