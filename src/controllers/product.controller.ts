import { Response } from "express";
import { OwnerRequest } from "../types/auth.js";
import { ProductService } from "../services/product.service.js";
import prisma from "../config/db.js";

export class ProductController {
  static async getAll(req: OwnerRequest, res: Response): Promise<void> {
    const data = await ProductService.getAll(req.businessId!);
    res.json({ ok: true, data });
  }
  static async getLowStock(req: OwnerRequest, res: Response): Promise<void> {
    const data = await prisma.product.findMany({
      where: {
        businessId: req.businessId!,
        isDeleted: false,
        stock: { lte: prisma.product.fields.minStockAlert as any },
      },
    });
    // Prisma doesn't support field-to-field comparison directly, do it in JS
    const products = await prisma.product.findMany({ where: { businessId: req.businessId!, isDeleted: false } });
    const lowStock = products.filter((p) => p.stock <= p.minStockAlert);
    res.json({ ok: true, data: lowStock });
  }
  static async getById(req: OwnerRequest, res: Response): Promise<void> {
    const data = await ProductService.getById(req.businessId!, req.params.id);
    if (!data) { res.status(404).json({ ok: false, error: "Product not found." }); return; }
    res.json({ ok: true, data });
  }
  static async create(req: OwnerRequest, res: Response): Promise<void> {
    const { name, salePrice, unitCost, stock, minStockAlert } = req.body;
    if (!name || salePrice === undefined) {
      res.status(400).json({ ok: false, error: "name and salePrice are required." }); return;
    }
    const data = await ProductService.create(req.businessId!, { name, salePrice, unitCost, stock, minStockAlert });
    res.status(201).json({ ok: true, data });
  }
  static async update(req: OwnerRequest, res: Response): Promise<void> {
    const data = await ProductService.update(req.businessId!, req.params.id, req.body);
    res.json({ ok: true, data });
  }
  static async delete(req: OwnerRequest, res: Response): Promise<void> {
    await ProductService.delete(req.businessId!, req.params.id);
    res.json({ ok: true, message: "Product deleted." });
  }
}
