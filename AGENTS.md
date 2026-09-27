# AGENTS.md: Kova Studio

Instructions for AI coding agents (Claude Code, Cowork, Codex, Cursor) working in this repo. Read this first, then DESIGN.md and SECURITY.md before touching UI or anything with money, auth or keys.

## What this is

Kova Studio is a browser app where a user turns their live webcam into a character (uploaded picture or gallery preset) using the Lucy 2.5 realtime model (through fal.ai now, Decart direct later). They can record, or stream through OBS. The channel link and OBS browser source work on Decart only. Users buy naira credit packs (1 credit = 1 minute). Free users get a watermark; paid users and admins do not. Admins get a dashboard with finance, users and the gallery.

## Owner preferences (must follow)

- **Never use em dashes** anywhere: code, comments, UI copy, docs, commit messages. Use commas, colons, periods or "/" instead.
- **Windows CMD commands only** in instructions. No PowerShell, no bash syntax (`copy` not `cp`, `notepad` not `nano`, `rmdir /s /q` not `rm -rf`).
- **Full file replacements** when handing code to the owner, not diffs.
- Plain, short explanations. Casual and direct.

## Stack

- Next.js 16 App Router, React 19, TypeScript strict, Tailwind CSS v4 (`app/globals.css` holds the design tokens)
- `proxy.ts` (Next 16 name for middleware): refreshes Supabase auth cookies, guards private pages
- Supabase: Auth (email + password), Postgres with RLS, Storage bucket `presets`
- Lucy 2.5 realtime through `@fal-ai/client` (now) or `@decartai/sdk` (later), behind `lib/live`
- Hosting: Vercel, region `lhr1` (see `vercel.json`)

## Commands (Windows CMD)

```
npm install
npm run dev
npm run typecheck
npm run build
```

## Map

```
app/
  page.tsx                 landing (reads presets)
  (auth)/                  login, signup, forgot-password, reset-password + server actions
  auth/confirm/route.ts    email link landing (code or token_hash)
  welcome/                 house rules gate (sets profiles.accepted_terms_at)
  studio/                  server page, renders components/studio/Studio.tsx
  c/[slug]/                public channel + OBS source (components/Viewer.tsx), Decart only
  account/                 balances, buy credits, channel, session history
  admin/                   Overview (stats, add time, signup gift, recent sessions)
  admin/finance/           revenue, AI cost, fees, profit, provider balance, payments, expenses
  admin/users/             every user with search, filters, sorting, pages
  admin/users/[id]/        one user: balances, credit history, sessions, add time
  admin/gallery/           preset characters
  api/session/{start,heartbeat,end}   metering
  api/live                 put a session on the channel (POST) / take it off (DELETE)
  api/channel/[slug]       public: is this channel live?
  api/decart/watch-stream/[room]      viewer proxy to Decart (never exposes the key)
  api/fal/token            60-second fal tokens, only for a live session with time left
  api/account/channel      reset channel link
  api/admin/{grant,settings,presets,expenses}  admin only
  api/admin/finance/export CSV of every payment (GET, admin login only)
components/
  Icons.tsx                all icons (stroke SVG, currentColor)
  SiteChrome.tsx           public navbar + footer
  studio/                  Studio.tsx, Gallery.tsx, util.ts (watermark, recorder)
  admin/                   AdminShell (tabs, Card, Kpi, Badge, table classes), *View.tsx pages, FinanceChart, AdminForms
lib/
  env.ts        server env (server-only)      config.ts   shared constants + formatters
  auth.ts       getCurrentUser, requireUser, requireAdmin, presets
  api.ts        route helpers: guardUser (origin + auth + admin), json, jsonError
  pricing.ts    naira credit packs, paystackFeeNgn
  finance.ts    computeFinance(): pure finance math for /admin/finance
  admin-users.ts  buildUserRows / queryUsers: pure user list math
  admin-data.ts   server loaders for the admin pages (reads Supabase in 1000-row pages)
  decart.ts     createSessionToken, roomFromSubscribeToken (server)
  live/         provider-neutral engine: startEngine() -> decart.ts (Decart SDK) or fal.ts (fal WebRTC signaling)
  supabase/     client.ts (browser), server.ts (user client + admin client)
supabase/schema.sql        idempotent schema + SQL functions (source of truth)
supabase/migrations/       dated changes for an existing project (paste into the SQL Editor)
```

## Hard rules

1. **Secrets stay on the server.** `SUPABASE_SECRET_KEY`, `FAL_KEY` and `DECART_API_KEY` are only read in `lib/env.ts` (marked `server-only`). Never prefix them with `NEXT_PUBLIC_`. Never return them from a route.
2. **Balances only change inside SQL functions** (`begin_session`, `settle_session`, `grant_seconds`). Never `update profiles set paid_seconds = ...` from TypeScript. Money received is recorded by `grant_seconds` (`p_amount_kobo`, `p_method`, `p_pack`) on the same ledger row as the credits.
3. **The server decides the watermark** (`sessions.watermark` from `begin_session`). The client only draws what the server said.
4. **Every mutating API route calls `guardUser(req)`** (checks Origin against `ALLOWED_ORIGINS` and the logged-in user). Admin routes use `guardUser(req, { admin: true })`.
5. **Admin = email in `ADMIN_EMAILS`** (env). Do not add an admin flag the browser can influence.
6. **AI provider is a switch** (`AI_PROVIDER=fal|decart`). The studio only talks to `lib/live` (`startEngine`), never to a provider SDK directly. Decart tokens are scoped (`allowedModels`, `allowedOrigins`, `maxSessionDuration` = reserved seconds). fal tokens come from `/api/fal/token`, last 60 seconds, and are refused once a session is out of time.
7. **Public routes** (`/api/channel/*`, `/api/decart/watch-stream/*`) must rate limit and must only act on rooms that are live right now.
8. RLS stays on for every table. The browser client can only read its own profile/sessions and active presets. `expenses` and `credit_ledger` have no browser policies at all.
9. **Money is stored in kobo** (`amount_kobo`, bigint). Convert to naira only for display. Finance math stays pure in `lib/finance.ts` so it can be tested with fake rows.
10. **Admin pages load data in `lib/admin-data.ts` and render a pure `*View` component.** Keeps pages easy to mock for screenshots and tests.

## Database changes

- Edit `supabase/schema.sql` so it stays idempotent (`create table if not exists`, `create or replace function`, `drop policy if exists` before `create policy`).
- Also add a dated file in `supabase/migrations/` (e.g. `2026-10-01_credit_packs.sql`) with just the change, so the owner can paste it into the Supabase SQL Editor.
- New SQL functions: `security definer`, `set search_path = public`, `revoke all ... from public, anon, authenticated`, `grant execute ... to service_role`.
- Test SQL with a local Postgres if available before shipping.

## UI rules (summary, full version in DESIGN.md)

- Every page sits on `.glow-page` (near-black with red glow). Content lives in `.card`s with 20px corners.
- Buttons are pills: `.btn-signal` (red, one primary per screen), `.btn-light` (white, secondary), `.btn-line`, `.btn-ghost`.
- Inputs use `.field` (add `.field-sm` in dense forms).
- Headlines use `.display` with one `.text-glow` word, small caps labels use `.label`, section intros use `.chip`.
- Icons come from `components/Icons.tsx`. Admin pages use `AdminShell`, `Card`, `Kpi`, `Badge`, `thClass`, `tdClass`.
- Honest copy only: no fake reviews, fake stats or "#1" claims. No emojis.

## Before you say "done"

- `npm run typecheck` passes
- `npm run build` passes
- Search your changes for em dashes
- If you touched metering, auth, payments or keys: re-read SECURITY.md checklist
- Update DEVELOPMENT_PLAN.md checkboxes
