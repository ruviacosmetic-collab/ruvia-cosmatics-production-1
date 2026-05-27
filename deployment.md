# Deployment Guide — Vercel

This guide covers deploying the **Frontend** (Next.js 16) and **Backend** (Express + MongoDB) to Vercel.

> **Read this first.** Vercel runs the backend as serverless functions, not as a long-lived Node process. That has consequences for the in-memory features built in Phase 2-3 (rate limiting, CSRF token store, JWT blacklist, log rotation). See [Backend Trade-offs on Vercel](#backend-trade-offs-on-vercel) before committing to this hosting model. If those features are non-negotiable, the recommended path is **Frontend on Vercel + Backend on Render/Railway/Fly.io**, and the relevant section below covers that too.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Repository Layout](#repository-layout)
3. [Frontend — Vercel](#frontend--vercel)
4. [Backend — Vercel](#backend--vercel)
5. [Backend Trade-offs on Vercel](#backend-trade-offs-on-vercel)
6. [Recommended: Backend on Render/Railway](#recommended-backend-on-renderrailway)
7. [Post-deploy Checklist](#post-deploy-checklist)
8. [Troubleshooting](#troubleshooting)

---

## Prerequisites

- A [Vercel](https://vercel.com) account (Hobby plan is fine for staging).
- A MongoDB Atlas cluster reachable from the public internet. Free tier (M0) works for staging.
- Cloudinary account for product images.
- Razorpay account (Live mode keys for production, Test mode for staging).
- An SMTP relay (Brevo, SendGrid, AWS SES, etc.).
- Vercel CLI installed locally:
  ```bash
  npm i -g vercel
  vercel login
  ```

## Repository Layout

```
ruvia-cosmatics-optimization/
├── Frontend/                # Next.js 16 app
└── backend/                 # Express + Mongoose API
```

The two apps are deployed as **separate Vercel projects** pointing at the same Git repo with different root directories.

---

## Frontend — Vercel

The frontend is a Next.js 16 app and runs natively on Vercel.

### 1. Generate production secrets

The frontend itself only needs public env vars, but they must point at the deployed backend.

### 2. Create the Vercel project

From the repo root:

```bash
vercel link
```

When prompted:
- Set up and deploy → **N** (link first, deploy later from Vercel UI or CLI)
- Scope → your team/personal account
- Link to existing project → **N**
- Project name → `ruvia-frontend` (or any name)
- In which directory is your code located → `./Frontend`

Or, in the Vercel dashboard:
1. **New Project → Import Git Repository**
2. Select your repo.
3. **Root Directory** → `Frontend`
4. **Framework Preset** → Next.js (auto-detected)
5. Build Command → `next build` (default)
6. Output Directory → `.next` (default)
7. Install Command → `npm install` (default)

### 3. Environment variables

In **Project Settings → Environment Variables**, add for **Production** (and optionally Preview):

| Key | Example value | Notes |
|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | `https://ruvia.example.com` | Your Vercel domain or custom domain |
| `NEXT_PUBLIC_API_URL` | `https://api.ruvia.example.com` | URL of the deployed backend |

`NEXT_PUBLIC_*` vars are inlined at build time, so changing them requires a redeploy.

### 4. Custom domain (optional)

**Project → Settings → Domains** → add `ruvia.example.com`. Vercel provisions the TLS cert automatically and forces HTTPS.

### 5. Deploy

```bash
cd Frontend
vercel --prod
```

Or push to your production branch (`main` by default) — Vercel auto-deploys on every push.

### 6. Verify

- Visit `https://<your-domain>` and confirm the homepage loads.
- Open DevTools → Network and confirm API calls go to `NEXT_PUBLIC_API_URL`.
- Visit `/orders` while logged in to confirm IDOR redirect works.

---

## Backend — Vercel

Vercel hosts the backend as a single serverless function that wraps the existing Express app. The current code uses `app.listen()`, which **does not work on serverless**, so we add a thin entrypoint that exports the app.

### 1. Create the serverless entrypoint

Create `backend/api/index.js`:

```js
// backend/api/index.js
// Vercel serverless entrypoint. Imports the Express app and re-exports it
// so Vercel can invoke it as a Function.
//
// IMPORTANT: server.js currently calls app.listen(). For Vercel, we need to
// either refactor server.js to export the app (recommended) or duplicate its
// setup here. The minimal change is below — it requires a tiny edit to server.js.
const dotenv = require('dotenv');
dotenv.config();

const app = require('../server');
module.exports = app;
```

And refactor `backend/server.js` to **export the configured `app`** instead of (or in addition to) calling `app.listen()`. The smallest patch:

```js
// at the bottom of backend/server.js, replace:
//   app.listen(PORT, () => { console.log(`Server running on port ${PORT}`); });
// with:
const PORT = process.env.PORT || 5000;
if (require.main === module) {
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}
module.exports = app;
```

This keeps `npm start` working locally while also making `app` importable from `api/index.js`.

### 2. Add `vercel.json` to route everything to the function

Create `backend/vercel.json`:

```json
{
  "version": 2,
  "builds": [
    { "src": "api/index.js", "use": "@vercel/node" }
  ],
  "routes": [
    { "src": "/(.*)", "dest": "/api/index.js" }
  ],
  "functions": {
    "api/index.js": {
      "maxDuration": 30
    }
  }
}
```

`maxDuration: 30` is the Hobby tier limit; raise to `60` or higher on Pro if needed for long Razorpay or DB calls.

### 3. Create the Vercel project for the backend

```bash
vercel link
```

- Project name → `ruvia-backend`
- Root directory → `./backend`
- Framework Preset → **Other** (Vercel will detect `vercel.json`)

### 4. Environment variables

In **Project Settings → Environment Variables**, add for **Production**:

#### Required

| Key | Example | Notes |
|---|---|---|
| `NODE_ENV` | `production` | Enables prod-only behavior (HTTPS redirect, sanitized errors, file-based logs) |
| `MONGO_URI` | `mongodb+srv://user:pass@cluster.mongodb.net/ruvia?retryWrites=true&w=majority` | URL-encode any special chars in the password |
| `JWT_SECRET` | 64-char random hex | Generate: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| `ENCRYPTION_KEY` | 64-char hex | Generate: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `CORS_ORIGINS` | `https://ruvia.example.com` | Comma-separated, no trailing slash. Must include the frontend's exact origin |
| `FRONTEND_URL` | `https://ruvia.example.com` | Used in email links |

#### Razorpay

| Key | Notes |
|---|---|
| `RAZORPAY_KEY_ID` | From Razorpay dashboard (Live for prod) |
| `RAZORPAY_KEY_SECRET` | From Razorpay dashboard |

#### Cloudinary

| Key | Notes |
|---|---|
| `CLOUDINARY_CLOUD_NAME` | |
| `CLOUDINARY_API_KEY` | |
| `CLOUDINARY_API_SECRET` | |

#### Email (Brevo / SendGrid / SES)

| Key | Example |
|---|---|
| `EMAIL_HOST` | `smtp-relay.brevo.com` |
| `EMAIL_PORT` | `587` |
| `EMAIL_USER` | smtp username |
| `EMAIL_PASS` | smtp password |
| `EMAIL_FROM_NAME` | `Ruvia Cosmetics` |
| `EMAIL_FROM_EMAIL` | `noreply@ruvia.example.com` (must be a verified sender) |
| `EMAIL_REPLY_TO` | `support@ruvia.example.com` |
| `EMAIL_ENABLED` | `true` |

#### Optional

| Key | Notes |
|---|---|
| `LOG_REQUESTS` | `false` in prod (Morgan still logs slow + error) |
| `LOG_SLOW_REQUEST_MS` | default `500` |
| `ADMIN_PASSWORD` | seed admin account password |
| `ADMIN_NOTIFICATIONS_EMAIL` | comma-separated admin emails for new-order notifications |

### 5. Generate strong secrets

```bash
# JWT_SECRET (>= 64 chars in production)
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"

# ENCRYPTION_KEY (must be 32 bytes = 64 hex chars)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

`config/envValidation.js` will fail startup if `JWT_SECRET` is missing, < 32 chars, or matches the placeholder.

### 6. MongoDB Atlas — IP allowlist

Vercel functions don't have static outbound IPs. In Atlas:

- **Network Access → Add IP Address → Allow Access from Anywhere (`0.0.0.0/0`)** for staging.
- For production, use [Atlas Private Endpoint with AWS PrivateLink](https://www.mongodb.com/docs/atlas/security-private-endpoint/) or move the backend off Vercel.

### 7. CORS, cookies, CSRF — domain considerations

The backend sets cookies (`token`, `XSRF-TOKEN`) with `sameSite: 'strict'` and `secure: true` in production. For these to work cross-origin between `ruvia.example.com` (frontend) and `api.ruvia.example.com` (backend):

- Both domains **must** be served over HTTPS (Vercel does this by default).
- They must share a **registrable parent domain** (e.g. both under `ruvia.example.com`) so the browser treats them as same-site.
- If frontend and backend are on **different parent domains** (`ruvia.vercel.app` vs `ruvia-backend.vercel.app`), cookies with `sameSite: 'strict'` will not be sent. You'll need to either:
  - Use a custom domain layout (`ruvia.example.com` + `api.ruvia.example.com`), or
  - Loosen cookie policy in `backend/utils/cookieOptions.js` to `sameSite: 'none'` + `secure: true` (still scoped, but works cross-site).

`CORS_ORIGINS` must list the exact frontend origin (no trailing slash).

### 8. Razorpay webhook URL

After deploying, in the Razorpay dashboard set the webhook URL to:

```
https://api.ruvia.example.com/api/payments/razorpay/webhook
```

The webhook handler verifies HMAC-SHA256 signature, the `x-razorpay-timestamp` header (5-minute window), and dedupes by payload hash via the `WebhookEvent` model.

### 9. Deploy

```bash
cd backend
vercel --prod
```

### 10. Smoke-test the live deployment

```bash
# Health endpoint (returns "Ruvia Cosmetics API is running...")
curl -i https://api.ruvia.example.com/

# API version header
curl -sI https://api.ruvia.example.com/api/v1/products | grep -i x-api-version

# Security headers
curl -sI https://api.ruvia.example.com/ | grep -iE 'strict-transport|content-security|x-frame'

# Swagger UI (browser)
open https://api.ruvia.example.com/api-docs
```

---

## Backend Trade-offs on Vercel

Several Phase 2-3 features were built for a long-lived process. Here's how they behave on Vercel and what (if anything) to do about them.

| Feature | Behavior on Vercel | Mitigation |
|---|---|---|
| **Rate limiting** (`utils/rateLimitStore.js`) | In-memory `Map` per function instance. Each cold start starts a new bucket; concurrent invocations on different instances don't share counts. Effectively much weaker than designed. | Move to Redis (Upstash works on Vercel). Wrap `increment/check/reset` to use `INCR` + `EXPIRE`. |
| **CSRF token store** (`utils/csrfTokenStore.js`) | Same problem. A token issued by one function instance won't validate on another. Login flows will sporadically 403 on `validateCsrfToken`. | Either move to Redis or switch to a stateless **double-submit cookie** approach where the token is validated against the cookie alone (no server store). |
| **JWT blacklist** (`middleware/authMiddleware.js`) | Per-instance `Set`. Logout on one instance does not revoke on another. The `lastLogout` user field still works because it's persisted in MongoDB and the middleware checks `decoded.iat < lastLogout`. | Rely on `lastLogout` (already in place) and/or move the blacklist to Redis. |
| **Cleanup intervals** (rate limit, CSRF, JWT blacklist, log rotation) | `setInterval` does **not** run on serverless. Functions are spun down between requests. | Not needed if you migrate to Redis (use TTL). Log rotation is moot — Vercel's request logs come from the platform. |
| **Morgan file logging** (`access.log`, `error.log`) | Vercel functions have an ephemeral, mostly read-only filesystem under `/var/task`. The middleware tries `fs.mkdirSync(logsDir)` which will throw on production. | Either send Morgan to `process.stdout` only (skip file streams when `process.env.VERCEL` is set), or pipe logs to an external service (Datadog, Logtail). The platform also captures stdout in **Vercel → Logs**. |
| **MongoDB connection pool** (`config/db.js`, min 5 / max 10) | Each cold start opens new connections. Atlas free-tier has a 500-connection cap; high traffic across many warm instances can exhaust it. | Lower `maxPoolSize` to `1`–`3` for serverless, or move to a long-running host. Consider `mongodb-data-api` for stateless reads. |
| **Connection health monitoring** (`utils/connectionMonitor.js`) | The `setInterval`-based monitor never runs. | Drop it on serverless; rely on Atlas's own monitoring. |
| **Webhook idempotency** (`models/webhookEventModel.js`) | Works fine — backed by Mongo. | None. |
| **Audit log** (`models/auditLogModel.js`) | Works fine — backed by Mongo with TTL index. | None. |
| **HTTP→HTTPS redirect** | Vercel terminates TLS at the edge and always sets `x-forwarded-proto`. Works as expected. | None. |
| **Function timeout** | Hobby tier: 10s default, 30s max. Pro: 60s default, 300s max. | The 5s Razorpay timeout in `paymentController` is well under this. |
| **File uploads** | Multer's memory storage works. Body size limit on Vercel is 4.5 MB by default; the validator's 5 MB ceiling is effectively trimmed to 4.5 MB. | Document the 4.5 MB practical limit, or upload directly to Cloudinary from the browser using a signed upload URL (recommended). |

**Bottom line:** Vercel is fine for a low-traffic staging deploy of the backend. For production, either migrate the in-memory stores to Redis (Upstash REST works inside Vercel functions) or run the backend on a long-running host (next section).

---

## Recommended: Backend on Render/Railway

If you want all Phase 2-3 features to behave as designed without touching code, deploy the backend to a long-lived Node host and keep the frontend on Vercel.

### Render

1. Render dashboard → **New → Web Service**.
2. Connect repo. Root directory → `backend`.
3. Runtime → Node. Build command → `npm install`. Start command → `node server.js`.
4. Add the same environment variables as the [Backend section above](#4-environment-variables).
5. Add a custom domain (`api.ruvia.example.com`) and Render will provision TLS.
6. Health check path → `/`.

### Railway

1. **New project → Deploy from GitHub repo**.
2. Service → root `backend`.
3. Start command → `node server.js`.
4. Same env vars.
5. Generate a public domain or attach a custom one.

In both cases:
- `setInterval` cleanup loops, the connection pool, and Morgan file logs all work as designed.
- Atlas IP allowlist can use the host's static egress IPs (Render: IP allowlisting on paid plans; Railway: similar).

The frontend on Vercel just needs `NEXT_PUBLIC_API_URL` pointed at the new backend host.

---

## Post-deploy Checklist

Run through this once after the first production deploy.

### Frontend

- [ ] Homepage loads at `https://<frontend-domain>`
- [ ] Product list `/shop` renders without console errors
- [ ] Login (`/auth`) succeeds and sets the session cookie
- [ ] `/orders` IDOR check: log in as user A, try `/orders/<order-id-of-user-B>` → redirected to `/orders` with access-denied toast
- [ ] DevTools → Network → response from `/api/v1/products` includes `x-api-version: 1.0`

### Backend

- [ ] `GET /` returns the running message
- [ ] `GET /api-docs` serves Swagger UI
- [ ] `GET /api-docs.json` returns OpenAPI 3.0 spec
- [ ] `curl -sI <backend>/` shows `Strict-Transport-Security`, `Content-Security-Policy`, `X-Frame-Options`
- [ ] 6 failed `POST /api/v1/auth/login` from same IP → 6th returns 429 with `Retry-After` (only meaningful if Redis-backed or single-instance)
- [ ] `POST /api/v1/orders` without `X-CSRF-Token` → 403
- [ ] Place a Razorpay test order → webhook hits `/api/payments/razorpay/webhook` → order marked paid
- [ ] Register a new user → verification email lands in inbox
- [ ] Audit log entries created in MongoDB after a login
- [ ] Trigger a 500 in any controller → response body contains generic `Internal Server Error`, **no stack trace**, no leaked sensitive data

### Security

- [ ] All env vars in Vercel marked **Encrypted** (default)
- [ ] No `.env` file committed (`git ls-files | grep .env` returns nothing)
- [ ] Razorpay using **Live** keys in production env, not Test
- [ ] MongoDB user has least privilege (read/write on `ruvia` DB only, not `dbAdmin`)
- [ ] `JWT_SECRET` ≥ 64 chars, `ENCRYPTION_KEY` exactly 64 hex chars
- [ ] `CORS_ORIGINS` does not include `*` or `localhost` in production

---

## Troubleshooting

### `CORS error` from the browser

Cause: `CORS_ORIGINS` doesn't list the frontend origin, or has a trailing slash.
Fix: set `CORS_ORIGINS=https://ruvia.example.com` (no trailing slash, exact origin).

### Login succeeds but subsequent requests get 401

Cause: cookie is being set on the API origin but the browser isn't sending it cross-site.
Fix: ensure both apps share a registrable parent domain, or change cookie `sameSite` to `'none'` (with `secure: true`) in `backend/utils/cookieOptions.js`.

### `XSRF-TOKEN cookie missing` / 403 on POST

Cause: on Vercel serverless, the in-memory CSRF store doesn't persist across instances. The token issued on one function call may not be present when validation runs on another.
Fix: deploy backend to a long-running host, or migrate `csrfTokenStore` to Redis.

### MongoDB connections exhausted

Cause: too many serverless instances, each opening 5–10 connections.
Fix: lower `maxPoolSize` in `config/db.js` to `1` or `3` for Vercel, or move backend off Vercel.

### `EROFS: read-only file system, mkdir '/var/task/logs'`

Cause: Morgan tries to create a logs directory inside a Vercel function.
Fix: in `middleware/requestLoggingMiddleware.js`, skip file streams when `process.env.VERCEL === '1'` and use stdout only.

### `Unhandled error: ENCRYPTION_KEY environment variable is not set`

Cause: `ENCRYPTION_KEY` env var missing.
Fix: add a 64-char hex value to Vercel env vars and redeploy. The User model decrypt path falls back to plaintext if the key is missing, but writes will fail when the pre-save hook tries to encrypt.

### Razorpay webhook fails with 401

Cause: `RAZORPAY_KEY_SECRET` differs between dashboard and Vercel, so HMAC mismatches.
Fix: copy the secret from Razorpay → Settings → Webhooks → reveal, paste into Vercel, redeploy.

### Function times out at 10s on Hobby

Cause: cold start + DB connect + downstream API call exceeds 10s.
Fix: upgrade to Pro (60s default) or move backend to a long-running host.

---

## Rollback

Vercel keeps every deployment. To roll back:

1. **Project → Deployments**
2. Find the last known-good deployment.
3. Click **... → Promote to Production**.

Roll back the frontend and backend independently if needed.
