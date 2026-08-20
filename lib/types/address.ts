import { z } from "zod";

import { listSchema } from "@/lib/types/common";

/**
 * Address book wire shapes (api.md §3), written from the backend source in
 * phase 1: `../backend/services/cart.ts` (`CustAddressRow`) and
 * `../backend/db/schema/catalog.ts` (cust_addresses columns). `line2` is
 * nullable — the create body accepts an absent/empty `line2` and the row
 * stores `null`.
 */

export const custAddressRowSchema = z
  .object({
    id: z.string().uuid(),
    customerId: z.string().uuid(),
    label: z.string(),
    line1: z.string(),
    line2: z.string().nullable(),
    city: z.string(),
    state: z.string(),
    pincode: z.string(),
  })
  .strict();

/** `GET /api/storefront/addresses` → `{ data: CustAddressRow[] }`. */
export const addressListSchema = listSchema(custAddressRowSchema);

/** `POST /api/storefront/addresses` body. */
export const createAddressBodySchema = z
  .object({
    label: z.string().trim().min(1).max(100),
    line1: z.string().trim().min(1).max(300),
    line2: z.string().trim().min(1).max(300).nullable().optional(),
    city: z.string().trim().min(1).max(100),
    state: z.string().trim().min(1).max(100),
    pincode: z.string().trim().min(1).max(20),
  })
  .strict();

export type CustAddressRow = z.infer<typeof custAddressRowSchema>;
export type CreateAddressBody = z.infer<typeof createAddressBodySchema>;