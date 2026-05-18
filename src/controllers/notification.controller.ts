import { Response } from "express";
import { NotificationService } from "../services/notification.service.js";
import { OwnerRequest } from "../types/auth.js";

export class NotificationController {
  // GET /businesses/:businessId/notifications?unreadOnly=true
  static async getAll(req: OwnerRequest, res: Response): Promise<void> {
    const unreadOnly = req.query.unreadOnly === "true";
    const result = await NotificationService.getAll(
      req.businessId!,
      unreadOnly,
    );
    res.json({ ok: true, ...result });
  }

  // GET /businesses/:businessId/notifications/unread-count
  static async getUnreadCount(req: OwnerRequest, res: Response): Promise<void> {
    const result = await NotificationService.getUnreadCount(req.businessId!);
    res.json({ ok: true, ...result });
  }

  // PATCH /businesses/:businessId/notifications/:notificationId/read
  static async markAsRead(req: OwnerRequest, res: Response): Promise<void> {
    const result = await NotificationService.markAsRead(
      req.businessId!,
      req.params.id as string,
    );
    res.json({ ok: true, ...result, message: "Notification marked as read." });
  }

  // PATCH /businesses/:businessId/notifications/mark-all-read
  static async markAllAsRead(req: OwnerRequest, res: Response): Promise<void> {
    const { count } = await NotificationService.markAllAsRead(req.businessId!);
    res.json({ ok: true, message: `${count} notifications marked as read.` });
  }

  // DELETE /businesses/:businessId/notifications/:notificationId
  static async delete(req: OwnerRequest, res: Response): Promise<void> {
    await NotificationService.delete(req.businessId!, req.params.id as string);
    console.log("Notification deleted.");
    res.json({ ok: true, message: "Notification deleted." });
  }

  // DELETE /businesses/:businessId/notifications/clear-read
  static async clearRead(req: OwnerRequest, res: Response): Promise<void> {
    await NotificationService.clearRead(req.businessId!);
    console.log("Notifications cleared.");
    res.json({ ok: true, message: ` notifications cleared.` });
  }

  static async getSystemNotification(req: OwnerRequest, res: Response): Promise<void> {
    const result = await NotificationService.getSystemNotification(req.businessId!);

    res.json({ok: true, ...result})
  }
}
