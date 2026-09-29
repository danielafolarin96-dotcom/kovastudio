import crypto from "node:crypto";
import type { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { json, jsonError } from "@/lib/api";
import { env } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STALE_SECONDS = 45;

// Fails closed: no CRON_SECRET configured, or a header that isn't an exact match, is
// Unauthorized either way. Never logs the header or the secret. Constant-time compare,
// same pattern as verifySignature in lib/paystack.ts.
function isAuthorized(req: NextRequest): boolean {
  if (!env.cronSecret) return false;
  const expected = Buffer.from(`Bearer ${env.cronSecret}`);
  const actual = Buffer.from(req.headers.get("authorization") ?? "");
  if (expected.length !== actual.length) return false;
  return crypto.timingSafeEqual(expected, actual);
}

// Vercel Cron calls this on a schedule (see vercel.json). It exists because
// begin_session's own stale-session sweep only runs for a user's own rows, and only
// when that same user starts a new session. A session nobody ever restarts (or that
// belongs to a modified client deliberately staying quiet) would otherwise sit open
// forever: no billing, no refund, and the fal stream (which has no cutoff of its own)
// left running. This sweep settles any user's stale session, on a timer, independent
// of anyone acting.
export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) return jsonError("Unauthorized.", 401);

  const db = createAdminClient();
  const cutoff = new Date(Date.now() - STALE_SECONDS * 1000).toISOString();

  const { data: stale, error } = await db
    .from("sessions")
    .select("id, started_at, last_heartbeat_at")
    .is("ended_at", null)
    .or(`last_heartbeat_at.lt.${cutoff},and(last_heartbeat_at.is.null,started_at.lt.${cutoff})`);

  if (error) return jsonError(error.message, 500);

  let settled = 0;
  for (const s of stale ?? []) {
    const contact = s.last_heartbeat_at ?? s.started_at;
    const { error: settleError } = await db.rpc("settle_session", {
      p_session: s.id,
      p_reported: 0,
      p_reason: "stale",
      p_contact: contact,
    });
    if (!settleError) settled += 1;
    else console.error("[cron/settle-sessions]", s.id, settleError);
  }

  return json({ ok: true, found: stale?.length ?? 0, settled });
}
