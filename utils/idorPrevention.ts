/**
 * IDOR (Insecure Direct Object Reference) Prevention Utilities
 * Prevents users from accessing resources they don't own
 */

/**
 * Verify that a resource belongs to the current user
 * @param resourceUserId - User ID from the API response
 * @param currentUserId - Current logged-in user ID
 * @returns boolean - True if resource belongs to current user
 */
export const verifyResourceOwnership = (
  resourceUserId: string | undefined,
  currentUserId: string | undefined
): boolean => {
  if (!resourceUserId || !currentUserId) {
    return false;
  }

  return resourceUserId === currentUserId;
};

/**
 * Handle access denied error
 * Redirects to safe page and shows error message
 * @param router - Next.js router
 * @param message - Error message to display
 */
export const handleAccessDenied = async (
  router: any,
  message: string = 'You do not have permission to access this resource'
) => {
  // Log the attempt for security monitoring
  console.warn('Access denied:', message);

  // Show error message (you can use a toast library here)
  if (typeof window !== 'undefined') {
    // Store error message in session storage for display on redirect
    sessionStorage.setItem('accessDeniedMessage', message);
  }

  // Redirect to safe page
  await router.push('/orders');
};

/**
 * Verify order ownership before displaying
 * @param order - Order object from API
 * @param currentUserId - Current user ID
 * @returns boolean - True if order belongs to current user
 */
export const verifyOrderOwnership = (
  order: any,
  currentUserId: string | undefined
): boolean => {
  if (!order || !currentUserId) {
    return false;
  }

  // Check if order.user matches current user
  const orderUserId = order.user?._id || order.user;
  return verifyResourceOwnership(orderUserId, currentUserId);
};

/**
 * Verify user profile ownership before displaying
 * @param profile - User profile object from API
 * @param currentUserId - Current user ID
 * @returns boolean - True if profile belongs to current user
 */
export const verifyProfileOwnership = (
  profile: any,
  currentUserId: string | undefined
): boolean => {
  if (!profile || !currentUserId) {
    return false;
  }

  return verifyResourceOwnership(profile._id, currentUserId);
};

/**
 * Verify payment ownership before displaying
 * @param payment - Payment object from API
 * @param currentUserId - Current user ID
 * @returns boolean - True if payment belongs to current user
 */
export const verifyPaymentOwnership = (
  payment: any,
  currentUserId: string | undefined
): boolean => {
  if (!payment || !currentUserId) {
    return false;
  }

  const paymentUserId = payment.user?._id || payment.user;
  return verifyResourceOwnership(paymentUserId, currentUserId);
};

/**
 * Verify review ownership before allowing edit/delete
 * @param review - Review object from API
 * @param currentUserId - Current user ID
 * @returns boolean - True if review belongs to current user
 */
export const verifyReviewOwnership = (
  review: any,
  currentUserId: string | undefined
): boolean => {
  if (!review || !currentUserId) {
    return false;
  }

  const reviewUserId = review.user?._id || review.user;
  return verifyResourceOwnership(reviewUserId, currentUserId);
};

/**
 * Verify return request ownership
 * @param returnRequest - Return request object from API
 * @param currentUserId - Current user ID
 * @returns boolean - True if return request belongs to current user
 */
export const verifyReturnOwnership = (
  returnRequest: any,
  currentUserId: string | undefined
): boolean => {
  if (!returnRequest || !currentUserId) {
    return false;
  }

  const returnUserId = returnRequest.user?._id || returnRequest.user;
  return verifyResourceOwnership(returnUserId, currentUserId);
};

/**
 * Verify wishlist ownership
 * @param wishlist - Wishlist object from API
 * @param currentUserId - Current user ID
 * @returns boolean - True if wishlist belongs to current user
 */
export const verifyWishlistOwnership = (
  wishlist: any,
  currentUserId: string | undefined
): boolean => {
  if (!wishlist || !currentUserId) {
    return false;
  }

  const wishlistUserId = wishlist.user?._id || wishlist.user;
  return verifyResourceOwnership(wishlistUserId, currentUserId);
};

/**
 * Verify cart ownership
 * @param cart - Cart object from API
 * @param currentUserId - Current user ID
 * @returns boolean - True if cart belongs to current user
 */
export const verifyCartOwnership = (
  cart: any,
  currentUserId: string | undefined
): boolean => {
  if (!cart || !currentUserId) {
    return false;
  }

  const cartUserId = cart.user?._id || cart.user;
  return verifyResourceOwnership(cartUserId, currentUserId);
};
