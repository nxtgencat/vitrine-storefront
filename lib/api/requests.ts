import { z } from "zod";

import { request } from "@/lib/api/client";
import {
  sessionResponseSchema,
  signInResponseSchema,
  signOutResponseSchema,
  signUpResponseSchema,
} from "@/lib/types/auth";
import { cartListSchema } from "@/lib/types/cart";
import {
  addressListSchema,
  createAddressBodySchema,
  custAddressRowSchema,
  type CustAddressRow,
} from "@/lib/types/address";
import {
  cancelOrderResponseSchema,
  customerOrderDetailSchema,
  customerOrderListSchema,
  storefrontCheckoutResultSchema,
  type CustomerOrderDetail,
  type CustomerOrderRow,
  type StorefrontCheckoutResult,
} from "@/lib/types/order";
import { healthResponseSchema, type Health } from "@/lib/types/ops";
import {
  storefrontProductDetailSchema,
  storefrontProductListSchema,
  type StorefrontProductDetail,
  type StorefrontProductList,
} from "@/lib/types/product";
import {
  createSalesReturnBodySchema,
  createSalesReturnResultSchema,
  type CreateSalesReturnResult,
} from "@/lib/types/returns";
import { wishlistItemSchema, wishlistListSchema } from "@/lib/types/wishlist";

/**
 * Typed endpoint functions (api.md §1–§5). Every mutation goes through
 * `request` with `key: true` (Idempotency-Key); reads never send one. Auth
 * endpoints are the documented passthrough exception and never send an
 * idempotency key (api.md §1).
 */

// ---------------------------------------------------------------------------
// Auth (api.md §1)
// ---------------------------------------------------------------------------

export function signUp(body: { name: string; email: string; password: string }) {
  return request({ method: "POST", path: "/auth/sign-up/email", body, schema: signUpResponseSchema });
}

export function signIn(body: { email: string; password: string }) {
  return request({ method: "POST", path: "/auth/sign-in/email", body, schema: signInResponseSchema });
}

export function signOut() {
  return request({ method: "POST", path: "/auth/sign-out", body: {}, schema: signOutResponseSchema });
}

export function getSession() {
  return request({ method: "GET", path: "/auth/get-session", schema: sessionResponseSchema });
}

// ---------------------------------------------------------------------------
// Catalog (api.md §2)
// ---------------------------------------------------------------------------

export function listStorefrontProducts(params?: { q?: string }): Promise<StorefrontProductList> {
  return request({ method: "GET", path: "/storefront/products", params, schema: storefrontProductListSchema });
}

export function getStorefrontProduct(slug: string): Promise<StorefrontProductDetail> {
  return request({ method: "GET", path: `/storefront/products/${slug}`, schema: storefrontProductDetailSchema });
}

// ---------------------------------------------------------------------------
// Cart, wishlist, addresses (api.md §3)
// ---------------------------------------------------------------------------

export function getCart() {
  return request({ method: "GET", path: "/storefront/cart", schema: cartListSchema });
}

export function upsertCartItem(body: { variantId: string; quantity: number }) {
  return request({ method: "PUT", path: "/storefront/cart", body, key: true, schema: z.object({}).passthrough() });
}

export function removeCartItem(variantId: string) {
  return request({ method: "DELETE", path: `/storefront/cart/${variantId}`, body: {}, key: true, schema: z.object({}).passthrough() });
}

export function getWishlist() {
  return request({ method: "GET", path: "/storefront/wishlist", schema: wishlistListSchema });
}

export function getWishlistItem(variantId: string) {
  return request({ method: "GET", path: `/storefront/wishlist/${variantId}`, schema: wishlistItemSchema });
}

export function addWishlistItem(body: { variantId: string }) {
  return request({ method: "POST", path: "/storefront/wishlist", body, key: true, schema: z.object({}).passthrough() });
}

export function removeWishlistItem(variantId: string) {
  return request({ method: "DELETE", path: `/storefront/wishlist/${variantId}`, body: {}, key: true, schema: z.object({}).passthrough() });
}

export function listAddresses() {
  return request({ method: "GET", path: "/storefront/addresses", schema: addressListSchema });
}

export function createAddress(body: z.infer<typeof createAddressBodySchema>): Promise<CustAddressRow> {
  return request({ method: "POST", path: "/storefront/addresses", body, key: true, schema: custAddressRowSchema });
}

export function getAddress(id: string): Promise<CustAddressRow> {
  return request({ method: "GET", path: `/storefront/addresses/${id}`, schema: custAddressRowSchema });
}

// ---------------------------------------------------------------------------
// Checkout & orders (api.md §4)
// ---------------------------------------------------------------------------

export function checkout(body: { custAddressId: string; paymentMode: "cod" | "gateway" }): Promise<StorefrontCheckoutResult> {
  return request({ method: "POST", path: "/storefront/checkout", body, key: true, schema: storefrontCheckoutResultSchema });
}

export function listMyOrders(): Promise<{ data: CustomerOrderRow[] }> {
  return request({ method: "GET", path: "/storefront/orders", schema: customerOrderListSchema });
}

export function getMyOrder(id: string): Promise<CustomerOrderDetail> {
  return request({ method: "GET", path: `/storefront/orders/${id}`, schema: customerOrderDetailSchema });
}

export function cancelMyOrder(id: string) {
  return request({ method: "POST", path: `/storefront/orders/${id}/cancel`, body: {}, key: true, schema: cancelOrderResponseSchema });
}

export function createSalesReturn(body: z.infer<typeof createSalesReturnBodySchema>): Promise<CreateSalesReturnResult> {
  return request({ method: "POST", path: "/storefront/returns", body, key: true, schema: createSalesReturnResultSchema });
}

// ---------------------------------------------------------------------------
// Realtime & health (api.md §5)
// ---------------------------------------------------------------------------

export function getHealth(): Promise<Health> {
  return request({ method: "GET", path: "/health", schema: healthResponseSchema });
}