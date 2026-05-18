// src/utils/sanitize.ts
// Lightweight client-side input sanitization.
// NOTE: This is a defense-in-depth measure. The backend must ALSO validate and sanitize.
// These utils prevent the most common XSS vectors from reaching the API.

const HTML_ENTITIES: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#x27;",
};

/**
 * Strips <script> tags and encodes HTML special characters.
 * Safe for use in API payloads and React text content.
 */
export function sanitizeString(input: unknown): string {
    if (typeof input !== "string") return String(input ?? "");
    return input
        .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
        .replace(/[&<>"']/g, (c) => HTML_ENTITIES[c] ?? c)
        .trim();
}

/**
 * Sanitizes all string values in a shallow object.
 * Safe for use with form data before posting to API.
 */
export function sanitizeObject<T extends Record<string, unknown>>(obj: T): T {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
        if (typeof value === "string") {
            result[key] = sanitizeString(value);
        } else if (value !== null && typeof value === "object" && !Array.isArray(value)) {
            result[key] = sanitizeObject(value as Record<string, unknown>);
        } else {
            result[key] = value;
        }
    }
    return result as T;
}

/**
 * Validates that a string is a valid UUID v4.
 * Use to validate route/query params before using as businessId/userId.
 */
export function isValidUUID(value: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        value,
    );
}

/**
 * Validates email format.
 */
export function isValidEmail(value: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

/**
 * Clamps a number to a safe range.
 * Prevents sending extreme values to the API.
 */
export function clampNumber(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
}

/**
 * Detects if an error is database/Prisma-related, and returns a clean, safe,
 * user-friendly error message, preventing any internal DB schemas or connection
 * details from leaking to the frontend.
 */
export function sanitizeDatabaseError(error: unknown): string {
  if (!error) return "An unexpected error occurred.";

  const err = error as any;
  const isPrisma = 
    (typeof err.code === "string" && err.code.startsWith("P")) ||
    (err.name && err.name.includes("Prisma")) ||
    (err.message && err.message.includes("prisma")) ||
    (err.stack && err.stack.includes("prisma"));

  if (!isPrisma) {
    return err.message || "An unexpected error occurred.";
  }

  // Handle specific Prisma error codes safely and elegantly
  switch (err.code) {
    case "P2002": {
      const target = err.meta?.target;
      if (Array.isArray(target) && target.length > 0) {
        const field = target[0].split("_").pop() || target[0];
        const formattedField = field.charAt(0).toUpperCase() + field.slice(1);
        return `${formattedField} is already taken. Please use a different value.`;
      }
      return "A record with this unique value already exists.";
    }
    case "P2025":
      return "The requested record was not found.";
    case "P2003":
      return "Unable to perform this operation because a related record is missing or in use.";
    case "P2000":
      return "The provided value is too long for this field.";
    case "P2011":
    case "P2012":
      return "A required field is missing or empty.";
    default:
      // Prevent leaking db credentials/schema for connection issues, timeouts, panic errors, etc.
      return "A database error occurred. Please try again later.";
  }
}