import { z } from "zod";

import { epochMsSchema, paiseSchema } from "@/lib/types/common";

/**
 * Sales-return wire shapes (api.md §4), written from the backend sources in
 * phase 1: `../backend/services/returns.ts` (`createSalesReturn`,
 * `ReturnRow`, `ReturnItemRow`) and `../backend/db/schema/orders.ts`
 * (returns/return_items columns). The storefront only ever creates draft
 * returns; staff confirmation applies real caps.
 */

/** `returns` row. */
export const returnRowSchema = z
  .object({
    id: z.string().uuid(),
    returnNumber: z.string(),
    returnType: z.string(),
    orderId: z.string().uuid().nullable(),
    purchaseBillId: z.string().uuid().nullable(),
    outletId: z.string().uuid(),
    status: z.string(),
    version: z.number().int(),
    createdAt: epochMsSchema,
    updatedAt: epochMsSchema,
  })
  .strict();

/** `return_items` row. */
export const returnItemRowSchema = z
  .object({
    id: z.string().uuid(),
    returnId: z.string().uuid(),
    variantId: z.string().uuid(),
    originalItemId: z.string().uuid(),
    quantity: z.number().int(),
    unitPricePaise: paiseSchema,
    taxAmountPaise: paiseSchema,
  })
  .strict();

/** `POST /api/storefront/returns` body. */
export const createSalesReturnBodySchema = z
  .object({
    orderId: z.string().uuid(),
    items: z.array(z.object({ originalItemId: z.string().uuid(), quantity: z.number().int().min(1) }).strict()).min(1),
  })
  .strict();

/** `POST /api/storefront/returns` response — the draft return. */
export const createSalesReturnResultSchema = z
  .object({
    returns: returnRowSchema,
    items: z.array(returnItemRowSchema),
  })
  .strict();

export type ReturnRow = z.infer<typeof returnRowSchema>;
export type ReturnItemRow = z.infer<typeof returnItemRowSchema>;
export type CreateSalesReturnBody = z.infer<typeof createSalesReturnBodySchema>;
export type CreateSalesReturnResult = z.infer<typeof createSalesReturnResultSchema>;