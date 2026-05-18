import { Response } from "express";
import { EmployeeService } from "../services/employee.service.js";
import { OwnerRequest } from "../types/auth.js";

export class EmployeeController {
  static async getAll(req: OwnerRequest, res: Response): Promise<void> {
    const data = await EmployeeService.getAll(req.businessId!);
    res.json({ ok: true, data });
  }
  static async getById(req: OwnerRequest, res: Response): Promise<void> {
    const data = await EmployeeService.getById(
      req.businessId!,
      req.params.id as string,
    );
    if (!data) {
      res.status(404).json({ ok: false, error: "Employee not found." });
      return;
    }
    res.json({ ok: true, data });
  }
  static async create(req: OwnerRequest, res: Response): Promise<void> {
    const { name, role, dateOfBirth, commissionRate } = req.body;
    if (!name) {
      res.status(400).json({ ok: false, error: "name is required." });
      return;
    }
    const data = await EmployeeService.create(req.businessId!, {
      name,
      role,
      dateOfBirth,
      commissionRate,
    });
    res.status(201).json({ ok: true, data });
  }
  static async update(req: OwnerRequest, res: Response): Promise<void> {
    const data = await EmployeeService.update(
      req.businessId!,
      req.params.id as string as string,
      req.body,
    );
    res.json({ ok: true, data });
  }
  static async delete(req: OwnerRequest, res: Response): Promise<void> {
    await EmployeeService.delete(
      req.businessId!,
      req.params.id as string as string,
    );
    res.json({ ok: true, message: "Employee deleted." });
  }
}
