import { Router } from "express";
import { BusinessController } from "../controllers/business.controller.js";
import { EmployeeController } from "../controllers/employee.controller.js";
import { ProductController  } from "../controllers/product.controller.js";
import { ServiceController  } from "../controllers/service.controller.js";
import { PackageController  } from "../controllers/package.controller.js";
import { ExpenseController  } from "../controllers/expense.controller.js";
import { StockController    } from "../controllers/stock.controller.js";
import { SaleController     } from "../controllers/sale.controller.js";
import { ReportController   } from "../controllers/report.controller.js";
import { requireOwner, requireBusiness } from "../middlewares/auth.middleware.js";

// ── Owner-level business routes (no :businessId) ──────────────────────────
export const ownerRouter = Router();
ownerRouter.use(requireOwner as any);
ownerRouter.get("/", BusinessController.getMyBusinesses as any);

// ── Business-scoped routes (/businesses/:businessId/...) ──────────────────
export const businessRouter = Router({ mergeParams: true });
businessRouter.use(requireOwner as any, requireBusiness as any);

// Business info & POS config
businessRouter.get ("/",                           BusinessController.getOne              as any);
businessRouter.put ("/",                           BusinessController.update              as any);
businessRouter.get ("/pos-config",                 BusinessController.getPosConfigStatus  as any);
businessRouter.post("/pos-config/reset",           BusinessController.resetPosPasswords   as any);
businessRouter.put ("/pos-config/main-password",   BusinessController.changePosMainPassword  as any);
businessRouter.put ("/pos-config/admin-password",  BusinessController.changePosAdminPassword as any);

// Employees
businessRouter.get   ("/employees",     EmployeeController.getAll   as any);
businessRouter.get   ("/employees/:id", EmployeeController.getById  as any);
businessRouter.post  ("/employees",     EmployeeController.create   as any);
businessRouter.put   ("/employees/:id", EmployeeController.update   as any);
businessRouter.delete("/employees/:id", EmployeeController.delete   as any);

// Products
businessRouter.get   ("/products",           ProductController.getAll      as any);
businessRouter.get   ("/products/low-stock", ProductController.getLowStock as any);
businessRouter.get   ("/products/:id",       ProductController.getById     as any);
businessRouter.post  ("/products",           ProductController.create      as any);
businessRouter.put   ("/products/:id",       ProductController.update      as any);
businessRouter.delete("/products/:id",       ProductController.delete      as any);

// Services
businessRouter.get   ("/services",     ServiceController.getAll  as any);
businessRouter.get   ("/services/:id", ServiceController.getById as any);
businessRouter.post  ("/services",     ServiceController.create  as any);
businessRouter.put   ("/services/:id", ServiceController.update  as any);
businessRouter.delete("/services/:id", ServiceController.delete  as any);

// Packages
businessRouter.get   ("/packages",     PackageController.getAll  as any);
businessRouter.get   ("/packages/:id", PackageController.getById as any);
businessRouter.post  ("/packages",     PackageController.create  as any);
businessRouter.put   ("/packages/:id", PackageController.update  as any);
businessRouter.delete("/packages/:id", PackageController.delete  as any);

// Expenses
businessRouter.get   ("/expenses",       ExpenseController.getAll      as any);
businessRouter.get   ("/expenses/range", ExpenseController.getByRange  as any);
businessRouter.get   ("/expenses/:id",   ExpenseController.getById     as any);
businessRouter.post  ("/expenses",       ExpenseController.create      as any);
businessRouter.put   ("/expenses/:id",   ExpenseController.update      as any);
businessRouter.delete("/expenses/:id",   ExpenseController.delete      as any);

// Stock
businessRouter.get ("/stock",                    StockController.getAll      as any);
businessRouter.get ("/stock/product/:productId", StockController.getByProduct as any);
businessRouter.post("/stock/adjust",             StockController.adjust       as any);

// Sales (read-only from Dashboard)
businessRouter.get("/sales",            SaleController.getAll   as any);
businessRouter.get("/sales/stats",      SaleController.getStats as any);
businessRouter.get("/sales/year/:year", SaleController.getByYear as any);
businessRouter.get("/sales/:id",        SaleController.getById  as any);

// Reports — JSON
businessRouter.get("/reports/summary",           ReportController.getSalesSummary    as any);
businessRouter.get("/reports/top-items",         ReportController.getTopItems        as any);
businessRouter.get("/reports/staff-performance", ReportController.getStaffPerformance as any);
businessRouter.get("/reports/financial-balance", ReportController.getFinancialBalance as any);
businessRouter.get("/reports/stock-status",      ReportController.getStockStatus     as any);

// Reports — Excel exports
businessRouter.get("/reports/export/sales-journal",      ReportController.exportSalesJournal     as any);
businessRouter.get("/reports/export/staff-performance",  ReportController.exportStaffPerformance as any);
businessRouter.get("/reports/export/stock-status",       ReportController.exportStockStatus      as any);
businessRouter.get("/reports/export/financial-balance",  ReportController.exportFinancialBalance as any);
