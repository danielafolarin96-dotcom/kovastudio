import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { guardUser } from "@/lib/api";
import { METHOD_LABEL } from "@/lib/finance";
import { packById } from "@/lib/pricing";
import type { LedgerRow } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const cell = (v: unknown) => {
  const s = v === null || v === undefined ? "" : String(v);
  // Quote everything and stop spreadsheet formulas from running.
  return `"${(/^[=+\-@]/.test(s) ? `'${s}` : s).replace(/"/g, '""')}"`;
};

// Admin: download every payment as a CSV (opens in Excel or Google Sheets).
// A plain link click has no Origin header, so this GET only checks the admin login.
export async function GET(req: NextRequest) {
  const guard = await guardUser(req, { admin: true, checkOrigin: false });
  if (!guard.ok) return guard.response;

  const { data, error } = await createAdminClient()
    .from("credit_ledger")
    .select("*, profiles(email, display_name)")
    .eq("reason", "payment")
    .order("created_at", { ascending: false })
    .limit(10000)
    .returns<Array<LedgerRow & { profiles: { email: string; display_name: string | null } | null }>>();
  if (error) return NextResponse.json({ error: "Could not export." }, { status: 500 });

  const lines = [
    ["Date", "Email", "Name", "Pack", "Credits (min)", "Amount (NGN)", "Method", "Note"].map(cell).join(","),
    ...(data ?? []).map((r) =>
      [
        r.created_at,
        r.profiles?.email,
        r.profiles?.display_name,
        packById(r.pack_id)?.name ?? "Custom",
        (r.seconds / 60).toFixed(1),
        ((r.amount_kobo ?? 0) / 100).toFixed(2),
        METHOD_LABEL[r.method ?? "unknown"],
        r.note,
      ]
        .map(cell)
        .join(","),
    ),
  ];
  return new NextResponse(lines.join("\r\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="kova-payments-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
