import { Request, Response } from "express";
import { ReceiptService } from "../services/receipt.service.js";

export class ReceiptController {
  /**
   * GET /receipts/:saleId
   *
   * Public route — no auth required.
   * Returns a fully rendered HTML receipt page the phone browser can display.
   *
   * The saleId comes from the QR code printed on the thermal receipt.
   * Anyone who physically holds the receipt can scan it and view it offline-style
   * (the URL itself works without auth, but the sale data is looked up server-side).
   */

  static async getReceiptPage(req: Request, res: Response) {
    const { saleId } = req.params;

    const sale = await ReceiptService.getSaleForReceipt(saleId as string);

    if (!sale) {
      return;
    }

    const html = ReceiptService.buildReceiptHTML(sale);
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(html);
  }
}
