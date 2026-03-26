import { Request, Response, NextFunction } from "express";

export const errorHandler = (err: any, _req: Request, res: Response, _next: NextFunction): void => {
  console.error("[ERROR]", err);
  res.status(err.status || 500).json({
    ok:    false,
    error: process.env.NODE_ENV === "development" ? err.message : "Internal server error.",
  });
};
