import { Response } from "express";
import { ServiceService } from "../services/service.service.js";
import { OwnerRequest } from "../types/auth.js";

export class ServiceController {
  static async getAll(req: OwnerRequest, res: Response): Promise<void> {
    const data = await ServiceService.getAll(req.businessId!);
    res.json({ ok: true, data });
  }
  static async getById(req: OwnerRequest, res: Response): Promise<void> {
    const data = await ServiceService.getById(
      req.businessId!,
      req.params.id as string,
    );
    if (!data) {
      res.status(404).json({ ok: false, error: "Service not found." });
      return;
    }
    res.json({ ok: true, data });
  }
  static async create(req: OwnerRequest, res: Response): Promise<void> {
    const { name, price } = req.body;
    if (!name || price === undefined) {
      res
        .status(400)
        .json({ ok: false, error: "name and price are required." });
      return;
    }
    const data = await ServiceService.create(req.businessId!, { name, price });
    res.status(201).json({ ok: true, data });
  }
  static async update(req: OwnerRequest, res: Response): Promise<void> {
    const data = await ServiceService.update(
      req.businessId!,
      req.params.id as string,
      req.body,
    );
    res.json({ ok: true, data });
  }
  static async delete(req: OwnerRequest, res: Response): Promise<void> {
    await ServiceService.delete(req.businessId!, req.params.id as string);
    res.json({ ok: true, message: "Service deleted." });
  }
}
