import type { NextRequest } from "next/server";
import { randomBytes } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/server";
import { guardUser, json, jsonError } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Makes a new channel link. The old link (and OBS source) stops working.
export async function POST(req: NextRequest) {
  const guard = await guardUser(req);
  if (!guard.ok) return guard.response;
  const { user } = guard.current;

  const admin = createAdminClient();
  const slug = randomBytes(8).toString("hex").slice(0, 12);

  const { error } = await admin.from("profiles").update({ channel_slug: slug }).eq("id", user.id);
  if (error) return jsonError("Could not reset your link. Try again.", 500);

  await admin
    .from("live_shares")
    .update({ ended_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .is("ended_at", null);

  return json({ channelSlug: slug });
}
