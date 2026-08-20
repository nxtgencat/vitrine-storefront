/**
 * Order lifecycle (architecture.md §9). Statuses the storefront sees:
 * `pending` (gateway awaiting webhook), `confirmed` (COD-issued or
 * gateway-issued), `cancelled`. `storefrontActionsFor` returns the legal
 * action set for an order at a given status, and the UI hides anything it
 * doesn't return (the only place these rules live).
 */

export const STOREFRONT_ORDER_STATUSES = ["pending", "confirmed", "cancelled"] as const;

export type StorefrontOrderStatus = (typeof STOREFRONT_ORDER_STATUSES)[number];

export type StorefrontOrderAction = "cancel" | "request-return";

const STATUS_ACTIONS: Record<StorefrontOrderStatus, readonly StorefrontOrderAction[]> = {
  pending: ["cancel"],
  confirmed: ["request-return"],
  cancelled: [],
};

/** Legal actions for an order at its status (architecture.md §9). */
export function storefrontActionsFor(status: string): StorefrontOrderAction[] {
  if (!isKnownStatus(status)) return [];
  return [...STATUS_ACTIONS[status]];
}

export function isKnownStatus(status: string): status is StorefrontOrderStatus {
  return (STOREFRONT_ORDER_STATUSES as readonly string[]).includes(status);
}

/** Terminal = no actions available. */
export function isTerminal(status: string): boolean {
  return storefrontActionsFor(status).length === 0;
}