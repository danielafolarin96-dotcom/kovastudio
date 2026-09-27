import type { Metadata } from "next";
import Link from "next/link";
import AppHeader from "@/components/AppHeader";
import ChannelLinks from "@/components/ChannelLinks";
import RateCard from "@/components/RateCard";
import SetupNotice from "@/components/SetupNotice";
import { IconBroadcast, IconClock, IconShield, IconWallet } from "@/components/Icons";
import { displayNameOf, requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/server";
import { env, missingEnv } from "@/lib/env";
import { formatDuration } from "@/lib/config";
import type { SessionRow } from "@/lib/types";

export const metadata: Metadata = { title: "Account" };
export const dynamic = "force-dynamic";

const dateFmt = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Lagos" });

export default async function AccountPage() {
  const missing = missingEnv();
  if (missing.length) return <SetupNotice missing={missing} />;

  const { profile, isAdmin } = await requireUser("/account");
  const { data: sessions } = await createAdminClient()
    .from("sessions")
    .select("*")
    .eq("user_id", profile.id)
    .order("started_at", { ascending: false })
    .limit(15)
    .returns<SessionRow[]>();

  const plan = isAdmin ? "Admin" : profile.has_paid ? "Paid" : "Free";
  const support = process.env.NEXT_PUBLIC_SUPPORT_EMAIL;
  const name = displayNameOf(profile);

  return (
    <div className="glow-page min-h-screen">
      <AppHeader isAdmin={isAdmin} active="account" />
      <main className="mx-auto max-w-6xl px-5 py-10">
        <div className="flex flex-wrap items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[linear-gradient(180deg,#ff4358,#c10f25)] text-2xl font-bold">
              {name.slice(0, 1).toUpperCase()}
            </span>
            <div>
              <h1 className="display text-3xl sm:text-4xl">{name}</h1>
              <p className="text-sm text-mute">{profile.email}</p>
            </div>
          </div>
          <Link href="/studio" className="btn btn-signal px-7 py-3.5 text-sm">
            <span className="h-2 w-2 rounded-full bg-white" /> Go to the studio
          </Link>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-3">
          <Tile
            icon={<IconShield />}
            tone="bg-grape"
            label="Plan"
            value={plan}
            note={isAdmin ? "No watermark, no limits" : profile.has_paid ? "No watermark" : "Watermark on"}
          />
          <Tile
            icon={<IconWallet />}
            tone="bg-signal"
            label="Credits"
            value={isAdmin ? "Unlimited" : credits(profile.paid_seconds)}
            note={isAdmin ? "Admins do not use credits" : `${formatDuration(profile.paid_seconds)} of live AI left`}
          />
          <Tile
            icon={<IconClock />}
            tone="bg-cue"
            label="Gift credits"
            value={isAdmin ? "Unlimited" : credits(profile.free_seconds)}
            note="From the Kova team, has a watermark"
          />
        </div>

        {!isAdmin && (
          <section id="buy" className="mt-14 scroll-mt-24">
            <h2 className="display text-2xl sm:text-3xl">Buy credits</h2>
            <p className="mb-6 mt-1.5 text-sm text-mute">1 credit = 1 minute of live AI. Paid credits remove the watermark for good.</p>
            <RateCard mode="account" supportEmail={support} />
          </section>
        )}

        <div className="mt-14 grid gap-4 lg:grid-cols-[1fr_1.3fr]">
          <section className="card p-6">
            <div className="flex items-center gap-3">
              <span className="icon-tile h-10 w-10 bg-ok">
                <IconBroadcast className="h-[18px] w-[18px]" />
              </span>
              <h2 className="text-lg font-bold">Your channel</h2>
            </div>
            {env.aiProvider === "decart" ? (
              <>
                <p className="mb-5 mt-3 text-sm text-mute">
                  Turn on &quot;Broadcast to my channel link&quot; in the studio, then share the watch link or add the OBS link as
                  a Browser source.
                </p>
                <ChannelLinks siteUrl={env.siteUrl} initialSlug={profile.channel_slug} />
              </>
            ) : (
              <p className="mt-4 rounded-xl border border-cue/30 bg-cue/10 px-4 py-3 text-sm text-[#ffe2a8]">
                Your personal watch link and one-paste OBS source are coming soon. For now, use OBS Window Capture on the studio
                (steps are in the studio).
              </p>
            )}
          </section>

          <section className="card p-6">
            <h2 className="text-lg font-bold">Recent sessions</h2>
            {sessions?.length ? (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="label border-b border-line text-mute">
                      <th className="py-2.5 font-semibold">When</th>
                      <th className="py-2.5 font-semibold">Character</th>
                      <th className="py-2.5 font-semibold">Time</th>
                      <th className="py-2.5 font-semibold">Type</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sessions.map((s) => (
                      <tr key={s.id} className="border-b border-line/70 last:border-0">
                        <td className="py-3 pr-3 text-soft">{dateFmt.format(new Date(s.started_at))}</td>
                        <td className="max-w-[10rem] truncate py-3 pr-3">{s.character_name ?? "Untitled"}</td>
                        <td className="py-3 pr-3 font-mono text-xs">
                          {s.ended_at ? (
                            formatDuration(s.billed_seconds ?? 0)
                          ) : (
                            <span className="rounded-full bg-signal/15 px-2 py-0.5 text-signal-2">Live</span>
                          )}
                        </td>
                        <td className="py-3">
                          <span className="rounded-full bg-white/5 px-2.5 py-1 text-xs capitalize text-soft">{s.bucket}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="mt-4 text-sm text-mute">No sessions yet. Head to the studio and go live.</p>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}

// 1 credit = 1 minute. Show whole minutes, or one decimal when there are leftover seconds.
function credits(seconds: number): string {
  const c = seconds / 60;
  return Number.isInteger(c) ? String(c) : c.toFixed(1);
}

function Tile({ icon, tone, label, value, note }: { icon: React.ReactNode; tone: string; label: string; value: string; note: string }) {
  return (
    <div className="card flex items-start gap-4 p-5">
      <span className={`icon-tile ${tone}`}>{icon}</span>
      <div>
        <p className="text-sm text-mute">{label}</p>
        <p className="mt-0.5 text-3xl font-extrabold tracking-tight">{value}</p>
        <p className="mt-1 text-xs text-mute">{note}</p>
      </div>
    </div>
  );
}
