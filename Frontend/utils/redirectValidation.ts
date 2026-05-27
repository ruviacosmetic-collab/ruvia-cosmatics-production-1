/**
 * Redirect Validation Utilities
 * Prevents unvalidated redirects to malicious sites
 */

// Whitelist of allowed redirect destinations
const ALLOWED_REDIRECTS = [
  '/dashboard',
  '/orders',
  '/profile',
  '/checkout',
  '/shop',
  '/cart',
  '/wishlist',
  '/reviews',
  '/returns',
  '/support',
  '/auth',
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/verify-email',
  '/admin',
  '/admin/dashboard',
  '/admin/products',
  '/admin/orders',
  '/admin/users',
  '/admin/returns',
  '/admin/reviews',
  '/',
];

/**
 * Validate if a redirect URL is safe
 * @param url - URL to validate
 * @returns boolean - True if URL is safe to redirect to
 */
export const validateRedirect = (url: string | null | undefined): boolean => {
  if (!url || typeof url !== 'string') {
    return false;
  }

  // Remove leading/trailing whitespace
  const trimmedUrl = url.trim();

  // Check if URL is empty
  if (trimmedUrl.length === 0) {
    return false;
  }

  // Check for protocol (http://, https://, //, etc.)
  if (trimmedUrl.startsWith('http://') || trimmedUrl.startsWith('https://') || trimmedUrl.startsWith('//')) {
    return false;
  }

  // Check for javascript: protocol
  if (trimmedUrl.startsWith('javascript:')) {
    return false;
  }

  // Check for data: protocol
  if (trimmedUrl.startsWith('data:')) {
    return false;
  }

  // Check if URL is in whitelist
  if (ALLOWED_REDIRECTS.includes(trimmedUrl)) {
    return true;
  }

  // Check if URL starts with whitelisted path
  for (const allowed of ALLOWED_REDIRECTS) {
    if (allowed !== '/' && trimmedUrl.startsWith(allowed + '/')) {
      return true;
    }
  }

  return false;
};

/**
 * Get safe redirect URL
 * Returns the provided URL if valid, otherwise returns default
 * @param url - URL to validate
 * @param defaultUrl - Default URL if validation fails
 * @returns string - Safe URL to redirect to
 */
export const getSafeRedirectUrl = (
  url: string | null | undefined,
  defaultUrl: string = '/dashboard'
): string => {
  if (validateRedirect(url)) {
    return url as string;
  }

  return defaultUrl;
};

/**
 * Validate and redirect
 * @param router - Next.js router
 * @param url - URL to redirect to
 * @param defaultUrl - Default URL if validation fails
 */
export const safeRedirect = async (
  router: any,
  url: string | null | undefined,
  defaultUrl: string = '/dashboard'
) => {
  const safeUrl = getSafeRedirectUrl(url, defaultUrl);
  await router.push(safeUrl);
};

/**
 * Get redirect URL from query parameters
 * @param query - Query parameters object
 * @param paramName - Name of the redirect parameter (default: 'redirect')
 * @returns string | null - Redirect URL or null if not found
 */
export const getRedirectFromQuery = (
  query: Record<string, any>,
  paramName: string = 'redirect'
): string | null => {
  const redirectUrl = query[paramName];

  if (typeof redirectUrl === 'string') {
    return redirectUrl;
  }

  if (Array.isArray(redirectUrl)) {
    return redirectUrl[0] || null;
  }

  return null;
};

/**
 * Add redirect parameter to URL
 * @param baseUrl - Base URL
 * @param redirectUrl - URL to redirect to after operation
 * @returns string - URL with redirect parameter
 */
export const addRedirectParam = (baseUrl: string, redirectUrl: string): string => {
  if (!validateRedirect(redirectUrl)) {
    return baseUrl;
  }

  const separator = baseUrl.includes('?') ? '&' : '?';
  return `${baseUrl}${separator}redirect=${encodeURIComponent(redirectUrl)}`;
};

/**
 * Add allowed redirect destinations
 * Useful for extending the whitelist at runtime
 * @param urls - Array of URLs to add to whitelist
 */
export const addAllowedRedirects = (urls: string[]): void => {
  for (const url of urls) {
    if (typeof url === 'string' && !ALLOWED_REDIRECTS.includes(url)) {
      ALLOWED_REDIRECTS.push(url);
    }
  }
};

/**
 * Remove redirect destination from whitelist
 * @param url - URL to remove
 */
export const removeAllowedRedirect = (url: string): void => {
  const index = ALLOWED_REDIRECTS.indexOf(url);
  if (index > -1) {
    ALLOWED_REDIRECTS.splice(index, 1);
  }
};

/**
 * Get all allowed redirects
 * @returns string[] - Array of allowed redirect URLs
 */
export const getAllowedRedirects = (): string[] => {
  return [...ALLOWED_REDIRECTS];
};
