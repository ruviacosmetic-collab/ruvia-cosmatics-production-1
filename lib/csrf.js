/**
 * CSRF token plumbing for the SPA.
 *
 * The backend sets an `XSRF-TOKEN` cookie on every safe request and also
 * exposes the same value via the `X-CSRF-Token` response header. On every
 * state-changing request the SPA must echo that token back in the
 * `X-CSRF-Token` request header — that's the double-submit defense.
 *
 * Cross-site complication:
 *   In production the SPA lives on `*.vercel.app` and the API on
 *   `*.onrender.com`. Cookies set by the API are sent back automatically
 *   (with SameSite=None;Secure), BUT `document.cookie` on the SPA only
 *   exposes cookies for the SPA's own origin — it cannot read cookies
 *   issued by the API origin. So we cannot rely on reading the cookie
 *   client-side. Instead we capture the token from the API's
 *   `X-CSRF-Token` response header (which CORS exposes to us) and cache
 *   it in module memory.
 *
 * Public surface:
 *   getCsrfToken()
 *     Returns the most recently observed token, or null.
 *
 *   captureCsrfFromResponse(response)
 *     Read the `X-CSRF-Token` response header and store it.
 *
 *   withCsrf(options)
 *     Build fetch options with `credentials: "include"` and
 *     `X-CSRF-Token` attached for mutating methods.
 *
 *   csrfFetch(input, init)
 *     Drop-in replacement for `fetch` that wraps init via withCsrf and
 *     captures the response token before returning.
 */

const TOKEN_COOKIE_NAME = "XSRF-TOKEN";
const TOKEN_HEADER_NAME = "X-CSRF-Token";
const MUTATING = new Set(["POST", "PUT", "DELETE", "PATCH"]);

// In-memory cache. Survives navigations within a Next.js client-side
// session because this module is loaded once per page, but is reset on a
// hard reload — which is fine since the very next GET to the API will
// re-issue the token via response header.
let cachedToken = null;

const readCookie = (name) => {
  if (typeof document === "undefined") return null;
  const target = name + "=";
  const parts = document.cookie ? document.cookie.split(";") : [];
  for (const raw of parts) {
    const c = raw.trim();
    if (c.startsWith(target)) {
      return decodeURIComponent(c.substring(target.length));
    }
  }
  return null;
};

/**
 * Returns the most recently captured CSRF token. Falls back to the
 * `XSRF-TOKEN` cookie (works on same-origin / local dev) when no token has
 * been captured from a response header yet.
 */
export const getCsrfToken = () => cachedToken || readCookie(TOKEN_COOKIE_NAME);

/**
 * Cache the token from a response. Safe to call with any Response object;
 * silently no-ops if the header isn't present.
 */
export const captureCsrfFromResponse = (response) => {
  try {
    if (!response || typeof response.headers?.get !== "function") return;
    const value = response.headers.get(TOKEN_HEADER_NAME);
    if (value) cachedToken = value;
  } catch {
    /* ignore */
  }
};

/**
 * Wrap a fetch options object. Always sets `credentials: "include"` so the
 * auth cookie is sent. For mutating methods, attaches `X-CSRF-Token` from
 * the cached / cookie token if present.
 */
export const withCsrf = (options = {}) => {
  const method = String(options.method || "GET").toUpperCase();
  const next = {
    ...options,
    credentials: options.credentials || "include",
    headers: { ...(options.headers || {}) },
  };

  if (MUTATING.has(method)) {
    const token = getCsrfToken();
    if (token && !next.headers[TOKEN_HEADER_NAME] && !next.headers["x-csrf-token"]) {
      next.headers[TOKEN_HEADER_NAME] = token;
    }
  }

  return next;
};

/**
 * Drop-in replacement for `fetch`:
 *   - Applies `withCsrf` to the init object so credentials and the CSRF
 *     header are attached automatically.
 *   - Captures the `X-CSRF-Token` response header on success so the next
 *     mutating request has a fresh token to send back.
 *
 * Use this anywhere we previously called `fetch(apiUrl(...), init)`.
 */
export const csrfFetch = async (input, init) => {
  const response = await fetch(input, withCsrf(init || {}));
  captureCsrfFromResponse(response);
  return response;
};
