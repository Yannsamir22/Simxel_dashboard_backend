import { randomUUID } from "crypto";
import prisma from "../config/db.js";
import { sendOtpEmail } from "../utils/email.js";
import { generateSecretKey } from "../utils/generateSecretKey.js";
import { verifyGoogleToken } from "../utils/google.js";
import { signOwnerToken } from "../utils/jwt.js";
import { createOTP, verifyOtp } from "../utils/otp.js";
import { hashPassword, verifyPassword } from "../utils/password.js";

// Shared helper: build the standard login response

const buildAuthResponse = (owner: { id: string; email: string; name: string | null }, businesses: any[]) => {
  const token = signOwnerToken({ sub: owner.id, email: owner.email, role: "OWNER" });

  return {
    ok: true as const,
    token,
    owner: { id: owner.id, email: owner.email, name: owner.name },
    businesses
  }
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function validateRegistration(data: {
  ownerEmail: string;
  ownerPassword: string;
  ownerName?: string;
  businessName: string;
}): string | null {
  if (!EMAIL_REGEX.test(data.ownerEmail)) return "Invalid email address."
  if (data.ownerPassword.length < 8) return "Password must be at least 8 characters."
  if (!data.businessName.trim()) return "Business name is required."
  return null
}
export class AuthService {
  //  Register owner + first business 
  static async register(data: {
    ownerEmail: string;
    ownerPassword: string;
    ownerName?: string;
    businessName: string;
    businessType?: string;
    currency?: string;
  }) {
    // Validation
    const validationError = validateRegistration(data);
    if (validationError) return { ok: false as const, error: validationError };

    const email = data.ownerEmail.toLowerCase().trim();

    // Duplicate check
    const existing = await prisma.owner.findUnique({ where: { email } });
    if (existing) {

      if (existing.isVerified) {

        return { ok: false as const, error: "An account with this email already exists." };
      }

      await prisma.business.deleteMany({ where: { ownerId: existing.id } })
      await prisma.owner.delete({ where: { id: existing.id } })
    }


    // Create owner
    const passwordHash = await hashPassword(data.ownerPassword);
    const secretKey = generateSecretKey();

    const owner = await prisma.owner.create({
      data: {
        id: randomUUID(),
        email: data.ownerEmail.toLowerCase(),
        passwordHash,
        name: data.ownerName?.trim() || "",
        isVerified: false,
        authProvider: "EMAIL",
        updatedAt: new Date(),
        businesses: {
          create: [{
            id: randomUUID(),
            name: data.businessName.trim(),
            currency: data.currency || "FCFA",
            type: data.businessType || "SERVICE",
            secretKey,
            updatedAt: new Date(),
          }],
        },
      },
      include: { businesses: true },
    });

    // Generate and email the OTP
    try {
      const { code } = await createOTP(email, { skipCooldown: true });
      await sendOtpEmail(email, code, data.ownerName || "")
    } catch (error) {
      await prisma.business.deleteMany({ where: { ownerId: owner.id } })
      await prisma.owner.delete({ where: { email } });
      console.error("[OTP]  Email send failed:", error);
      return {
        ok: false as const,
        error: "Could not send verification email. Please check your email address and try again."
      }

    }
    return {
      ok: true as const,
      email,
      message: "Account created. Check your email for the 6-digit verification code."
    }

  }

  // Verify Email
  // Validate the OTP
  static async verifyEmail(email: string, code: string) {
    const normalizedEmail = email.toLowerCase().trim();

    // Find the owner
    const owner = await prisma.owner.findUnique({
      where: { email: normalizedEmail },
      include: { businesses: true }
    })

    if (!owner) {
      return { ok: false as const, error: "No account found for this email.." }
    }
    if (owner.isVerified) {
      return { ok: false as const, error: "This account has already been verified. Please log in." }

    }

    const result = await verifyOtp(normalizedEmail, code.trim());
    if (!result.valid) {
      return { ok: false as const, error: result.error }
    }
    // marlk owner as verified
    await prisma.owner.update({
      where: { id: owner.id },
      data: { isVerified: true }
    })

    const secretKey = (owner as any).businesses[0]?.secretKey ?? null;

    return {
      ...buildAuthResponse(owner, owner.businesses),
      secretKey,
      message: "Email verified. Your account is ready."
    }


  }

  // Resend OTP
  // Respects the 60-second cooldown enforced in creaeteOTP()
  static async resendCode(email: string) {
    const normalizedEmail = email.toLowerCase().trim();

    const owner = await prisma.owner.findUnique({ where: { email: normalizedEmail } });
    if (!owner) {
      return { ok: true as const, message: "If an account exists for this email, a new code has been sent." }
    }
    if (owner.isVerified) {
      return { ok: false as const, error: "This email is already verified." }

    }

    try {
      const { code } = await createOTP(normalizedEmail, { skipCooldown: false })
      await sendOtpEmail(normalizedEmail, code, owner.name || "")
    } catch (err: any) {
      if (err.status === 429) {
        return { ok: false as const, error: err.message };
      }
      console.error("[OTP] Resend failed:", err);
      return { ok: false as const, error: "Could not send email. Please try again." };
    }

    return { ok: true as const, message: "A new code has been sent to your email." }
  }


  //   Login 
  static async login(email: string, password: string) {
    const owner = await prisma.owner.findUnique({
      where: { email: email.toLowerCase().trim() },
      include: { businesses: true },
    });
    if (!owner) return { ok: false as const, error: "Invalid credentials." };

    if (!owner.passwordHash) {
      return { ok: false as const, error: "This account uses Google Sign-In. Please log in with Google." }
    }

    // Email not yet verified
    if (!owner.isVerified) {
      return {
        ok: false as const,
        error: "EMAIL_NOT_VERIFIED",
        email: owner.email,
        message: "Please verify your email before logging in.",
      };
    }

    const valid = await verifyPassword(password, owner.passwordHash);
    if (!valid) return { ok: false as const, error: "Invalid credentials." };

    return buildAuthResponse(owner, owner.businesses)
  }

  // Google OAuth login / register
  static async googleAuth(idToken: string, businessName?: string, businessType?: string, currency?: string) {
    // Verify Google token
    let googleUser;
    try {
      googleUser = await verifyGoogleToken(idToken);
    } catch (err) {
      return { ok: false as const, error: "Invalid Google token." }
    }

    const { googleId, email, name } = googleUser;

    // Lookup existing owners
    let owner = await prisma.owner.findFirst({
      where: {
        OR: [
          { googleId },
          { email: email.toLowerCase() }
        ]
      },
      include: { businesses: true }
    })

    if (owner) {
      if (!owner.googleId) {
        owner = await prisma.owner.update({
          where: { id: owner.id },
          data: { googleId, authProvider: "BOTH" },
          include: { businesses: true }
        })
      }
      return buildAuthResponse(owner, owner.businesses)
    }

    // New owner - create account
    if (!businessName?.trim()) {
      return {
        ok: false as const,
        error: "BUSINESS_NAME_REQUIRED",
        message: "Please provide a business name to complete your registration.",
        googleUser: { email, name }
      }
    }

    const secretKey = generateSecretKey();

    const newOwner = await prisma.owner.create({
      data: {
        id: randomUUID(),
        email: email.toLowerCase(),
        passwordHash: null,
        name: name.trim(),
        googleId,
        isVerified: true,
        authProvider: "GOOGLE",
        updatedAt: new Date(),
        businesses: {
          create: [{
            id: randomUUID(),
            name: businessName.trim(),
            currency: currency || "FCFA",
            type: businessType || "SERVICE",
            secretKey,
            updatedAt: new Date(),
          }]
        }
      },
      include: { businesses: true }
    })

    const token = signOwnerToken({
      sub: newOwner.id, email: newOwner.email, role: "OWNER"
    })

    return {
      ok: true as const,
      token,
      owner: { id: newOwner.id, email: newOwner.email, name: newOwner.name },
      businesses: newOwner.businesses, secretKey,
      message: "Account created via Google. Save your POS activation key - it wil not be shown again."

    }
  }

  //  Get current owner ─
  static async getMe(ownerId: string) {
    const owner = await prisma.owner.findUnique({
      where: { id: ownerId },
      include: { businesses: true },
    });
    if (!owner) return { ok: false as const, error: "Owner not found." };
    return {
      ok: true as const,
      owner: { id: owner.id, email: owner.email, name: owner.name, authProvider: owner.authProvider },
      businesses: owner.businesses,
    };
  }

  //  Change dashboard password ─
  static async changePassword(ownerId: string, oldPassword: string, newPassword: string) {
    const owner = await prisma.owner.findUnique({ where: { id: ownerId } });
    if (!owner) return { ok: false as const, error: "Owner not found." };

    if (!owner.passwordHash) {
      const passwordHash = await hashPassword(newPassword);
      await prisma.owner.update({
        where: { id: ownerId },
        data: { passwordHash, authProvider: "BOTH" },
      });
      return { ok: true as const, message: "Password set successfully. You can now also log in with email/password." };
    }

    const valid = await verifyPassword(oldPassword, owner.passwordHash);
    if (!valid) return { ok: false as const, error: "Current password is incorrect." };

    const passwordHash = await hashPassword(newPassword);
    await prisma.owner.update({ where: { id: ownerId }, data: { passwordHash } });
    return { ok: true as const, message: "Password updated successfully." };
  }
}
