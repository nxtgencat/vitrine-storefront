# Vitrine Storefront — Architecture

The customer storefront. Same stack and discipline as the dashboard
(`../dashboard/.agents/architecture.md` §1–§12), with the storefront's narrower surface:
only `/api/storefront/*` + better-auth auth. Where a decision is identical to the
dashboard's, this file says so and restates the rule rather than re-deriving it.

Read `task.md` §1–§3 first. `api.md` is the consumer contract.

---

## §1 Principles

1. **Backend as source of truth.** No stored price/stock/status is ever trusted; the cart
   is convenience state the checkout endpoint re-derives server-side.
2. **Three layers, strict** — `components` → `stores` → `lib`; only `lib/api` touches the
   network. Same as dashboard §1/§5.
3. **One-shot idempotent mutations** — same `lib/api` key contract.
4. **Binary stock display.** `isInStock` is a boolean. No quantities, no "N left".
5. **Own-rows only.** Reads return the customer's own data or 404; a 404 renders generic
   "not found", never hints at existence.
6. **Checkout result is authoritative.** The storefront renders the backend's
   confirmed-issued or pending-gateway result; it never treats a gateway "redirect
   success" as completion — it waits on `order:{id}`.

## §2 Stack & resolved versions

Same as dashboard §2: Next.js 16.3.1 (starter), React 19.2.8, TS strict, Tailwind v4,
shadcn/ui `base-nova` on `@base-ui/react`, zod 4.4.3, zustand 5.0.15 (both add via
`bun add`), `fetch` + own typed client, native `WebSocket`, `lib/logger`. `hono` NOT a
dependency (same note as dashboard §2).

**Env (`storefront/.env.example`):**
```
NEXT_PUBLIC_API_BASE=    # dev backend origin, default http://localhost:3000
NEXT_PUBLIC_WS_BASE=     # ws base, default ws://localhost:3000 (or location.origin when proxied)
NEXT_PUBLIC_API_PROXY=   # when set, next.config rewrites /api/* -> <this>/api/* (default NEXT_PUBLIC_API_BASE)
```
Production: app + API share an origin via a gateway (dashboard §3); WS defaults to
`location.origin`.

## §3 Transport & session cookies

Identical to dashboard §3: same-origin `/api/*` via `next.config.ts` `rewrites()` in dev
and a gateway in prod (including WS upgrades); better-auth's httpOnly cookie flows through
the proxy; no CORS (backend mounts none); media bytes + multipart upload flow through the
proxy. The app never reads the cookie; it hydrates via `GET /api/auth/get-session`. Dev server
runs on `:3000` (`package.json`), matching the backend's `ALLOWED_ORIGINS`.

## §4 Folder layout

```
storefront/
  .agents/                 # this spec set
  app/
    (public)/              # browse: layout with header/footer (search, cart badge, account)
      page.tsx             # product listing
      product/[slug]/page.tsx   # product detail
    (auth)/login/  (auth)/signup/
    (account)/             # session-guarded: cart, wishlist, addresses, orders, checkout
      cart/                # (cart must be reachable unauthenticated? NO — cart is C-guarded)
      checkout/            # checkout form page
      checkout/result/     # backend-result page: receipt OR "payment processing" (gateway)
      orders/  orders/[id]/   # own order list; detail (items, invoice, timeline, cancel/return)
      ...
  components/
    ui/                    # shadcn base-nova (starter)
    layout/                # SiteHeader, SiteFooter, CartBadge, SearchBox, MobileNav, AccountMenu
    product/               # ProductCard, VariantPicker, PriceText, StockBadge, WishlistToggle, ProductDetailPage
    cart/  account/        # CartLine; CheckoutForm, OrderStatusBadge, OrderTimeline, ReturnFormDialog, AddressForm, AddressFormDialog
    shared/                # EmptyState, ErrorState, ConfirmDialog, QtyStepper
  lib/
    api/                   # client, requests, errors, idempotency, server-session (as dashboard)
    domain/                # money.ts, dates.ts (formatDate/formatDateTime), lifecycle.ts (order statuses), lists.ts
    realtime/              # ws client (order:{id}, invoice:{id}, payment.confirmed)
    types/                 # zod mirrors of /api/storefront/* shapes
    verify/                # hygiene scripts
    utils.ts
  stores/                  # use-session.ts, use-live.ts, use-cart.ts, use-checkout.ts
  hooks/                   # use-mobile (starter), use-query, use-realtime (subscribe wrapper), use-add-to-cart, use-wishlist-toggle
```

Route-group decisions:
- **`(public)`** — browse; guarded by nothing, but cart/wishlist buttons require a
  session (they render the sign-in redirect when anonymous). Cart itself is a `C`-guarded
  route.
- **`(auth)`** — `/login`, `/signup`; bare layouts.
- **`(account)`** — session-guarded server layout (no session → `/login?next=…`):
  `/cart`, `/wishlist`, `/addresses`, `/checkout`, `/orders`, `/orders/[id]`.

## §5 Layers & data flow

Same as dashboard §5. Storefront stores:
- `use-session.ts` — actor (`{ userId, name, email }` from better-auth session), hydration
  status, sign-in/sign-up/sign-out.
- `use-cart.ts` — cart **count** badge + line state for the cart page, hydrated from
  `GET /api/storefront/cart`; convenience only.
- `use-checkout.ts` — the address selected on /addresses ("use for checkout"),
  remembered for the checkout form; **view-state only** — the checkout endpoint
  re-reads the address server-side.
- `use-live.ts` — the display-only query cache + `useQuery`/`invalidate` (dashboard §5).

`lib/api` is the same typed client: request validation, response validation, idempotency
keys, error classification.

## §6 Errors

Same envelope + code map as dashboard §6. Storefront-specific surfaces:
- 401 on a `C`-guarded call → rehydrate session once; on failure redirect to
  `/login?next=…` (cart, wishlist, addresses, orders, checkout all gate this way).
- 409 `insufficient_stock` at checkout → show "some items are no longer available —
  review your cart" and **refetch the cart** (the backend rolled everything back; the
  cart survives), highlighting out-of-stock lines via the catalog's `isInStock`.
- 429 / `RATE_LIMITED` on checkout (5/min) → "slow down" message with retry window; never
  auto-retry.
- `invalid_transition` on cancel (order no longer pending) → refetch order, re-render by
  status.
- `over_return` / `duplicate line` / custom-line return rejection → inline form messages.
- Generic 404 on order/address detail → `EmptyState` "not found".

## §7 Session & auth

- Hydration: `GET /api/auth/get-session` → `{ user: { id, name, email }, session }` or
  literal `null` (better-auth registers `/get-session`, not `/session`).
- Sign-up: `POST /api/auth/sign-up/email` (triggers backend auto-provision of the
  customer profile). Sign-in: `POST /api/auth/sign-in/email`. Both set the httpOnly
  cookie via the proxy. Sign-out: `POST /api/auth/sign-out`.
- The storefront never needs `customerId` client-side — every `C`-guarded call resolves it
  server-side. Views that need a name use `session.user.name` / `email`.
- Route guards: `(account)` layout (server) redirects anonymous → `/login?next=…`;
  client-side shell re-checks for post-render races. The server guard
  (`lib/api/server-session.ts`, the app's only server-side fetch) reads the
  forwarded httpOnly cookie and redirects only on a definitive no-session
  answer — a backend outage lets the render through and the client hydration
  surfaces reality. The header's account menu hydrates the session store on
  mount, so a fresh page load for a signed-in customer shows the account menu
  (name + sign-out), not the sign-in button.
- Session expiry: discovered via a real 401 (§6), never a timer.
- Client-side action gate on public pages: `requireCustomer()` (in
  `stores/use-session.ts`) hydrates the session if it isn't known yet (the
  header hydrates on mount, but a click can land first), then redirects an
  anonymous user to `/login?next=…` and resolves false. Add-to-cart and the
  wishlist toggle call it before any mutation. Wishlist hearts never fire the
  `C`-guarded wishlist read for an anonymous visitor: the toggle renders a
  plain redirecting button until the session resolves authenticated.

## §8 Money

Same as dashboard §8, storefront-scoped: `lib/domain/money.ts` exports `PAISE_PER_RUPEE`,
`formatINR(paise)` (Indian grouping, `₹`, paise suffix only when nonzero) and
`formatINRCompact` (K/L/Cr) for dense rows. No `inputPaiseFromText` — the storefront never
collects money. **Every price shown is a price just returned by the API** — the
storefront re-fetches cart/checkout-total from `GET /api/storefront/cart` (which returns
`unitPricePaise`/`lineTotalPaise` recomputed server-side) before checkout; never a
client-summed total as the authoritative number.

## §9 Order lifecycle & status-aware UI

Statuses the storefront sees: `pending` (gateway awaiting webhook), `confirmed`
(COD-issued or gateway-issued), `cancelled`. Order detail shows a **timeline** from
`order_events` (backend returns them). Status-aware rendering:

| Order status | Actions available | Notes |
|---|---|---|
| `pending` | **Cancel** (`POST /storefront/orders/:id/cancel`); retry-consideration only if the gateway never confirms | The linked invoice is `draft`/voided-on-cancel; the payment fact stays (backend's webhook compensates if it later arrives). Storefront shows "payment processing — we'll update this order automatically". |
| `confirmed` | **Return request** (sales return on the issued invoice, lines ≤ original); view invoice/items | The backend auto-issues COD invoices on checkout; gateway invoices confirm via webhook. |
| `cancelled` | none | |

`lib/domain/lifecycle.ts` exports `storefrontActionsFor(status)` — the only place these
rules live. Return entry: the return form picks confirmed-order items from
`getOrder` items and validates ≤ original client-side; the staff-side confirm enforces the
real cap.

## §10 Lists, pagination & URL state

The storefront's only "list" with pagination semantics is the product listing, which the
backend returns as **`{ data }` without a pagination envelope** (a bounded, non-paginated
catalog read). `q` search is a URL search param (`useSearchParams`). The header SearchBox
is the one search input: on the catalog page (`/`) typing writes the URL with a 300ms
debounce (`router.replace`) and the listing refetches as `q` changes — the URL is the
source and the fetch keys off it; elsewhere (any other page) the box only submits on Enter,
so it never rewrites the current page's URL. The listing page reads `q`, keys its query on
it, and renders directly. Orders and wishlist/cart/addresses are returned as `{ data: [...] }`
arrays (no pagination) — render directly. Keep the URL as the source of the search query;
everything else is store state.

## §11 Realtime

`lib/realtime` — same client as dashboard §11, narrower topic set:
- Subscribe `order:{id}` (own) + `invoice:{id}` (own, linked) on the order detail page and
  after checkout in gateway mode.
- On `{ type, entityId, at }` → `invalidate` the matching order/invoice query; if the
  order's status left `pending`, toast "your order is confirmed" (or cancelled) and
  re-render.
- **Checkout success in gateway mode does NOT show a receipt** — it shows "payment
  processing" and subscribes; the receipt appears when `order.confirmed` /
  `invoice.issued` arrives. The customer may also close the tab and check `/orders`.
- **`payment.confirmed` clears the cart on the backend** (same tx that confirms the
  order) — the realtime client invalidates the live `"cart"` query AND the cart badge
  store on that frame, so the header badge drops without a reload.
- Reconnect: backoff (1s→…→15s), resubscribe, refetch. No polling anywhere.

WS URL: `NEXT_PUBLIC_WS_BASE` if set, else `${location.origin}/api/ws`.

## §12 Forms

Same as dashboard §12 (no react-hook-form; controlled components, zod draft state, one
`Idempotency-Key` per submit attempt). Storefront forms: sign-in, sign-up, address,
checkout (address select/create + payment mode), return.

## §13 Page map & feature notes

```
(public)/
  /                    public   product listing (q search, stock badge, variant chips)
  /product/[slug]      public   detail: media, visible variants (no stock badge), add-to-cart, wishlist toggle
(auth)/
  /login               public
  /signup              public
(account)/             C-guarded
  /cart                cart lines (qty stepper), totals from API, checkout button
  /wishlist            wishlist rows, add-to-cart, remove
  /addresses           address book CRUD
  /checkout            address select/create + paymentMode (cod|gateway) + submit
  /checkout/result     renders backend result: confirmed-receipt OR pending-processing
  /orders              own order list (any status)
  /orders/[id]         detail: items, invoice summary, timeline, cancel/return actions
```

Feature decisions:
- **Add to cart** requires a session (backend `C`-guard). Anonymous users are redirected
  to `/login?next=…` — the backend has no anonymous cart, so no guest cart in the UI.
- **Wishlist is variant-keyed** (the API's wishlist rows are variants). The toggle on
  cards/detail is per variant; its membership state comes from the shared `wishlist`
  query (`getWishlist` → variantId set) — one fetch per session, not one
  `getWishlistItem` per row (same truth; `getWishlistItem` remains available for
  single-row reads). Toggles flip optimistically and roll back on error; the wishlist
  page lists rows with `sellingPricePaise` and offers add-to-cart + remove.
- **Product detail has no `isInStock` and no media** (backend gap — the storefront
  routes return raw product/variant rows only; media lives on the staff catalog routes
  the storefront never calls). The VariantPicker shows variants without stock badges
  and without images; add-to-cart is always offered and the backend gates stock at
  checkout (`409 insufficient_stock` → refetch cart + highlight).
- **Addresses** list/create on /addresses; each row can be flagged "use for checkout"
  (view-state in `use-checkout.ts`, phase 4's checkout form starts from it).
- **Checkout** gate: cart non-empty (client checks the refetched cart), address selected,
  payment mode chosen. Submit sends exactly `{ custAddressId, paymentMode }`; the 409
  `insufficient_stock` path refetches the cart and marks lines.
- **Order detail** shows the backend's `items` (invoice lines when the invoice exists),
  totals, and the `events` timeline. For a `pending` gateway order with no confirmed
  invoice, items come from the draft invoice the backend created at checkout. A pending
  order's row `totalPaise` is `0` while the draft invoice already carries the real
  backend-computed `subtotal/tax/total` — the detail header and list render the invoice
  total when the invoice exists, the row total otherwise (both are backend numbers;
  never a client sum).
- **Return form** (confirmed orders only): line/qty pickers against the order's items,
  validated ≤ original; submit `POST /storefront/returns`. Staff confirm applies real
  caps.

## §14 Non-goals (this app)

Back-office / staff / RBAC · quantities or stock levels · reporting/analytics · reviews ·
marketing · abandoned-cart logic · optimistic money UI · offline/PWA · guest cart ·
multi-currency · anything outside `/api/storefront/*` + `/api/auth/*`.

## §15 Verify & hygiene

`ci` = `typecheck` + `build` + `verify:hygiene` — the same greps as dashboard §15 (no
`console.*` outside `lib/logger`, no `any`, no `fetch(` outside `lib/api` [WS constructor
excepted], no imports from `../backend`, no `hono`/`@hono/*` deps, deps imported both
directions). The dep-usage allowlist in `lib/verify/verify.ts` holds exactly: `react-dom`
(next's peer, imported by the framework itself). `zod`/`zustand` were declared phase 0 and
first imported phase 1 (api-core) — removed from the allowlist in that same commit.
The list only shrinks. A phase's named exit condition is authoritative.