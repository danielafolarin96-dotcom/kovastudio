import type { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { guardUser, json, jsonError, readJson } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const KINDS = ["ai_topup", "hosting", "marketing", "fees", "other"];

type Body = { kind: string; amountNgn: number; amountUsd: number | null; note: string; spentOn: string };

// Admin: log money going out (AI provider top-ups, hosting, ads...).
export async function POST(req: NextRequest) {
  const guard = await guardUser(req, { admin: true });
  if (!guard.ok) return guard.response;

  const body = await readJson<Body>(req);
  const kind = typeof body.kind === "string" && KINDS.includes(body.kind) ? body.kind : null;
  const amountNgn = Number(body.amountNgn);
  const amountUsd = body.amountUsd === null || body.amountUsd === undefined || body.amountUsd === ("" as unknown) ? null : Number(body.amountUsd);
  const spentOn = typeof body.spentOn === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.spentOn) ? body.spentOn : null;

  if (!kind) return jsonError("Pick what the money was for.", 400);
  if (!Number.isFinite(amountNgn) || amountNgn <= 0 || amountNgn > 100_000_000) return jsonError("Enter the amount in naira.", 400);
  if (amountUsd !== null && (!Number.isFinite(amountUsd) || amountUsd < 0 || amountUsd > 1_000_000)) {
    return jsonError("The dollar amount looks wrong.", 400);
  }

  const { error } = await createAdminClient()
    .from("expenses")
    .insert({
      kind,
      amount_kobo: Math.round(amountNgn * 100),
      amount_usd: amountUsd,
      note: typeof body.note === "string" ? body.note.slice(0, 200) : null,
      ...(spentOn ? { spent_on: spentOn } : {}),
      created_by: guard.current.user.id,
    });
  if (error) {
    console.error("[admin/expenses]", error);
    return jsonError("Could not save. Did you run the finance migration?", 500);
  }
  return json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const guard = await guardUser(req, { admin: true });
  if (!guard.ok) return guard.response;
  const body = await readJson<{ id: number }>(req);
  const id = Number(body.id);
  if (!Number.isInteger(id) || id <= 0) return jsonError("Bad id.", 400);
  const { error } = await createAdminClient().from("expenses").delete().eq("id", id);
  if (error) return jsonError("Could not delete.", 500);
  return json({ ok: true });
}
