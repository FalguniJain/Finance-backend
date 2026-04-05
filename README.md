# 💰 Finance Dashboard Backend

A production-quality REST API for managing financial records with role-based access control, built with **Node.js**, **TypeScript**, **Express**, and **PostgreSQL** (via Prisma ORM).

---

## 📋 Table of Contents

- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Role & Permission Model](#role--permission-model)
- [Setup & Installation](#setup--installation)
- [Environment Variables](#environment-variables)
- [API Reference](#api-reference)
- [Design Decisions & Assumptions](#design-decisions--assumptions)
- [Data Model](#data-model)
- [Security Considerations](#security-considerations)
- [Testing](#testing)
- [Folder Structure](#folder-structure)

---

## 🛠 Tech Stack

| Layer | Technology | Reason |
|---|---|---|
| Runtime | Node.js (v18+) | Stable LTS, wide ecosystem |
| Language | TypeScript | Type safety, better DX, catches errors at compile time |
| Framework | Express.js | Minimal, flexible, industry standard |
| ORM | Prisma | Type-safe DB access, great migrations, readable schema |
| Database | PostgreSQL | ACID compliance, strong support for financial data |
| Auth | JWT (access + refresh) | Stateless, scalable, standard |
| Validation | Zod | Schema-first, TypeScript-native, great error messages |
| Docs | Swagger / OpenAPI 3.0 | Self-documenting, interactive API explorer |
| Logging | Winston | Structured JSON logs, configurable levels |
| Password | bcrypt (12 rounds) | Industry standard for password hashing |

---

## 🏗 Architecture

The project follows a **layered architecture** with clear separation of concerns:

```
HTTP Request
     │
     ▼
  Router          → Defines routes, applies middleware chains
     │
     ▼
  Middleware       → Auth, Role Check, Validation (in order)
     │
     ▼
  Controller       → Parses request, calls service, sends response
     │
     ▼
  Service          → Business logic, orchestrates data access
     │
     ▼
  Prisma Client    → Type-safe database queries
     │
     ▼
  PostgreSQL
```

Each layer has a single responsibility:
- **Routes** declare what middleware runs and in what order
- **Controllers** are thin — they just extract data and call services
- **Services** contain all business logic
- **Middlewares** are reusable, composable guards

---

## 🔐 Role & Permission Model

Three roles are supported with a hierarchical permission model:

| Action | VIEWER | ANALYST | ADMIN |
|--------|:------:|:-------:|:-----:|
| Login / Auth | ✅ | ✅ | ✅ |
| View transactions (list, filter, detail) | ✅ | ✅ | ✅ |
| View dashboard summary | ✅ | ✅ | ✅ |
| View recent activity | ✅ | ✅ | ✅ |
| Category breakdown analytics | ❌ | ✅ | ✅ |
| Income/expense trends | ❌ | ✅ | ✅ |
| Top categories analytics | ❌ | ✅ | ✅ |
| Create transactions | ❌ | ❌ | ✅ |
| Update transactions | ❌ | ❌ | ✅ |
| Delete transactions (soft) | ❌ | ❌ | ✅ |
| Manage users (CRUD) | ❌ | ❌ | ✅ |
| View user stats | ❌ | ❌ | ✅ |

**Implementation**: Roles are checked via `requireRole()` middleware which uses a numeric hierarchy (`VIEWER=1`, `ANALYST=2`, `ADMIN=3`). Any user with a level ≥ the required level is granted access.

---

## ⚡ Setup & Installation

### Prerequisites

- Node.js 18+
- PostgreSQL 14+
- npm or yarn

### 1. Clone and Install

```bash
git clone <repo-url>
cd finance-backend
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env with your database credentials and JWT secrets
```

### 3. Set Up Database

```bash
# Generate Prisma client
npm run db:generate

# Run migrations
npm run db:migrate

# Seed with sample data and users
npm run db:seed
```

### 4. Start the Server

```bash
# Development (with hot reload)
npm run dev

# Production
npm run build && npm start
```

### 5. Access API Docs

Open **http://localhost:3000/api/docs** in your browser for the interactive Swagger UI.

---

## 🔧 Environment Variables

| Variable | Description | Default |
|---|---|---|
| `NODE_ENV` | `development` or `production` | `development` |
| `PORT` | Server port | `3000` |
| `DATABASE_URL` | PostgreSQL connection string | _(required)_ |
| `JWT_SECRET` | Secret for access tokens (min 32 chars) | _(required)_ |
| `JWT_EXPIRES_IN` | Access token expiry | `15m` |
| `JWT_REFRESH_SECRET` | Secret for refresh tokens | _(required)_ |
| `JWT_REFRESH_EXPIRES_IN` | Refresh token expiry | `7d` |
| `RATE_LIMIT_WINDOW_MS` | Rate limit window in ms | `900000` (15min) |
| `RATE_LIMIT_MAX` | Max requests per window | `100` |

---

## 📡 API Reference

Base URL: `http://localhost:3000/api`

Interactive docs: `http://localhost:3000/api/docs`

### Authentication

All protected endpoints require:
```
Authorization: Bearer <access_token>
```

### Seeded Test Credentials

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@finance.com | Admin@123 |
| Analyst | analyst@finance.com | Analyst@123 |
| Viewer | viewer@finance.com | Viewer@123 |

---

### Auth Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/auth/login` | Public | Login with email + password |
| `POST` | `/auth/refresh` | Public | Refresh access token |
| `POST` | `/auth/logout` | Any role | Invalidate refresh token |
| `GET` | `/auth/me` | Any role | Get current user profile |

**Login Request:**
```json
POST /api/auth/login
{
  "email": "admin@finance.com",
  "password": "Admin@123"
}
```

**Login Response:**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "accessToken": "eyJhbGci...",
    "refreshToken": "eyJhbGci...",
    "expiresIn": "15m",
    "user": { "id": "...", "name": "Alice Admin", "email": "admin@finance.com", "role": "ADMIN" }
  }
}
```

---

### User Endpoints (Admin only)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/users` | List users (paginated, searchable) |
| `GET` | `/users/stats` | User counts by role and status |
| `GET` | `/users/:id` | Get a specific user |
| `POST` | `/users` | Create a new user |
| `PATCH` | `/users/:id` | Update user (name, role, status) |
| `DELETE` | `/users/:id` | Delete a user |

---

### Transaction Endpoints

| Method | Path | Role Required | Description |
|--------|------|--------------|-------------|
| `GET` | `/transactions` | VIEWER+ | List with filtering + pagination |
| `GET` | `/transactions/categories` | VIEWER+ | All unique categories by type |
| `GET` | `/transactions/:id` | VIEWER+ | Single transaction detail |
| `POST` | `/transactions` | ADMIN | Create new transaction |
| `PATCH` | `/transactions/:id` | ADMIN | Update transaction |
| `DELETE` | `/transactions/:id` | ADMIN | Soft-delete transaction |

**Filtering Query Parameters:**
```
GET /api/transactions?type=EXPENSE&category=Rent&startDate=2024-01-01T00:00:00Z&endDate=2024-03-31T23:59:59Z&minAmount=1000&maxAmount=50000&search=rent&tags=recurring,housing&page=1&limit=20&sortBy=date&sortOrder=desc
```

---

### Dashboard Endpoints

| Method | Path | Role Required | Description |
|--------|------|--------------|-------------|
| `GET` | `/dashboard/summary` | VIEWER+ | Total income, expenses, net balance |
| `GET` | `/dashboard/recent` | VIEWER+ | Most recent transactions |
| `GET` | `/dashboard/categories` | ANALYST+ | Category-wise totals with percentages |
| `GET` | `/dashboard/trends` | ANALYST+ | Monthly/weekly income vs expense trends |
| `GET` | `/dashboard/top-categories` | ANALYST+ | Top spending or earning categories |

**Dashboard Summary Response:**
```json
{
  "success": true,
  "data": {
    "totalIncome": 293500,
    "totalExpenses": 126300,
    "netBalance": 167200,
    "transactionCount": 23,
    "incomeTransactions": 7,
    "expenseTransactions": 16,
    "period": { "startDate": null, "endDate": null }
  }
}
```

**Trends Response:**
```json
{
  "success": true,
  "data": [
    { "period": "2024-01", "income": 100000, "expenses": 58700, "net": 41300 },
    { "period": "2024-02", "income": 93000, "expenses": 48900, "net": 44100 },
    { "period": "2024-03", "income": 100500, "expenses": 47800, "net": 52700 }
  ]
}
```

---

### Standard Response Format

All responses follow a consistent envelope:

```json
// Success
{
  "success": true,
  "message": "...",
  "data": { ... },
  "meta": {          // Only on paginated responses
    "page": 1,
    "limit": 20,
    "total": 100,
    "totalPages": 5,
    "hasNext": true,
    "hasPrev": false
  }
}

// Error
{
  "success": false,
  "message": "...",
  "errors": {        // Only on validation errors
    "fieldName": ["error message"]
  }
}
```

---

## 🗃 Data Model

### Users Table

```
users
├── id           CUID (PK)
├── name         string
├── email        string (unique)
├── passwordHash string
├── role         VIEWER | ANALYST | ADMIN
├── status       ACTIVE | INACTIVE
├── createdAt    datetime
└── updatedAt    datetime
```

### Transactions Table

```
transactions
├── id           CUID (PK)
├── amount       Decimal(15,2)        -- Supports up to ~trillion
├── type         INCOME | EXPENSE
├── category     string               -- Indexed for fast filtering
├── date         datetime             -- The actual transaction date
├── description  string?
├── notes        string?
├── tags         string[]             -- Array for multi-tag filtering
├── isDeleted    boolean              -- Soft delete flag
├── createdById  FK → users.id
├── createdAt    datetime             -- Indexed
└── updatedAt    datetime
```

### RefreshTokens Table

```
refresh_tokens
├── id        CUID (PK)
├── token     string (unique)
├── userId    FK → users.id
├── expiresAt datetime
└── createdAt datetime
```

---

## 🛡 Security Considerations

1. **Password hashing** — bcrypt with 12 salt rounds
2. **Token rotation** — Refresh tokens are single-use; a new one is issued on every refresh
3. **Timing-safe auth** — Invalid email still runs bcrypt.compare() to prevent user enumeration attacks
4. **Rate limiting** — Global (100 req/15min) + strict auth limiter (10 req/15min)
5. **Input validation** — All inputs validated with Zod before hitting business logic
6. **Helmet** — Sets security-related HTTP headers
7. **CORS** — Configurable per environment
8. **Soft deletes** — Transactions are never hard-deleted; `isDeleted` flag preserves audit trail
9. **Prisma parameterized queries** — No raw SQL, safe against SQL injection
10. **Inactive users** — Cannot authenticate even with valid credentials

---

## 🧪 Testing

```bash
# Run all tests
npm test

# Run with coverage
npm test -- --coverage
```

Tests cover:
- Validation schema edge cases (unit tests)
- HTTP response codes for auth flows
- RBAC enforcement
- Health check endpoint
- 404 handling

---

## 📁 Folder Structure

```
finance-backend/
├── prisma/
│   ├── schema.prisma          # Database schema and models
│   └── seed.ts                # Seed script with demo data
├── src/
│   ├── config/
│   │   ├── database.ts        # Prisma client singleton
│   │   ├── env.ts             # Typed environment config
│   │   ├── logger.ts          # Winston logger setup
│   │   └── swagger.ts         # OpenAPI spec config
│   ├── controllers/           # Request handlers (thin layer)
│   │   ├── auth.controller.ts
│   │   ├── user.controller.ts
│   │   ├── transaction.controller.ts
│   │   └── dashboard.controller.ts
│   ├── middlewares/
│   │   ├── auth.middleware.ts     # JWT verification + RBAC guards
│   │   ├── validate.middleware.ts # Zod schema validation
│   │   └── error.middleware.ts    # Global error handler
│   ├── routes/                # Route definitions with Swagger docs
│   │   ├── auth.routes.ts
│   │   ├── user.routes.ts
│   │   ├── transaction.routes.ts
│   │   └── dashboard.routes.ts
│   ├── services/              # Business logic layer
│   │   ├── auth.service.ts
│   │   ├── user.service.ts
│   │   ├── transaction.service.ts
│   │   └── dashboard.service.ts
│   ├── types/
│   │   └── index.ts           # Shared TypeScript types and DTOs
│   ├── utils/
│   │   └── helpers.ts         # Error classes, response builders, pagination
│   ├── validations/
│   │   └── schemas.ts         # All Zod schemas
│   ├── __tests__/
│   │   ├── api.test.ts        # Integration tests
│   │   └── validation.test.ts # Unit tests for schemas
│   ├── app.ts                 # Express app setup
│   └── server.ts              # Entry point, graceful shutdown
├── .env.example
├── jest.config.js
├── package.json
├── tsconfig.json
└── README.md
```

---

## 🤔 Design Decisions & Assumptions

### 1. Soft Deletes for Transactions
Transactions are never hard-deleted (`isDeleted` flag). This preserves a complete audit trail, which is critical in any financial system.

### 2. Decimal Type for Money
Using `Decimal(15, 2)` in PostgreSQL (via Prisma's `Decimal` type) avoids floating-point precision errors that would occur with plain `float`. All amounts are serialized to `number` in responses only after conversion.

### 3. Access Token Expiry of 15 Minutes
Short-lived access tokens reduce the window of exposure if a token is compromised. Refresh tokens (7 days) allow users to stay logged in without re-entering credentials.

### 4. Refresh Token Rotation
Each use of a refresh token issues a new one and invalidates the old. This means stolen refresh tokens are detected on next use.

### 5. Role Hierarchy vs. Permission Lists
Rather than maintaining explicit permission lists per action, a numeric hierarchy (`VIEWER < ANALYST < ADMIN`) makes adding new roles straightforward and reduces configuration surface area.

### 6. ANALYST Cannot Mutate Transactions
The assumption is that analysts are read + insights focused. Only admins can modify financial records to maintain data integrity.

### 7. Tags as String Array
Tags are stored as a native PostgreSQL array (via Prisma `String[]`). This allows efficient `hasSome` filtering without a separate join table, which would be overkill for this use case.

### 8. `createdAt` vs `date` on Transactions
The `date` field represents when the transaction actually occurred (the business date). `createdAt` is the system timestamp of when the record was entered. Both are useful for different analytics.

---

## 🚀 Possible Enhancements (Not Implemented)

- **Budget limits per category** — Alert when spending exceeds budget
- **Recurring transactions** — Auto-create transactions on a schedule
- **Export to CSV/PDF** — Financial reports generation
- **Multi-currency support** — Add `currency` + exchange rate fields
- **Audit log** — Track all changes to transactions with before/after state
- **WebSocket** — Real-time dashboard updates on new transactions
- **Redis caching** — Cache dashboard aggregations, invalidate on write

---

## 📄 License

MIT — Built as a technical assignment submission.
