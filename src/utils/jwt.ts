import jwt from "jsonwebtoken";
import { OwnerPayload } from "../types/auth.js";

const secret = () => {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error("JWT_SECRET is not set in environment variables.");
  return s;
};

export const signOwnerToken = (payload: Omit<OwnerPayload, "iat" | "exp">): string =>
  jwt.sign(payload, secret(), { expiresIn: process.env.JWT_EXPIRES_IN || "7d" });

export const verifyOwnerToken = (token: string): OwnerPayload =>
  jwt.verify(token, secret()) as OwnerPayload;
