import { z } from "zod";

import { epochMsSchema, listSchema, paiseSchema } from "@/lib/types/common";

/**
 * Wishlist wire shapes (api.md §3), written from the backend source in
 * phase 1: `../backend/services/cart.ts` (`WishlistDisplayRow`,
 * `listWishlist`, `getWishlistItem`).
 */

export const wishlistDisplayRowSchema = z
  .object({
    id: z.string().uuid(),
    variantId: z.string().uuid(),
    name: z.string(),
    sku: z.string().nullable(),
    productSlug: z.string(),
    sellingPricePaise: paiseSchema,
    createdAt: epochMsSchema,
  })
  .strict();

/** `GET /api/storefront/wishlist` → `{ data: WishlistDisplayRow[] }`. */
export const wishlistListSchema = listSchema(wishlistDisplayRowSchema);

/**
 * `GET /api/storefront/wishlist/:variantId` → a single row; 404 when
 * absent — the UI uses it for the toggle state.
 */
export const wishlistItemSchema = wishlistDisplayRowSchema;

export type WishlistDisplayRow = z.infer<typeof wishlistDisplayRowSchema>;