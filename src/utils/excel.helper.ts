import ExcelJS from "exceljs";

const fmtDate = (d: Date) => new Date(d).toLocaleDateString("fr-FR", { day:"2-digit", month:"2-digit", year:"numeric" });
const fmtCur  = (n: number) => n.toLocaleString("fr-FR") + " FCFA";

const HEADER_DARK  = "0D1F3C";
const HEADER_BLUE  = "1F4E78";
const HEADER_GREEN = "1A5E1A";
const ROW_EVEN     = "F2F2F2";
const WHITE        = "FFFFFF";
const GREEN        = "1B5E20";
const RED_BG       = "FDE8E8";
const RED_TEXT     = "C62828";

function thin(c = "CCCCCC"): Partial<ExcelJS.Borders> {
  const s = { style: "thin" as ExcelJS.BorderStyle, color: { argb: c } };
  return { top: s, bottom: s, left: s, right: s };
}

function styleHeader(cell: ExcelJS.Cell, bg = HEADER_DARK) {
  cell.font      = { bold: true, color: { argb: WHITE }, size: 11 };
  cell.fill      = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
  cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  cell.border    = thin();
}

function styleRow(row: ExcelJS.Row, even: boolean) {
  row.eachCell((c) => {
    c.fill   = { type: "pattern", pattern: "solid", fgColor: { argb: even ? ROW_EVEN : WHITE } };
    c.border = thin();
    c.alignment = { vertical: "middle", wrapText: true };
  });
}

function styleTotalRow(row: ExcelJS.Row) {
  row.eachCell((c) => {
    c.font = { bold: true, color: { argb: WHITE }, size: 11 };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_DARK } };
    c.border = thin();
  });
}

function addTitleBlock(sheet: ExcelJS.Worksheet, cols: number, title: string, sub: string) {
  const colLetter = String.fromCharCode(64 + cols);
  sheet.mergeCells(`A1:${colLetter}1`);
  const t = sheet.getCell("A1");
  t.value     = title;
  t.font      = { bold: true, size: 16, color: { argb: WHITE } };
  t.fill      = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_DARK } };
  t.alignment = { horizontal: "center", vertical: "middle" };
  sheet.getRow(1).height = 30;

  sheet.mergeCells(`A2:${colLetter}2`);
  const s = sheet.getCell("A2");
  s.value     = sub;
  s.font      = { italic: true, size: 11, color: { argb: HEADER_BLUE } };
  s.alignment = { horizontal: "center", vertical: "middle" };
  sheet.getRow(2).height = 20;
}

// ── 1. Sales Journal ──────────────────────────────────────────────────────
export async function generateSalesJournalExcel(sales: any[], businessName: string): Promise<Buffer> {
  const wb    = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet("Journal des Ventes");
  sheet.columns = [
    { key: "date",    width: 14 },
    { key: "ref",     width: 12 },
    { key: "items",   width: 42 },
    { key: "cashier", width: 18 },
    { key: "payment", width: 32 },
    { key: "total",   width: 18 },
  ];
  addTitleBlock(sheet, 6, "JOURNAL DES VENTES", businessName);
  const hRow = sheet.addRow(["DATE", "RÉFÉRENCE", "ARTICLES", "CAISSIER", "PAIEMENTS", "TOTAL"]);
  hRow.eachCell((c) => styleHeader(c));
  sheet.getRow(3).height = 20;

  sales.forEach((sale, i) => {
    const articles = (sale.saleItems ?? []).map((item: any) =>
      `${item.product?.name ?? item.service?.name ?? item.package?.name ?? "?"} (x${item.quantity || 1})`
    ).join(", ") || "—";

    const payments = (sale.paymentTypes ?? []).map((p: any) => `${p.method}: ${fmtCur(p.amount)}`).join(" / ") || "—";

    const row = sheet.addRow([
      fmtDate(sale.saleDate),
      sale.id.substring(0, 8).toUpperCase(),
      articles,
      sale.employee?.name ?? "—",
      payments,
      sale.totalAmount,
    ]);
    styleRow(row, i % 2 === 0);
    row.getCell(6).numFmt    = '#,##0 " FCFA"';
    row.getCell(6).alignment = { horizontal: "right", vertical: "middle" };
  });

  const lastData = sales.length + 3;
  const tot = sheet.addRow(["", "", "", "", "TOTAL", { formula: `SUM(F4:F${lastData})` }]);
  styleTotalRow(tot);
  tot.getCell(6).numFmt    = '#,##0 " FCFA"';
  tot.getCell(6).alignment = { horizontal: "right" };
  return Buffer.from(await wb.xlsx.writeBuffer());
}

// ── 2. Staff Performance ──────────────────────────────────────────────────
export async function generateStaffPerformanceExcel(
  staffData: any[], businessName: string, startDate: Date, endDate: Date,
): Promise<Buffer> {
  const wb    = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet("Performance Staff");
  sheet.columns = [
    { key: "name",  width: 26 },
    { key: "count", width: 16 },
    { key: "gen",   width: 22 },
    { key: "comm",  width: 22 },
  ];
  const period = `${fmtDate(startDate)} -> ${fmtDate(endDate)}`;
  addTitleBlock(sheet, 4, "RAPPORT DE PERFORMANCE STAFF", `${businessName}  ·  ${period}`);
  const hRow = sheet.addRow(["EMPLOYÉ", "PRESTATIONS", "CHIFFRE D'AFFAIRES", "COMMISSION"]);
  hRow.eachCell((c) => styleHeader(c, HEADER_GREEN));
  sheet.getRow(3).height = 20;

  let totalGen = 0, totalComm = 0;
  staffData.forEach((emp, i) => {
    totalGen  += emp.totalGenerated;
    totalComm += emp.commission;
    const row = sheet.addRow([emp.employeeName, emp.prestationCount, emp.totalGenerated, emp.commission]);
    styleRow(row, i % 2 === 0);
    row.getCell(2).alignment = { horizontal: "center", vertical: "middle" };
    [3, 4].forEach((c) => { row.getCell(c).numFmt = '#,##0 " FCFA"'; row.getCell(c).alignment = { horizontal: "right", vertical: "middle" }; });
  });

  const tot = sheet.addRow(["TOTAL", staffData.reduce((s, e) => s + e.prestationCount, 0), totalGen, totalComm]);
  styleTotalRow(tot);
  tot.getCell(2).alignment = { horizontal: "center" };
  [3, 4].forEach((c) => { tot.getCell(c).numFmt = '#,##0 " FCFA"'; tot.getCell(c).alignment = { horizontal: "right" }; });
  return Buffer.from(await wb.xlsx.writeBuffer());
}

// ── 3. Stock Status ───────────────────────────────────────────────────────
export async function generateStockStatusExcel(stockData: any[], businessName: string): Promise<Buffer> {
  const wb    = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet("État des Stocks");
  sheet.columns = [
    { key: "name",   width: 32 },
    { key: "stock",  width: 16 },
    { key: "alert",  width: 16 },
    { key: "status", width: 14 },
  ];
  addTitleBlock(sheet, 4, "ÉTAT DES STOCKS", businessName);
  const hRow = sheet.addRow(["PRODUIT", "STOCK ACTUEL", "SEUIL D'ALERTE", "STATUT"]);
  hRow.eachCell((c) => styleHeader(c, "5D4037"));
  sheet.getRow(3).height = 20;

  stockData.forEach((p, i) => {
    const isAlert = p.status === "ALERT";
    const row = sheet.addRow([p.productName, p.currentStock, p.minStockAlert, isAlert ? "⚠ ALERTE" : "✓ OK"]);
    styleRow(row, i % 2 === 0);
    if (isAlert) {
      row.eachCell((c) => { c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: RED_BG } }; });
      row.getCell(4).font = { bold: true, color: { argb: RED_TEXT } };
    } else {
      row.getCell(4).font = { bold: true, color: { argb: GREEN } };
    }
    [2, 3, 4].forEach((c) => { row.getCell(c).alignment = { horizontal: "center", vertical: "middle" }; });
  });
  return Buffer.from(await wb.xlsx.writeBuffer());
}

// ── 4. Financial Balance ──────────────────────────────────────────────────
export async function generateFinancialBalanceExcel(
  balance: { totalRevenue: number; productCost: number; totalExpenses: number; netProfit: number; expenseBreakdown: Record<string, number> },
  businessName: string, startDate: Date, endDate: Date,
): Promise<Buffer> {
  const wb    = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet("Bilan Financier");
  sheet.columns = [{ key: "label", width: 32 }, { key: "amount", width: 24 }];
  const period = `${fmtDate(startDate)} -> ${fmtDate(endDate)}`;
  addTitleBlock(sheet, 2, "BILAN FINANCIER", `${businessName}  ·  ${period}`);

  const addSection = (title: string, rows: [string, number][], bg: string) => {
    const h = sheet.addRow([title, ""]);
    sheet.mergeCells(`A${h.number}:B${h.number}`);
    styleHeader(h.getCell(1), bg);
    rows.forEach(([label, amount], i) => {
      const row = sheet.addRow([label, amount]);
      styleRow(row, i % 2 === 0);
      row.getCell(2).numFmt    = '#,##0 " FCFA"';
      row.getCell(2).alignment = { horizontal: "right", vertical: "middle" };
    });
  };

  addSection("REVENUS", [["Total des ventes", balance.totalRevenue]], "1565C0");
  addSection("COÛT DES PRODUITS", [["Coût d'achat", balance.productCost]], "6A1A1A");
  addSection("DÉPENSES OPÉRATIONNELLES",
    Object.entries(balance.expenseBreakdown).sort(([, a], [, b]) => b - a),
    "C62828",
  );

  const profitRow = sheet.addRow(["BÉNÉFICE NET", balance.netProfit]);
  profitRow.eachCell((c) => {
    c.font      = { bold: true, size: 13, color: { argb: WHITE } };
    c.fill      = { type: "pattern", pattern: "solid", fgColor: { argb: balance.netProfit >= 0 ? "1B5E20" : "B71C1C" } };
    c.border    = thin();
    c.alignment = { vertical: "middle" };
  });
  profitRow.getCell(2).numFmt    = '#,##0 " FCFA"';
  profitRow.getCell(2).alignment = { horizontal: "right", vertical: "middle" };
  profitRow.height = 26;

  return Buffer.from(await wb.xlsx.writeBuffer());
}
