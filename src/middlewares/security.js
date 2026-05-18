// backend/middlewares/security.js
// Drop-in security middleware stack for your Express backend.
// Install: npm install express-rate-limit helmet cors jsonwebtoken bcryptjs
//          npm install express-validator zod

import rateLimit from "express-rate-limit";
import helmet from "helmet";
import cors from "cors";

// ─── 1. Helmet — security headers ────────────────────────────────────────────

export const helmetMiddleware = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  hsts: {
    maxAge: 63072000,
    includeSubDomains: true,
    preload: true,
  },
});

// ─── 2. CORS — only allow your frontend domain ────────────────────────────────

const ALLOWED_ORIGINS = [
  "http://localhost:5173",  // Vite dev server
  "https://your-domain.com", // Replace with your production domain
];

export const corsMiddleware = cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (e.g. curl, Postman in dev)
    if (!origin || ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS: origin '${origin}' not allowed`));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Request-Id"],
  maxAge: 86400, // Cache preflight for 24h
});

// ─── 3. Rate limiting ─────────────────────────────────────────────────────────

// Login: 5 attempts per 15 minutes per IP
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: "Too many login attempts. Try again in 15 minutes." },
  skipSuccessfulRequests: true, // Only count failed attempts
});

// General API: 100 req/min per IP
export const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: "Rate limit exceeded." },
});

// Sensitive endpoints (password change, role updates): 10 req/min
export const sensitiveLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: "Rate limit exceeded for sensitive operation." },
});


// ─── backend/middlewares/auth.js ──────────────────────────────────────────────
// JWT Authentication + RBAC middleware

import jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Verifies the Bearer token and attaches req.user.
 * If the token is invalid or expired, returns 401.
 */
export async function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ ok: false, error: "Authentication required." });
  }

  const token = authHeader.slice(7);

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);

    // Fetch fresh user from DB to get current role (don't trust token payload alone)
    const owner = await prisma.owner.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, name: true, role: true, isActive: true },
    });

    if (!owner || !owner.isActive) {
      return res.status(401).json({ ok: false, error: "Account not found or disabled." });
    }

    req.user = owner;
    next();
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({ ok: false, error: "Token expired." });
    }
    return res.status(401).json({ ok: false, error: "Invalid token." });
  }
}

/**
 * RBAC middleware factory.
 * Usage: router.delete("/users/:id", authenticate, requireRole(["owner", "admin"]), handler)
 */
export function requireRole(allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ ok: false, error: "Authentication required." });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ ok: false, error: "Insufficient permissions." });
    }
    next();
  };
}

/**
 * Multi-tenant isolation middleware.
 * Verifies req.user has access to the requested businessId.
 * Attach after `authenticate`.
 *
 * Usage: router.get("/businesses/:businessId/sales", authenticate, requireBusinessAccess, handler)
 */
export async function requireBusinessAccess(req, res, next) {
  const { businessId } = req.params;

  if (!businessId) {
    return res.status(400).json({ ok: false, error: "businessId required." });
  }

  try {
    // Check if this owner has access to this business
    const membership = await prisma.businessMember.findFirst({
      where: {
        ownerId: req.user.id,
        businessId,
      },
    });

    if (!membership) {
      // SECURITY: Return 404 not 403 to avoid leaking business existence
      return res.status(404).json({ ok: false, error: "Business not found." });
    }

    req.businessId = businessId;
    req.businessRole = membership.role; // e.g. "owner", "admin", "manager"
    next();
  } catch {
    res.status(500).json({ ok: false, error: "Internal server error." });
  }
}


// ─── backend/controllers/authController.js ────────────────────────────────────
// Secure auth controller with refresh tokens

import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import crypto from "crypto";

const ACCESS_TOKEN_TTL  = "15m";   // Short-lived
const REFRESH_TOKEN_TTL = 7 * 24 * 60 * 60; // 7 days in seconds

function generateTokens(userId) {
  const accessToken = jwt.sign(
    { sub: userId },
    process.env.JWT_SECRET,
    { expiresIn: ACCESS_TOKEN_TTL, issuer: "simxel" },
  );

  // Refresh token is an opaque random string — stored in DB, not JWT
  const refreshToken = crypto.randomBytes(64).toString("hex");

  return { accessToken, refreshToken };
}

export async function login(req, res) {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ ok: false, error: "Email and password required." });
  }

  try {
    const owner = await prisma.owner.findUnique({
      where: { email: email.toLowerCase().trim() },
      include: { businesses: { select: { id: true, name: true, currency: true, type: true, isActivated: true } } },
    });

    // SECURITY: Always use constant-time comparison
    if (!owner || !(await bcrypt.compare(password, owner.passwordHash))) {
      // Log failed attempt
      console.warn(`[AUTH] Failed login for: ${email}`);
      return res.status(401).json({ ok: false, error: "Invalid email or password." });
    }

    if (!owner.isActive) {
      return res.status(403).json({ ok: false, error: "Account disabled." });
    }

    const { accessToken, refreshToken } = generateTokens(owner.id);

    // Store refresh token in DB (hashed)
    await prisma.refreshToken.create({
      data: {
        token: await bcrypt.hash(refreshToken, 10),
        ownerId: owner.id,
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL * 1000),
      },
    });

    // Log successful login
    console.info(`[AUTH] Login success: ${owner.email} (${owner.id})`);

    res.json({
      ok: true,
      token: accessToken,
      refreshToken,
      expiresIn: 900, // 15 minutes in seconds
      owner: { id: owner.id, email: owner.email, name: owner.name, role: owner.role },
      businesses: owner.businesses,
    });
  } catch (err) {
    console.error("[AUTH] Login error:", err);
    res.status(500).json({ ok: false, error: "Internal server error." });
  }
}

export async function refresh(req, res) {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(400).json({ ok: false, error: "Refresh token required." });
  }

  try {
    // Find all non-expired refresh tokens for potential match
    const storedTokens = await prisma.refreshToken.findMany({
      where: { expiresAt: { gt: new Date() }, revokedAt: null },
      include: { owner: true },
    });

    // Find matching token (bcrypt compare each)
    let matched = null;
    for (const stored of storedTokens) {
      if (await bcrypt.compare(refreshToken, stored.token)) {
        matched = stored;
        break;
      }
    }

    if (!matched) {
      return res.status(401).json({ ok: false, error: "Invalid or expired refresh token." });
    }

    // Rotate: revoke old, issue new
    await prisma.refreshToken.update({
      where: { id: matched.id },
      data: { revokedAt: new Date() },
    });

    const { accessToken, refreshToken: newRefreshToken } = generateTokens(matched.owner.id);

    await prisma.refreshToken.create({
      data: {
        token: await bcrypt.hash(newRefreshToken, 10),
        ownerId: matched.owner.id,
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL * 1000),
      },
    });

    res.json({
      ok: true,
      token: accessToken,
      refreshToken: newRefreshToken,
      expiresIn: 900,
    });
  } catch (err) {
    console.error("[AUTH] Refresh error:", err);
    res.status(500).json({ ok: false, error: "Internal server error." });
  }
}

export async function logout(req, res) {
  const { refreshToken } = req.body;

  if (refreshToken) {
    try {
      // Find and revoke the refresh token
      const storedTokens = await prisma.refreshToken.findMany({
        where: { ownerId: req.user.id, revokedAt: null },
      });
      for (const stored of storedTokens) {
        if (await bcrypt.compare(refreshToken, stored.token)) {
          await prisma.refreshToken.update({
            where: { id: stored.id },
            data: { revokedAt: new Date() },
          });
          break;
        }
      }
    } catch {
      // Best-effort
    }
  }

  console.info(`[AUTH] Logout: ${req.user?.email}`);
  res.json({ ok: true });
}


// ─── Prisma schema additions needed ──────────────────────────────────────────
/*
Add to your schema.prisma:

model RefreshToken {
  id        String    @id @default(cuid())
  token     String    // bcrypt hash of the raw token
  ownerId   String
  owner     Owner     @relation(fields: [ownerId], references: [id])
  expiresAt DateTime
  revokedAt DateTime?
  createdAt DateTime  @default(now())

  @@index([ownerId])
}

model Owner {
  // ... existing fields ...
  role         String        @default("owner")  // owner | admin | manager | user
  isActive     Boolean       @default(true)
  refreshTokens RefreshToken[]
}
*/