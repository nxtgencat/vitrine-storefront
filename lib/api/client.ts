import type { z } from "zod";

import { ApiError, apiErrorFromResponse, apiErrorOf } from "@/lib/api/errors";
import { key, releaseKey } from "@/lib/api/idempotency";
import { logger } from "@/lib/logger";

/**
 * The one network boundary (architecture.md §5). Every request goes through
 * here: base path, envelope parsing, zod validation, idempotency headers,
 * and the 401 → rehydrate → retry-once flow. No other module touches fetch.
 */

const API_BASE = "/api";

type RequestOptions = {
  method: "GET" | "POST" | "PUT" | "DELETE";
  /** Route path, e.g. "/storefront/cart/:variantId" — the "/api" prefix is added here. */
  path: string;
  /** JSON body. Mutations send one (even `{}`); reads send none. */
  body?: unknown;
  params?: Record<string, string | number | undefined | null>;
  /** Send Idempotency-Key (all writes; reads never do). */
  key?: boolean;
  schema: z.ZodType<unknown>;
};

/** Registered by stores/use-session.ts — resolves a stale session mid-request. */
type UnauthorizedHandler = () => Promise<boolean>;

let unauthorizedHandler: UnauthorizedHandler | null = null;

export function setUnauthorizedHandler(handler: UnauthorizedHandler | null): void {
  unauthorizedHandler = handler;
}

function buildUrl(path: string, params?: RequestOptions["params"]): string {
  const url = `${API_BASE}${path}`;
  if (!params) return url;
  const search = new URLSearchParams();
  for (const [name, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    search.set(name, String(value));
  }
  const query = search.toString();
  return query === "" ? url : `${url}?${query}`;
}

export async function request<T>(options: RequestOptions & { schema: z.ZodType<T> }): Promise<T> {
  const { method, path, body, params, schema } = options;
  const idempotencyKey = options.key === true ? key() : null;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    let response: Response;
    try {
      response = await fetch(buildUrl(path, params), {
        method,
        headers: {
          Accept: "application/json",
          ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
          ...(idempotencyKey !== null ? { "Idempotency-Key": idempotencyKey } : {}),
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
    } catch (err) {
      // Network failure: the attempt may not have reached the server — keep
      // the idempotency key so a retry of this attempt replays identically.
      logger.warn("api request failed", { path, error: String(err) });
      throw apiErrorOf(err);
    }

    if (response.status === 401 && unauthorizedHandler !== null && !path.startsWith("/auth/")) {
      // Session likely expired — ask the session store to rehydrate once.
      const recovered = await unauthorizedHandler();
      if (recovered) continue;
    }

    // The server answered conclusively: this attempt is over, the next is new.
    releaseKey();

    if (!response.ok) throw await apiErrorFromResponse(response);

    const parsed = schema.safeParse(await response.json());
    if (!parsed.success) {
      logger.error("api response failed validation", { path, issues: parsed.error.issues });
      throw new ApiError({
        message: "The server sent an unexpected response.",
        status: response.status,
        code: null,
        reason: null,
        details: parsed.error.issues,
      });
    }
    return parsed.data;
  }

  throw new ApiError({ message: "Request failed after re-authentication.", status: 401, code: "UNAUTHORIZED", reason: null, details: null });
}

export { key } from "@/lib/api/idempotency";