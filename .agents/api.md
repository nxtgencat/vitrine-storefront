# Vitrine Storefront — API (consumer contract)

The storefront consumes **only** `/api/storefront/*` and better-auth `/api/auth/*`,
same-origin via the proxy (§3). This document is the **client's** contract: every endpoint
the storefront calls, its request shape, guard, and the zod mirror in
`lib/types/<module>.ts` it maps to. The backend's `../backend/.agents/api.md` §1/§9 is
authoritative — when the two disagree, the backend wins and this file is fixed in the same
commit as the code.

**Never code a mirror from memory** — read the backend route/service source
(`../backend/routes/storefront.ts`, `../backend/services/{cart,checkout,returns}.ts`) in
the phase that builds it. The request schemas below are verified; the response shapes for
cart/wishlist/addresses/orders/checkout are stated from those service sources and
re-verified in-phase.

---

## §0 Conventions (consumer side)

Same as dashboard §0: same-origin `/api`, implicit credentials, guards `*`/`C` (customer
session), idempotency `I` on every mutation, error envelope `{ code, reason, details? }`,
money as INTEGER paise rendered via `formatINR`, realtime `‡` refetch-on-event. Lists here
return `{ data: [...] }` **without** a pagination envelope (except none exist — see §4).

---

## §1 Auth (better-auth)

| Call | Endpoint | Guard | Idem |
|---|---|---|---|
| `signUp({ name, email, password })` | `POST /api/auth/sign-up/email` | * | – |
| `signIn({ email, password })` | `POST /api/auth/sign-in/email` | * | – |
| `signOut()` | `POST /api/auth/sign-out` | * | – |
| `getSession()` | `GET /api/auth/get-session` | * | – |

- `signUp` triggers the backend's `user.create.after` hook → a `customers` row is
  auto-provisioned. `signUp`/`signIn` → `{ token: string | null, user }` (better-auth
  auto-sign-in sets the httpOnly cookie via the proxy; `token` is null when sign-in is
  skipped/disabled). `getSession` (better-auth registers `/get-session`, not `/session`)
  → `{ user: { id, name, email }, session }` **when signed in**, or the **literal
  JSON `null`** when signed out — the mirror is `.nullable()`. `signOut` →
  `{ success: true }`.

## §2 Catalog (public)

| Call | Endpoint | Guard | Idem |
|---|---|---|---|
| `listStorefrontProducts({ q? })` | `GET /api/storefront/products` | * | – |
| `getStorefrontProduct(slug)` | `GET /api/storefront/products/:slug` | * | – |

- **Listing** → `{ data: ProductWithVariants[] }` where each product carries
  `variants: [{ ..., isInStock: boolean }]` — **`isInStock` is the only stock field; never
  quantity.** Products with no `isCustomerVisible` variant are excluded by the backend.
  `q` filters product names.
- **Detail** → product object with `variants` (visible, active only); 404 when the
  product has no visible variant. **`isInStock` is NOT included on detail** — backend gap
  (see §6): the detail page renders variant chips without stock badges; stock is decided
  at checkout, never displayed here.
- Stock is read from the display projection — safe because it is display-only (the backend
  never decides checkout off it).

## §3 Cart, wishlist, addresses (all `C`)

| Call | Endpoint | Guard | Idem |
|---|---|---|---|
| `getCart()` | `GET /api/storefront/cart` | C | – |
| `upsertCartItem({ variantId, quantity })` | `PUT /api/storefront/cart` | C | I |
| `removeCartItem(variantId)` | `DELETE /api/storefront/cart/:variantId` | C | I |
| `getWishlist()` | `GET /api/storefront/wishlist` | C | – |
| `getWishlistItem(variantId)` | `GET /api/storefront/wishlist/:variantId` | C | – |
| `addWishlistItem({ variantId })` | `POST /api/storefront/wishlist` | C | I |
| `removeWishlistItem(variantId)` | `DELETE /api/storefront/wishlist/:variantId` | C | I |
| `listAddresses()` | `GET /api/storefront/addresses` | C | – |
| `createAddress({ label, line1, line2?, city, state, pincode })` | `POST /api/storefront/addresses` | C | I |
| `getAddress(id)` | `GET /api/storefront/addresses/:id` | C | – |

- **Cart** → `{ data: CartDisplayRow[] }`; rows `{ id, variantId, quantity, name, sku,
  productSlug, unitPricePaise, lineTotalPaise, createdAt, updatedAt }` — totals are
  **server-recomputed** (`lineTotalPaise = unitPricePaise * quantity`). The cart page
  shows these verbatim; the header badge shows the row count. Cart is cross-device (keyed
  by customer), keyed on `customerId` — no client persistence.
- **Wishlist** → `{ data: WishlistDisplayRow[] }`; rows `{ id, variantId, name, sku,
  productSlug, sellingPricePaise, createdAt }`. Add is an upsert (duplicate = no-op);
  `getWishlistItem` 404s when absent — the UI uses it for the toggle state.
- **Addresses** → `{ data: CustAddressRow[] }`; rows `{ id, customerId, label, line1,
  line2, city, state, pincode }`. Own rows only.
- Mutations: `quantity ≥ 1` (upsert replaces the quantity — same variant never
  duplicates); unknown variant → 404; DELETE of an absent line is a no-op (200).
- All of these writes produce **zero fact rows and zero events** (backend I11) —
  convenience state; the UI treats them as such (no optimistic money math).

## §4 Checkout & orders

| Call | Endpoint | Guard | Idem |
|---|---|---|---|
| `checkout({ custAddressId, paymentMode })` | `POST /api/storefront/checkout` ‡ | C (rate-limited 5/min) | I |
| `listMyOrders()` | `GET /api/storefront/orders` | C | – |
| `getMyOrder(id)` | `GET /api/storefront/orders/:id` | C | – |
| `cancelMyOrder(id)` | `POST /api/storefront/orders/:id/cancel` ‡ | C | I |
| `createSalesReturn({ orderId, items })` | `POST /api/storefront/returns` | C | I |

- **Checkout body is exactly `{ custAddressId, paymentMode: "cod" | "gateway" }` — no
  prices, no cart snapshot.** The backend re-reads the cart, re-prices every line, and
  re-derives stock in-tx. Response `StorefrontCheckoutResult`:
  - `order: { id, orderNumber, status, totalPaise, createdAt }`
  - `invoice: InvoiceWithLines` — **always present, never null**: `issued` for COD,
    `draft` for gateway (the draft invoice exists so the webhook can flip it)
  - `payment: PaymentRow | null` (gateway: the pending placeholder row)
  - `checkoutReference: string | null` (gateway: the `gatewayPaymentId` handed to the
    payment provider; COD: null)
- **COD** → `order.status = "confirmed"`, invoice `issued`, cart **cleared**. Show the
  receipt immediately.
- **Gateway** → `order.status = "pending"`, invoice `draft`, `payment.status =
  "pending"`, `checkoutReference` set, **cart kept** until the backend's webhook confirms.
  The UI shows "payment processing" and **subscribes to `order:{id}`** — a "gateway
  success" is never treated as completion (§11). A later webhook confirms the order and
  clears the cart; the UI discovers it via the realtime event + refetch.
- **Errors**: `400 cart is empty`; `409 insufficient_stock` (whole tx rolled back, cart
  untouched → refetch the cart and highlight lines); `404 not_found` (address not yours);
  `429`/`RATE_LIMITED` (5/min).
- **Orders list** → `{ data: CustomerOrderWithItems[] }`, own orders only, newest first.
  Rows: `{ id, orderNumber, orderType, status, totalPaise, createdAt, invoice:
  { id, invoiceNumber, status, subtotalPaise, taxPaise, totalPaise } | null }`.
- **Order detail** → `CustomerOrderDetail` = the row above + `events`
  (`order_events` timeline: `{ id, orderId, type, payload, actorId, actorType, createdAt
  }`) + `items` (invoice lines when the linked invoice exists — including a `pending`
  gateway order's draft invoice).
- **Cancel** → `pending` only; `{ id, status: "cancelled" }`. Everything later →
  `409 invalid_transition`.
- **Return request** → `{ orderId, items: [{ originalItemId, quantity }] }` on a
  **confirmed** order whose invoice is `issued`. Draft sales return; staff confirm
  applies real caps. Errors: `409 invalid_transition` (order not confirmed), 404 (order
  or invoice not yours/issued), 400 (quantity > original, duplicate line, custom line).

## §5 Realtime & health

| Call | Endpoint | Guard | Idem |
|---|---|---|---|
| `ws()` | `WS /api/ws` | C | – |
| `getHealth()` | `GET /api/health` | * | – |

- **WS**: subscribe `order:{id}` (own) and `invoice:{id}` (own). A customer trying to
  subscribe to another's order or any stock topic is rejected by the backend (error
  frame + close). Frames `{ type, entityId, at }`.
- **Health**: same as dashboard §9 — used by the storefront only as a tiny
  "store status" note if ever surfaced; normally unused (public reads just work).

---

## §6 Shape notes (verified during each phase)

Request schemas above are verified against `../backend/routes/storefront.ts`. The
response mirrors (`lib/types/*`) are written in the phase that first uses each module by
reading `../backend/services/{cart,checkout,returns}.ts` and the route files for the exact
installed version — never from memory. Anything this file states that disagrees with the
backend is a spec bug: fix this file (and raise it), don't silently trust one side.

**Verified backend facts (this file's reading of the route source):** the listing endpoint
adds `isInStock` per visible variant; the **detail endpoint does not** — a confirmed
limitation of the backend (`/api/storefront/products/:slug` returns raw variant rows).

**Verified during phase 1 (api-core):**

- `GET /api/auth/get-session` signed out → HTTP 200 with body `null` (no cookie, no
  `{user:null}` object). `GET /api/auth/session` → 404 (better-auth does not register
  that route; the smoke script and dashboard both use `/get-session`).
- `checkout` response `invoice` is non-null in `StorefrontCheckoutResult`
  (`../backend/services/checkout.ts`).
- Cart rows: `CartDisplayRow = { id, variantId, quantity, name, sku | null,
  productSlug, unitPricePaise, lineTotalPaise, createdAt, updatedAt }`; `lineTotalPaise`
  is always `unitPricePaise * quantity` (`../backend/services/cart.ts`).
- `InvoiceWithLines` = invoice row + `items` (invoice_items) + `charges`
  (invoice_charges), from `../backend/services/sales.ts`.
- Cart/wishlist mutation responses (`PUT /api/storefront/cart`, `DELETE
  /api/storefront/cart/:variantId`, `POST/DELETE /api/storefront/wishlist/:variantId`)
  return the raw `cart_items`/`wishlists` row (or `{}` for a no-op delete) — the mirrors
  accept them via passthrough.

**Verified during phase 4 (checkout-orders):**

- Checkout always returns an `invoice` (non-null): `issued` for COD, `draft` for gateway.
  `checkoutReference` is the **`gatewayPaymentId` on the payments row** (the provider's
  checkout reference — that's the value a gateway webhook echoes back, not the payment id
  and not the order id).
- A pending gateway order's row `totalPaise` is `0`, but its **draft invoice already
  carries the real totals** (`subtotal/tax/total` computed at checkout, invoice_items with
  `lineTotalPaise = unit×qty` incl. tax) — the storefront shows the invoice total when the
  invoice exists (verified: E2E10-5 ₹550 → line ₹577.50, tax ₹27.50).
- Order list rows: `invoice` is **non-null even for pending** (the draft invoice), so a
  list row can always show the invoice total. `listMyOrders` returns newest first.
- `cancelMyOrder` on `pending` → `{ id, status: "cancelled" }`; the order detail's
  `events` then include an `order.cancelled` entry. Any later cancel → `409
  invalid_transition` (the client refetches and re-renders by status).
- `createSalesReturn` on a confirmed order creates a **`draft` sales return** (its
  `returnNumber` round-trips, e.g. `RT-…`) and returns it; duplicate/over-quantity lines
  are rejected 400 by the backend.
- `payment.confirmed` (gateway webhook) confirms the order AND **clears the cart in the
  same tx** — the storefront's realtime client invalidates the `"cart"` query and the cart
  badge store on that frame (both mirrors, since the checkout success path invalidates the
  same two for COD).
- Checkout `429` (rate-limited 5/min) carries `reason: "rate_limited"` — the checkout page
  surfaces a "slow down" message, never auto-retries.