import { Request } from "express";

export interface OwnerPayload {
  sub:   string;   // ownerId
  email: string;
  role:  "OWNER";
  iat?:  number;
  exp?:  number;
}

export interface OwnerRequest extends Request {
  owner?:      OwnerPayload;
  businessId?: string;
}
