import type { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { env, missingEnv } from "@/lib/env";
import { guardUser, json, jsonError, readJson } from "@/lib/api";
import { createSessionToken } from "@/lib/decart";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = { character: string };
type BeginRow = { session_id: string; bucket: "free" | "paid" | "admin"; reserved_seconds: number; watermark: boolean };

// Starts a live session: reserves time from the user's balance, then tells the
// browser how to reach the AI.
//   Decart: a short-lived Decart key capped at exactly the reserved time.
//   fal: just the session id. The browser then asks /api/fal/token for a connect token.
export async function POST(req: NextRequest) {
  const missing = missingEnv({ ai: true });
  if (missing.length) return jsonError(`Server setup incomplete. Missing: ${missing.join(", ")}`, 500);

  const guard = await guardUser(req);
  if (!guard.ok) return guard.response;
  const { user, profile, isAdmin } = guard.current;

  if (!profile.accepted_terms_at) return jsonError("Accept the house rules first.", 403);
  if (!rateLimit(`start:${user.id}`, 12, 10 * 60 * 1000)) {
    return jsonError("Too many starts in a short time. Wait a few minutes.", 429);
  }

  const body = await readJson<Body>(req);
  const character = typeof body.character === "string" ? body.character.slice(0, 80) : null;

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("begin_session", {
    p_user: user.id,
    p_is_admin: isAdmin,
    p_max_paid: env.maxPaidSession,
    p_max_free: env.maxFreeSession,
    p_max_admin: env.maxAdminSession,
    p_character: character,
  });

  if (error) {
    if (error.message.includes("already_live")) {
      return jsonError("You are already live in another tab or window. Stop that one first.", 409, { code: "already_live" });
    }
    if (error.message.includes("no_time")) {
      return jsonError("You are out of credits.", 402, { code: "no_time" });
    }
    console.error("[session/start] begin_session failed:", error);
    return jsonError("Could not start a session. Try again.", 500);
  }

  const row = (Array.isArray(data) ? data[0] : data) as BeginRow | undefined;
  if (!row) return jsonError("Could not start a session. Try again.", 500);

  const base = {
    sessionId: row.session_id,
    bucket: row.bucket,
    reservedSeconds: row.reserved_seconds,
    watermark: row.watermark,
    provider: env.aiProvider,
  };

  if (env.aiProvider === "fal") return json(base);

  try {
    const apiKey = await createSessionToken({
      sessionSeconds: row.reserved_seconds,
      sessionId: row.session_id,
      userId: user.id,
    });
    return json({ ...base, apiKey });
  } catch (err) {
    console.error("[session/start] Decart token failed:", err);
    // Give the reserved time back.
    await admin.rpc("settle_session", { p_session: row.session_id, p_reported: 0, p_reason: "token_failed" });
    return jsonError("The AI provider did not respond. Check the Decart key and balance, then try again.", 502);
  }
}
