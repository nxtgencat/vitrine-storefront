import { z } from "zod";

import { epochMsSchema, listSchema, paiseSchema } from "@/lib/types/common";

/**
 * Cart wire shapes (api.md §3), written from the backend source in phase 1:
 * `../backend/services/cart.ts` (`CartDisplayRow`, `listCart`). Rows are
 * server-recomputed — `lineTotalPaise = unitPricePaise * quantity` — and the
 * storefront shows them verbatim; it never sums client-side.
 */

export const cartDisplayRowSchema = z
  .object({
    id: z.string().uuid(),
    variantId: z.string().uuid(),
    quantity: z.number().int().min(1),
    name: z.string(),
    sku: z.string().nullable(),
    productSlug: z.string(),
    unitPricePaise: paiseSchema,
    lineTotalPaise: paiseSchema,
    createdAt: epochMsSchema,
    updatedAt: epochMsSchema,
  })
  .strict();

/** `GET /api/storefront/cart` → `{ data: CartDisplayRow[] }`. */
export const cartListSchema = listSchema(cartDisplayRowSchema);

export type CartDisplayRow = z.infer<typeof cartDisplayRowSchema>;