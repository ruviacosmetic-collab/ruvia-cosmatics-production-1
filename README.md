# Ruvia Cosmetics — Full‑Stack E‑Commerce (Next.js + Express + MongoDB)

Production-minded MERN-style e-commerce application with a **customer storefront** and an **admin portal**.

This README is written in an “Amazon SDE” style: **clear architecture**, **service boundaries**, **tradeoffs**, and **how to run + operate** the system.

---

## Table of contents
- [High-level architecture](#high-level-architecture)
- [Repository layout](#repository-layout)
- [Feature set](#feature-set)
- [Key data flows](#key-data-flows)
- [Local development](#local-development)
- [Environment variables](#environment-variables)
- [Performance work (what we changed)](#performance-work-what-we-changed)
- [Tradeoffs & known gaps](#tradeoffs--known-gaps)
- [Production readiness](#production-readiness)
- [Phase 5 measurement & profiling](#phase-5-measurement--profiling)

---

## High-level architecture

### Services
1. **Frontend** (`Frontend/`)
   - Next.js 16 (App Router), React 19, Tailwind
   - Runs at `http://localhost:3000` in dev
2. **Backend API** (`backend/`)
   - Express 5 + Mongoose (MongoDB)
   - Runs at `http://localhost:5000` in dev

### Authentication model
- Backend issues a JWT and sets an **httpOnly cookie** (`token`) on login/register.
- Frontend calls authenticated endpoints with `credentials: "include"` so cookies are sent.

> Note: Some legacy cleanup code removes old `localStorage` values, but the current intent is cookie-first auth.

### Deployment target (recommended)
See [PRODUCTION_READINESS_PLAN.md](./PRODUCTION_READINESS_PLAN.md) for a full checklist targeting:
- **Vercel** for the Next.js frontend
- **Render** for the Express backend
- **MongoDB Atlas** for the database
- **Cloudinary** for media
- **Razorpay** for payments

---

## Repository layout

```
ruvia-cosmatics-main/
  Frontend/                 # Next.js app (App Router)
    app/                    # Routes: /, /shop, /checkout, /orders, /admin/*
    components/             # UI components + layout
    context/                # Auth/Cart/Wishlist contexts (memoized)
    lib/                    # apiClient + invoice pdf logic
    public/                 # static images
    next.config.ts
    package.json

  backend/                  # Express API service
    server.js               # Express bootstrap + middlewares + route mounting
    config/                 # DB + env validation + 3rd party config
    routes/                 # Express routers
    controllers/            # Request handlers / business logic
    models/                 # Mongoose models
    middleware/             # auth/error/validation/sanitization
    scripts/                # seed/admin scripts
    utils/                  # token/email helpers
    package.json

  docs/                     # prior audits and analysis docs
  PRODUCTION_READINESS_PLAN.md
  PM_CODEBASE_REVIEW.md
```

---

## Feature set

### Customer (storefront)
- Browse products and product detail pages (`/shop`, `/shop/[id]`)
- Cart (local-first with optional authenticated server sync)
- Checkout (COD + Razorpay)
- Orders list + order details (`/orders`, `/orders/[id]`)
- Invoice download (PDF)
- Wishlist
- Profile (addresses, basic profile update)

### Admin (portal)
- Admin login (`/admin/login`)
- Dashboard with charts (`/admin/dashboard`)
- Products management (`/admin/products`)
- Orders management + status updates (`/admin/orders`)
- Reviews + returns pages (`/admin/reviews`, `/admin/returns`)

---

## Key data flows

### 1) Login / bootstrap
1. Frontend bootstraps by calling `GET /api/auth/me` with cookies.
2. If 401 → treat as logged out (non-fatal).
3. If 200 → hydrate user profile and addresses.

### 2) Cart sync
- Cart is stored in `localStorage` for instant UX.
- If authenticated, cart will also sync to backend `/api/cart`.

### 3) Checkout / order creation
1. Frontend submits order items + address + payment method to `POST /api/orders`
2. Backend validates items against DB prices + stock and calculates totals
3. Stock decrement happens after order creation (see tradeoffs section for transactional improvements)

### 4) Payments (Razorpay)
- Razorpay order creation + verification endpoints exist under `/api/payments`.
- Webhook endpoint uses raw body parsing for signature verification.

---

## Local development

### Prerequisites
- Node.js 20+
- MongoDB connection (Atlas recommended)

### 1) Backend
```bash
cd backend
npm install
npm run dev
```

### 2) Frontend
```bash
cd Frontend
npm install
npm run dev
```

Open: http://localhost:3000

> Dev note: first navigation to a route may show “Compiling …” (expected). Subsequent navigations should be fast.

---

## Environment variables

### Frontend (`Frontend/.env.local`)
- `NEXT_PUBLIC_API_URL=http://localhost:5000`

### Backend (`backend/.env`)
See `backend/.env.example` for the full list.

---

## Performance work (what we changed)

### Phase 1 — dev turnaround
- Switched dev to **Turbopack** (`npm run dev`) with a fallback `npm run dev:webpack`
- Fixed Next.js “workspace root / multiple lockfiles” noise by pinning `outputFileTracingRoot`
- Removed generated `.next/` artifacts from the repo folder

### Phase 2 — reduce route-level JS
- **Admin Dashboard charts** (Recharts) now load via `next/dynamic()` (only when needed)
- **Invoice PDF** (`jspdf`, `jspdf-autotable`) is lazy-loaded only when user clicks “Invoice”

### Phase 3 — smoother UX
- Added route-level `loading.js` skeletons for heavy routes (`/shop`, `/orders`, `/checkout`, and admin routes)
- Memoized context values/callbacks to reduce rerender churn
- Silenced Next scroll-behavior warning via `data-scroll-behavior="smooth"`

### Phase 4 — safer delivery
- Added GitHub Actions CI build workflow (build-only)
- Added backend `start`/`dev` scripts

---

## Tradeoffs & known gaps

### 1) Dev speed vs production behavior
- In dev, Next compiles routes on first hit. This is expected, but it can look like “slow rendering”.
- Production builds are pre-optimized and do not pay the same compile cost.

### 2) Cart model (local-first)
**Pros**
- Instant UX and resilience against flaky network

**Cons**
- Requires careful sync rules to avoid conflicts between server cart and local cart.

### 3) Inventory consistency
Current behavior decrements stock after order save without a DB transaction.
**Risk:** oversell or inconsistent inventory under concurrent checkouts/retries.
**Recommended:** MongoDB session transactions + idempotency keys.

### 4) Payments trust boundary
Razorpay integration exists, but production hardening requires:
- Server-authoritative amount derivation
- Paid status transitions based only on verified events

See [PRODUCTION_READINESS_PLAN.md](./PRODUCTION_READINESS_PLAN.md).

### 5) Lint/test maturity
- Lint currently reports issues in some pages (strings, React purity warnings, etc.).
- Test coverage is minimal.
**Tradeoff:** moving fast vs stable release engineering; plan is to add smoke tests and backend integration tests.

---

## Production readiness

- **Full plan:** [PRODUCTION_READINESS_PLAN.md](./PRODUCTION_READINESS_PLAN.md)
- **PM audit / risk register:** [PM_CODEBASE_REVIEW.md](./PM_CODEBASE_REVIEW.md)

---

## Phase 5 measurement & profiling

### 1) Frontend bundle analysis
```bash
cd Frontend
npm run analyze
```
Use the report to identify large route chunks and candidates for dynamic import.

### 2) React render profiling
- Use React DevTools Profiler on:
  - `/shop`, `/checkout`, `/orders`, `/admin/dashboard`
- Look for:
  - repeated rerenders of large trees
  - expensive component commits

### 3) Next.js performance tracing (dev)
- Chrome DevTools:
  - Performance tab: record during route transitions
  - Network tab: confirm API latency vs JS execution time

### 4) Backend latency measurement
- Enable request timing logs by setting:
  - `LOG_REQUESTS=true` (see middleware added in Phase 5 work)

---

## Contributing
See `Frontend/CONTRIBUTING.md` for conventions (commit format, quality gates).

