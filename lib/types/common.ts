import { z } from "zod";

/**
 * Shared wire primitives (api.md §0) — the shapes every storefront module's
 * mirror composes. All response schemas are `.strict()` where the backend
 * sends a closed object; the exception is the better-auth contract
 * (lib/types/auth.ts), which is a third-party surface and deliberately
 * lenient.
 */

/** Every `*Paise` field on the wire is INTEGER paise (architecture.md §8). */
export const paiseSchema = z.number().int();

/** UUIDv7 ids minted by the backend (`randomUUIDv7`). */
export const uuidSchema = z.string().uuid();

/** Epoch-millis timestamps as the backend's INTEGER columns report them. */
export const epochMsSchema = z.number().int();

/**
 * Unpaginated list envelope — `{ data: T[] }`. Every storefront list
 * (cart, wishlist, addresses, orders, products) returns this shape; there
 * is no pagination envelope anywhere in `/api/storefront/*` (api.md §0).
 */
export function listSchema<T extends z.ZodType>(item: T) {
  return z.object({ data: z.array(item) }).strict();
}

export const ENVELOPE_CODES = [
  "VALIDATION",
  "UNAUTHORIZED",
  "FORBIDDEN",
  "NOT_FOUND",
  "CONFLICT",
  "RATE_LIMITED",
  "INTERNAL",
] as const;

export type EnvelopeCode = (typeof ENVELOPE_CODES)[number];

/**
 * The backend error envelope (backend lib/errors.ts) on every non-2xx
 * response from a mounted route: `{ error: { code, message, reason, details } }`
 * (api.md §0). `reason` is the closed conflict-code list; `details` carries
 * zod issues on a 400 VALIDATION. better-auth's `/api/auth/*` endpoints send
 * their own shape and are parsed leniently in lib/api/errors.ts.
 * NOTE: the backend serializes `reason: undefined` as an absent key, so the
 * mirror keeps `reason` optional — codes outside the backend's REASON_CODES
 * (duplicate_email, custom-line rejections, "cart is empty") arrive in
 * `message` instead.
 */
export const errorEnvelopeSchema = z
  .object({
    error: z
      .object({
        code: z.enum(ENVELOPE_CODES),
        message: z.string(),
        reason: z.string().nullable().optional(),
        details: z.array(z.unknown()).default([]),
      })
      .strict(),
  })
  .strict();

export type ErrorEnvelope = z.infer<typeof errorEnvelopeSchema>;