import { Response } from "express";
import { OwnerRequest } from "../types/auth.js";
import { BusinessService } from "../services/business.service.js";
import prisma from "../config/db.js";

export class BusinessController {
  static async getMyBusinesses(req: OwnerRequest, res: Response): Promise<void> {
    const businesses = await BusinessService.getOwnerBusinesses(req.owner!.sub);
    res.status(200).json({ ok: true, data: businesses });
  }

  static async getOne(req: OwnerRequest, res: Response): Promise<void> {
    const business = await BusinessService.getOne(req.businessId!);
    res.status(200).json({ ok: true, data: business });
  }

  static async update(req: OwnerRequest, res: Response): Promise<void> {
    const { name, currency, type } = req.body;
    const updated = await BusinessService.update(req.businessId!, { name, currency, type });
    res.status(200).json({ ok: true, data: updated });
  }

  static async getPosConfigStatus(req: OwnerRequest, res: Response): Promise<void> {
    const data = await BusinessService.getPosConfigStatus(req.businessId!);
    res.status(200).json({ ok: true, data });
  }

  static async resetPosPasswords(req: OwnerRequest, res: Response): Promise<void> {
    const { mainPassword, adminPassword } = req.body;
    if (!mainPassword || !adminPassword) {
      res.status(400).json({ ok: false, error: "mainPassword and adminPassword are required." }); return;
    }
    const result = await BusinessService.resetPosPasswords(req.businessId!, mainPassword, adminPassword);
    res.status(200).json(result);
  }

  static async changePosMainPassword(req: OwnerRequest, res: Response): Promise<void> {
    const { currentAdminPassword, newMainPassword } = req.body;
    if (!currentAdminPassword || !newMainPassword) {
      res.status(400).json({ ok: false, error: "currentAdminPassword and newMainPassword are required." }); return;
    }
    const result = await BusinessService.changePosMainPassword(req.businessId!, currentAdminPassword, newMainPassword);
    if (!result.ok) { res.status(400).json(result); return; }
    res.status(200).json(result);
  }

  static async changePosAdminPassword(req: OwnerRequest, res: Response): Promise<void> {
    const { currentAdminPassword, newAdminPassword } = req.body;
    if (!currentAdminPassword || !newAdminPassword) {
      res.status(400).json({ ok: false, error: "currentAdminPassword and newAdminPassword are required." }); return;
    }
    const result = await BusinessService.changePosAdminPassword(req.businessId!, currentAdminPassword, newAdminPassword);
    if (!result.ok) { res.status(400).json(result); return; }
    res.status(200).json(result);
  }

  static async getPosSyncStatus(req: OwnerRequest, res: Response): Promise<void> {
    const data = await BusinessService.getPosSyncStatus(req.businessId!);
    res.status(200).json({ ok: true, data });
  }
}
