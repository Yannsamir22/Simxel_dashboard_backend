// src/controllers/owner.controller.ts
import { Request, Response } from "express";
import { OwnerService } from "../services/owner.service.js";
import { OwnerRequest } from "../types/auth.js";

export class OwnerController {

  // ─── Registration (public) ───────────────────────────────────────────────

  /**
   * POST /api/owner/register
   * Create a new owner account + first business.
   * Returns the secretKey that the POS operator needs for activation.
   */
  static async registerBusiness(req: Request, res: Response) {
    const result = await OwnerService.registerBusiness(req.body);
    if (!result.ok) return res.status(400).json({ ok: false, error: result.error });
    return res.status(201).json({ ok: true, data: result });
  }

  // ─── Owner account (protected) ───────────────────────────────────────────

  /**
   * PUT /api/owner/password
   * Change the owner's own Dashboard login password.
   */
  static async changeOwnerPassword(req: OwnerRequest, res: Response) {
    const { oldPassword, newPassword } = req.body;
    const result = await OwnerService.changeOwnerPassword(
      req.owner!.sub,
      oldPassword,
      newPassword
    );
    if (!result.ok) return res.status(400).json({ ok: false, error: result.error });
    return res.status(200).json({ ok: true, message: result.message });
  }

  // ─── Remote POS Config (protected + business-scoped) ────────────────────

  /**
   * GET /api/businesses/:businessId/config
   * Get POS config status for a business (no passwords returned).
   */
  static async getPosConfig(req: OwnerRequest, res: Response) {
    const result = await OwnerService.getPosConfig(req.businessId!);
    if (!result.ok) return res.status(404).json({ ok: false, error: result.error });
    return res.status(200).json({ ok: true, data: result.config });
  }

  /**
   * PUT /api/businesses/:businessId/config/manager-password
   * Remotely change the POS manager (cashier) password.
   * Body: { ownerPassword, newManagerPassword }
   */
  static async changePosManagerPassword(req: OwnerRequest, res: Response) {
    const { ownerPassword, newManagerPassword } = req.body;
    if (!ownerPassword || !newManagerPassword) {
      return res.status(400).json({
        ok: false,
        error: "ownerPassword and newManagerPassword are required.",
      });
    }
    const result = await OwnerService.changePosManagerPassword(
      req.owner!.sub,
      req.businessId!,
      ownerPassword,
      newManagerPassword
    );
    if (!result.ok) return res.status(400).json({ ok: false, error: result.error });
    return res.status(200).json({ ok: true, message: result.message });
  }

  /**
   * PUT /api/businesses/:businessId/config/admin-password
   * Remotely change the POS admin password.
   * Body: { ownerPassword, newAdminPassword }
   */
  static async changePosAdminPassword(req: OwnerRequest, res: Response) {
    const { ownerPassword, newAdminPassword } = req.body;
    if (!ownerPassword || !newAdminPassword) {
      return res.status(400).json({
        ok: false,
        error: "ownerPassword and newAdminPassword are required.",
      });
    }
    const result = await OwnerService.changePosAdminPassword(
      req.owner!.sub,
      req.businessId!,
      ownerPassword,
      newAdminPassword
    );
    if (!result.ok) return res.status(400).json({ ok: false, error: result.error });
    return res.status(200).json({ ok: true, message: result.message });
  }

  /**
   * PUT /api/businesses/:businessId/info
   * Update business name, currency, or type.
   * Body: { name?, currency?, type? }
   */
  static async updateBusinessInfo(req: OwnerRequest, res: Response) {
    const result = await OwnerService.updateBusinessInfo(req.businessId!, req.body);
    if (!result.ok) return res.status(400).json({ ok: false, error: result.error });
    return res.status(200).json({ ok: true, data: result.business });
  }
}
