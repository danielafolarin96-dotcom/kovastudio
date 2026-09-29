# Kova Studio: Development Plan

Live webcam AI character swap in the browser. Users pick or upload a character, go live, share a channel link or pipe it into OBS, and record.

Owner: Afolarin (solo). Hosting: Vercel (vercel.app URL for now, custom domain later).

---

## Phase 0: Foundation (done)

- [x] Next.js 16 app (App Router, `proxy.ts`, Tailwind v4)
- [x] Supabase schema: profiles, sessions, credit ledger, live shares, presets, settings (`supabase/schema.sql`)
- [x] Email + password auth (signup, login, forgot/reset password, email confirm route)
- [x] House rules gate before first stream (`/welcome`)
- [x] Server-metered live sessions (reserve, heartbeat, settle, refund)
- [x] Studio: camera, gallery presets, upload, go live, switch character mid-stream, record, fullscreen
- [x] Watermark for unpaid users (decided on the server), none for paid users and admins
- [x] Channel link `/c/[code]` + OBS browser source `?obs=1`
- [x] Viewer proxy so viewers never see the Decart key
- [x] Admin panel: stats + costs, add time, signup gift, preset gallery, users, sessions
- [x] Account page: balances, channel links, reset link, session history
- [x] Landing, terms, privacy, 404
- [x] Project docs: AGENTS.md, CLAUDE.md, DESIGN.md, SECURITY.md, skill file, vercel.json
- [x] Redesign v2 "night studio" (dark, red glow, rounded cards, pill buttons, Poppins) across every page, approved from mockups
- [x] Admin v2: tabs for Overview, Finance, Users, Gallery
- [x] Finance: revenue, AI cost, Paystack fees, expenses, net profit, revenue vs AI cost chart, sales by pack, provider balance estimate, payments table + CSV export
- [x] Users: search, filters, sorting, pages, and a user details page with credit history, sessions and add time
- [x] Recording a payment now saves the amount (kobo), method and pack

## Phase 1: Go live on Vercel (this week)

Infrastructure (created by Claude):
- Supabase project `kovastudio`, id `uaqsisnoxbvxemtmrinf`, region eu-west-2 (London), schema applied
- Vercel project `kovastudio` (prj_joLKf8In9vUpde33PS5usqscFz8z), linked to GitHub `danielafolarin96-dotcom/kovastudio`, public env vars set

Live URL: **https://kovastudio-kappa.vercel.app** (`kovastudio.vercel.app` was taken). Swap to a custom domain later.

1. [x] Supabase project in West EU (London), schema applied
2. [x] Vercel project created and linked to the GitHub repo, public env vars set
3. [x] Supabase: turn OFF "Confirm email" (Authentication > Sign In / Providers > Email)
4. [ ] Supabase: Site URL `https://kovastudio-kappa.vercel.app`, Redirect URLs `http://localhost:3000/**` and `https://kovastudio-kappa.vercel.app/**`
5. [x] AI provider switch built: `AI_PROVIDER=fal` now (Decart rejected the NIN slip), `decart` later
6. [x] fal.ai account and API key (scope: API)
6b. [ ] fal credit: $20 to $30
7. [x] `.env.local` filled, `npm run dev` works
7b. [x] Supabase SQL Editor: ran `supabase/migrations/2026-09-28_finance.sql`
8. [x] Vercel: `SUPABASE_SECRET_KEY` and `FAL_KEY` added as Secret (Production)
8b. [ ] Vercel: set `NEXT_PUBLIC_SITE_URL` and `ALLOWED_ORIGINS` to `https://kovastudio-kappa.vercel.app`, then redeploy (Go live is blocked until this matches the real URL)
9. [ ] Email Decart support about other ID options; get an international passport. When verified: add `DECART_API_KEY`, set `AI_PROVIDER=decart`
10. [x] Pushed to GitHub, Vercel deployed (2026-09-27)
11. [ ] Upload 6 to 12 preset characters you own in /admin/gallery
12. [ ] End-to-end test on Vercel: signup, go live, switch character, record, OBS Window Capture
13. [ ] Check the fal dashboard after the first session: confirm the real price per second and that usage stops when a session ends
14. [ ] Log your fal top-up in /admin/finance > Log money out (with dollars) so the balance estimate starts

**Provider differences** (same Lucy 2.5 model, same $0.02/sec):

| | fal (now) | Decart direct (later) |
| --- | --- | --- |
| Signup | Card | ID check |
| Hard stop when paid time runs out | Studio stops itself + server heartbeat closes the session. A tampered browser could keep going, so keep the fal balance small | Decart ends the stream at the token limit |
| Watch link + OBS browser source | Not yet (OBS Window Capture instead) | Built in |


## Phase 2: Credits and Paystack checkout (next)

**Decisions:** charge in **naira** with **Paystack**. **No free minutes** for signups (signup gift = 0). **No email confirmation.**
1 credit = 1 minute of live AI, billed by the second. Credits never expire. Any paid pack removes the watermark.

Our cost: about ₦1,600 per credit ($1.20 at ₦1,330/$). Paystack: 1.5% + ₦100, capped at ₦2,000.

| Pack | Credits | Price | Per minute | Our AI cost | Paystack fee | Profit |
| --- | --- | --- | --- | --- | --- | --- |
| Try | 2 | ₦8,000 | ₦4,000 | ₦3,192 | ₦220 | ₦4,588 (57%) |
| Starter | 10 | ₦35,000 | ₦3,500 | ₦15,960 | ₦625 | ₦18,415 (53%) |
| Creator | 30 | ₦95,000 | ₦3,167 | ₦47,880 | ₦1,525 | ₦45,595 (48%) |
| Pro | 90 | ₦250,000 | ₦2,778 | ₦143,640 | ₦2,000 | ₦104,360 (42%) |

Prices live in `lib/pricing.ts` for now (landing rate card and `/account#buy`). Decart bills in dollars, so re-check prices whenever the naira moves.

**Compared with Virofy** (default packs found in their site code, Sept 2026; their live prices may differ):
2 credits = 1 second. Starter ₦16,000 for 2.5 min, Basic ₦50,999 for 8.3 min, Pro ₦100,000 for 16.7 min, Ultimate ₦259,999 for 41.7 min.
That is about **₦6,000 to ₦6,400 per minute**, paid by manual bank transfer and receipt upload that an admin approves.
Kova is roughly 35% to 55% cheaper per minute, sells simple minute-based credits, and credits accounts automatically.

Build list:
- [x] Paystack account (test mode), secret key set in Vercel and `.env.local`
- [x] `payments` table (reference, user, pack, amount_kobo, status, raw event) + `complete_payment()` SQL function
- [x] `POST /api/pay/init`: `guardUser`, look up the pack, call Paystack `transaction/initialize` (amount in kobo), save a pending payment, return the checkout URL
- [x] `POST /api/pay/webhook` and `/pay/return`: verify `x-paystack-signature` (HMAC SHA512 of the raw body), re-verify with `transaction/verify`, check amount, then `complete_payment()` grants exactly once per reference (calls `grant_seconds(user, 'paid', credits * 60, true, reference, null, amount_kobo, 'paystack', pack_id)`), so Finance picks it up automatically
- [x] Turn on the Buy buttons in `components/RateCard.tsx`, success banner on `/account?paid=1`
- [ ] Move packs into a DB table editable in `/admin`

**Phase 2 status: tested and working.** Bought the Try pack on Vercel with a Paystack test card: credit landed once, `/account` shows Paid, `/admin/finance` showed revenue ₦8,000 and net ₦7,780. Refund line in `app/terms/page.tsx` is confirmed as written.

**Owner steps done:**
1. [x] Paystack account created, test mode, secret key set.
2. [x] `PAYSTACK_SECRET_KEY` added in Vercel (Secret, Production) and `.env.local`.
3. [x] Paystack dashboard test Webhook URL and Callback URL set.
4. [x] `supabase/migrations/2026-09-28_paystack.sql` run in the Supabase SQL Editor.
5. [x] Bought the Try pack with a Paystack test card on Vercel: credit landed once, showed in `/account` and `/admin/finance` with method Paystack.

**Still open:**
- [ ] Going live later: switch to the `sk_live_` key and live webhook/callback URLs after Paystack business verification.
- [ ] Move packs into a DB table editable in `/admin` (build list item above).

## Phase 3: Growth features

- [ ] Viewer count on the channel page (Supabase Realtime presence)
- [ ] Live chat on the channel page
- [ ] "Go live as yourself, then switch to AI" (camera-only mode costs nothing)
- [ ] Saved characters per user (private Storage bucket)
- [ ] Custom domain + Resend domain email
- [ ] USD pricing for international creators

## Phase 4: Hardening

- [ ] Image moderation on uploads and presets
- [ ] Shared rate limiting (Upstash Redis) instead of in-memory
- [x] Content Security Policy header (enforced in `proxy.ts`, 2026-09-29, see SECURITY.md)
- [x] fal metering hole narrowed: `settle_session` floors billing on wall-clock time to the last heartbeat when a session is force-closed stale/over time and at least one heartbeat came in, a cron (`/api/cron/settle-sessions`, daily on Vercel Hobby, optional free 5-minute external pinger documented in SECURITY.md) settles stale sessions on a timer, `/admin/finance` warns on force-closed sessions (2026-09-29, see SECURITY.md). Still open: a client that never sends a single heartbeat still refunds in full, and fal itself has no way for us to force a live stream closed, only switching `AI_PROVIDER` to a funded, tested Decart key gives a real hard cutoff
- [ ] Error tracking (Sentry free tier)
- [ ] Lawyer review of Terms and Privacy (NDPA)
- [ ] Automated tests for the SQL functions and API routes

---

## Money: AI provider deposit (fal now, Decart later)

Both are prepaid, pay as you go. Log every top-up in /admin/finance so the dashboard can estimate what is left. $0.02 per second = $1.20 per minute = $72 per hour.

| Stage | Deposit | Covers |
| --- | --- | --- |
| Building and testing | $30 to $50 | 25 to 40 minutes of live AI |
| Soft launch | $100 | about 80 minutes |
| After launch | Top up from sales | About 45% to 55% of every pack sold goes back to the AI provider. /admin/finance turns amber when the balance is below what users are owed |

Rules of thumb:
- Keep the AI balance above: (all unused paid credits) + (free signup gifts you expect this week).
- No free signups, so the only AI spend is paid users and admin testing.
- Admin sessions cost real money too. The `/admin` cost card includes them.
- Ask fal (or Decart) about your concurrent session limit before a big launch.

## Environments

| | Local | Vercel |
| --- | --- | --- |
| URL | http://localhost:3000 | https://kovastudio-kappa.vercel.app |
| NEXT_PUBLIC_SITE_URL | http://localhost:3000 | the vercel.app URL |
| ALLOWED_ORIGINS | http://localhost:3000 | the vercel.app URL |
| Supabase | same project (fine for now) | same project |
