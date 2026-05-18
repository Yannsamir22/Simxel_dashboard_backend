// src/services/owner.service.ts
// Handles:
//   1. Business registration (create Owner + Business + generate secretKey)
//   2. Owner password change
//   3. Remote POS config management (manager/admin password, business info)
import prisma from "../config/db.js";
import { hashPassword, verifyPassword } from "../utils/password.js";
import { generateSecretKey } from "../utils/generateSecretKey.js";
import { sanitizeDatabaseError } from "../utils/sanitize.js";

// ─── Business Registration ─────────────────────────────────────────────────

export interface RegisterBusinessInput {
  // Owner fields — only required if the owner does not exist yet
  ownerName?: string;
  ownerEmail: string;
  ownerPassword: string;
  // Business fields
  businessName: string;
  currency?: string;
  businessType?: string;
}

export class OwnerService {

  /**
   * Register a new business.
   * - If the owner email already exists, the new business is added to that owner.
   * - If not, a new owner account is created first.
   * - Returns the businessId and secretKey (to be entered in the POS on first activation).
   */
  static async registerBusiness(data: RegisterBusinessInput) {
    const { ownerEmail, ownerPassword, ownerName, businessName, currency, businessType } = data;

    if (!ownerEmail?.trim()) return { ok: false, error: "Owner email is required." };
    if (!ownerPassword)       return { ok: false, error: "Owner password is required." };
    if (!businessName?.trim()) return { ok: false, error: "Business name is required." };

    try {
      // Find or create owner
      let owner = await prisma.owner.findUnique({
        where: { email: ownerEmail.toLowerCase().trim() },
      });

      if (!owner) {
        const passwordHash = await hashPassword(ownerPassword);
        owner = await prisma.owner.create({
          data: {
            email: ownerEmail.toLowerCase().trim(),
            passwordHash,
            name: ownerName?.trim() || "",
          },
        });
      } else {
        // Owner exists — verify password before attaching a new business
        // Google OAuth owners have no passwordHash — guard against null before calling verifyPassword
        if (!owner.passwordHash) {
          return { ok: false, error: "This account uses Google Sign-In. Please log in with Google to manage your businesses." };
        }
        const valid = await verifyPassword(ownerPassword, owner.passwordHash);
        if (!valid) return { ok: false, error: "Invalid credentials for existing owner account." };
      }

      const secretKey = generateSecretKey();

      const business = await prisma.business.create({
        data: {
          name: businessName.trim(),
          currency: currency || "FCFA",
          type: businessType || "SERVICE",
          secretKey,
          ownerId: owner.id,
          isActivated: false,
        },
      });

      return {
        ok: true,
        businessId: business.id,
        secretKey,          // ← give this to the POS operator for activation
        owner: {
          id: owner.id,
          email: owner.email,
          name: owner.name,
        },
        business: {
          id: business.id,
          name: business.name,
          currency: business.currency,
          type: business.type,
          isActivated: business.isActivated,
        },
      };
    } catch (error) {
      console.error("[OwnerService.registerBusiness]", error);
      return { ok: false, error: sanitizeDatabaseError(error) };
    }
  }

  // ─── Owner account ────────────────────────────────────────────────────────

  /**
   * Change the owner's login password (the one used to log into the Dashboard).
   */
  static async changeOwnerPassword(
    ownerId: string,
    oldPassword: string,
    newPassword: string
  ) {
    if (!oldPassword || !newPassword)
      return { ok: false, error: "Both old and new passwords are required." };
    if (newPassword.length < 6)
      return { ok: false, error: "New password must be at least 6 characters." };

    try {
      const owner = await prisma.owner.findUnique({ where: { id: ownerId } });
      if (!owner) return { ok: false, error: "Owner not found." };
      if (!owner.passwordHash) return { ok: false, error: "This account uses Google Sign-In and has no password set." };

      const valid = await verifyPassword(oldPassword, owner.passwordHash);
      if (!valid) return { ok: false, error: "Old password is incorrect." };

      const passwordHash = await hashPassword(newPassword);
      await prisma.owner.update({
        where: { id: ownerId },
        data: { passwordHash },
      });

      return { ok: true, message: "Owner password updated successfully." };
    } catch (error) {
      return { ok: false, error: sanitizeDatabaseError(error) };
    }
  }

  // ─── Remote POS Config ───────────────────────────────────────────────────
  // The POS reads its Config row from the cloud DB on activation and on pull sync.
  // Changing the config here means the POS will pick up the new values on next sync.

  /**
   * Get the POS config for a business.
   * Returns whether the config exists and when it was last updated.
   * Does NOT return password hashes.
   */
  static async getPosConfig(businessId: string) {
    try {
      const config = await prisma.config.findUnique({
        where: { businessId },
        select: {
          id: true,
          businessId: true,
          updatedAt: true,
          business: { select: { name: true, isActivated: true, currency: true, type: true } },
        },
      });

      if (!config) return { ok: false, error: "POS config not found. The POS has not been activated yet." };

      return { ok: true, config };
    } catch (error) {
      return { ok: false, error: sanitizeDatabaseError(error) };
    }
  }

  /**
   * Remotely change the POS Manager password.
   * The POS will pick up the new hash on next pull sync.
   * Requires the owner to confirm with their own Dashboard password.
   */
  static async changePosManagerPassword(
    ownerId: string,
    businessId: string,
    ownerPassword: string,  // confirmation — owner must re-authenticate
    newManagerPassword: string
  ) {
    if (!newManagerPassword)
      return { ok: false, error: "New manager password is required." };
    if (newManagerPassword.length < 4)
      return { ok: false, error: "Manager password must be at least 4 characters." };

    try {
      // Re-verify owner credentials before allowing a sensitive POS change
      const owner = await prisma.owner.findUnique({ where: { id: ownerId } });
      if (!owner) return { ok: false, error: "Owner not found." };
      if (!owner.passwordHash) return { ok: false, error: "This account uses Google Sign-In and cannot confirm identity via password." };

      const valid = await verifyPassword(ownerPassword, owner.passwordHash);
      if (!valid) return { ok: false, error: "Incorrect owner password. Please confirm your identity." };

      const config = await prisma.config.findUnique({ where: { businessId } });
      if (!config) return { ok: false, error: "POS config not found. Has the POS been activated?" };

      const mainPasswordHash = await hashPassword(newManagerPassword);
      await prisma.config.update({
        where: { businessId },
        data: { mainPasswordHash, isSynced: false },
        // isSynced: false flags this config row as "needs to be pulled by POS"
        // The POS pull sync reads config by updatedAt — setting isSynced false
        // is a belt-and-suspenders signal; the updatedAt timestamp does the real work.
      });

      return { ok: true, message: "POS manager password updated. The POS will apply it on next sync." };
    } catch (error) {
      return { ok: false, error: sanitizeDatabaseError(error) };
    }
  }

  /**
   * Remotely change the POS Admin password.
   * Same confirmation flow as manager password change.
   */
  static async changePosAdminPassword(
    ownerId: string,
    businessId: string,
    ownerPassword: string,
    newAdminPassword: string
  ) {
    if (!newAdminPassword)
      return { ok: false, error: "New admin password is required." };
    if (newAdminPassword.length < 4)
      return { ok: false, error: "Admin password must be at least 4 characters." };

    try {
      const owner = await prisma.owner.findUnique({ where: { id: ownerId } });
      if (!owner) return { ok: false, error: "Owner not found." };
      if (!owner.passwordHash) return { ok: false, error: "This account uses Google Sign-In and cannot confirm identity via password." };

      const valid = await verifyPassword(ownerPassword, owner.passwordHash);
      if (!valid) return { ok: false, error: "Incorrect owner password. Please confirm your identity." };

      const config = await prisma.config.findUnique({ where: { businessId } });
      if (!config) return { ok: false, error: "POS config not found. Has the POS been activated?" };

      const adminPasswordHash = await hashPassword(newAdminPassword);
      await prisma.config.update({
        where: { businessId },
        data: { adminPasswordHash, isSynced: false },
      });

      return { ok: true, message: "POS admin password updated. The POS will apply it on next sync." };
    } catch (error) {
      return { ok: false, error: sanitizeDatabaseError(error) };
    }
  }

  /**
   * Update basic business info (name, currency, type).
   * These changes are reflected in the POS on next pull sync.
   */
  static async updateBusinessInfo(
    businessId: string,
    data: { name?: string; currency?: string; type?: string }
  ) {
    const { name, currency, type } = data;

    if (!name && !currency && !type)
      return { ok: false, error: "Provide at least one field to update." };

    try {
      const updateData: any = {};
      if (name?.trim()) updateData.name = name.trim();
      if (currency?.trim()) updateData.currency = currency.trim();
      if (type?.trim()) updateData.type = type.trim();

      const business = await prisma.business.update({
        where: { id: businessId },
        data: updateData,
        select: { id: true, name: true, currency: true, type: true, isActivated: true, updatedAt: true },
      });

      return { ok: true, business };
    } catch (error) {
      return { ok: false, error: sanitizeDatabaseError(error) };
    }
  }

  /**
   * Get all businesses belonging to an owner.
   */
  static async getMyBusinesses(ownerId: string) {
    try {
      const businesses = await prisma.business.findMany({
        where: { ownerId },
        select: {
          id: true,
          name: true,
          currency: true,
          type: true,
          isActivated: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { createdAt: "asc" },
      });
      return { ok: true, businesses };
    } catch (error) {
      return { ok: false, error: sanitizeDatabaseError(error) };
    }
  }

  /**
   * Add a new business to an existing owner's account.
   * Does not require ownerPassword — owner is already authenticated via JWT.
   */
  static async addBusiness(
    ownerId: string,
    data: { businessName: string; currency?: string; businessType?: string }
  ) {
    const { businessName, currency, businessType } = data;

    if (!businessName?.trim()) return { ok: false, error: "Business name is required." };

    try {
      const secretKey = generateSecretKey();

      const business = await prisma.business.create({
        data: {
          name: businessName.trim(),
          currency: currency || "FCFA",
          type: businessType || "SERVICE",
          secretKey,
          ownerId,
          isActivated: false,
        },
      });

      return {
        ok: true,
        businessId: business.id,
        secretKey,
        business: {
          id: business.id,
          name: business.name,
          currency: business.currency,
          type: business.type,
          isActivated: business.isActivated,
        },
      };
    } catch (error) {
      return { ok: false, error: sanitizeDatabaseError(error) };
    }
  }

  /**
   * Full POS password reset — sets both manager and admin passwords at once.
   * Used when the owner has lost all access to the POS.
   */
  static async resetPosPasswords(
    ownerId: string,
    businessId: string,
    ownerPassword: string,
    newManagerPassword: string,
    newAdminPassword: string
  ) {
    if (!newManagerPassword || !newAdminPassword)
      return { ok: false, error: "Both new passwords are required." };
    if (newManagerPassword.length < 4 || newAdminPassword.length < 4)
      return { ok: false, error: "Passwords must be at least 4 characters." };

    try {
      const owner = await prisma.owner.findUnique({ where: { id: ownerId } });
      if (!owner) return { ok: false, error: "Owner not found." };
      if (!owner.passwordHash) return { ok: false, error: "This account uses Google Sign-In and cannot confirm identity via password." };

      const valid = await verifyPassword(ownerPassword, owner.passwordHash);
      if (!valid) return { ok: false, error: "Incorrect owner password. Please confirm your identity." };

      const config = await prisma.config.findUnique({ where: { businessId } });
      if (!config) return { ok: false, error: "POS config not found. Has the POS been activated?" };

      const [mainPasswordHash, adminPasswordHash] = await Promise.all([
        hashPassword(newManagerPassword),
        hashPassword(newAdminPassword),
      ]);

      await prisma.config.update({
        where: { businessId },
        data: { mainPasswordHash, adminPasswordHash, isSynced: false },
      });

      return { ok: true, message: "Both POS passwords reset. The POS will apply them on next sync." };
    } catch (error) {
      return { ok: false, error: sanitizeDatabaseError(error) };
    }
  }

  /**
   * Get a single business's public info.
   */
  static async getBusinessInfo(businessId: string) {
    try {
      const business = await prisma.business.findUnique({
        where: { id: businessId },
        select: {
          id: true,
          name: true,
          currency: true,
          type: true,
          isActivated: true,
          createdAt: true,
          updatedAt: true,
        },
      });
      if (!business) return { ok: false, error: "Business not found." };
      return { ok: true, business };
    } catch (error) {
      return { ok: false, error: sanitizeDatabaseError(error) };
    }
  }
}
