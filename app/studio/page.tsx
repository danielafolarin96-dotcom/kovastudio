import type { Metadata } from "next";
import Studio from "@/components/studio/Studio";
import SetupNotice from "@/components/SetupNotice";
import { displayNameOf, getActivePresets, requireUser } from "@/lib/auth";
import { env, missingEnv } from "@/lib/env";
import type { StudioAccount } from "@/lib/types";

export const metadata: Metadata = { title: "Studio" };
export const dynamic = "force-dynamic";

export default async function StudioPage() {
  const missing = missingEnv({ ai: true });
  if (missing.length) return <SetupNotice missing={missing} />;

  const { profile, isAdmin } = await requireUser("/studio");
  const presets = await getActivePresets();

  const account: StudioAccount = {
    displayName: displayNameOf(profile),
    email: profile.email,
    isAdmin,
    hasPaid: profile.has_paid,
    freeSeconds: profile.free_seconds,
    paidSeconds: profile.paid_seconds,
    channelSlug: profile.channel_slug,
    siteUrl: env.siteUrl,
    provider: env.aiProvider,
  };

  return <Studio account={account} presets={presets} />;
}
