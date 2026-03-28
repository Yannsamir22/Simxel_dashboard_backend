import { Request, Response } from "express";
import { AuthService } from "../services/auth.service.js";
import { OwnerRequest } from "../types/auth.js";

export class AuthController {
  static async register(req: Request, res: Response): Promise<void> {
    const {
      ownerEmail,
      ownerPassword,
      ownerName,
      businessName,
      businessType,
      currency,
    } = req.body;
    if (!ownerEmail || !ownerPassword || !businessName) {

      res.status(400).json({
        ok: false,
        error: "ownerEmail, ownerPassword and businessName are required.",
      });
      return;
    }
    const result = await AuthService.register({
      ownerEmail,
      ownerPassword,
      ownerName,
      businessName,
      businessType,
      currency,
    });
    if (!result.ok) {
      const status = result.error.includes("already exists") ? 409 : 400;
      res.status(status).json(result);
      return;
    }
    res.status(201).json(result);
  }

  static async verifyEmail(req: Request, res: Response): Promise<void> {
    // Home site sends `ownerEmail` — destructure and alias to `email`
    const { ownerEmail: email, code } = req.body;

    if (!email || !code) {
      res.status(400).json({ ok: false, error: "Email and code are required." })

      return
    }
    if (String(code).trim().length !== 6) {
      res.status(400).json({ ok: false, error: "The verification code must be exactly 6 digits." })
      return
    }

    const result = await AuthService.verifyEmail(email, String(code).trim());

    if (!result.ok) {
      res.status(400).json(result)
      return
    }
    res.status(200).json(result)

  }

  static async resendCode(req: Request, res: Response): Promise<void> {
    // Home site sends `ownerEmail` — alias to `email` for consistency
    const { ownerEmail: email } = req.body;

    if (!email) {
      res.status(400).json({ ok: false, error: "ownerEmail is required." });
      return;
    }

    const result = await AuthService.resendCode(email);

    if (!result.ok) {
      // 429 for cooldown, 400 for everything else
      const status = result.error?.includes("wait") ? 429 : 400;
      res.status(status).json(result);
      return;
    }

    res.status(200).json(result);
  }

  static async login(req: Request, res: Response): Promise<void> {
    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400).json({ ok: false, error: "email and password are required." });
      return;
    }
    const result = await AuthService.login(email, password);
    if (!result.ok) {
      const status = (result as any).error === "EMAIL_NOT_VERIFIED" ? 403 : 400
      res.status(status).json(result);
      return;
    }
    res.status(200).json(result);
  }

  // POST /api/auth/google
  static async googleAuth(req: Request, res: Response): Promise<void> {
    const { idToken, businessName } = req.body;

    if (!idToken) {
      res.status(400).json({ ok: false, error: "idToken is required." });
      return;
    }

    const result = await AuthService.googleAuth(idToken, businessName);

    if (!result.ok) {
      if (result.error === "BUSINESS_NAME_REQUIRED") {
        res.status(200).json(result); // 200 so the frontend can handle the UI step
        return;
      }
      res.status(401).json(result);
      return;
    }

    res.status(200).json(result);
  }

  static async getMe(req: OwnerRequest, res: Response): Promise<void> {
    const result = await AuthService.getMe(req.owner!.sub);
    if (!result.ok) {
      res.status(404).json(result);
      return;
    }
    res.status(200).json(result);
  }

  static async changePassword(req: OwnerRequest, res: Response): Promise<void> {
    const { oldPassword, newPassword } = req.body;
    if (!oldPassword || !newPassword) {
      res.status(400).json({
        ok: false,
        error: "oldPassword and newPassword are required.",
      });
      return;
    }
    const result = await AuthService.changePassword(
      req.owner!.sub,
      oldPassword ?? "",
      newPassword,
    );
    if (!result.ok) {
      res.status(400).json(result);
      return;
    }
    res.status(200).json(result);
  }
}
