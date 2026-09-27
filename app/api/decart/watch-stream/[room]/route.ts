import type { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { env } from "@/lib/env";
import { clientIp, json, jsonError } from "@/lib/api";
import { DECART_WATCH_BASE } from "@/lib/decart";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The viewer SDK calls this (proxy mode) to get watch credentials for a live room.
// We only forward requests for rooms that are live on a Kova channel right now,
// so this can never be used as an open door to our Decart key.
export async function POST(req: NextRequest, ctx: { params: Promise<{ room: string }> }) {
  const { room } = await ctx.params;
  if (!room || room.length > 200) return jsonError("Unknown stream.", 404);
  if (!rateLimit(`watch:${clientIp(req)}`, 30, 60 * 1000)) return jsonError("Slow down.", 429);
  if (!env.decartApiKey) return jsonError("Server setup incomplete.", 500);

  const { data: share } = await createAdminClient()
    .from("live_shares")
    .select("session_id, sessions(ended_at)")
    .eq("room_name", room)
    .is("ended_at", null)
    .limit(1)
    .maybeSingle<{ session_id: string; sessions: { ended_at: string | null } | null }>();
  if (!share || share.sessions?.ended_at) return jsonError("This stream is offline.", 404);

  try {
    const res = await fetch(`${DECART_WATCH_BASE}/watch-stream/${encodeURIComponent(room)}`, {
      method: "POST",
      headers: { "x-api-key": env.decartApiKey, "content-type": "application/json" },
      cache: "no-store",
    });
    const text = await res.text();
    if (!res.ok) {
      console.error("[watch-stream] Decart error", res.status, text.slice(0, 300));
      return jsonError("Could not open the stream.", 502);
    }
    return json(JSON.parse(text));
  } catch (err) {
    console.error("[watch-stream] failed", err);
    return jsonError("Could not open the stream.", 502);
  }
}
