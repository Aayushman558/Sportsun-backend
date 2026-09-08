# SportsSun Inventory & Warehouse Management — Backend Starter

A real, runnable starter for the inventory system: Express API + PostgreSQL (via Prisma), JWT auth, and role-based access control (Super Admin / Regional Manager / Store Manager).

## What's included
- Prisma schema covering Users, Products, Inventory, Locations, Transfers, Employees, Sales, AuditLogs, Notifications, StockAlerts (matches the original spec)
- Auth routes: login + refresh token, with a 15-minute session expiry and audit logging on login
- Role-based middleware (`requireAuth`, `requireRole`, `scopeToLocation`)
- Product routes: search/filter, create, and stock adjustment (auto-creates a low-stock alert)
- Docker Compose for one-command local setup (Postgres + API)

## What's scaffolded but not built out yet
These are structured so you can extend them following the same pattern as `src/routes/products.js`:
- `/api/inventory`, `/api/transfers`, `/api/employees`, `/api/sales`, `/api/analytics`
- 2FA (TOTP) — the login route has a clear comment marking where to add the verification step
- Barcode/QR scanning, email/SMS alerts, Google Maps integration, CSV export — these need real third-party accounts/credentials to wire up

## Local setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Copy the environment template and fill in real secrets:
   ```bash
   cp .env.example .env
   ```

3. Start Postgres + API with Docker:
   ```bash
   docker compose up --build
   ```
   Or, if you'd rather run Postgres separately, just run the API:
   ```bash
   npx prisma migrate dev --name init
   npm run dev
   ```

4. Confirm it's running:
   ```bash
   curl http://localhost:4000/health
   ```

## Creating your first admin user

There's no seed script yet — the fastest way to create your first Super Admin is via Prisma Studio:
```bash
npm run prisma:studio
```
Open the `User` table and add a row manually. Hash the password first with a quick Node snippet:
```js
require("bcrypt").hash("your-password", 10).then(console.log);
```

## API quick reference

| Method | Route | Access |
|---|---|---|
| POST | `/api/auth/login` | Public |
| POST | `/api/auth/refresh` | Public (valid refresh token) |
| GET | `/api/products?search=&category=` | Authenticated |
| POST | `/api/products` | Super Admin, Regional Manager |
| PATCH | `/api/products/:id/stock` | Authenticated |

## Next steps, roughly in priority order

1. Build out `/api/inventory` and `/api/transfers` (the schema already supports both)
2. Add the 2FA step to login (e.g. with `speakeasy` for TOTP)
3. Add the analytics endpoints the dashboard needs (sales trends, category split, size demand — see the frontend prototype for the exact shapes expected)
4. Wire up a real barcode scanning flow with `html5-qrcode` on the frontend, hitting the stock adjustment endpoint
5. Add automated tests before this touches real inventory data
