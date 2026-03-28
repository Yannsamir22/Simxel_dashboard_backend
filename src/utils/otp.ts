import prisma from "../config/db";
import { randomInt } from "crypto";
const CODE_LENGTH = 6;
const TTL_MINUTES = 15;
const RESEND_COOLDOWN_SECONDS = 60;

// Generate a cryprographically random 6-digit string
function generateCode(): string {

      // max is inclusive
      return String(randomInt(100_000, 1_000_000));

}


export async function createOTP(
      email: string,
      { skipCooldown = false }
): Promise<{ code: string, expiresAt: Date }> {
      if (!skipCooldown) {
            const recent = await prisma.otpCode.findFirst({
                  where: {
                        email,
                        used: false,
                        expiresAt: {
                              gte: new Date()
                        }
                  },
                  orderBy: { createdAt: "desc" }

            })

            if (recent) {
                  const secondsSince = (Date.now() - recent.createdAt.getTime()) / 1000;
                  if (secondsSince < RESEND_COOLDOWN_SECONDS) {
                        const wait = Math.ceil(RESEND_COOLDOWN_SECONDS - secondsSince);
                        throw Object.assign(
                              new Error(`Please wait ${wait} seconds before requesting a new code.`),
                              { status: 429, waitSeconds: wait }
                        )
                  }
            }
      }

      // Delete all previous codes for this email
      await prisma.otpCode.deleteMany({ where: { email } });

      // Create the new code
      const code = generateCode();
      const expiresAt = new Date(Date.now() + TTL_MINUTES * 60 * 1000);

      // Persist the OTP so verifyOtp can find it
      await prisma.otpCode.create({
            data: { email, code, expiresAt }
      });

      return { code, expiresAt }
}


// Verify a submitted code
export async function verifyOtp(email: string, submittedCode: string): Promise<{ valid: true } | { valid: false, error: string }> {
      const otp = await prisma.otpCode.findFirst({
            where: { email },
            orderBy: { createdAt: "desc" }
      })

      if (!otp) {
            return { valid: false, error: "No verification code was found for this email." }
      }

      if (otp.used) {
            return { valid: false, error: "This code has already been used." }
      }
      if (otp.expiresAt < new Date()) {
            return { valid: false, error: "This code has expired. Please request a new one." }
      }

      if (otp.code !== submittedCode) {
            return { valid: false, error: "Invalid code. Please try again." }
      }

      // Mark as used
      await prisma.otpCode.update({ where: { id: otp.id }, data: { used: true } })

      return { valid: true }

}

// Delete all expired OTP records from the database
export async function purgeExpiredOtps(): Promise<number> {
      const { count } = await prisma.otpCode.deleteMany({
            where: { expiresAt: { lt: new Date() } }
      })
      return count
}
