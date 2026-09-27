import Link from "next/link";
import HeroMonitor from "@/components/HeroMonitor";
import RateCard from "@/components/RateCard";
import {
  IconBolt,
  IconBroadcast,
  IconCamera,
  IconCheck,
  IconChevronDown,
  IconImage,
  IconMonitor,
  IconRecord,
  IconShield,
  IconSparkle,
  IconStar,
  IconSwap,
  IconUpload,
} from "@/components/Icons";
import { formatNaira, lowestPerMinuteNgn } from "@/lib/pricing";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { getActivePresets } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { missingEnv } from "@/lib/env";
import type { PresetCard } from "@/lib/types";

export const dynamic = "force-dynamic";

// Where the output can go. All of these work through OBS (Virtual Camera for call apps).
const PLATFORMS = ["TikTok Live", "YouTube", "Twitch", "Facebook Live", "Zoom", "Google Meet", "Discord", "OBS Studio"];

const HIGHLIGHTS = [
  { icon: IconBolt, title: "Realtime output", body: "Your moves, their face and body, live." },
  { icon: IconMonitor, title: "No extra hardware", body: "A laptop, a webcam and Chrome or Edge." },
  { icon: IconRecord, title: "One-click recording", body: "Save clips with your mic audio." },
  { icon: IconShield, title: "Private by design", body: "We never store your webcam video." },
] as const;

const STEPS = [
  { icon: IconImage, title: "Pick a character", body: "Choose one from the gallery or upload your own picture. One clear face works best." },
  { icon: IconCamera, title: "Turn on your camera", body: "Allow your webcam in the browser. Nothing to download or install." },
  { icon: IconBroadcast, title: "Go live", body: "Press Go live and you become the character in real time. Stream it, record it, share it." },
] as const;

const STUDIO = [
  { icon: IconImage, tone: "bg-signal", title: "Character gallery", body: "Ready-made characters you can become in one click." },
  { icon: IconUpload, tone: "bg-grape", title: "Upload your own", body: "Drop in any character you own and go live as it." },
  { icon: IconSwap, tone: "bg-sky", title: "Swap mid-stream", body: "Change character without ending the stream. No black screen." },
  { icon: IconRecord, tone: "bg-cue", title: "Record in one click", body: "Hit Rec and a clean video file lands in your Downloads." },
  { icon: IconBroadcast, tone: "bg-ok", title: "OBS ready", body: "Capture the studio in OBS and stream to any platform." },
  { icon: IconSparkle, tone: "bg-[#ec4899]", title: "Extra details", body: "Add a line like \"wearing a red cape\" to shape the look." },
] as const;

const FAQ = [
  ["Do I need to install anything?", "No. Kova Studio runs in Chrome or Edge on your laptop or desktop. Just allow your camera."],
  ["Does it work on my phone?", "Going live needs a computer with a webcam. Your viewers can watch on any device."],
  ["How is my time counted?", "By the second, only while the AI is live. Waiting in line or standing by is not counted."],
  ["Is there a free trial?", "No free minutes. The Try pack gives you 2 minutes for ₦8,000, no watermark, so you can test it properly."],
  ["Do credits expire?", "No. 1 credit is 1 minute of live AI, billed by the second, and unused credits stay in your account."],
  ["Can I stream to TikTok or YouTube?", "Yes. Capture the studio in OBS and stream from OBS. For Zoom, Meet or Discord, use OBS Virtual Camera."],
  ["Can I upload any picture?", "Only pictures you own or have permission to use. No real people without their consent."],
] as const;

async function loadLanding(): Promise<{ presets: PresetCard[]; signedIn: boolean }> {
  if (missingEnv().some((m) => m.includes("SUPABASE"))) return { presets: [], signedIn: false };
  try {
    const supabase = await createClient();
    const [{ data: claims }, presets] = await Promise.all([supabase.auth.getClaims(), getActivePresets()]);
    return { presets, signedIn: !!claims?.claims?.sub };
  } catch {
    return { presets: [], signedIn: false };
  }
}

export default async function Home() {
  const { presets, signedIn } = await loadLanding();
  const cta = signedIn ? "/studio" : "/signup";
  const pairs = presets.slice(0, 2).map((p) => ({ imageUrl: p.imageUrl, name: p.name }));

  return (
    <div className="glow-page">
      <SiteHeader signedIn={signedIn} />

      <main>
        {/* ---------- hero ---------- */}
        <section className="mx-auto grid max-w-6xl items-center gap-14 px-5 pb-16 pt-14 sm:pt-20 lg:grid-cols-[1.05fr_1fr]">
          <div>
            <span className="chip">
              <IconStar className="h-3.5 w-3.5 text-signal-2" />
              Live AI studio for creators
            </span>
            <h1 className="display mt-7 text-[clamp(2.9rem,7vw,5.4rem)]">
              Go live as
              <br />
              <span className="text-glow">anyone</span>
              <br />
              in real time.
            </h1>
            <p className="mt-6 max-w-lg text-lg leading-relaxed text-soft">
              Upload a character and Kova Studio turns your webcam into them, face and body, live. Stream it through OBS, record
              it, or show it off on a call. Nothing to download.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-3">
              <Link href={cta} className="btn btn-signal px-8 py-4 text-base">
                {signedIn ? "Open the studio" : "Get started"}
              </Link>
              <a href="#pricing" className="btn btn-light px-8 py-4 text-base">
                See pricing
              </a>
            </div>
            <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-soft">
              {["No download", "Chrome or Edge", `From ${formatNaira(lowestPerMinuteNgn())} a minute`].map((t) => (
                <li key={t} className="flex items-center gap-2">
                  <IconCheck className="h-4 w-4 text-signal-2" />
                  {t}
                </li>
              ))}
            </ul>
          </div>
          <HeroMonitor pairs={pairs} />
        </section>

        {/* ---------- platforms ---------- */}
        <section className="border-y border-line bg-night/60 py-6">
          <p className="label mb-4 text-center text-mute">Go live anywhere OBS does</p>
          <div className="overflow-hidden [mask-image:linear-gradient(90deg,transparent,#000_12%,#000_88%,transparent)]" aria-hidden="true">
            <div className="marquee flex w-max gap-3">
              {[0, 1].map((copy) => (
                <div key={copy} className="flex gap-3">
                  {PLATFORMS.map((p) => (
                    <span key={`${copy}-${p}`} className="rounded-full border border-line bg-surface px-5 py-2.5 text-sm font-semibold text-soft">
                      {p}
                    </span>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ---------- highlights ---------- */}
        <section className="mx-auto max-w-6xl px-5 pt-16">
          <div className="card grid gap-px overflow-hidden bg-line p-0 sm:grid-cols-2 lg:grid-cols-4">
            {HIGHLIGHTS.map(({ icon: Icon, title, body }) => (
              <div key={title} className="flex items-start gap-4 bg-surface p-6">
                <span className="icon-tile bg-signal/15 text-signal-2">
                  <Icon />
                </span>
                <div>
                  <p className="font-semibold">{title}</p>
                  <p className="mt-1 text-sm text-mute">{body}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ---------- how it works ---------- */}
        <section id="how" className="mx-auto max-w-6xl scroll-mt-28 px-5 py-24">
          <SectionHead chip="How it works" title={<>On air in <span className="text-glow">three steps</span></>}>
            From sign up to live in about a minute.
          </SectionHead>
          <div className="mt-12 grid gap-4 md:grid-cols-3">
            {STEPS.map(({ icon: Icon, title, body }, i) => (
              <div key={title} className="card card-hover relative overflow-hidden p-7">
                <span className="absolute -right-2 -top-6 text-[7rem] font-extrabold leading-none text-white/[0.04]">{i + 1}</span>
                <span className="icon-tile bg-signal shadow-[0_10px_30px_-8px_rgb(239_29_53/0.8)]">
                  <Icon />
                </span>
                <p className="label mt-6 text-signal-2">Step {i + 1}</p>
                <h3 className="mt-2 text-xl font-bold">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-mute">{body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ---------- studio features ---------- */}
        <section className="glow-center border-y border-line bg-night-2/70">
          <div className="mx-auto max-w-6xl px-5 py-24">
            <SectionHead chip="The studio" title={<>Everything inside <span className="text-glow">one studio</span></>}>
              One screen to pick a character, go live, switch looks and record.
            </SectionHead>
            <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {STUDIO.map(({ icon: Icon, tone, title, body }) => (
                <div key={title} className="card card-hover p-6">
                  <span className={`icon-tile ${tone}`}>
                    <Icon />
                  </span>
                  <h3 className="mt-5 text-lg font-bold">{title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-mute">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ---------- characters ---------- */}
        {presets.length > 0 && (
          <section id="characters" className="mx-auto max-w-6xl scroll-mt-28 px-5 py-24">
            <SectionHead chip="Characters" title={<>Pick a face, <span className="text-glow">go live</span></>}>
              Ready-made characters you can become in one click. Or bring your own.
            </SectionHead>
            <ul className="mt-12 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
              {presets.slice(0, 12).map((p) => (
                <li key={p.id} className="group card overflow-hidden p-1.5">
                  <div className="relative aspect-[4/5] overflow-hidden rounded-[0.9rem]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={p.imageUrl}
                      alt={p.name}
                      loading="lazy"
                      className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                    />
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent px-3 pb-2.5 pt-8">
                      <p className="truncate text-sm font-semibold">{p.name}</p>
                      <p className="text-[11px] text-soft">{p.category}</p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* ---------- pricing ---------- */}
        <section id="pricing" className={`glow-center scroll-mt-28 ${presets.length ? "border-t border-line" : ""}`}>
          <div className="mx-auto max-w-6xl px-5 py-24">
            <SectionHead chip="Pricing" title={<>Simple <span className="text-glow">credits</span>, no subscription</>}>
              1 credit = 1 minute of live AI, billed by the second. Any pack removes the watermark.
            </SectionHead>
            <div className="mt-12">
              <RateCard mode="public" />
            </div>
          </div>
        </section>

        {/* ---------- house rules ---------- */}
        <section className="mx-auto max-w-6xl px-5 pb-24">
          <div className="card grid gap-10 p-8 sm:p-10 lg:grid-cols-[1fr_1.5fr]">
            <div>
              <span className="icon-tile bg-signal/15 text-signal-2">
                <IconShield />
              </span>
              <h2 className="display mt-5 text-3xl sm:text-4xl">Play it straight</h2>
              <p className="mt-3 max-w-sm text-soft">Kova Studio is for entertainment, creators and characters. Not for fooling people.</p>
            </div>
            <ul className="grid gap-3 sm:grid-cols-2">
              {[
                ["Your art, your rights", "Upload only what you made, own or have permission to use."],
                ["Consent first", "No real people unless they have clearly agreed."],
                ["No scams", "Impersonation, fraud or deception gets you banned."],
                ["Keep it clean", "No sexual, violent or hateful content, ever."],
              ].map(([t, b]) => (
                <li key={t} className="rounded-2xl border border-line bg-surface-2 p-5">
                  <p className="font-semibold">{t}</p>
                  <p className="mt-1.5 text-sm text-mute">{b}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ---------- faq ---------- */}
        <section id="faq" className="mx-auto max-w-3xl scroll-mt-28 px-5 pb-24">
          <SectionHead chip="FAQ" title={<>Questions, <span className="text-glow">answered</span></>} />
          <div className="mt-10 space-y-3">
            {FAQ.map(([q, a]) => (
              <details key={q} className="group card px-6 py-5 open:border-signal/40">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold">
                  {q}
                  <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-white/5 text-soft transition group-open:rotate-180 group-open:bg-signal group-open:text-white">
                    <IconChevronDown className="h-4 w-4" />
                  </span>
                </summary>
                <p className="mt-3 pr-10 text-sm leading-relaxed text-soft">{a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* ---------- final call ---------- */}
        <section className="mx-auto max-w-6xl px-5 pb-24">
          <div className="card-hot relative overflow-hidden px-6 py-16 text-center sm:px-12">
            <h2 className="display mx-auto max-w-2xl text-4xl sm:text-6xl">
              Ready to be <span className="text-glow">anyone?</span>
            </h2>
            <p className="mx-auto mt-4 max-w-md text-soft">Make your account, grab a pack, and go live in about a minute.</p>
            <div className="mt-9 flex flex-wrap justify-center gap-3">
              <Link href={cta} className="btn btn-signal px-8 py-4 text-base">
                {signedIn ? "Open the studio" : "Get started"}
              </Link>
              <a href="#pricing" className="btn btn-light px-8 py-4 text-base">
                See pricing
              </a>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}

function SectionHead({ chip, title, children }: { chip: string; title: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="text-center">
      <span className="chip">{chip}</span>
      <h2 className="display mx-auto mt-5 max-w-3xl text-4xl sm:text-5xl">{title}</h2>
      {children && <p className="mx-auto mt-4 max-w-xl text-soft">{children}</p>}
    </div>
  );
}
