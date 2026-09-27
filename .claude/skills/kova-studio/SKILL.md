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

## 5. Add Paystack credits (Phase 2 recipe, naira)

1. Migration: `credit_packs` and `payments` tables (see DEVELOPMENT_PLAN.md).
2. `POST /api/pay/init`: `guardUser`, load pack from DB, call `https://api.paystack.co/transaction/initialize` with `PAYSTACK_SECRET_KEY`, amount in kobo, `reference` = new uuid, `callback_url` = `${siteUrl}/account?paid=1`, store a `pending` payment row.
3. `POST /api/pay/webhook` (no `guardUser`, it comes from Paystack):
   - Read the raw body text, compute HMAC SHA512 with `PAYSTACK_SECRET_KEY`, compare with `x-paystack-signature` using `timingSafeEqual`.
   - On `charge.success`, re-verify with `GET https://api.paystack.co/transaction/verify/:reference`.
   - Check amount and currency match the pack, then in one SQL function: mark payment `paid` only if it was `pending`, and call `grant_seconds(user, 'paid', credits * 60, true, reference, null, amount_kobo, 'paystack', pack_id)`. This makes it idempotent and puts the money in /admin/finance automatically.
4. Add `PAYSTACK_SECRET_KEY` to `.env.example`, Vercel env, and SECURITY.md.

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
