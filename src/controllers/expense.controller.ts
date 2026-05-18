import { Response } from "express";
import { ExpenseService } from "../services/expense.service.js";
import { OwnerRequest } from "../types/auth.js";

export class ExpenseController {
  static async getAll(req: OwnerRequest, res: Response): Promise<void> {
    const data = await ExpenseService.getAll(req.businessId!);
    res.json({ ok: true, data });
  }
  static async getByRange(req: OwnerRequest, res: Response): Promise<void> {
    const { start, end } = req.query;
    if (!start || !end) {
      res
        .status(400)
        .json({ ok: false, error: "start and end query params required." });
      return;
    }
    const data = await ExpenseService.getByRange(
      req.businessId!,
      new Date(start as string),
      new Date(end as string),
    );
    res.json({ ok: true, data });
  }
  static async getById(req: OwnerRequest, res: Response): Promise<void> {
    const data = await ExpenseService.getById(
      req.businessId!,
      req.params.id as string,
    );
    if (!data) {
      res.status(404).json({ ok: false, error: "Expense not found." });
      return;
    }
    res.json({ ok: true, data });
  }
  static async create(req: OwnerRequest, res: Response): Promise<void> {
    const { type, amount, note, date } = req.body;
    if (!type || amount === undefined) {
      res
        .status(400)
        .json({ ok: false, error: "type and amount are required." });
      return;
    }
    const data = await ExpenseService.create(req.businessId!, {
      type,
      amount,
      note,
      date,
    });
    res.status(201).json({ ok: true, data });
  }
  static async update(req: OwnerRequest, res: Response): Promise<void> {
    const data = await ExpenseService.update(
      req.businessId!,
      req.params.id as string,
      req.body,
    );
    res.json({ ok: true, data });
  }
  static async delete(req: OwnerRequest, res: Response): Promise<void> {
    await ExpenseService.delete(req.businessId!, req.params.id as string);
    res.json({ ok: true, message: "Expense deleted." });
  }
}
