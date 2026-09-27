import type { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { guardUser, json, jsonError, readJson } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  email: string;
  minutes: number;
  bucket: "free" | "paid";
  markPaid: boolean;
  note: string;
  amountNgn: number;
  method: string;
  pack: string;
};

const METHODS = ["transfer", "paystack", "cash", "other"];

// Admin: add (or remove, with negative minutes) live time for a user.
export async function POST(req: NextRequest) {
  const guard = await guardUser(req, { admin: true });
  if (!guard.ok) return guard.response;

  const body = await readJson<Body>(req);
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const minutes = Number(body.minutes);
  const bucket = body.bucket === "free" ? "free" : "paid";

  if (!email) return jsonError("Enter the user's email.", 400);
  if (!Number.isFinite(minutes) || minutes === 0 || Math.abs(minutes) > 10_000) {
    return jsonError("Enter minutes between -10000 and 10000 (not 0).", 400);
  }

  const markPaid = body.markPaid === true;
  const amountNgn = Number(body.amountNgn ?? 0);
  if (markPaid && (!Number.isFinite(amountNgn) || amountNgn < 0 || amountNgn > 100_000_000)) {
    return jsonError("Enter the amount paid in naira.", 400);
  }
  const method = markPaid && typeof body.method === "string" && METHODS.includes(body.method) ? body.method : null;
  const pack = typeof body.pack === "string" && /^[a-z0-9_-]{1,40}$/.test(body.pack) ? body.pack : null;

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("id")
    .eq("email", email)
    .maybeSingle<{ id: string }>();
  if (!profile) return jsonError("No user with that email. They need to sign up first.", 404);

  const { error } = await admin.rpc("grant_seconds", {
    p_user: profile.id,
    p_bucket: bucket,
    p_seconds: Math.round(minutes * 60),
    p_mark_paid: markPaid,
    p_note: typeof body.note === "string" ? body.note.slice(0, 200) : null,
    p_admin: guard.current.user.id,
    p_amount_kobo: markPaid ? Math.round(amountNgn * 100) : null,
    p_method: method,
    p_pack: pack,
  });
  if (error) {
    console.error("[admin/grant]", error);
    if (/p_amount_kobo|function .* does not exist/i.test(error.message)) {
      return jsonError("Run supabase/migrations/2026-09-28_finance.sql in the Supabase SQL Editor first.", 500);
    }
    return jsonError("Could not update the balance.", 500);
  }
  return json({ ok: true });
}
