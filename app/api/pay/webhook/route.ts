import type { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { json, jsonError } from "@/lib/api";
import { verify, verifySignature } from "@/lib/paystack";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Paystack calls this directly, so there is no guardUser (no Origin header, no logged-in user).
// We verify the signature on the raw body, then re-verify the transaction with Paystack
// before granting anything: never trust the webhook payload's amount by itself.
export async function POST(req: NextRequest) {
  const raw = await req.text();
  if (!verifySignature(raw, req.headers.get("x-paystack-signature"))) {
    return jsonError("Bad signature.", 401);
  }

  let event: { event?: string; data?: { reference?: string } };
  try {
    event = JSON.parse(raw);
  } catch {
    return json({ ok: true });
  }

  if (event.event !== "charge.success") return json({ ok: true });

  const reference = event.data?.reference;
  if (typeof reference !== "string") return json({ ok: true });

  try {
    const result = await verify(reference);
    if (result.status === "success") {
      const { error } = await createAdminClient().rpc("complete_payment", {
        p_reference: reference,
        p_amount_kobo: result.amount,
        p_currency: result.currency,
        p_paystack_id: result.id,
        p_channel: result.channel,
        p_raw: result,
      });
      if (error) console.error("[pay/webhook] complete_payment", error);
    }
  } catch (err) {
    console.error("[pay/webhook] verify", err);
  }

  return json({ ok: true });
}
