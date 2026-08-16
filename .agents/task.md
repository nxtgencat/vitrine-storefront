# Vitrine Storefront — Task (build brief)

The customer-facing storefront for Vitrine, the single-tenant retail platform (backend:
`../backend`, DONE — out of scope here). This document states **what** and **why**. Read
it once, then `architecture.md` → `api.md`. `todo.md` is the execution plan. `AGENTS.md`
is the standing operating protocol for whichever agent builds this — read it before
touching any phase.

The backend is the source of truth for every shape this app consumes — same rule as the
dashboard (`../dashboard`): never re-derive API behavior from memory;
`../backend/.agents/api.md` and the route files are the contract. Ambiguity here that the
backend doesn't answer is a spec bug in **this** file.

The storefront talks **only** to `/api/storefront/*` plus better-auth auth endpoints.
It has no back-office surface.

---

## 1. Goal

Build the **Vitrine customer storefront**: browse the catalog (search, product detail),
wishlist, cart, checkout (COD and gateway modes), order history + timeline, order
cancellation (pending only), sales returns, and an address book — as a single Next.js App
Router application over the finished backend's `/api/storefront/*`. The staff console
(`../dashboard`) is a separate app; the two frontends share no code.

The storefront **never decides anything the backend decides**: prices, totals, tax, stock,
or payment state. It renders what the backend returns, shows `isInStock` (never quantity),
and submits checkout with exactly `{ custAddressId, paymentMode }` — no prices, no cart
snapshot. The backend re-derives everything server-side and the storefront trusts it.

## 2. Non-negotiable stack

Binding — identical to the dashboard's (§2 of `../dashboard/.agents/task.md`), with one
difference: the storefront also calls better-auth **sign-up** (`/api/auth/sign-up/email`)
for customer self-registration. Install with `bun add <pkg>`; versions resolved and
recorded in `architecture.md` §2.

**Next.js 16.3.1 App Router** (starter — NOT the Next.js you know; params/searchParams are
Promises) · **React 19.2.8** · **TypeScript strict** · **Tailwind v4** · **shadcn/ui
`base-nova` on `@base-ui/react`** — no react-hook-form, no radix · **Zod** at the API
boundary · **Zustand** for client state (session, cart count, view state) · **fetch +
own typed client** in `lib/api` — no `hc<AppType>()`, no cross-app imports · **`hono` NOT
a dependency** · **Money = INTEGER paise rendered through one formatter, zero floats** ·
**`lib/logger`** (no `console.*`).

## 3. Architectural commitments (not re-litigated)

1. **The backend is the only source of truth.** The storefront holds no domain facts; the
   cart and wishlist are **convenience state** — the checkout endpoint re-reads and
   re-prices everything server-side. Never show a price that wasn't just returned by a
   fetch; never compute a total client-side and show it as authoritative.
2. **UI/business layering** — same as the dashboard: `components` render, `stores` hold
   view state, `lib/api` is the only network boundary and validator, `lib/domain` holds
   shared rules (money, order lifecycle, error mapping). (`architecture.md` §5)
3. **Idempotency-Key on every mutation** — same `lib/api` contract: one key per logical
   mutation attempt, reused on retry, fresh on a new attempt. Cart, wishlist, addresses,
   checkout, cancel, return all go through it.
4. **`isInStock` only.** The API never exposes quantity. UI states are binary: "in stock" /
   "out of stock". Do not show "only N left" — the backend never sends N.
5. **Checkout is one server-side decision.** The storefront submits `{ custAddressId,
   paymentMode }` and renders the backend's result. COD → order confirmed + invoice
   issued immediately. Gateway → order stays `pending`, a `checkoutReference` is
   returned; **a gateway "success" is never trusted client-side** — the storefront waits
   on `order:{id}` (subscribe + refetch) until status leaves `pending` (backend's webhook
   path resolves it). If the order stays pending, show "payment processing" and refetch;
   a `pending` order can be cancelled by the customer.
6. **Realtime refetch-on-event, never polling.** Subscribe to own `order:{id}` /
   `invoice:{id}`; refetch on event; reconnect with backoff and refetch. (`architecture.md`
   §11)
7. **Own-orders isolation.** Order/address/cart/wishlist reads are own-rows only; a 404
   on another customer's order renders a generic "not found", never a leak.
8. **Simplicity gate.** No page, store, or abstraction beyond what `/api/storefront/*`
   serves. No back-office, no admin, no reviews/ratings, no analytics pixels, no
   abandoned-cart logic (backend has none), no offline/PWA.

## 4. Scope

**In — every item ships end-to-end:**

1. **Auth & session** — customer sign-up, sign-in, sign-out, session hydration, route
   guarding for account/cart/checkout.
2. **Browse** — product listing (name search, in-stock/out-of-stock badge, variant chips),
   product detail (visible variants, media, add-to-cart, wishlist toggle).
3. **Cart & wishlist** — cross-device (backend-keyed), quantity editing, cart badge count,
   wishlist page + toggle.
4. **Addresses** — address book CRUD (create/list/use at checkout).
5. **Checkout** — address select/create, payment mode choice (cod / gateway), submission,
   result states (confirmed-issued vs pending-gateway vs insufficient-stock).
6. **Orders** — own order list (any status), order detail with timeline + items, cancel
   while `pending`, sales-return request on issued invoices.
7. **Realtime** — order/invoice subscriptions for live status on order detail.

**Out — stated once:** anything on `/api/*` outside `/storefront/*` and `/auth/*` · staff
capabilities · inventory/stock quantities · back-office · marketing (coupons, campaigns —
backend has none) · reviews · customer support · multi-tenant · i18n.

## 5. Rules of execution

1. One git commit per phase, `phase N: <slug>`, in order — never two phases in one commit
   (`todo.md`). Each commit is code + its doc updates + the Session Log row.
2. A phase is complete only when its named exit condition is green — `bun run typecheck` +
   `bun run build` (+ the phase's named check), never "looks done."
3. Route additions update `architecture.md` in the same commit; new API calls update
   `api.md` in the same commit.
4. `todo.md`'s Session Log is the source of truth for where work stopped.
5. Zero `console.*`, zero `any`, zero unused deps — `bun run ci` (typecheck + build +
   `lib/verify` hygiene grep).
6. Research-before-coding for this stack (Next 16, React 19, `@base-ui/react`, Tailwind
   v4, zod v4) — check `node_modules/<pkg>` / `node_modules/next/dist/docs/` first;
   record verified shapes in `architecture.md` §9.

## 6. Definition of Done

Every page in `api.md`'s route map exists, is guarded (session where required), renders
in-stock only (never quantity), and calls the documented endpoints; every mutation goes
through `lib/api` with an idempotency key; every response is zod-validated; every money
field renders via `lib/domain/money`; checkout submits only `{ custAddressId,
paymentMode }` and handles both result modes correctly; own-orders isolation holds;
realtime status updates work on a live backend; `bun run ci` green; one commit per phase;
`todo.md` fully checked; Session Log ends clean.