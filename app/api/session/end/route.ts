import type { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { guardUser, json, jsonError, readJson } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = { sessionId: string; seconds: number; reason: string };

// Ends a session: bills the time used and refunds the rest of the reservation.
export async function POST(req: NextRequest) {
  const guard = await guardUser(req);
  if (!guard.ok) return guard.response;
  const { user } = guard.current;

  const body = await readJson<Body>(req);
  if (typeof body.sessionId !== "string") return jsonError("Missing session.", 400);

  const admin = createAdminClient();
  const { data: session } = await admin
    .from("sessions")
    .select("id")
    .eq("id", body.sessionId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!session) return jsonError("Session not found.", 404);

  const reason = typeof body.reason === "string" ? body.reason.replace(/[^\w .:-]/g, "").slice(0, 80) : "ended";
  const { data: billed, error } = await admin.rpc("settle_session", {
    p_session: body.sessionId,
    p_reported: Math.max(0, Math.floor(Number(body.seconds) || 0)),
    p_reason: reason || "ended",
  });
  if (error) {
    console.error("[session/end]", error);
    return jsonError("Could not close the session.", 500);
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("free_seconds, paid_seconds")
    .eq("id", user.id)
    .single<{ free_seconds: number; paid_seconds: number }>();

  return json({
    billedSeconds: billed ?? 0,
    freeSeconds: profile?.free_seconds ?? 0,
    paidSeconds: profile?.paid_seconds ?? 0,
  });
}
