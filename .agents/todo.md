# Vitrine Storefront — Build Plan (todo)

Phase-gated execution of `task.md`. One git commit per phase, `phase N: <slug>`, in order,
none bundling two phases. A phase is complete only when its named exit condition is green —
`bun run typecheck` + `bun run build` (+ the phase's named check), never "looks done."
Before starting any phase and before committing it, follow `AGENTS.md` §1.

**Read the Session Log (§ bottom) first — it is the source of truth for where work
stopped.**

---

## Phase 0 — Scaffolding

- [x] Add deps: `bun add zod zustand`. `hono` deliberately not added (architecture.md §2).
- [x] `lib/logger.ts`, `.env.example`, `.env.local`; `next.config.ts` `rewrites()`
      proxying `/api/:path*` to `{NEXT_PUBLIC_API_PROXY|NEXT_PUBLIC_API_BASE}`; verify
      `GET /api/health` through the proxy in dev.
- [x] `lib/verify` hygiene script + `package.json` scripts (`dev`, `typecheck`, `build`,
      `ci`).
- [x] Route groups + shell: `(public)` layout (SiteHeader with search + cart badge +
      account menu, SiteFooter), `(auth)/login` + `(auth)/signup` stubs, `(account)`
      guarded layout stub. Placeholder `(public)/page.tsx`. `bun run build` green.

**Exit:** `bun run ci` green on the shell + proxy; `/api/health` reachable through the
rewrite; route groups render. Commit `phase 0: scaffolding`.

## Phase 1 — API client, types, domain core

- [x] `lib/types/*` — zod mirrors for **every** storefront module in api.md, written from
      the backend sources (api.md §6 rule); phase 1 covers session, cart, wishlist,
      address, product, order, checkout shapes (all used in later phases).
- [x] `lib/api/client.ts`, `lib/api/errors.ts`, `lib/api/idempotency.ts`,
      `lib/api/requests.ts` (typed functions per api.md §1–§4).
- [x] `lib/domain/money.ts`, `lib/domain/lifecycle.ts` (order statuses), `lib/domain/
      lists.ts` (URL search state).
- [x] `stores/use-session.ts`, `stores/use-live.ts`, `stores/use-cart.ts`;
      `components/layout/*` (CartBadge wired to stores), `components/shared/*`
      (EmptyState, ErrorState, ConfirmDialog, QtyStepper, StockBadge, PriceText).

**Exit:** typecheck-clean `lib/api` + stores; sign-in as a backend-created customer
hydrates the session store; `getCart` returns the server-recomputed rows. Commit
`phase 1: api-core`.

## Phase 2 — Auth & account shell

- [x] `(auth)/login`, `(auth)/signup` — full forms (controlled, zod, error surfaces),
      redirect to `next`.
- [x] `(account)/layout.tsx` — server session guard; header account menu shows name +
      sign-out; 401 rehydrate path (architecture.md §6).
- [x] `/cart` page — server-recomputed cart rows, qty stepper, remove, totals verbatim,
      checkout button (gated on session + non-empty).

**Exit:** sign-up → auto-provisioned customer can sign in; guarded routes redirect
anonymous; cart round-trips (add via API, qty edit, remove). Commit `phase 2: auth-cart`.

## Phase 3 — Browse & product

- [x] `(public)/page.tsx` — listing from `listStorefrontProducts({ q })` with URL search
      param + debounce (header SearchBox writes `?q=` debounced on the catalog page;
      the listing refetches as `q` changes), StockBadge, variant chips, wishlist toggle
      (session-gated → `/login?next=`), add-to-cart (session-gated → `/login?next=`).
- [x] `(public)/product/[slug]/page.tsx` — detail, VariantPicker, add-to-cart, wishlist
      toggle for the selected variant. **Spec fixes (AGENTS.md §4, per architecture.md
      §13):** the backend detail endpoint returns raw variant rows without `isInStock`,
      so the picker is **not** stock-aware, and it serves no media — the detail page is
      text + variant chips only. Wishlist toggle state comes from the shared
      `getWishlist` membership set (one fetch per session), not a `getWishlistItem` call
      per row — same truth.
- [x] Wishlist page `(account)/wishlist` (rows + add-to-cart + remove) and addresses page
      `(account)/addresses` (list/create + "use for checkout" view-state flag for phase 4).

**Exit:** browse/search works live; product detail adds to cart; wishlist + addresses
round-trip; anonymous add-to-cart redirects to login. Commit `phase 3: browse`.

## Phase 4 — Checkout & orders

- [x] `(account)/checkout` — refetch cart, address select/create, payment mode
      (cod/gateway), submit `checkout({ custAddressId, paymentMode })` with key.
- [x] `(account)/checkout/result` — two render paths: **COD/confirmed** (receipt: order
      number, items, totals) and **gateway/pending** ("payment processing", subscribe to
      `order:{id}`, live-update to receipt/cancelled on event, refetch on reconnect).
- [x] `(account)/orders` — own order list; `(account)/orders/[id]` — items, totals,
      timeline, cancel (pending only), return request form (confirmed only, validated ≤
      original).
- [x] `lib/realtime` client wired on order detail + checkout result (subscribe, refetch on
      event, backoff reconnect, resubscribe).
- [x] `insufficient_stock` checkout path → refetch cart, highlight lines; 429 handled.

**Exit:** COD checkout round-trips to a receipt and the order appears in /orders; gateway
mode shows "payment processing" and resolves to a receipt when the backend confirms (via
WS event or refetch); pending order cancels; return request round-trips to a draft.
Commit `phase 4: checkout-orders`.

## Phase 5 — Realtime hardening, hygiene, sign-off

- [x] Full realtime client pass (connect, the customer topic rule — own `order:`/
      `invoice:` only, never staff `stock:` — enforced client-side so one bad topic
      can't 1008 the shared socket; reconnect/resubscribe with terminal 1008 and
      signed-out stops; live indicator in account shell).
- [x] `verify:hygiene` final pass; `bun run ci` green; api.md/architecture.md updated to
      match the shipped tree; every phase's checkboxes verified; known-gap list (§bottom)
      revisited.

**Exit:** `bun run ci` green (typecheck + cold `bun run build` + verify:hygiene); a
gateway checkout's pending → confirmed transition lands without a manual refresh (on
the checkout-result page and, for orders already listed, on the orders list itself); a
status change to a listed order from another session (cancel, webhook confirm)
re-renders this session's orders list live; the account shell shows the live indicator.
**Spec fix (phase 5):** the plan's original exit "a COD checkout from another session
updates this session's orders live" is not satisfiable against the shipped backend — a
customer may only subscribe to own `order:{id}`/`invoice:{id}`, and a COD checkout
publishes only on the *new* order's topic, which another session cannot know before the
order exists (no customer-wide topic; verified against `backend/routes/realtime.ts` +
`routes/storefront.ts`). The list therefore subscribes per-row: every change to a
listed order is realtime; brand-new orders arrive on the next visit/refetch. Commit
`phase 5: realtime-ops`.

---

## Session Log

The source of truth for where work stopped. One row per phase commit — date, phase, what
passed, what changed in the docs (if anything). Read this table first, every time, before
starting the next phase.

| Date | Phase | Note |
| ---- | ----- | ---- |
| 2026-08-20 | 0 — scaffolding | `bun run ci` green (typecheck + build + verify:hygiene); `/api/health` returns backend JSON through the dev rewrite; `/`, `/login`, `/signup` render 200. Docs updated in the same commit: architecture.md §3 — dev server port `:3000` (matches backend `ALLOWED_ORIGINS`) documented; §15 — dep-usage allowlist (`react-dom` as next's peer; `zod`/`zustand` declared phase 0, first import phase 1) added, only shrinks. Removed unused starter dep `date-fns` (hygiene: zero unused deps). `.gitignore` now allows committing `.env.example` (was swallowed by `.env*`). |
| 2026-08-20 | 1 — api-core | Full zod mirror set (`lib/types/{common,auth,product,cart,wishlist,address,order,returns,ops}.ts`), `lib/api/{client,errors,idempotency,requests}.ts`, `lib/domain/{money,lifecycle,lists}.ts`, `stores/{use-session,use-live,use-cart}.ts`, `components/shared/*` + CartBadge wired to the session/cart stores. Docs updated in the same commit: api.md §1 — `getSession` is `GET /api/auth/get-session` (better-auth registers `/get-session`, not `/session`; the old path 404s) and returns literal `null` when signed out; §1 — signUp/signIn return `{ token, user }`; §4 — checkout `invoice` is non-null (always created: COD issued, gateway draft); §6 — phase-1 verified shapes (cart rows, mutation responses). architecture.md §3/§7 — `/get-session` hydration; §8 — no `inputPaiseFromText` (storefront never inputs money); §15 — allowlist now exactly `react-dom` (`zod`/`zustand` removed in this commit, their first import). |
| 2026-08-20 | 2 — auth-cart | `bun run ci` green (typecheck + build + verify:hygiene); build route map shows `/cart` (ƒ server-rendered, guarded), `/login` + `/signup` static. **Live round-trip through the :3000 proxy → :3100 backend:** anonymous `/cart` → 307 → `/login`; sign-up via the form → 200 `{ token, user }` (auto-provisioned customer) + httpOnly cookie, redirect to `/`; header account menu hydrates on mount (avatar initials + name + email + Your cart + Sign out); cart round-trip — PUT qty 2 → server-recomputed `lineTotalPaise` 110000 (unit 55000), PUT qty 3 → 165000 on the same row (upsert, no duplicate), DELETE → empty; sign-out (with `Origin` header; better-auth CSRF-checked, 403 without it — a curl artifact, the browser sends Origin) → session null → `/cart` redirects again. Delivered: `lib/api/server-session.ts` (`getServerSession` — the app's only server-side fetch, mirrors dashboard; origin resolution API_SERVER_ORIGIN → NEXT_PUBLIC_API_PROXY → NEXT_PUBLIC_API_BASE → :3000), `app/(account)/layout.tsx` (async server guard, redirects anonymous, renders the site header/footer shell), `components/layout/account-menu.tsx` (session hydrate on mount — a real bug found live: a fresh page load showed "Sign in" for a signed-in customer because nothing hydrated the store — the server guard passed but the client never re-checked; fixed per architecture.md §7 "client-side shell re-checks for post-render races"), `components/cart/cart-line.tsx` (row renders the backend's verbatim `unitPricePaise`/`lineTotalPaise`, QtyStepper, remove), `app/(account)/cart/page.tsx` (`useQuery("cart", getCart)`, one-in-flight serialized idempotent mutations, invalidate cart query + badge store, EmptyState/ErrorState/loading states, checkout button gated on session (layout) + non-empty). Docs updated in the same commit: architecture.md §4 (lib/api listing + `server-session.ts`), §7 (server guard + client re-check + account menu hydration); api.md untouched (no new endpoints — cart/auth calls existed from phase 1); `safeNext` shared in lib/domain/lists.ts (login + signup both use it). |
| 2026-08-20 | 3 — browse | `bun run ci` green (typecheck + build + verify:hygiene); build route map now `/` + `/login` + `/signup` static, `/cart` + `/wishlist` + `/addresses` ƒ guarded, `/product/[slug]` ƒ dynamic. **Live through the :3000 proxy → :3100 backend (OpenChamber browser, real session cookie):** listing renders 9 products as cards with per-variant StockBadge + PriceText (compare-at from `mrpPaise` struck) + heart + add button (add disabled exactly when `isInStock` is false); debounced search — typing "coffee" → 300ms → URL `/?q=coffee` → listing refetches to the single match, heading switches to "Results for …"; product detail (slug route) renders name/HSN/VariantPicker (base variant pre-selected, no stock badges — the detail endpoint sends none, api.md §6)/SKU/Add-to-cart/wishlist toggle; wishlist toggle on detail flips live (Add→Remove from wishlist) and the /wishlist page shows the saved row with add-to-cart + remove; cart badge updated live 0→1 on add (upsert qty-1 = same row; badge counts rows — correct); address create dialog (controlled, zod, per-field errors) → "Home / 42 Test Road, Andheri East, Mumbai, Maharashtra, 400069" card + "Use for checkout" flag → ring + "Using for checkout" + "Remove selection"; sign-out → hearts render as anonymous, and anonymous add-to-cart AND anonymous wishlist heart both redirect to `/login?next=%2F`. Delivered: `stores/use-session.ts` `requireCustomer()` (hydrate-then-redirect client gate for public-page mutations; the wishlist toggle renders a plain redirecting button until the session resolves authenticated, so anonymous browsing never fires the C-guarded wishlist read), `stores/use-checkout.ts` (selected-address view-state for phase 4), `hooks/use-add-to-cart.ts` + `hooks/use-wishlist-toggle.ts` (idempotent mutations + shared `wishlist` membership query, optimistic flip with rollback), `components/product/{product-card,variant-picker,wishlist-toggle,product-detail}.tsx`, `components/account/address-form-dialog.tsx`, `app/(public)/page.tsx` (Suspense-wrapped `useSearchParams` listing), `app/(public)/product/[slug]/page.tsx` (server page awaiting `params`, client detail), `app/(account)/{wishlist,addresses}/page.tsx`, debounced `components/layout/search-box.tsx` (writes `?q=` only on the catalog route, else submits on Enter; Suspense-wrapped in the header). **Docs changed in the same commit (spec bugs, AGENTS.md §4):** todo.md phase-3 (1) detail "media" → the backend storefront routes return no media (raw product/variant rows; media lives on staff catalog routes the storefront never calls), (2) VariantPicker is NOT `isInStock`-aware — the detail endpoint omits the flag (api.md §6), (3) wishlist toggle state comes from the shared `getWishlist` membership set, not a `getWishlistItem` call per row; architecture.md §4 (hooks + product components + `use-checkout.ts` listed), §5 (`use-checkout` store row), §7 (`requireCustomer` client gate), §10 (SearchBox debounce mechanics — URL is the source, fetch keys off it; the box never rewrites a non-catalog page URL), §13 (variant-keyed wishlist membership, detail no-media no-stock, addresses select-flag). api.md untouched (all endpoints used here were already documented in phase 1 — no new calls). |
| 2026-08-20 | 4 — checkout-orders | `bun run ci` green (typecheck + build + verify:hygiene); build route map adds `/checkout` + `/checkout/result` + `/orders` + `/orders/[id]` ƒ guarded. **Live through the :3000 proxy → :3100 backend (OpenChamber browser, real "PC Phase Check" session cookie):** COD checkout (default mode, address "Home / 14 MG Road, Mumbai, Maharashtra, 400001") → receipt OR-KFLLO7I ₹210 (item line ₹210 = 200+10 tax verbatim) → appears in /orders + detail (items, timeline incl. "Invoice issued", invoice INV-26CRUEL); return request on a confirmed order → draft `RT-ODE7M6G` persisted in backend `data/vitrine.sqlite` (dialog closes after its ~100ms exit transition — snapshot timing made it look stuck, not a bug); gateway checkout OR-ZHOC4JY ₹577.50 → result page "Payment processing" + cart retained (badge 1, ₹0 row total — backend draft-invoice behavior) → signed webhook (`X-Webhook-Signature` = lowercase hex HMAC-SHA256 over the body, secret `WEBHOOK_SECRET_GATEWAY=vitrine-local-gateway-secret` added to backend/.env, `payment.confirmed` + the payments row's `gatewayPaymentId`) → 200 confirmed → result page **live-flipped to receipt via realtime, no refresh** + cart badge → 0 (reload path); second gateway order OR-ENI5WT6 verified the in-session badge→0 path (no reload) after the realtime client fix; pending order OR-B4KQZGT cancelled → "Cancelled" badge, timeline gains "Order cancelled", action buttons gone, cart badge stays 1 (backend keeps the gateway cart — consistent). Delivered: `lib/realtime/client.ts` (WS, backoff reconnect, INVALIDATE_PREFIXES, `payment.confirmed` → invalidate live `"cart"` + cart badge store because the backend clears the cart in the confirm tx), `hooks/use-realtime.ts` (subscribe wrapper), `lib/domain/dates.ts` (`formatDate`/`formatDateTime`), `components/account/{checkout-form,order-status-badge,order-timeline,return-form-dialog}.tsx`, `app/(account)/checkout/page.tsx` (cart summary verbatim, out-of-stock highlight via `listStorefrontProducts` `isInStock` map, 409/429 handling, success invalidates both cart mirrors then pushes result), `app/(account)/checkout/result/page.tsx` (receipt / payment-processing / cancelled / 404; `hasOrderId` guard; realtime live-flip), `app/(account)/orders/page.tsx` (rows `orders.data?.data ?? []`), `app/(account)/orders/[id]/page.tsx` (manual `params: Promise<{id}>` + `use(props.params)` — route-gen PageProps is stale, detail header shows invoice total when the draft invoice exists since a pending row's `totalPaise` is 0), `app/layout.tsx` (Toaster), `components/layout/account-menu.tsx` (Your orders + Addresses links). Docs updated in the same commit: architecture.md §4 (folder tree + checkout/result + orders routes), §11 (payment.confirmed clears cart → invalidate both mirrors), §13 (pending-total display rule); api.md §6 phase-4 verified notes (checkoutReference = payments.gatewayPaymentId; pending row totalPaise 0 vs draft-invoice totals; list invoice non-null even pending; cancel response + events; return draft round-trip; payment.confirmed cart-clear; 429 rate_limited). Known gaps unchanged (§bottom). |

| 2026-08-20 | 5 — realtime-ops | `bun run ci` green (typecheck + cold `bun run build` from a deleted `.next` + verify:hygiene); build route map 12 routes. **Live two-session verification (OpenChamber browser session A on :3000 + session B driving the backend API as the same customer `phase5@vitrine.test`, signed webhooks fired at `backend/routes/webhooks.ts` from the pending `payments.gatewayPaymentId` read out of `backend/data/vitrine.sqlite`):** every exit item green — gateway checkout OR-MUME4VV's pending→confirmed transition landed on `/checkout/result` with **no manual refresh** (receipt + cart badge 1→0); a gateway order placed in session B (OR-QDNBU25, then OR-XFJPGSM) flipped its `/orders` row from "Payment pending" to "Confirmed" live; a cancel from session B flipped OR-JCZ4UZK to "Cancelled" live; the shell indicator stayed "Live" throughout (one transient "Connecting…" window observed mid-reconnect — data survived via the synthetic `reconnected` frame → refetch); COD orders from session B (OR-MFU3HP4, OR-ILGAKL4) did **not** appear live — the documented no-customer-wide-topic gap — and landed on the next visit/refetch. **Two real bugs found and fixed:** (1) the eager zero-topic connect sent `{op:"subscribe",topics:[]}` on every account page — the backend's frame schema requires `topics.min(1)`, so every load drew an error frame (caught by the new error-frame logging — the phase's own hardening paying off); `sendSubscribe` now no-ops on an empty topic set. (2) `use-live.ts` `invalidate` **dropped** the entry's data, so every live update blanked the orders list for the refetch window (two observed empty-list episodes); invalidate now keeps the last-known data (stale-while-refetch) and the orders list renders rows whenever data exists — re-verified: the final OR-XFJPGSM flip rendered the full list continuously, no blank. Docs updated in the same commit: architecture.md §11 (two new hardening bullets — empty-topic connect, stale-while-refetch) + §4 tree gained `RealtimeIndicator`; api.md §5 verified-notes extended; todo.md phase-2 checkboxes ticked (spec gap — login/signup, account layout guard, cart page all verified present and functional). Known-gap list revisited: unchanged (backend gaps, unaffected). Commit `phase 5: realtime-ops`.

---

## Known backend gaps raised (not fixed here — surfaced to the operator at review)

1. **Gateway checkout is a placeholder in the frontend.** The backend's gateway path is
   webhook-driven (phase 8 backend) and there is no real provider yet; the storefront
   implements the documented pending→wait-on-`order:{id}` behavior and a manual
   "refresh" affordance, so a store can complete gateway orders via a future provider
   webhook with zero frontend changes.
2. **`GET /api/storefront/products` is non-paginated.** The listing is a bounded catalog
   read (`{ data }`); a large catalog returns one big page. The UI renders it directly
   (no client pagination) and treats search as the mitigation — per the backend's design.
3. **Product detail exposes no `isInStock`.** `GET /api/storefront/products/:slug`
   returns raw variant rows without the stock flag (only the listing adds it). The detail
   page therefore shows no stock state; stock is enforced by the backend at checkout
   (`409 insufficient_stock`).