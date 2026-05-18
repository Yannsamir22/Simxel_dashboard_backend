import { Router } from "express";
import { requireBusinessAccess } from "../middlewares/business.middleware.js";
import { checkDashboardSubscription } from "../middlewares/subscription.middleware.js";
import authRouter from "./auth.route.js";
import { businessRouter, ownerRouter } from "./business.route.js";
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
router.use("/businesses/:businessId", requireBusinessAccess, checkDashboardSubscription, businessRouter);

export default router;
