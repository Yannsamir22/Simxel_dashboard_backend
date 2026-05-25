import { Router } from "express";
import { requireBusinessAccess } from "../middlewares/business.middleware.js";
import { checkDashboardSubscription } from "../middlewares/subscription.middleware.js";
import authRouter from "./auth.route.js";
import { businessRouter, ownerRouter } from "./business.route.js";
import receiptRouter from "./receipt.route.js";
const router = Router();

// POST /api/auth/register
// POST /api/auth/login
// GET  /api/auth/me
// PUT  /api/auth/password
router.use("/auth", authRouter);

// GET  /api/businesses  (list owner's businesses)
router.use("/businesses", ownerRouter);

// GET/PUT /api/businesses/:businessId
// + all sub-resources (employees, products, services, packages, expenses, stock, sales, reports)
router.use(
  "/businesses/:businessId",
  requireBusinessAccess,
  checkDashboardSubscription,
  businessRouter,
);

// GET /api/receipts/:saleId  — public, no auth, for QR code scanning
// Returns a fully rendered HTML receipt page viewable on any phone browser.
router.use("/receipts", receiptRouter);

export default router;
