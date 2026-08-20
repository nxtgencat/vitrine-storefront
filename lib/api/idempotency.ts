/**
 * Idempotency-key lifecycle (architecture.md §5, §12): one key per logical
 * mutation attempt. The key is minted lazily on the first use of an attempt,
 * held across a retry of THAT attempt (a network failure reuses it), and
 * released as soon as the server answered — so the next submit is a new
 * attempt with a new key. The storefront is single-action-at-a-time per
 * attempt, so a single pending key suffices.
 */

let pendingKey: string | null = null;

/** Key for the current attempt; mints one when the previous concluded. */
export function key(): string {
  if (pendingKey === null) pendingKey = crypto.randomUUID();
  return pendingKey;
}

/** The attempt concluded (the server answered) — the next use is a new attempt. */
export function releaseKey(): void {
  pendingKey = null;
}

export function resetKey(): void {
  pendingKey = null;
}