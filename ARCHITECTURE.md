# Simxel Cloud Dashboard — Backend Architecture Guide

## Overview

The Cloud Dashboard is a **separate Node.js/Express backend** that connects
exclusively to the **Supabase PostgreSQL cloud database**. It gives business
owners a remote web interface to view and manage their data.

```
┌─────────────────────┐        ┌──────────────────────┐
│     POS (local)     │ ──────▶│  Cloud PostgreSQL DB  │◀──── Cloud Dashboard
│   Node.js + SQLite  │  sync  │     (Supabase)        │      (this project)
└─────────────────────┘        └──────────────────────┘
```

**Key rules:**
- The POS **owns** the schema and runs migrations.
- The Dashboard **never** runs `prisma migrate`. Use `prisma db pull` only.
- The Dashboard **never** syncs. It reads and writes cloud data directly.
- Every write sets `isSynced: true` because the data is already in the cloud.

---

## Project Structure

```
simxel-cloud-dashboard/
├── prisma/
│   └── schema.prisma              ← Mirror of POS schema (db pull, no migrate)
├── src/
│   ├── config/
│   │   └── db.ts                  ← Single PrismaClient for cloud DB
│   ├── types/
│   │   └── auth.ts                ← OwnerPayload, OwnerRequest
│   ├── utils/
│   │   ├── jwt.ts                 ← signOwnerToken / verifyOwnerToken
│   │   ├── password.ts            ← hashPassword / verifyPassword (bcrypt)
│   │   ├── uuid.validator.ts      ← isUUID()
│   │   └── excel.helper.ts        ← Copy from POS (see file for instructions)
│   ├── middlewares/
│   │   ├── auth.middleware.ts     ← requireOwner + requireBusiness ★
│   │   └── error.middleware.ts    ← Global error handler
│   ├── services/                  ← All business logic
│   │   ├── auth.service.ts
│   │   ├── employee.service.ts
│   │   ├── product.service.ts
│   │   ├── service.service.ts
│   │   ├── package.service.ts
│   │   ├── sale.service.ts        ← Read-only (POS creates sales)
│   │   ├── expense.service.ts
│   │   ├── stock.service.ts
│   │   └── report.service.ts
│   ├── controllers/               ← HTTP layer — thin, delegates to services
│   │   ├── auth.controller.ts
│   │   ├── employee.controller.ts
│   │   ├── product.controller.ts
│   │   ├── service.controller.ts
│   │   ├── package.controller.ts
│   │   ├── sale.controller.ts
│   │   ├── expense.controller.ts
│   │   ├── stock.controller.ts
│   │   └── report.controller.ts
│   ├── routes/
│   │   ├── auth.route.ts          ← /api/auth/...
│   │   ├── business.route.ts      ← /api/businesses/:businessId/... (all scoped)
│   │   └── index.route.ts         ← Mounts auth + business routers
│   ├── app.ts                     ← Express setup (cors, body-parser, routes)
│   └── server.ts                  ← DB connect + listen + graceful shutdown
├── .env.example
├── .gitignore
├── package.json
└── tsconfig.json
```

---

## Setup

```bash
# 1. Install dependencies
npm install

# 2. Create your .env
cp .env.example .env
# Fill in CLOUD_DATABASE_URL and JWT_SECRET

# 3. Introspect the cloud schema (do NOT run migrate)
npx prisma db pull

# 4. Generate the Prisma client
npm run prisma:generate

# 5. Start in development
npm run dev
```

---

## Authentication Flow

### Login

```
POST /api/auth/login
Content-Type: application/json

{
  "email": "owner@example.com",
  "password": "secret"
}
```

**Response:**
```json
{
  "ok": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "owner": {
    "id": "uuid",
    "email": "owner@example.com",
    "name": "John Doe"
  },
  "businesses": [
    {
      "id": "biz-uuid-1",
      "name": "Salon Lumière",
      "currency": "FCFA",
      "type": "SERVICE",
      "isActivated": true
    }
  ]
}
```

The **token** must be sent as a Bearer token on all subsequent requests:

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### JWT Payload

```json
{
  "sub": "owner-uuid",
  "email": "owner@example.com",
  "role": "OWNER",
  "iat": 1234567890,
  "exp": 1234567890
}
```

---

## Multi-Tenancy Security Model

### The Two-Layer Middleware

Every business-scoped request passes through two middlewares in sequence:

```
Request
  │
  ▼
requireOwner          → Verifies JWT. Injects req.owner (sub, email, role)
  │
  ▼
requireBusiness       → Validates :businessId UUID
                      → Confirms business exists in DB
                      → Confirms business.ownerId === req.owner.sub  ← KEY CHECK
                      → Injects req.businessId
  │
  ▼
Controller            → Uses req.businessId directly. Never trusts req.body for businessId.
  │
  ▼
Service               → Receives businessId as a parameter.
                        All Prisma queries include: where: { businessId, ... }
```

### Why the client never sends businessId in the body

The `businessId` travels through the **URL** (`/api/businesses/:businessId/products`),
not the request body. The `requireBusiness` middleware resolves and **ownership-validates**
it before any controller runs. This means:

- A malicious owner **cannot** pass another business's ID in the body to read their data.
- Even if they know another business's UUID, the ownership check (`ownerId === token.sub`) blocks them.
- Controllers receive `req.businessId` injected by the middleware — they never read it from `req.body`.

---

## Complete API Reference

### Auth

| Method | Endpoint          | Auth     | Description                        |
|--------|-------------------|----------|------------------------------------|
| POST   | /api/auth/login   | Public   | Login with email + password        |
| GET    | /api/auth/me      | Owner JWT| Get own profile + businesses       |

### All routes below require: `Authorization: Bearer <token>`

### Employees — `/api/businesses/:businessId/employees`

| Method | Path        | Description              |
|--------|-------------|--------------------------|
| GET    | /           | List all employees       |
| GET    | /:id        | Get employee by ID       |
| POST   | /           | Create employee          |
| PUT    | /:id        | Update employee          |
| DELETE | /:id        | Soft-delete employee     |

**POST / PUT body:**
```json
{
  "name": "Alice Martin",
  "dateOfBirth": "1995-06-15",
  "role": "EMPLOYEE",
  "commissionRate": 0.1
}
```

### Products — `/api/businesses/:businessId/products`

| Method | Path        | Description              |
|--------|-------------|--------------------------|
| GET    | /           | List all products        |
| GET    | /low-stock  | Products below alert     |
| GET    | /:id        | Get product by ID        |
| POST   | /           | Create product           |
| PUT    | /:id        | Update product           |
| DELETE | /:id        | Soft-delete product      |

**POST / PUT body:**
```json
{
  "name": "Shampoo Pro",
  "salePrice": 3500,
  "unitCost": 1200,
  "stock": 50,
  "minStockAlert": 10
}
```

### Services — `/api/businesses/:businessId/services`

| Method | Path  | Description          |
|--------|-------|----------------------|
| GET    | /     | List all services    |
| GET    | /:id  | Get service by ID    |
| POST   | /     | Create service       |
| PUT    | /:id  | Update service       |
| DELETE | /:id  | Soft-delete service  |

**POST / PUT body:**
```json
{ "name": "Haircut", "price": 5000 }
```

### Packages — `/api/businesses/:businessId/packages`

| Method | Path  | Description          |
|--------|-------|----------------------|
| GET    | /     | List all packages    |
| GET    | /:id  | Get package by ID    |
| POST   | /     | Create package       |
| PUT    | /:id  | Update package       |
| DELETE | /:id  | Soft-delete package  |

**POST body:**
```json
{
  "name": "Complete Care",
  "price": 15000,
  "serviceIds": ["service-uuid-1", "service-uuid-2"]
}
```

### Sales — `/api/businesses/:businessId/sales` (read-only)

| Method | Path           | Description                           |
|--------|----------------|---------------------------------------|
| GET    | /              | List sales (supports ?startDate=&endDate=&limit=&offset=) |
| GET    | /stats         | Dashboard stats (?period=Today\|This week\|This month\|This year\|Yesterday) |
| GET    | /year/:year    | All sales for a given year            |
| GET    | /:id           | Get sale with full details            |

### Expenses — `/api/businesses/:businessId/expenses`

| Method | Path      | Description                                        |
|--------|-----------|----------------------------------------------------|
| GET    | /         | All expenses                                       |
| GET    | /range    | Filter by ?start=YYYY-MM-DD&end=YYYY-MM-DD         |
| GET    | /:id      | Get by ID                                          |
| POST   | /         | Create expense                                     |
| PUT    | /:id      | Update expense                                     |
| DELETE | /:id      | Soft-delete expense                                |

**POST / PUT body:**
```json
{ "type": "Rent", "amount": 150000, "date": "2026-03-01" }
```

### Stock Movements — `/api/businesses/:businessId/stock`

| Method | Path                    | Description                        |
|--------|-------------------------|------------------------------------|
| GET    | /                       | All movements (last 200)           |
| GET    | /product/:productId     | Movements for one product          |
| POST   | /adjust                 | Manual stock adjustment            |

**POST /adjust body:**
```json
{
  "productId": "product-uuid",
  "type": "IN",
  "quantity": 20,
  "reason": "Restocking from supplier"
}
```
`type` must be: `IN` | `OUT` | `ADJUSTMENT`

### Reports — `/api/businesses/:businessId/reports`

All report routes accept `?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD`

| Method | Path                          | Description                          |
|--------|-------------------------------|--------------------------------------|
| GET    | /summary                      | Revenue, transactions, payment split |
| GET    | /top-items?limit=10           | Best-selling items by revenue        |
| GET    | /staff-performance            | Per-employee revenue + commissions   |
| GET    | /financial-balance            | Revenue vs expenses → net profit     |
| GET    | /stock-status                 | All products with stock vs alert     |
| GET    | /export/sales-journal         | Download .xlsx sales journal         |

---

## Differences from the POS Backend

| Aspect                  | POS Backend                      | Cloud Dashboard                          |
|-------------------------|----------------------------------|------------------------------------------|
| Database                | SQLite (local) + Postgres (cloud)| Postgres (cloud only)                    |
| BusinessId resolution   | `getLocalBusinessId()` from DB   | From URL param, ownership-validated      |
| Auth subjects           | MANAGER / ADMIN roles            | OWNER role only                          |
| Token cookie            | `auth_token` / `admin_token`     | No cookies — Bearer header only          |
| Sale creation           | Full POS sale workflow           | Read-only (POS is the source of truth)   |
| `isSynced` on writes    | `false` (needs POS → cloud sync) | `true` (writing directly to cloud)       |
| Sync service            | `isSynced.service.ts` present    | Not needed, not present                  |
| Activation flow         | `activation.service.ts`          | Not needed, not present                  |
| Config setup            | `config.service.ts`              | Not needed, not present                  |
| Local DB helper         | `getLocalBusiness.ts`            | Removed                                  |

---

## What to Copy from the POS Project

| POS file                          | Dashboard destination               | Action      |
|-----------------------------------|-------------------------------------|-------------|
| `src/helper/excel.helper.ts`      | `src/utils/excel.helper.ts`         | Copy as-is  |
| `src/constant/moisConstants.ts`   | `src/utils/moisConstants.ts`        | Copy if needed for reports |
| `src/types/sale.ts`               | Reference only                      | Types already inlined in services |

---

## Environment Variables

| Variable           | Required | Description                              |
|--------------------|----------|------------------------------------------|
| CLOUD_DATABASE_URL | ✅        | Supabase PostgreSQL connection string    |
| JWT_SECRET         | ✅        | Secret for signing/verifying JWT tokens  |
| JWT_EXPIRES_IN     | Optional | Token expiry, default `7d`               |
| PORT               | Optional | Server port, default `4000`              |
| NODE_ENV           | Optional | `development` or `production`            |
| ALLOWED_ORIGIN     | Optional | CORS origin, default `*`                 |

---

## Important Notes for Production

1. **Never run `prisma migrate`** from this project. The POS owns the schema.
   Only use `prisma db pull` to refresh the generated client after POS schema changes.

2. **Set `ALLOWED_ORIGIN`** to your actual dashboard frontend URL.

3. **Use `NODE_ENV=production`** to suppress stack traces in error responses.

4. **JWT_SECRET** must be the same value across POS and Dashboard if you want
   POS-issued tokens to be accepted here. However, since the Dashboard issues
   `role: "OWNER"` tokens and the POS issues `role: "ADMIN"/"MANAGER"` tokens,
   they are functionally separate — the Dashboard's `verifyOwnerToken` rejects
   any token without `role === "OWNER"`.

5. **Rate limiting** — Consider adding `express-rate-limit` on `/api/auth/login`
   in production to prevent brute-force attacks.
