import type { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { guardUser, json, jsonError, readJson } from "@/lib/api";
import { roomFromSubscribeToken } from "@/lib/decart";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = { sessionId: string; subscribeToken: string };

// Puts the current live session on the user's channel link (and OBS link).
export async function POST(req: NextRequest) {
  const guard = await guardUser(req);
  if (!guard.ok) return guard.response;
  const { user } = guard.current;

  const body = await readJson<Body>(req);
  if (typeof body.sessionId !== "string" || typeof body.subscribeToken !== "string") {
    return jsonError("Missing session details.", 400);
  }
  const room = roomFromSubscribeToken(body.subscribeToken);
  if (!room) return jsonError("Invalid stream token.", 400);

  const admin = createAdminClient();
  const { data: session } = await admin
    .from("sessions")
    .select("id, watermark, ended_at")
    .eq("id", body.sessionId)
    .eq("user_id", user.id)
    .maybeSingle<{ id: string; watermark: boolean; ended_at: string | null }>();
  if (!session || session.ended_at) return jsonError("That session is not live.", 404);

  // Only one broadcast per channel at a time.
  await admin
    .from("live_shares")
    .update({ ended_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .is("ended_at", null)
    .neq("session_id", session.id);

  const { error } = await admin.from("live_shares").upsert(
    {
      session_id: session.id,
      user_id: user.id,
      room_name: room,
      subscribe_token: body.subscribeToken,
      watermark: session.watermark,
      ended_at: null,
    },
    { onConflict: "session_id" },
  );
  if (error) {
    console.error("[live] share failed:", error);
    return jsonError("Could not put you on your channel.", 500);
  }
  return json({ ok: true });
}

// Takes the session off the channel without stopping it.
export async function DELETE(req: NextRequest) {
  const guard = await guardUser(req);
  if (!guard.ok) return guard.response;

  const body = await readJson<{ sessionId: string }>(req);
  if (typeof body.sessionId !== "string") return jsonError("Missing session.", 400);

  await createAdminClient()
    .from("live_shares")
    .update({ ended_at: new Date().toISOString() })
    .eq("session_id", body.sessionId)
    .eq("user_id", guard.current.user.id)
    .is("ended_at", null);
  return json({ ok: true });
}
