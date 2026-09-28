---
name: kova-studio
description: Step-by-step procedures for building features in the Kova Studio repo (Next.js 16 + Supabase + Lucy 2.5 via fal/Decart). Use when adding a page, API route, database change, studio control, admin or finance feature, payment feature, or when preparing a release.
---

# Kova Studio development procedures

Read AGENTS.md and DESIGN.md first. These are the recipes for common jobs. Follow the owner rules: no em dashes, Windows CMD commands only, full file replacements when handing code over.

## 1. Add a database change

1. Write the SQL change in a new file `supabase/migrations/YYYY-MM-DD_short_name.sql`.
2. Merge the same change into `supabase/schema.sql`, keeping it idempotent:
   - `create table if not exists`, `alter table ... add column if not exists`
   - `create or replace function`
   - `drop policy if exists "x" on t;` then `create policy "x" ...`
3. For any new table: `alter table ... enable row level security;` and only add browser-readable policies when the browser truly needs to read it.
4. For any new function that changes balances or money: `security definer`, `set search_path = public`, revoke from `public, anon, authenticated`, grant to `service_role`.
5. Add the TypeScript shape to `lib/types.ts`.
6. Tell the owner: "Paste `supabase/migrations/<file>.sql` into Supabase > SQL Editor and press Run."

## 2. Add an API route

Template (`app/api/<name>/route.ts`):

```ts
import type { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { guardUser, json, jsonError, readJson } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = { example: string };

export async function POST(req: NextRequest) {
  const guard = await guardUser(req); // { admin: true } for admin routes
  if (!guard.ok) return guard.response;

  const body = await readJson<Body>(req);
  if (typeof body.example !== "string") return jsonError("Missing example.", 400);

  const { error } = await createAdminClient().rpc("some_function", { p_user: guard.current.user.id });
  if (error) return jsonError("Could not do that. Try again.", 500);
  return json({ ok: true });
}
```

Rules: validate every field, friendly error text, never return secrets or other users' data, rate limit public routes with `lib/rate-limit.ts`.

## 3. Add a page

- Signed-in page: server component, call `requireUser("/path")` (or `requireAdmin()`), wrap it in `<div className="glow-page min-h-screen">` with `<AppHeader />`.
- Admin page: load rows in `lib/admin-data.ts`, do the math in a pure file (like `lib/finance.ts`), and render a pure `components/admin/XxxView.tsx` inside `<AdminShell tab="..." title="...">`. Use `Card`, `Kpi`, `Badge`, `thClass`, `tdClass` from `AdminShell.tsx`. Add a tab in `AdminShell` if it is a new section.
- Supabase returns at most 1000 rows per request: use `fetchAll()` in `lib/admin-data.ts` for anything that can grow.
- If it needs env, start with `const missing = missingEnv(); if (missing.length) return <SetupNotice missing={missing} />;`
- Public page: use `<SiteHeader />` and `<SiteFooter />` from `components/SiteChrome.tsx` inside `.glow-page`.
- Add private paths to `PRIVATE_PREFIXES` in `proxy.ts`.
- Icons: add to `components/Icons.tsx`. Follow DESIGN.md for color, type and components.

## 4. Add a control to the studio

- File: `components/studio/Studio.tsx`. Panels use `<Panel icon={<IconX className="h-[18px] w-[18px]" />} tone="bg-sky" title="...">`.
- Anything that must be read inside SDK events or timers goes in a ref (see `statusRef`, `secondsRef`), and the state copy is for rendering.
- Never trust client values for money. The client may report seconds, but billing happens in `settle_session`.
- After changes, test the full loop: camera on, pick character, go live, switch character, record, end, check the balance updated.

## 5. Paystack credits (Phase 2, naira): built

This is already wired up. Read these files rather than rebuild the flow:

- `supabase/migrations/2026-09-28_paystack.sql` (merged into `schema.sql`): the `payments` table and `complete_payment(reference, amount_kobo, currency, paystack_id, channel, raw)`, a `security definer` function that locks the row, is idempotent per reference, and calls the same `grant_seconds` used for manual payments.
- `lib/paystack.ts`: `initialize()`, `verify()`, `verifySignature()`, a thin wrapper around `api.paystack.co`, `server-only`.
- `app/api/pay/init/route.ts`: `guardUser`, resolves the pack from `lib/pricing.ts` (never trust a client-sent price), inserts a `pending` `payments` row, calls `initialize()` with `callback_url = ${siteUrl}/pay/return`, returns the checkout URL.
- `app/api/pay/webhook/route.ts` (no `guardUser`, Paystack calls it directly): checks `x-paystack-signature` on the raw body, then on `charge.success` re-verifies with `verify()` and calls `complete_payment`.
- `app/pay/return/page.tsx`: where Paystack sends the shopper back. Same `verify()` + `complete_payment()` call as the webhook (whichever gets there first wins, the other becomes a no-op `'already'`), then redirects to `/account?paid=1` or `?paid=0`. Never grants from the query string.
- `components/RateCard.tsx` (`mode="account"`): the real Buy buttons, POST `/api/pay/init`, redirect to the returned URL.

To extend this (for example, moving packs into a DB table): keep the SQL function as the only place that grants credits, and keep the client-sent pack id resolved against a server-side source, never trusted as-is.

## 6. Add a finance number or chart

1. Add the field to `Finance` and compute it in `computeFinance()` in `lib/finance.ts` (pure, no database calls, money in naira from `amount_kobo / 100`).
2. If it needs new rows, load them in `loadFinance()` in `lib/admin-data.ts` with `fetchAll()`.
3. Show it in `components/admin/FinanceView.tsx` with `Kpi` or `Card`.
4. Charts: follow the chart pattern in DESIGN.md (one axis, legend, hover tooltip, table view). Check new series colors for color blindness on the `surface` color.
5. Update the mock in your screenshot harness, if you use one, so the view renders with fake data.

## 7. Release checklist

```
npm run typecheck
npm run build
git add .
git commit -m "short description"
git push
```

Then on the Vercel deployment: sign up as a new user, go live for 10 seconds, check `/admin` shows the session and the balance dropped by about 10 seconds, record a test payment and check it appears in `/admin/finance` and on the user's page in `/admin/users`, check no watermark as admin.
