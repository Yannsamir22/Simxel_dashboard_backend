import { Response } from "express";
import { OwnerRequest } from "../types/auth.js";
import { StockService } from "../services/stock.service.js";
import { sanitizeDatabaseError } from "../utils/sanitize.js";

export class StockController {
  static async getAll(req: OwnerRequest, res: Response): Promise<void> {
    const data = await StockService.getAll(req.businessId!);
    res.json({ ok: true, data });
  }
  static async getByProduct(req: OwnerRequest, res: Response): Promise<void> {
    const data = await StockService.getByProduct(req.businessId!, req.params.productId as string);
    res.json({ ok: true, data });
  }
  static async adjust(req: OwnerRequest, res: Response): Promise<void> {
    const { productId, type, quantity, reason } = req.body;
    if (!productId || !type || quantity === undefined) {
      res.status(400).json({ ok: false, error: "productId, type and quantity are required." }); return;
    }
    try {
      const data = await StockService.adjust(req.businessId!, { productId, type, quantity, reason });
      res.json({ ok: true, data });
    } catch (error) {
      res.status(400).json({ ok: false, error: sanitizeDatabaseError(error) });
    }
  }
}
