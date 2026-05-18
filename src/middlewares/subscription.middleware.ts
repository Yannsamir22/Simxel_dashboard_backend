import { NextFunction, Response } from "express";
import prisma from "../config/db.js";
import { AuthRequest } from "../types/auth.js";

/**
 * Middleware checking if the business has an active cloud dashboard subscription.
 * Gated only on /businesses/:businessId routes.
 * Does NOT block POS sync or raw auth routes.
 */
export async function checkDashboardSubscription(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const businessId = req.businessId;
    if (!businessId) {
      return res.status(400).json({ ok: false, error: "Business ID is required." });
    }

    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: {
        id: true,
        isActivated: true,
        dashboardExpiresAt: true,
        planType: true,
      },
    });

    if (!business) {
      return res.status(404).json({ ok: false, error: "Business not found." });
    }

    // 1. If POS is not activated at all (still PENDING), let it pass to allow frontend
    // to load select-business or display the PendingActivationPage.
    // (Actual gating is handled on frontend using isActivated/planType status).
    if (!business.isActivated && business.planType === "PENDING") {
      return next();
    }

    // 2. Check if dashboard subscription is active
    const now = new Date();
    if (!business.dashboardExpiresAt || new Date(business.dashboardExpiresAt) < now) {
      return res.status(403).json({
        ok: false,
        code: "DASHBOARD_EXPIRED",
        message: "Votre abonnement au tableau de bord cloud a expiré. Votre caisse physique fonctionne toujours parfaitement en mode hors-ligne et en ligne.",
        action: "Veuillez contacter le support Simxel pour renouveler votre accès.",
        whatsapp: "+237 688185548",
      });
    }

    next();
  } catch (err: any) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}
