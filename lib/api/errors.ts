import type { ErrorEnvelope } from "@/lib/types/common";
import { ENVELOPE_CODES, errorEnvelopeSchema } from "@/lib/types/common";

/**
 * Error handling for the single network boundary (architecture.md §6).
 * Everything thrown out of lib/api is an ApiError; UI layers turn it into
 * copy via messageFor.
 */

export type { EnvelopeCode } from "@/lib/types/common";

export class ApiError extends Error {
  /** HTTP status; 0 means the request never got a response. */
  readonly status: number;
  readonly code: ErrorEnvelope["error"]["code"] | null;
  readonly reason: string | null;
  readonly details: unknown;

  constructor(args: {
    message: string;
    status: number;
    code: ErrorEnvelope["error"]["code"] | null;
    reason: string | null;
    details: unknown;
  }) {
    super(args.message);
    this.name = "ApiError";
    this.status = args.status;
    this.code = args.code;
    this.reason = args.reason;
    this.details = args.details;
  }
}

export function isApiError(err: unknown): err is ApiError {
  return err instanceof ApiError;
}

/**
 * Parse a non-2xx response body. Backend routes send the error envelope;
 * better-auth auth routes send `{ message, code, ... }` directly (verified
 * against the installed package) — both are handled here.
 */
function parseErrorBody(body: unknown): {
  message: string;
  code: ErrorEnvelope["error"]["code"] | null;
  reason: string | null;
  details: unknown;
} {
  if (body !== null && typeof body === "object") {
    const envelope = errorEnvelopeSchema.safeParse(body);
    if (envelope.success) {
      return {
        message: envelope.data.error.message,
        code: envelope.data.error.code,
        reason: envelope.data.error.reason ?? null,
        details: envelope.data.error.details,
      };
    }
    const loose = body as { message?: unknown; code?: unknown };
    if (typeof loose.message === "string") {
      return {
        message: loose.message,
        code: ENVELOPE_CODES.includes(loose.code as never) ? (loose.code as ErrorEnvelope["error"]["code"]) : null,
        reason: null,
        details: null,
      };
    }
  }
  return { message: "Unexpected response from server", code: null, reason: null, details: null };
}

/** Build an ApiError from a non-2xx Response (body may be envelope or better-auth shape). */
export async function apiErrorFromResponse(response: Response): Promise<ApiError> {
  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }
  const parsed = parseErrorBody(body);
  return new ApiError({
    message: parsed.message,
    status: response.status,
    code: parsed.code,
    reason: parsed.reason,
    details: parsed.details,
  });
}

/** Wrap any thrown value as an ApiError (normalizes network failures too). */
export function apiErrorOf(err: unknown): ApiError {
  if (isApiError(err)) return err;
  if (err instanceof Error) {
    return new ApiError({
      message: err.message,
      status: 0,
      code: null,
      reason: null,
      details: null,
    });
  }
  return new ApiError({ message: "Unexpected error", status: 0, code: null, reason: null, details: null });
}

/**
 * The backend's conflict code for an error, if any (architecture.md §6).
 * Codes in REASON_CODES arrive in the envelope's `reason`; codes not yet
 * listed there arrive in `message` — both resolve to the same key here, so
 * handlers can branch on the mechanism (e.g. insufficient_stock) without
 * caring which slot it travelled in.
 */
export function reasonCodeOf(err: unknown): string | null {
  if (!isApiError(err)) return null;
  return err.reason ?? err.message;
}

const REASON_MESSAGES: Record<string, string> = {
  stale_version: "This document changed since you loaded it. Refresh and try again.",
  idempotency_mismatch: "Request conflict — retry the action.",
  invalid_transition: "This order is no longer in that state.",
  insufficient_stock: "Some items are no longer available — review your cart.",
  over_payment: "The amount exceeds the outstanding balance.",
  over_return: "The quantity exceeds the returnable amount.",
  already_issued: "This document was already issued.",
  not_found: "Not found.",
  idempotency_key_required: "Request missing idempotency key.",
  rate_limited: "Too many attempts — try again shortly.",
  "cart is empty": "Your cart is empty.",
  "custom line returns not supported": "This item can't be returned.",
};

/**
 * Friendly copy for an error (architecture.md §6 reason→message map).
 * The backend routes codes through its own REASON_CODES list into the
 * envelope's `reason`; codes it hasn't listed yet (duplicate_email, "cart is
 * empty", custom-line rejections) arrive in `message` instead — the same map
 * resolves both keys.
 */
export function messageFor(err: unknown, fallback: string): string {
  if (isApiError(err)) {
    if (err.reason && REASON_MESSAGES[err.reason]) return REASON_MESSAGES[err.reason];
    if (err.message && REASON_MESSAGES[err.message]) return REASON_MESSAGES[err.message];
    if (err.code === "VALIDATION") return "The request couldn't be saved as sent. Check the fields and retry.";
    if (err.code === "UNAUTHORIZED") return "Your session expired. Sign in again.";
    if (err.code === "FORBIDDEN") return "You don't have permission to do this.";
    if (err.code === "RATE_LIMITED") return REASON_MESSAGES.rate_limited;
    if (err.code === "NOT_FOUND") return REASON_MESSAGES.not_found;
    if (err.message) return err.message;
    return fallback;
  }
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}