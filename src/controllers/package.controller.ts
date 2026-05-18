import { Response } from "express";
import { PackageService } from "../services/package.service.js";
import { OwnerRequest } from "../types/auth.js";

export class PackageController {
  static async getAll(req: OwnerRequest, res: Response): Promise<void> {
    const data = await PackageService.getAll(req.businessId!);
    res.json({ ok: true, data });
  }
  static async getById(req: OwnerRequest, res: Response): Promise<void> {
    const data = await PackageService.getById(
      req.businessId!,
      req.params.id as string,
    );
    if (!data) {
      res.status(404).json({ ok: false, error: "Package not found." });
      return;
    }
    res.json({ ok: true, data });
  }
  static async create(req: OwnerRequest, res: Response): Promise<void> {
    const { name, price, serviceIds } = req.body;
    if (!name || price === undefined || !serviceIds?.length) {
      res
        .status(400)
        .json({ ok: false, error: "name, price and serviceIds are required." });
      return;
    }
    const data = await PackageService.create(req.businessId!, {
      name,
      price,
      serviceIds,
    });
    res.status(201).json({ ok: true, data });
  }
  static async update(req: OwnerRequest, res: Response): Promise<void> {
    const data = await PackageService.update(
      req.businessId!,
      req.params.id as string,
      req.body,
    );
    res.json({ ok: true, data });
  }
  static async delete(req: OwnerRequest, res: Response): Promise<void> {
    await PackageService.delete(req.businessId!, req.params.id as string);
    res.json({ ok: true, message: "Package deleted." });
  }
}
