# Kova Studio

Go live as any character. Upload a picture (or pick one from the gallery), and your webcam turns into that character in real time. Stream it through OBS or record it.

Built with Next.js 16, Supabase, and the Lucy 2.5 realtime model (through fal.ai now, Decart direct later). Dark "night studio" design, naira credit packs, and an admin dashboard with finance and users.

Project docs: [DEVELOPMENT_PLAN.md](DEVELOPMENT_PLAN.md) (roadmap, pricing, Decart deposit), [AGENTS.md](AGENTS.md) (rules for AI coding agents), [DESIGN.md](DESIGN.md), [SECURITY.md](SECURITY.md), and the Claude Code skill in `.claude/skills/kova-studio/SKILL.md`.

---

## 1. Accounts you need

| Service | What for | Cost |
| --- | --- | --- |
| Supabase | Login, database, preset image storage | Free tier |
| fal.ai | The AI video (Lucy 2.5) for now | Pay as you go, about $0.02 per second |
| Decart (platform.decart.ai) | The same AI, direct (later, needs an ID check) | Same price |
| Vercel | Hosting | Free tier |
| GitHub | Code | Free |

## 2. Supabase setup (10 minutes)

1. Create a new project at supabase.com. Pick the region **West EU (London)** so it sits next to the Vercel servers set in `vercel.json` (`lhr1`).
2. **SQL Editor > New query**: paste everything from `supabase/schema.sql` and press **Run**. You should see "Success".
   - Already ran an older schema? Just run the newer files in `supabase/migrations/` in date order instead (for example `2026-09-28_finance.sql`).
3. **Project Settings > API Keys**: copy the Project URL, the **Publishable** key and the **Secret** key.
4. **Authentication > URL Configuration**:
   - Site URL: `http://localhost:3000` for now (change to your real domain later).
   - Redirect URLs: add `http://localhost:3000/**` and later `https://yourdomain.com/**`.
5. **Authentication > Sign In / Providers > Email**: keep Email on.
   - For quick testing you can turn **Confirm email** off. Turn it back on before launch.
   - Supabase's built-in email only sends a few emails per hour. Before launch, set up free SMTP (Resend has a free plan) under **Authentication > Emails > SMTP Settings**.

## 3. Run it on your computer (Windows CMD)

```
cd C:\Users\afola\kovastudio
npm install
copy .env.example .env.local
notepad .env.local
```

Fill in `SUPABASE_SECRET_KEY` and `FAL_KEY` (with `AI_PROVIDER=fal`), save, then:

```
npm run dev
```

Open **http://localhost:3000** in Chrome or Edge. Sign up with one of the admin emails in `ADMIN_EMAILS` and you get the admin panel at `/admin`.

## 4. Deploy to Vercel

1. Push the folder to a new GitHub repo:

```
cd C:\Users\afola\kovastudio
git init
git add .
git commit -m "Kova Studio v1"
git branch -M main
git remote add origin https://github.com/danielafolarin96-dotcom/kovastudio.git
git push -u origin main
```

2. On vercel.com: **Add New > Project**, import the repo.
3. Add every variable from `.env.local` under **Environment Variables**. Set `NEXT_PUBLIC_SITE_URL` and `ALLOWED_ORIGINS` to your Vercel URL (ours is `https://kovastudio-kappa.vercel.app`). They must match the address in the browser exactly, or Go live is blocked.
4. Deploy. Then add the same URL to Supabase **Site URL** and **Redirect URLs**.

---

## How it works

**Plans and watermark**

- **Admins** (emails in `ADMIN_EMAILS`): no watermark, no time limit, access to `/admin`.
- **Paid users** (you added time with "This is a payment" ticked): no watermark, ever.
- **Free users**: the Kova Studio bug is burned into their video, recordings and channel stream.

The server decides the watermark, not the browser.

**Live time**

- Every account has a paid balance and a free balance, in seconds. Paid time is used first.
- When a user presses Go live, the server reserves time from their balance. The AI key it hands out stops working when that reserved time runs out.
- While live, the studio checks in every 10 seconds. When the session ends, the unused time goes back.
- If a tab crashes, the leftover reservation is settled the next time that user goes live.
- Honest limit: the browser reports how long it was live. Someone skilled could get back up to one session's worth of time. Keep `MAX_FREE_SESSION_SECONDS` small.

**Channel link and OBS**

- On fal (now): users stream by capturing the studio window in OBS (steps are in the studio). The channel link and one-paste OBS source switch on when `AI_PROVIDER=decart`.
- Every user has a permanent channel link: `/c/their-code`. With "Broadcast to my channel link" on, anyone with the link can watch while they are live.
- Add `?obs=1` for a clean, transparent OBS browser source.
- Viewers never get a Decart key. Our server fetches the viewing pass for them, and only for rooms that are live right now.

**Admin panel** (`/admin`, admins only)

- **Overview**: users, live now, AI time today, revenue for 30 days, add time or record a payment, signup gift, newest users, recent sessions. Shows a red warning when the AI balance is low.
- **Finance**: pick 7, 30, 90 days or all time. Revenue, AI cost, Paystack fees, other expenses, net profit and margin, a revenue vs AI cost chart, sales by pack, payment methods, unused credits, and an estimate of your fal balance. Payments table with a CSV download. Log money going out (fal top-ups, hosting, ads) on the same page.
- **Users**: everyone who signed up, with search, filters (paying, never paid, active, new, admins), sorting (newest, top spenders, most AI time, most credits, last active) and pages. Click a user for their balances, total spent, credit history, sessions, and a form to add time.
- **Gallery**: add, hide, reorder and delete preset characters.

**Gallery**

Admins add characters in `/admin/gallery`. Images go to the Supabase `presets` bucket. Only upload art you own or have rights to.

**Payments**

A user picks a pack on `/account#buy` and pays with Paystack (card, bank transfer or USSD, test mode until you switch the key). The credits land automatically, once: the webhook (`/api/pay/webhook`) and the return page (`/pay/return`) both call the same `complete_payment` SQL function, so a replay or a refresh never grants twice. Set `PAYSTACK_SECRET_KEY` in `.env.local` and Vercel and run `supabase/migrations/2026-09-28_paystack.sql` to turn this on. It shows up in Finance with method Paystack, no admin work.

For anything Paystack cannot take (a direct bank transfer, cash): open `/admin`, enter their email, click the pack they bought (it fills the minutes and price), keep "This is a payment" ticked, pick how they paid, and press Update balance. It shows up in Finance straight away too.

When you top up fal, log it in `/admin/finance` under "Log money out" with the dollar amount, so the balance estimate stays right.

## Files

| Path | What it does |
| --- | --- |
| `supabase/schema.sql` | Tables, security rules, and the time and money functions |
| `supabase/migrations/` | Changes for an existing project, run in date order |
| `components/studio/Studio.tsx` | The studio: camera, character, go live, record, OBS steps |
| `components/Viewer.tsx` | Channel page and OBS source (Decart only) |
| `app/api/session/*` | Start, heartbeat and end a live session |
| `app/api/fal/token` | Short fal tokens for a live session |
| `app/api/admin/*` | Add time, record payments, expenses, CSV export, signup gift, gallery |
| `app/admin/*` | Overview, Finance, Users (+ user details), Gallery |
| `lib/finance.ts`, `lib/admin-users.ts` | The finance and user list math |
| `lib/admin-data.ts` | Loads the admin data from Supabase |
| `app/globals.css` | Colors, buttons, cards (see DESIGN.md) |
| `proxy.ts` | Keeps logins fresh and protects private pages |
| `lib/env.ts` | All server settings in one place |

## Troubleshooting

- **"Setup needed" page**: a variable is missing from `.env.local`. Restart `npm run dev` after editing it.
- **"not in ALLOWED_ORIGINS"**: open the site at exactly the address in `ALLOWED_ORIGINS` (localhost, not 127.0.0.1).
- **Confirmation email never arrives**: check spam, then set up SMTP (see step 2.5), or turn off Confirm email while testing.
- **Camera busy**: close Zoom, Teams, or any OBS video capture that is using the webcam.
- **"The AI provider did not respond"**: check `FAL_KEY` (or `DECART_API_KEY`) and your balance on the provider's dashboard.
- **Finance says "not switched on yet" / recording a payment fails**: run `supabase/migrations/2026-09-28_finance.sql` in the Supabase SQL Editor.
