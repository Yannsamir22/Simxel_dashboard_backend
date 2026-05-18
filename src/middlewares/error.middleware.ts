import { Request, Response, NextFunction } from "express";
import { sanitizeDatabaseError } from "../utils/sanitize.js";

export const errorHandler = (err: any, _req: Request, res: Response, _next: NextFunction): void => {
  console.error("[ERROR]", err);
  res.status(err.status || 500).json({
    ok:    false,
    error: sanitizeDatabaseError(err),
  });
};
