import type { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { clientIp, json, jsonError } from "@/lib/api";
import { rateLimit } from "@/lib/rate-limit";
import { displayNameOf } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ShareRow = {
  session_id: string;
  subscribe_token: string;
  watermark: boolean;
  sessions: { ended_at: string | null; last_heartbeat_at: string | null; started_at: string; character_name: string | null } | null;
};

// Public: is this channel live right now? Viewers and OBS poll this.
export async function GET(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  if (!/^[a-z0-9]{6,32}$/i.test(slug)) return jsonError("Channel not found.", 404);
  if (!rateLimit(`channel:${clientIp(req)}`, 120, 60 * 1000)) return jsonError("Slow down.", 429);

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("id, display_name, email")
    .eq("channel_slug", slug)
    .maybeSingle<{ id: string; display_name: string | null; email: string }>();
  if (!profile) return jsonError("Channel not found.", 404);

  const hostName = displayNameOf(profile);

  const { data: share } = await admin
    .from("live_shares")
    .select("session_id, subscribe_token, watermark, sessions(ended_at, last_heartbeat_at, started_at, character_name)")
    .eq("user_id", profile.id)
    .is("ended_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<ShareRow>();

  const s = share?.sessions;
  const lastSeen = s ? new Date(s.last_heartbeat_at ?? s.started_at).getTime() : 0;
  const live = !!share && !!s && !s.ended_at && Date.now() - lastSeen < 45_000;

  if (!live || !share) return json({ live: false, hostName });

  return json({
    live: true,
    hostName,
    sessionId: share.session_id,
    subscribeToken: share.subscribe_token,
    watermark: share.watermark,
    characterName: s?.character_name ?? null,
  });
}
