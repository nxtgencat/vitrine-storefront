import { z } from "zod";

import { epochMsSchema, listSchema, paiseSchema } from "@/lib/types/common";

/**
 * Storefront catalog wire shapes (api.md §2). Written from the backend
 * sources: routes/storefront.ts and db/schema/catalog.ts. The listing
 * endpoint returns raw product/variant rows plus `isInStock` per visible
 * variant — `isInStock` is the ONLY stock field (never quantity). The
 * detail endpoint returns the same rows WITHOUT `isInStock` (backend gap,
 * api.md §6) — hence two variant mirrors.
 */

/** `products` row (routes/storefront.ts spreads the full row). */
export const storefrontProductRowSchema = z
  .object({
    id: z.string().uuid(),
    categoryId: z.string().uuid().nullable(),
    name: z.string(),
    slug: z.string(),
    hsnCode: z.string(),
    gstRatePct: z.number().int(),
    isActive: z.number().int(),
    createdAt: epochMsSchema,
    updatedAt: epochMsSchema,
  })
  .strict();

/** `variants` row as the detail endpoint returns it (no stock flag). */
export const storefrontVariantRowSchema = z
  .object({
    id: z.string().uuid(),
    productId: z.string().uuid(),
    name: z.string(),
    sku: z.string().nullable(),
    barcode: z.string().nullable(),
    costPricePaise: paiseSchema,
    sellingPricePaise: paiseSchema,
    mrpPaise: paiseSchema,
    isBase: z.number().int(),
    isTaxable: z.number().int(),
    isCustomerVisible: z.number().int(),
    isActive: z.number().int(),
    createdAt: epochMsSchema,
    updatedAt: epochMsSchema,
  })
  .strict();

/** Variant row + `isInStock` as ONLY the listing adds it. */
export const storefrontVariantWithStockSchema = storefrontVariantRowSchema
  .extend({ isInStock: z.boolean() })
  .strict();

/** `GET /api/storefront/products` → `{ data: ProductWithVariants[] }`. */
export const storefrontProductListSchema = listSchema(
  storefrontProductRowSchema
    .extend({ variants: z.array(storefrontVariantWithStockSchema) })
    .strict(),
);

/** `GET /api/storefront/products/:slug` → product with raw visible variants. */
export const storefrontProductDetailSchema = storefrontProductRowSchema
  .extend({ variants: z.array(storefrontVariantRowSchema) })
  .strict();

export type StorefrontProductRow = z.infer<typeof storefrontProductRowSchema>;
export type StorefrontVariantRow = z.infer<typeof storefrontVariantRowSchema>;
export type StorefrontVariantWithStock = z.infer<typeof storefrontVariantWithStockSchema>;
export type StorefrontProductList = z.infer<typeof storefrontProductListSchema>;
export type StorefrontProductDetail = z.infer<typeof storefrontProductDetailSchema>;