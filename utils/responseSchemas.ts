/**
 * Response Validation Schemas
 * Zod schemas for validating API responses
 */

import { z } from 'zod';

// ============ Common Schemas ============

export const UserSchema = z.object({
  _id: z.string(),
  name: z.string(),
  email: z.string().email(),
  role: z.enum(['user', 'admin']).optional(),
  emailVerified: z.boolean().optional(),
  isBlocked: z.boolean().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

export const ProductSchema = z.object({
  _id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  price: z.number().positive(),
  image: z.string().optional(),
  category: z.string().optional(),
  stock: z.number().optional(),
  rating: z.number().optional(),
  createdAt: z.string().optional(),
});

export const OrderItemSchema = z.object({
  product: z.string(),
  name: z.string(),
  price: z.number().positive(),
  qty: z.number().positive(),
  img: z.string().optional(),
});

export const OrderSchema = z.object({
  _id: z.string(),
  user: z.string(),
  items: z.array(OrderItemSchema),
  total: z.number().positive(),
  status: z.enum(['Processing', 'Shipped', 'Out for Delivery', 'Delivered']).optional(),
  isPaid: z.boolean().optional(),
  paymentMethod: z.enum(['Razorpay', 'COD']).optional(),
  createdAt: z.string().optional(),
});

export const ReviewSchema = z.object({
  _id: z.string(),
  user: z.string(),
  product: z.string(),
  rating: z.number().min(1).max(5),
  comment: z.string().optional(),
  createdAt: z.string().optional(),
});

export const CartSchema = z.object({
  _id: z.string(),
  user: z.string(),
  items: z.array(
    z.object({
      product: z.string(),
      qty: z.number().positive(),
    })
  ),
  createdAt: z.string().optional(),
});

export const WishlistSchema = z.object({
  _id: z.string(),
  user: z.string(),
  products: z.array(z.string()),
  createdAt: z.string().optional(),
});

// ============ Response Schemas ============

export const SuccessResponseSchema = z.object({
  success: z.literal(true),
  data: z.any().optional(),
  message: z.string().optional(),
});

export const ErrorResponseSchema = z.object({
  success: z.literal(false),
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.any().optional(),
  }),
});

export const PaginatedResponseSchema = z.object({
  success: z.literal(true),
  data: z.array(z.any()),
  page: z.number().positive(),
  limit: z.number().positive(),
  total: z.number().nonnegative(),
  totalPages: z.number().nonnegative(),
});

// ============ API Response Schemas ============

export const LoginResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    user: UserSchema,
    token: z.string(),
  }),
  message: z.string().optional(),
});

export const RegisterResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    user: UserSchema,
    token: z.string(),
  }),
  message: z.string().optional(),
});

export const GetUserResponseSchema = z.object({
  success: z.literal(true),
  data: UserSchema,
});

export const GetProductsResponseSchema = z.object({
  success: z.literal(true),
  data: z.array(ProductSchema),
  page: z.number().optional(),
  limit: z.number().optional(),
  total: z.number().optional(),
  totalPages: z.number().optional(),
});

export const GetProductResponseSchema = z.object({
  success: z.literal(true),
  data: ProductSchema,
});

export const GetOrdersResponseSchema = z.object({
  success: z.literal(true),
  data: z.array(OrderSchema),
  page: z.number().optional(),
  limit: z.number().optional(),
  total: z.number().optional(),
  totalPages: z.number().optional(),
});

export const GetOrderResponseSchema = z.object({
  success: z.literal(true),
  data: OrderSchema,
});

export const CreateOrderResponseSchema = z.object({
  success: z.literal(true),
  data: OrderSchema,
  message: z.string().optional(),
});

export const GetCartResponseSchema = z.object({
  success: z.literal(true),
  data: CartSchema,
});

export const GetWishlistResponseSchema = z.object({
  success: z.literal(true),
  data: WishlistSchema,
});

export const GetReviewsResponseSchema = z.object({
  success: z.literal(true),
  data: z.array(ReviewSchema),
  page: z.number().optional(),
  limit: z.number().optional(),
  total: z.number().optional(),
  totalPages: z.number().optional(),
});

// ============ Type Exports ============

export type User = z.infer<typeof UserSchema>;
export type Product = z.infer<typeof ProductSchema>;
export type Order = z.infer<typeof OrderSchema>;
export type Review = z.infer<typeof ReviewSchema>;
export type Cart = z.infer<typeof CartSchema>;
export type Wishlist = z.infer<typeof WishlistSchema>;
export type SuccessResponse = z.infer<typeof SuccessResponseSchema>;
export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;
export type PaginatedResponse = z.infer<typeof PaginatedResponseSchema>;
