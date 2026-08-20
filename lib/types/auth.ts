import { z } from "zod";

/**
 * better-auth wire contract (v1.6.27, backend node_modules) — NOT the
 * backend envelope. Auth endpoints live at `/api/auth/*` and keep their own
 * response shapes and error bodies (api.md §1). Because it is a third-party
 * contract, every schema here is `.passthrough()` — the one documented
 * exception to the strict-mirror rule.
 *
 * Verified this phase against the installed package (backend
 * node_modules/better-auth) and the live backend:
 * - `GET /api/auth/session` is NOT an endpoint — better-auth registers
 *   `/get-session` (404 for `/session`, verified live). api.md §1 was wrong;
 *   fixed in the same commit.
 * - `GET /api/auth/get-session` returns literal `null` when no session
 *   cookie is present (verified live), and `{ user, session }` when signed
 *   in — hence the `.nullable()`.
 * - `POST /api/auth/sign-up/email` returns `{ token, user }` (auto
 *   sign-in when email verification is off — it is, here); `token` is the
 *   session token (or null when sign-in is skipped).
 */

export const authUserSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    email: z.string(),
    emailVerified: z.boolean(),
    image: z.string().nullable(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .passthrough();

/**
 * Auth user ids are minted by better-auth (random opaque strings, NOT uuids)
 * — everything referencing `user.id` on the wire is `z.string()`.
 */
export const authSessionSchema = z
  .object({
    id: z.string(),
    userId: z.string(),
    token: z.string(),
    expiresAt: z.iso.datetime(),
    ipAddress: z.string().nullable(),
    userAgent: z.string().nullable(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .passthrough();

/**
 * `GET /api/auth/get-session` — `null` when signed out (no cookie),
 * `{ user, session }` when signed in.
 */
export const sessionResponseSchema = z
  .object({
    user: authUserSchema.nullable(),
    session: authSessionSchema.nullable(),
  })
  .passthrough()
  .nullable();

/** `POST /api/auth/sign-up/email` → `{ token, user }` (same shape as sign-in). */
export const signUpResponseSchema = z
  .object({
    token: z.string().nullable(),
    user: authUserSchema,
  })
  .passthrough();

/** `POST /api/auth/sign-in/email` → `{ token, user }`. */
export const signInResponseSchema = z
  .object({
    token: z.string().nullable(),
    user: authUserSchema,
  })
  .passthrough();

/** `POST /api/auth/sign-out` — returns `{ success: true }`. */
export const signOutResponseSchema = z
  .object({ success: z.boolean() })
  .passthrough();

export type AuthUser = z.infer<typeof authUserSchema>;
export type AuthSession = z.infer<typeof authSessionSchema>;