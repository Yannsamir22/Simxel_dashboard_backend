import { Request, Response } from "express";
import { AuthService } from "../services/auth.service.js";
import { OwnerRequest } from "../types/auth.js";

export class AuthController {
  static async register(req: Request, res: Response): Promise<void> {
    const { ownerEmail, ownerPassword, ownerName, businessName, businessType, currency } = req.body;
    if (!ownerEmail || !ownerPassword || !businessName) {
      res.status(400).json({ ok: false, error: "ownerEmail, ownerPassword and businessName are required." });
      return;
    }
    const result = await AuthService.register({ ownerEmail, ownerPassword, ownerName, businessName, businessType, currency });
    if (!result.ok) { res.status(409).json(result); return; }
    res.status(201).json(result);
  }

  static async login(req: Request, res: Response): Promise<void> {
    const { email, password } = req.body;
    if (!email || !password) { res.status(400).json({ ok: false, error: "email and password are required." }); return; }
    const result = await AuthService.login(email, password);
    if (!result.ok) { res.status(401).json(result); return; }
    res.status(200).json(result);
  }

  static async getMe(req: OwnerRequest, res: Response): Promise<void> {
    const result = await AuthService.getMe(req.owner!.sub);
    if (!result.ok) { res.status(404).json(result); return; }
    res.status(200).json(result);
  }

  static async changePassword(req: OwnerRequest, res: Response): Promise<void> {
    const { oldPassword, newPassword } = req.body;
    if (!oldPassword || !newPassword) { res.status(400).json({ ok: false, error: "oldPassword and newPassword are required." }); return; }
    const result = await AuthService.changePassword(req.owner!.sub, oldPassword, newPassword);
    if (!result.ok) { res.status(400).json(result); return; }
    res.status(200).json(result);
  }
}
