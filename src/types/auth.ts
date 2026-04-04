import { Request } from "express";

export interface OwnerPayload {
  sub:   string;   // ownerId
  email: string;
  role:  "OWNER";
  iat?:  number;
  exp?:  number;
}

export interface AuthRequest extends Request {
  owner?:      OwnerPayload;
  businessId?: string;
}

export interface OwnerRequest extends Request {
  owner?:      OwnerPayload;
  businessId?: string;
}
