/**
 * Date formatting for order surfaces (architecture.md §9). Client-side
 * `Intl` only — no date library; all timestamps on the wire are epoch-ms.
 */

/** `epochMs` → e.g. "Aug 20, 2026, 4:30 PM" (en-IN). */
export function formatDateTime(epochMs: number): string {
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(epochMs));
}

/** `epochMs` → e.g. "Aug 20, 2026" (en-IN). */
export function formatDate(epochMs: number): string {
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(new Date(epochMs));
}