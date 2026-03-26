import { Response } from "express";
import { OwnerRequest } from "../types/auth.js";
import { ReportService } from "../services/report.service.js";
import {
  generateSalesJournalExcel,
  generateStaffPerformanceExcel,
  generateStockStatusExcel,
  generateFinancialBalanceExcel,
} from "../utils/excel.helper.js";
import prisma from "../config/db.js";

function parseDates(req: OwnerRequest, res: Response): { startDate: Date; endDate: Date } | null {
  const { startDate, endDate } = req.query;
  if (!startDate || !endDate) {
    res.status(400).json({ ok: false, error: "startDate and endDate are required (YYYY-MM-DD)." });
    return null;
  }
  const start = new Date(startDate as string);
  const end   = new Date(endDate   as string);
  end.setHours(23, 59, 59, 999);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    res.status(400).json({ ok: false, error: "Invalid date format." });
    return null;
  }
  return { startDate: start, endDate: end };
}

function sendExcel(res: Response, buffer: Buffer, fileName: string) {
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
  res.setHeader("Content-Length", buffer.length);
  res.send(buffer);
}

export class ReportController {
  static async getSalesSummary(req: OwnerRequest, res: Response): Promise<void> {
    const dates = parseDates(req, res);
    if (!dates) return;
    const data = await ReportService.getSalesSummary(req.businessId!, dates.startDate, dates.endDate);
    res.json({ ok: true, data });
  }

  static async getTopItems(req: OwnerRequest, res: Response): Promise<void> {
    const dates = parseDates(req, res);
    if (!dates) return;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
    const data  = await ReportService.getTopItems(req.businessId!, dates.startDate, dates.endDate, limit);
    res.json({ ok: true, data });
  }

  static async getStaffPerformance(req: OwnerRequest, res: Response): Promise<void> {
    const dates = parseDates(req, res);
    if (!dates) return;
    const data = await ReportService.getStaffPerformance(req.businessId!, dates.startDate, dates.endDate);
    res.json({ ok: true, data });
  }

  static async getFinancialBalance(req: OwnerRequest, res: Response): Promise<void> {
    const dates = parseDates(req, res);
    if (!dates) return;
    const data = await ReportService.getFinancialBalance(req.businessId!, dates.startDate, dates.endDate);
    res.json({ ok: true, data });
  }

  static async getStockStatus(req: OwnerRequest, res: Response): Promise<void> {
    const data = await ReportService.getStockStatus(req.businessId!);
    res.json({ ok: true, data });
  }

  // ── Excel exports ──────────────────────────────────────────────────────
  static async exportSalesJournal(req: OwnerRequest, res: Response): Promise<void> {
    const dates = parseDates(req, res);
    if (!dates) return;
    try {
      const business = await prisma.business.findUnique({ where: { id: req.businessId! } });
      const sales    = await ReportService.getSalesJournal(req.businessId!, dates.startDate, dates.endDate);
      const buffer   = await generateSalesJournalExcel(sales ?? [], business?.name || "Simxel");
      sendExcel(res, buffer, `Journal_Ventes_${dates.startDate.toISOString().split("T")[0]}.xlsx`);
    } catch (e) { res.status(500).json({ ok: false, error: (e as Error).message }); }
  }

  static async exportStaffPerformance(req: OwnerRequest, res: Response): Promise<void> {
    const dates = parseDates(req, res);
    if (!dates) return;
    try {
      const business   = await prisma.business.findUnique({ where: { id: req.businessId! } });
      const staffData  = await ReportService.getStaffPerformance(req.businessId!, dates.startDate, dates.endDate);
      const buffer     = await generateStaffPerformanceExcel(staffData ?? [], business?.name || "Simxel", dates.startDate, dates.endDate);
      sendExcel(res, buffer, `Performance_Staff_${dates.startDate.toISOString().split("T")[0]}.xlsx`);
    } catch (e) { res.status(500).json({ ok: false, error: (e as Error).message }); }
  }

  static async exportStockStatus(req: OwnerRequest, res: Response): Promise<void> {
    try {
      const business  = await prisma.business.findUnique({ where: { id: req.businessId! } });
      const stockData = await ReportService.getStockStatus(req.businessId!);
      const buffer    = await generateStockStatusExcel(stockData ?? [], business?.name || "Simxel");
      sendExcel(res, buffer, `Etat_Stocks_${new Date().toISOString().split("T")[0]}.xlsx`);
    } catch (e) { res.status(500).json({ ok: false, error: (e as Error).message }); }
  }

  static async exportFinancialBalance(req: OwnerRequest, res: Response): Promise<void> {
    const dates = parseDates(req, res);
    if (!dates) return;
    try {
      const business = await prisma.business.findUnique({ where: { id: req.businessId! } });
      const balance  = await ReportService.getFinancialBalance(req.businessId!, dates.startDate, dates.endDate);
      const buffer   = await generateFinancialBalanceExcel(
        balance ?? { totalRevenue: 0, productCost: 0, totalExpenses: 0, netProfit: 0, expenseBreakdown: {} },
        business?.name || "Simxel",
        dates.startDate,
        dates.endDate,
      );
      sendExcel(res, buffer, `Bilan_Financier_${dates.startDate.toISOString().split("T")[0]}.xlsx`);
    } catch (e) { res.status(500).json({ ok: false, error: (e as Error).message }); }
  }
}
