import { Router } from "express";
import { ReceiptController } from "../controllers/receipt.controller.js";

/**
 * Public receipt routes — NO auth middleware.
 *
 * These routes are intentionally unauthenticated.
 * The saleId is a UUID (unguessable), so only someone who physically
 * holds the printed receipt (with the QR code on it) can access the page.
 *
 * Mounted at: /receipts
 *
 * Routes:
 *   GET /receipts/:saleId   → renders the HTML receipt page
 */
const receiptRouter = Router();

receiptRouter.get("/:saleId", ReceiptController.getReceiptPage as any);

export default receiptRouter;
