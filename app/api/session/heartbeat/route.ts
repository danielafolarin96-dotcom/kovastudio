import type { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { guardUser, json, jsonError, readJson } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = { sessionId: string; seconds: number; generating: boolean };

// Grace period on top of the reserved time before the server closes a session.
const OVERRUN_GRACE_SECONDS = 15;

// The studio calls this every few seconds while live so we know the session is alive.
// It also closes sessions that run past their reserved time (matters most on fal,
// where the provider does not cut the stream for us).
export async function POST(req: NextRequest) {
  const guard = await guardUser(req);
  if (!guard.ok) return guard.response;
  const userId = guard.current.user.id;

  const body = await readJson<Body>(req);
  if (typeof body.sessionId !== "string") return jsonError("Missing session.", 400);

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("session_heartbeat", {
    p_session: body.sessionId,
    p_user: userId,
    p_reported: Math.max(0, Math.floor(Number(body.seconds) || 0)),
    p_generating: body.generating === true,
  });
  if (error) {
    console.error("[session/heartbeat]", error);
    return jsonError("Heartbeat failed.", 500);
  }
  // false = the server already closed this session.
  if (data !== true) return json({ ok: false, reason: "closed" });

  const { data: s } = await admin
    .from("sessions")
    .select("reserved_seconds, generating_at, reported_seconds")
    .eq("id", body.sessionId)
    .maybeSingle<{ reserved_seconds: number; generating_at: string | null; reported_seconds: number }>();

  if (s?.generating_at) {
    const used = (Date.now() - new Date(s.generating_at).getTime()) / 1000;
    if (used > s.reserved_seconds + OVERRUN_GRACE_SECONDS) {
      await admin.rpc("settle_session", { p_session: body.sessionId, p_reported: s.reserved_seconds, p_reason: "time_up" });
      return json({ ok: false, reason: "time_up" });
    }
  }

  return json({ ok: true });
}
