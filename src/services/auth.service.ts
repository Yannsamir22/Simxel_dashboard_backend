import prisma from "../config/db.js";
import { signOwnerToken } from "../utils/jwt.js";
import { hashPassword, verifyPassword } from "../utils/password.js";
import { generateSecretKey } from "../utils/generateSecretKey.js";

export class AuthService {
  // ── Register owner + first business ──────────────────────────────────────
  static async register(data: {
    ownerEmail:    string;
    ownerPassword: string;
    ownerName?:    string;
    businessName:  string;
    businessType?: string;
    currency?:     string;
  }) {
    const existing = await prisma.owner.findUnique({ where: { email: data.ownerEmail } });
    if (existing) return { ok: false as const, error: "An account with this email already exists." };

    const passwordHash = await hashPassword(data.ownerPassword);
    const secretKey    = generateSecretKey();

    const owner = await prisma.owner.create({
      data: {
        email:        data.ownerEmail,
        passwordHash,
        name:         data.ownerName || "",
        businesses: {
          create: {
            name:      data.businessName,
            currency:  data.currency   || "FCFA",
            type:      data.businessType || "SERVICE",
            secretKey,
          },
        },
      },
      include: { businesses: true },
    });

    const token = signOwnerToken({ sub: owner.id, email: owner.email, role: "OWNER" });

    return {
      ok:         true as const,
      token,
      owner:      { id: owner.id, email: owner.email, name: owner.name },
      businesses: owner.businesses,
      secretKey,
      message:    "Account created. Save your POS activation key.",
    };
  }

  // ── Login ─────────────────────────────────────────────────────────────────
  static async login(email: string, password: string) {
    const owner = await prisma.owner.findUnique({
      where:   { email },
      include: { businesses: true },
    });
    if (!owner) return { ok: false as const, error: "Invalid credentials." };

    const valid = await verifyPassword(password, owner.passwordHash);
    if (!valid) return { ok: false as const, error: "Invalid credentials." };

    const token = signOwnerToken({ sub: owner.id, email: owner.email, role: "OWNER" });

    return {
      ok:    true as const,
      token,
      owner: { id: owner.id, email: owner.email, name: owner.name },
      businesses: owner.businesses,
    };
  }

  // ── Get current owner ─────────────────────────────────────────────────────
  static async getMe(ownerId: string) {
    const owner = await prisma.owner.findUnique({
      where:   { id: ownerId },
      include: { businesses: true },
    });
    if (!owner) return { ok: false as const, error: "Owner not found." };
    return {
      ok:         true as const,
      owner:      { id: owner.id, email: owner.email, name: owner.name },
      businesses: owner.businesses,
    };
  }

  // ── Change dashboard password ─────────────────────────────────────────────
  static async changePassword(ownerId: string, oldPassword: string, newPassword: string) {
    const owner = await prisma.owner.findUnique({ where: { id: ownerId } });
    if (!owner) return { ok: false as const, error: "Owner not found." };

    const valid = await verifyPassword(oldPassword, owner.passwordHash);
    if (!valid) return { ok: false as const, error: "Current password is incorrect." };

    const passwordHash = await hashPassword(newPassword);
    await prisma.owner.update({ where: { id: ownerId }, data: { passwordHash } });
    return { ok: true as const, message: "Password updated successfully." };
  }
}
