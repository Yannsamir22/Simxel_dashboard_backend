import { Response, NextFunction } from "express";
import { verifyOwnerToken } from "../utils/jwt.js";
import { OwnerRequest } from "../types/auth.js";
import prisma from "../config/db.js";

// 1. Verify JWT — inject req.owner
export const requireOwner = (req: OwnerRequest, res: Response, next: NextFunction): void => {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) {
    res.status(401).json({ ok: false, error: "No token provided." });
    return;
  }
  try {
    req.owner = verifyOwnerToken(auth.split(" ")[1]);
    next();
  } catch {
    res.status(401).json({ ok: false, error: "Invalid or expired token." });
  }
};

// 2. Verify business ownership — inject req.businessId
export const requireBusiness = async (req: OwnerRequest, res: Response, next: NextFunction): Promise<void> => {
  const { businessId } = req.params;
  if (!businessId) {
    res.status(400).json({ ok: false, error: "businessId is required." });
    return;
  }
  try {
    const business = await prisma.business.findUnique({ where: { id: businessId } });
    if (!business) {
      res.status(404).json({ ok: false, error: "Business not found." });
      return;
    }
    if (business.ownerId !== req.owner!.sub) {
      res.status(403).json({ ok: false, error: "Access denied." });
      return;
    }
    req.businessId = businessId;
    next();
  } catch (error) {
    res.status(500).json({ ok: false, error: (error as Error).message });
  }
};
