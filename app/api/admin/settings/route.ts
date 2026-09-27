import type { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { guardUser, json, jsonError, readJson } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Admin: change how much free time new signups get.
export async function POST(req: NextRequest) {
  const guard = await guardUser(req, { admin: true });
  if (!guard.ok) return guard.response;

  const body = await readJson<{ signupFreeSeconds: number }>(req);
  const seconds = Math.floor(Number(body.signupFreeSeconds));
  if (!Number.isFinite(seconds) || seconds < 0 || seconds > 3600) {
    return jsonError("Free time must be between 0 and 3600 seconds.", 400);
  }

  const { error } = await createAdminClient()
    .from("app_settings")
    .update({ signup_free_seconds: seconds, updated_at: new Date().toISOString() })
    .eq("id", 1);
  if (error) return jsonError("Could not save.", 500);
  return json({ ok: true });
}
