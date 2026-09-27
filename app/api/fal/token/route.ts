import type { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { env } from "@/lib/env";
import { guardUser, json, jsonError, readJson } from "@/lib/api";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// fal's app alias for "decart/lucy-2-5/realtime" (the part after the owner).
const FAL_APP_ALIAS = "lucy-2-5";
// The token is only needed to open the connection, so keep it short.
const TOKEN_SECONDS = 60;

type SessionRow = {
  id: string;
  user_id: string;
  reserved_seconds: number;
  started_at: string;
  generating_at: string | null;
  ended_at: string | null;
};

// Gives the browser a short-lived fal token, but only for a live Kova session
// that belongs to this user and still has reserved time left.
// FAL_KEY itself never leaves the server.
export async function POST(req: NextRequest) {
  if (env.aiProvider !== "fal") return jsonError("fal is not the active provider.", 400);
  if (!env.falKey) return jsonError("Server setup incomplete. Missing: FAL_KEY", 500);

  const guard = await guardUser(req);
  if (!guard.ok) return guard.response;
  const { user } = guard.current;

  if (!rateLimit(`faltoken:${user.id}`, 30, 10 * 60 * 1000)) return jsonError("Too many requests.", 429);

  const body = await readJson<{ sessionId: string }>(req);
  if (typeof body.sessionId !== "string") return jsonError("Missing session.", 400);

  const { data: session } = await createAdminClient()
    .from("sessions")
    .select("id, user_id, reserved_seconds, started_at, generating_at, ended_at")
    .eq("id", body.sessionId)
    .eq("user_id", user.id)
    .maybeSingle<SessionRow>();

  if (!session || session.ended_at) return jsonError("This session has ended. Press Go live again.", 409);

  // No new tokens once the reserved time is used up (plus a little slack for connecting).
  const from = new Date(session.generating_at ?? session.started_at).getTime();
  const usedSeconds = (Date.now() - from) / 1000;
  if (usedSeconds > session.reserved_seconds + 30) return jsonError("This session is out of time.", 402);

  try {
    const res = await fetch("https://rest.fal.ai/tokens/", {
      method: "POST",
      headers: { Authorization: `Key ${env.falKey}`, "content-type": "application/json" },
      body: JSON.stringify({ allowed_apps: [FAL_APP_ALIAS], token_expiration: TOKEN_SECONDS }),
      cache: "no-store",
    });
    const text = await res.text();
    if (!res.ok) {
      console.error("[fal/token] fal error", res.status, text.slice(0, 300));
      return jsonError("The AI provider did not respond. Check the fal key and balance.", 502);
    }
    // fal returns the token as a JSON string (older proxies wrap it in { detail }).
    let token: unknown = text;
    try {
      token = JSON.parse(text);
    } catch {
      /* plain text */
    }
    if (token && typeof token === "object" && "detail" in token) token = (token as { detail: unknown }).detail;
    if (token && typeof token === "object" && "token" in token) token = (token as { token: unknown }).token;
    if (typeof token !== "string" || !token) return jsonError("Unexpected token response from fal.", 502);

    return json({ token });
  } catch (err) {
    console.error("[fal/token] failed", err);
    return jsonError("Could not reach the AI provider.", 502);
  }
}
