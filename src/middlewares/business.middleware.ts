import { NextFunction, Response } from "express";
import prisma from "../config/db.js";
import { AuthRequest } from "../types/auth.js";

export async function requireBusinessAccess(req: AuthRequest, res: Response, next: NextFunction) {
      const businessId = req.params.businessId || req.query.businessId as string;
      if(!businessId) {
            return res.status(400).json({message: "businessId is required"})
      }

      // Verify this business belongs to the authenticated owner
      const business = await prisma.business.findUnique({
      where: {id: String(businessId)},
      select: {id: true, ownerId: true, isActivated: true}

      })

      if(!business){
      return res.status(404).json({message: "Business not found"})

      }

      if(business.ownerId !== req.owner!.sub){
            return res.status(403).json({message: "Access denied"})

      }
      // Attach businessId to request so services never read it from client body
  req.businessId = business.id;
  next();
}