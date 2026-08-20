import { z } from "zod";

/**
 * Ops wire shapes (api.md §5) — the storefront's only ops read is health.
 * Written from `../backend/app.ts` in phase 1: `GET /api/health` returns
 * the bare object (no envelope) with `status: "ok" | "degraded"`.
 */

export const healthResponseSchema = z
  .object({
    status: z.enum(["ok", "degraded"]),
    dbTimeMs: z.number(),
    ledgerCounts: z.record(z.string(), z.number()),
  })
  .strict();

export type Health = z.infer<typeof healthResponseSchema>;