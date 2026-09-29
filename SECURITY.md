# SECURITY.md: Kova Studio

What we protect, how, and what is still open. Read before touching auth, metering, payments, keys or public routes.

## What matters most

1. **Our AI provider balance** (fal now, Decart later). Every second of AI costs real money. A leaked key or broken metering drains it.
2. **User accounts and data.** Emails, passwords (handled by Supabase), session history, payment records.
3. **Misuse of the product.** Impersonation, scams, non-consensual content of real people.

## Secrets

| Secret | Where it lives | Never |
| --- | --- | --- |
| `SUPABASE_SECRET_KEY` | `.env.local`, Vercel env | In the browser, in `NEXT_PUBLIC_*`, in logs, in git |
| `DECART_API_KEY` | `.env.local`, Vercel env | Same |
| `FAL_KEY` | `.env.local`, Vercel env | Same. The browser only ever gets 60-second fal tokens from `/api/fal/token` |
| `PAYSTACK_SECRET_KEY` | `.env.local`, Vercel env | Same |
| `CRON_SECRET` | `.env.local`, Vercel env | Same. Checked against the `Authorization` header on `/api/cron/settle-sessions`, Vercel Cron sends it automatically once the env var is set |

- `.env.local` is in `.gitignore`. Check before every first push: `git status` must not list it.
- `lib/env.ts` imports `server-only`, so importing it into a client component fails the build.
- If a secret leaks: rotate it immediately (Supabase > API Keys, fal or Decart dashboard), update Vercel env, redeploy.
- Vercel's Hobby plan only runs a cron job once a day, so `vercel.json` has `/api/cron/settle-sessions` on a daily schedule (`0 3 * * *`). That is a slow backstop, not the fast sweep the fal metering fix wants. To settle stale sessions every few minutes instead, add a free external pinger:
  1. Create a free account at a service like cron-job.org (any similar "call this URL on a schedule" service works).
  2. Add a new job with the URL `https://<your site>/api/cron/settle-sessions`, method GET, every 5 minutes.
  3. Under its custom headers, add one: name `Authorization`, value `Bearer <your CRON_SECRET>` (the same value set in Vercel env). Without this exact header the route returns 401 and does nothing.
  4. Keep the daily Vercel cron running too, as a backstop if the external pinger ever stops.

## Controls in place

**Auth**
- Supabase email + password. Passwords never touch our code beyond passing them to Supabase.
- `proxy.ts` refreshes sessions and redirects logged-out users away from `/studio`, `/account`, `/admin`, `/welcome`.
- Server code uses `supabase.auth.getUser()` (verified with Supabase), not just the cookie.
- Admin = email in `ADMIN_EMAILS` env, checked on the server for every admin page and route.
- Reset-password answers the same whether or not the email exists (no account fishing).

**Database**
- RLS on every table. The browser can read only its own profile and sessions, and active presets.
- All balance changes happen inside `security definer` SQL functions that only `service_role` can execute.
- `begin_session` locks the profile row (`for update`), so two tabs cannot spend the same seconds twice. One open session per user.

**Decart**
- The browser gets a short-lived client token, never the real key.
- Tokens are scoped: only `lucy-2.5`, only our origins, and `maxSessionDuration` equals the seconds reserved from the user's balance. When their time is up, Decart itself ends the session.
- Viewers never get a Decart key. `/api/decart/watch-stream/[room]` forwards only for rooms that are live on a Kova channel right now, rate limited per IP.

**API routes**
- Every private route runs `guardUser`: checks the `Origin` header against `ALLOWED_ORIGINS` and the logged-in user.
- Rate limits: session start (12 per 10 min per user), channel checks and watch requests (per IP).
- Inputs validated and length-capped. Preset uploads: type check, 4 MB cap, random file names.

**Admin and money**
- Payments are recorded only through `grant_seconds` (service role), which writes the credits and the amount (in kobo), method and pack on one ledger row.
- `expenses` and `credit_ledger` have RLS on with no browser policies. Only the server reads them, and only on admin pages.
- Every admin page calls `requireAdmin()` and every admin route calls `guardUser(req, { admin: true })`.
- `GET /api/admin/finance/export` (CSV) skips the Origin check because a normal link click sends no Origin, but it still requires an admin login. Cells are quoted and values starting with `=`, `+`, `-` or `@` are escaped so the CSV cannot run spreadsheet formulas.
- Amounts are validated on the server (0 to N100m, whole kobo). Expense kinds and payment methods come from fixed lists.

**Browser**
- `Permissions-Policy` limits camera and mic to our own pages.
- `X-Frame-Options: DENY` on private pages (no clickjacking).
- Uploaded character pictures stay in the browser and go only to Decart during a session. Webcam video is never stored by us.
- Content Security Policy is enforced (`proxy.ts`, `CSP_ENFORCE = true` since 2026-09-29, after a clean report-only click-through: landing, signup, login, account, Buy through Paystack and back, admin tabs, studio camera + preset + upload). No `'unsafe-eval'` in prod `script-src`. The one violation the report-only run caught was zod's `Function("")` capability probe (pulled in by `@decartai/sdk`, used on `/studio` and `/c/[slug]`); it catches its own throw and falls back cleanly, so it is harmless. Do not add `'unsafe-eval'` back for it.

**Content**
- Everyone accepts the house rules before their first session.
- Every uploaded picture needs a consent tick. Presets are admin-curated.
- Free output carries a visible "KOVA STUDIO | AI" watermark.

## Known gaps (be honest about these)

| Gap | Risk | Plan |
| --- | --- | --- |
| fal has no session-duration cutoff of its own (checked in `lib/live/fal.ts`, 2026-09-29). Once the WebRTC media is flowing it does not depend on the signaling channel staying authenticated, so a modified client that stops asking for new fal tokens can keep the video running | A tampered browser could keep streaming on our fal balance past reserved time, we have no server-side way to force that stream closed | `settle_session`'s floor and a cron (`/api/cron/settle-sessions`, daily on Vercel Hobby, see the Secrets section above for a free 5-minute external pinger) close the billing/refund side of this (see the row below), and `/admin/finance` warns when sessions are being force-closed this way. This bounds the money lost, it does not guarantee the stream itself stops; only switching to Decart (`maxSessionDuration` enforced by Decart's own backend) does that |
| Before 2026-09-29, a session that sent at least one heartbeat but never confirmed the AI started ("generating") was billed zero seconds and refunded in full when force-closed for going stale or running over time, no matter how long the stream actually ran | Reserve time, keep heartbeating without ever confirming "generating," get a full refund regardless of usage | Fixed in `settle_session` (`supabase/migrations/2026-09-29_session-floor.sql`): when force-closed with reason `stale` or `time_up` and at least one heartbeat was received, the floor is wall-clock time from `started_at` to the *last heartbeat* (not to whenever the sweep runs), minus a 20s connection-negotiation grace, capped at the reservation. Deliberately does not apply to a user pressing stop, a cancelled/failed start, or a provider error, those still refund in full. A client that suppresses every heartbeat from the very first one still gets a full refund too, accepted so a genuine crash before anything connects is never billed |
| Watermark is drawn in the browser | A skilled free user could strip it from their own view/recording | Short free sessions make it not worth it; the channel stream to viewers also carries it |
| Rate limits are in memory | On Vercel each instance counts separately | Upstash Redis in Phase 4 |
| No automatic image moderation | Users could upload banned content | Consent tick + terms now; moderation API in Phase 4 |
| The studio's background/details prompt blocklist (`lib/prompt-filter.ts`) runs in the browser and is a plain word list | Easy to get around with spacing, misspellings or another language | Best-effort only, catches casual misuse; terms ban prompt misuse regardless of whether the filter catches it |
| Supabase default email is rate limited | Signups stall | Resend SMTP before launch |
| CSP allows fal (`wss://fal.run`) and Decart (`wss://api3.decart.ai`) but neither has been exercised through a real live AI session yet (no fal balance, no camera in the environment that built it) | The policy could still be subtly wrong for the live WebRTC/signaling path | Untested until the first real "go live" session on Vercel; watch the console during that session specifically |
| Manual bank transfer/cash payments are still typed in by an admin | A typo in the amount makes Finance wrong | Paystack payments are automatic and idempotent (webhook and `/pay/return` both call `complete_payment`, which grants exactly once per reference); this gap only applies to manually-entered rows. Fix a wrong manual amount in Supabase Table Editor (`credit_ledger.amount_kobo`) |
| AI provider balance on /admin/finance is our own estimate | It can drift from fal's real balance | Log every top-up with the dollar amount; check the fal dashboard weekly |
| Admin users and finance pages load all rows into memory | Slow once there are many thousands of users or sessions | Move totals into SQL views or functions when it gets slow |
| Email confirmation is off (owner decision) | Anyone can sign up with an email they do not own | Signup gift is 0, so fake accounts cost nothing. Turn confirmation on if abuse starts |

## Payments (Phase 2 rules)

- Never grant credits from the browser redirect. Only from the webhook.
- Verify `x-paystack-signature` (HMAC SHA512 of the raw body with the secret key) using a constant-time compare.
- Re-verify the transaction with Paystack's verify API and check amount + currency against the pack in our DB.
- Grant exactly once per reference (unique constraint + status check in one SQL function).

## Launch checklist

- [ ] `.env.local` not in git, secrets only in Vercel env
- [ ] `ALLOWED_ORIGINS` and `NEXT_PUBLIC_SITE_URL` set to the real Vercel URL
- [ ] Supabase Redirect URLs only list our own domains
- [ ] Signup gift is 0 (email confirmation is off by decision)
- [ ] Resend SMTP configured (password reset emails)
- [ ] Test that a non-admin gets 403 on `/api/admin/grant`
- [ ] Test that a free user sees the watermark and an admin does not
- [ ] `supabase/migrations/2026-09-28_finance.sql` run in the SQL Editor
- [ ] `supabase/migrations/2026-09-28_paystack.sql` run in the SQL Editor, `PAYSTACK_SECRET_KEY` set in Vercel, test webhook and callback URLs set in the Paystack dashboard
- [ ] Bought a pack with a Paystack test card, checked the credit lands once, replayed the webhook and confirmed no double grant
- [ ] First fal top-up logged in /admin/finance (with dollars) so the balance estimate works
- [ ] fal balance and a low-balance alert set on the fal dashboard
- [ ] Terms and Privacy reviewed

## Reporting

Found a security issue? Email the owner directly. Do not open a public GitHub issue.
