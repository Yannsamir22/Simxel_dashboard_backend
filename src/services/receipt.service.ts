import prisma from "../config/db.js";

// ─────────────────────────────────────────────────────────────────────────────
// Prisma include
// ─────────────────────────────────────────────────────────────────────────────

const RECEIPT_INCLUDE = {
  business: { select: { name: true, currency: true, type: true } },
  employee: { select: { name: true } },
  saleItems: {
    include: {
      product: { select: { name: true } },
      service: { select: { name: true } },
      package: { select: { name: true } },
      employee: { select: { name: true } },
    },
  },
  paymentTypes: { select: { method: true, amount: true } },
} as const;

export type SaleForReceipt = NonNullable<
  Awaited<ReturnType<typeof ReceiptService.getSaleForReceipt>>
>;

// ─────────────────────────────────────────────────────────────────────────────
// Formatting helpers
// ─────────────────────────────────────────────────────────────────────────────

function fmtCurrency(amount: number, currency = "FCFA"): string {
  return `${amount.toLocaleString("fr-FR")} ${currency}`;
}

function fmtDate(iso: string | Date): { date: string; time: string } {
  const d = new Date(iso);
  return {
    date: d.toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }),
    time: d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }),
  };
}

function trunc(str: string, maxLen: number): string {
  if (!str) return "";
  return str.length > maxLen ? str.slice(0, maxLen - 1) + "…" : str;
}

// ─────────────────────────────────────────────────────────────────────────────
// Receipt service
// ─────────────────────────────────────────────────────────────────────────────

export class ReceiptService {
  /**
   * Fetch a sale by ID. No businessId check — route is public and saleId is
   * a UUID (unguessable), so only the QR holder can access it.
   */
  static async getSaleForReceipt(saleId: string) {
    return prisma.sale.findUnique({
      where: { id: saleId },
      include: RECEIPT_INCLUDE,
    });
  }

  /**
   * buildReceiptHTML()
   *
   * Renders the mobile receipt page served to the phone browser.
   *
   * When the sale IS synced (normal case):
   *   The controller calls this directly and returns the HTML.
   *   The page shows a green "✓ Reçu vérifié" badge.
   *
   * When the sale is NOT yet synced:
   *   The controller returns a 404.
   *   The receipt.route.ts landing page catches that and renders
   *   the embedded fallback HTML that was baked into the QR page at print time.
   *   The page shows an orange "⏳ En attente de synchronisation" badge.
   *
   * Both paths show identical receipt data — the badge is the only difference.
   */
  static buildReceiptHTML(sale: SaleForReceipt): string {
    const currency = sale.business?.currency ?? "FCFA";
    const bizName = sale.business?.name ?? "Simxel POS";
    const bizType = sale.business?.type ?? "";
    const { date, time } = fmtDate(sale.saleDate);
    const shortId = sale.id.slice(0, 8).toUpperCase();
    const cashier = sale.employee?.name ?? null;

    const itemRows = (sale.saleItems as any[])
      .map((item) => {
        const name = trunc(
          item.product?.name ??
            item.service?.name ??
            item.package?.name ??
            "Article",
          26,
        );
        const empBadge = item.employee?.name
          ? `<div class="emp">Réalisé par: ${item.employee.name}</div>`
          : "";
        return `
        <tr>
          <td class="td-name">${name}${empBadge}</td>
          <td class="td-qty">x${item.quantity}</td>
          <td class="td-tot">${fmtCurrency(item.total, currency)}</td>
        </tr>`;
      })
      .join("");

    const payRows = (sale.paymentTypes as any[])
      .map(
        (p) => `
      <tr>
        <td class="pay-label">${p.method}</td>
        <td class="pay-amount">${fmtCurrency(p.amount, currency)}</td>
      </tr>`,
      )
      .join("");

    return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Reçu ${shortId} — ${bizName}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: "Courier New", Courier, monospace;
      font-size: 14px; color: #1a1a1a; background: #f5f5f0;
      min-height: 100vh; display: flex; justify-content: center;
      align-items: flex-start; padding: 20px 12px 48px;
    }
    .receipt {
      background: #fff; width: 100%; max-width: 420px; border-radius: 4px;
      box-shadow: 0 2px 16px rgba(0,0,0,.10); padding: 24px 20px 20px;
      border-top: 4px solid #111;
    }
    .biz-name { text-align: center; font-size: 20px; font-weight: bold; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 2px; }
    .biz-type { text-align: center; font-size: 11px; color: #666; margin-bottom: 12px; }
    .badge-verified {
      display: inline-flex; align-items: center; gap: 4px;
      background: #f0fff4; border: 1px solid #9ae6b4; color: #276749;
      font-size: 10px; padding: 3px 8px; border-radius: 99px; margin-bottom: 10px;
    }
    hr { border: none; border-top: 1px dashed #bbb; margin: 10px 0; }
    hr.solid  { border-top: 1px solid #bbb; }
    hr.double { border-top: 3px double #555; }
    .meta { font-size: 12px; line-height: 1.8; margin: 8px 0; }
    .meta-row { display: flex; justify-content: space-between; font-size: 12px; }
    table { width: 100%; border-collapse: collapse; }
    thead th {
      font-size: 10px; text-transform: uppercase; letter-spacing: .4px;
      padding-bottom: 4px; border-bottom: 1px solid #555; color: #555;
    }
    .th-name { text-align: left; width: 55%; }
    .th-qty  { text-align: center; width: 13%; }
    .th-tot  { text-align: right; width: 32%; }
    tbody td { padding: 4px 0; vertical-align: top; }
    .td-name { text-align: left; width: 55%; padding-right: 4px; line-height: 1.4; }
    .td-qty  { text-align: center; width: 13%; }
    .td-tot  { text-align: right; width: 32%; white-space: nowrap; }
    .emp { font-size: 10px; font-weight: bold; text-transform: uppercase; color: #555; margin-top: 2px; }
    .totals td { padding: 2px 0; }
    .total-label { text-align: left; }
    .total-value { text-align: right; white-space: nowrap; }
    .grand td { font-size: 17px; font-weight: bold; padding-top: 4px; }
    .pay-header { font-size: 10px; text-transform: uppercase; letter-spacing: .5px; color: #777; margin: 6px 0 2px; }
    .pay-label  { text-align: left; }
    .pay-amount { text-align: right; white-space: nowrap; }
    .footer { text-align: center; margin-top: 16px; }
    .proverb { font-style: italic; font-size: 11px; line-height: 1.5; color: #666; margin-bottom: 10px; }
    .thank-you { font-size: 15px; font-weight: bold; margin-bottom: 3px; }
    .brand { font-size: 10px; color: #aaa; margin-top: 6px; }
  </style>
</head>
<body>
  <div class="receipt">
    <div class="biz-name">${bizName}</div>
    ${bizType ? `<div class="biz-type">${bizType}</div>` : ""}
    <div style="text-align:center">
      <span class="badge-verified">✓ Reçu vérifié</span>
    </div>
    <hr class="solid"/>
    <div class="meta">
      <div class="meta-row">
        <span>Date: ${date}</span>
        <span>${time}</span>
      </div>
      <div>Reçu N°: <strong>${shortId}</strong></div>
      ${cashier ? `<div style="font-size:12px;color:#555">Caissier: ${cashier}</div>` : ""}
    </div>
    <hr/>
    <table>
      <thead>
        <tr>
          <th class="th-name">Article</th>
          <th class="th-qty">Qté</th>
          <th class="th-tot">Total</th>
        </tr>
      </thead>
      <tbody>${itemRows}</tbody>
    </table>
    <hr class="double"/>
    <table class="totals">
      <tr class="grand">
        <td class="total-label">TOTAL</td>
        <td class="total-value">${fmtCurrency(sale.totalAmount, currency)}</td>
      </tr>
    </table>
    <hr/>
    <div class="pay-header">Règlement</div>
    <table><tbody>${payRows}</tbody></table>
    <hr/>
    <div class="footer">
      <div class="proverb">
        "Commit your work to the Lord,<br/>and your plans will be established."<br/>
        <strong style="opacity:.5">— PROVERBS 16:3</strong>
      </div>
      <div class="thank-you">Merci / Thank you!</div>
      <div class="brand">Propulsé par Simxel</div>
    </div>
  </div>
</body>
</html>`;
  }
}
