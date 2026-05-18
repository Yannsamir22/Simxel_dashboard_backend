import { Response } from "express";
import { SaleService } from "../services/sale.service.js";
import { OwnerRequest } from "../types/auth.js";

export class SaleController {
  static async getAll(req: OwnerRequest, res: Response): Promise<void> {
    const { startDate, endDate, limit, offset } = req.query;
    const [sales, total] = await SaleService.getAll(req.businessId!, {
      startDate: startDate ? new Date(startDate as string) : undefined,
      endDate: endDate ? new Date(endDate as string) : undefined,
      limit: limit ? parseInt(limit as string) : 50,
      offset: offset ? parseInt(offset as string) : 0,
    });
    res.json({ ok: true, data: sales, total });
  }
  static async getById(req: OwnerRequest, res: Response): Promise<void> {
    const data = await SaleService.getById(
      req.businessId!,
      req.params.id as string
    );
    if (!data) {
      res.status(404).json({ ok: false, error: "Sale not found." });
      return;
    }
    res.json({ ok: true, data });
  }
  static async getByYear(req: OwnerRequest, res: Response): Promise<void> {
    const data = await SaleService.getByYear(
      req.businessId!,
      parseInt(req.params.year as string),
    );
    res.json({ ok: true, data });
  }
  static async getStats(req: OwnerRequest, res: Response): Promise<void> {
    const period = (req.query.period as string) || "Today";
    const validPeriods = [
      "Today",
      "Yesterday",
      "This week",
      "This month",
      "This year",
    ];
    if (!validPeriods.includes(period)) {
      res.status(400).json({
        ok: false,
        error: `period must be one of: ${validPeriods.join(", ")}`,
      });
      return;
    }
    const data = await SaleService.getDashboardStats(
      req.businessId!,
      period as any,
    );
    res.json({ ok: true, data });
  }
}
