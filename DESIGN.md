# DESIGN.md: Kova Studio identity

## The idea

**Night studio.** Near-black rooms lit by a deep red glow, rounded dark cards, pill buttons and big bold type. It feels like a creator app you go live from, not a settings panel. The owner picked this direction after two rounds of mockups (reference: the dark red creator-tool look of apps like bookfua), and Kova keeps its own name, logo, copy and honesty.

What we never copy from reference sites: fake reviews, fake live stats, "#1" claims, partner logos we have no deal with.

## Color tokens (defined in `app/globals.css` under `@theme`)

| Token | Hex | Use |
| --- | --- | --- |
| `night` | #07060a | Page background everywhere |
| `night-2` | #0c090d | Alternate full-width bands, footer |
| `surface` | #120e12 | Cards and panels |
| `surface-2` | #1a1419 | Inputs, rows inside cards |
| `surface-3` | #251d23 | Hover fills, toggles off, chip backgrounds |
| `line` | #2c2329 | Card borders, table dividers |
| `line-2` | #3d3139 | Input borders, stronger dividers |
| `fg` | #f8f4f6 | Main text |
| `soft` | #c4b8be | Body text, secondary text |
| `mute` | #8d8087 | Hints, labels, table headers |
| `signal` | #ef1d35 | Brand red: primary buttons, live state, highlighted word |
| `signal-2` | #ff4a5f | Red text on dark, links, small badges |
| `signal-deep` | #a30f22 | Glows and gradient ends |
| `cue` | #ffb020 | Warnings, reconnecting, gift time |
| `ok` | #22c55e | Healthy, success, paying |
| `sky` | #3b82f6 | Icon tiles, AI cost series in charts |
| `grape` | #8b5cf6 | Icon tiles, admin badge |

Rules:
- Red is the brand. It carries the primary action on each screen, the live state and one highlighted word per headline. Do not paint whole sections red.
- Icon tiles can use `signal`, `grape`, `sky`, `cue`, `ok` or pink `#ec4899` so feature grids are not all red.
- Status colors (`ok`, `cue`, `signal`) always come with a word ("Healthy", "Low", "Live"), never color alone.

## Type

- **Poppins** (400 to 800) for everything, loaded with `next/font/google` in `app/layout.tsx` as `--font-poppins`.
- **JetBrains Mono** only for timers, clocks and small numeric codes (`font-mono`).
- `.display`: weight 800, tracking -0.02em, line-height 1.02. Hero `clamp(2.9rem, 7vw, 5.4rem)`, section titles `text-4xl`/`text-5xl`, page titles `text-3xl`/`text-4xl`.
- `.label`: 11px, weight 600, uppercase, wide tracking. For table headers and tiny captions.
- `.text-glow`: red gradient text with a soft glow. One word or short phrase per headline ("anyone", "one studio").

## Components (in `app/globals.css`, `@layer components`)

| Class | What |
| --- | --- |
| `.glow-page` | Page backdrop: near-black with two red radial glows and a faint dot grid |
| `.glow-center` | Single red glow at the top of a section |
| `.card` | Rounded (20px) dark card with a thin border |
| `.card-hover` | Lift, red border and glow on hover |
| `.card-hot` | Featured card: red border, inner glow, red shadow (featured pack, final CTA, positive profit) |
| `.chip` | Small uppercase pill badge above headlines |
| `.icon-tile` | 44px rounded square holding an icon |
| `.btn` + `.btn-signal` | Red gradient pill, the primary action |
| `.btn-light` | White pill, the secondary action (and "Sign up" in the nav) |
| `.btn-line` | Outline pill |
| `.btn-ghost` | Text-only pill for quiet actions |
| `.field` (+ `.field-sm`) | Rounded dark input, red focus ring |
| `.tally` | Blinking live dot |
| `.marquee` | Scrolling platform chips |

Icons live in `components/Icons.tsx` (24px stroke icons, `currentColor`). Add new ones there instead of pulling in an icon library.

Patterns:
- **Navbar** (public): floating rounded pill with a red to dark gradient, links in the middle, "Log in" outline pill and "Sign up" white pill.
- **Section head**: centered `.chip`, `.display` title with one `.text-glow` word, one line of `text-soft`.
- **KPI tile** (`Kpi` in `components/admin/AdminShell.tsx`): label, big number, small note, optional colored icon tile.
- **Panels** (studio): `.card` with a small icon tile and a bold title. No codes like `SRC` or `OUT` any more.
- **Stage** (studio, channel): rounded frame around the video; it glows red while live.
- **Tables**: `thClass` / `tdClass` from `AdminShell.tsx`. Uppercase muted headers, thin row dividers, no zebra stripes.
- **Charts**: see `components/admin/FinanceChart.tsx`. One naira axis, never two. Revenue `signal`, AI cost `sky` (validated for color blindness on the dark surface). Thin bars with a 2px gap, rounded tops, recessive grid, legend on top, hover tooltip, and a "Show as a table" fallback.

## Voice and copy

- Short, direct, friendly: "Go live", "Top up", "Your camera is off", "Ready to be anyone?".
- Say what happens, not what the tech is: "Your webcam becomes the character", not "AI-powered neural transformation".
- Never "revolutionary", "seamless", "unleash", "magic". No emojis.
- No em dashes. Use commas, colons, periods or "/".
- Errors tell the user what to do next.
- Only honest claims. Platforms are listed as "Go live anywhere OBS does" because output goes through OBS.

## Layout

- Max width `max-w-6xl` for marketing, account and admin. The studio uses the full width up to `max-w-[1600px]`.
- Studio: 3 columns on xl (character / stage / output), 2 on lg. Desktop only (below 1024px show the desktop-only card).
- Admin: `AdminShell` with pill tabs (Overview, Finance, Users, Gallery), a title row, then cards.
- Everything public works on a 390px phone. The channel page works on phones.

## Accessibility

- `fg` and `soft` on `night`/`surface` pass WCAG AA. Use `mute` only for non-essential hints.
- Animations respect `prefers-reduced-motion` (tally and marquee stop).
- Toggles use `role="switch"` and `aria-checked`.
- Every icon-only control needs an `aria-label`.
- Charts always have a table view.
