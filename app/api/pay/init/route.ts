import type { NextRequest } from "next/server";
import { randomUUID } from "crypto";
import { createAdminClient } from "@/lib/supabase/server";
import { guardUser, json, jsonError, readJson } from "@/lib/api";
import { rateLimit } from "@/lib/rate-limit";
import { env } from "@/lib/env";
import { packById } from "@/lib/pricing";
import { initialize } from "@/lib/paystack";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = { packId: string };

// Starts a Paystack checkout for one credit pack. Never grants credits here:
// only the webhook and /pay/return (through complete_payment) do that.
export async function POST(req: NextRequest) {
  if (!env.paystackSecretKey) return jsonError("Server setup incomplete. Missing: PAYSTACK_SECRET_KEY", 500);

  const guard = await guardUser(req);
  if (!guard.ok) return guard.response;
  const { user, profile } = guard.current;

  if (!rateLimit(`payinit:${user.id}`, 10, 10 * 60 * 1000)) return jsonError("Too many requests. Try again soon.", 429);

  const body = await readJson<Body>(req);
  const pack = packById(body.packId);
  if (!pack) return jsonError("Pick a valid pack.", 400);

  const reference = `kova_${randomUUID()}`;
  const amountKobo = Math.round(pack.priceNgn * 100);
  const admin = createAdminClient();

  const { error: insertError } = await admin.from("payments").insert({
    reference,
    user_id: user.id,
    pack_id: pack.id,
    credits: pack.credits,
    amount_kobo: amountKobo,
    currency: "NGN",
    status: "pending",
  });
  if (insertError) {
    console.error("[pay/init] insert", insertError);
    if (/relation .* does not exist/i.test(insertError.message)) {
      return jsonError("Run supabase/migrations/2026-09-28_paystack.sql in the Supabase SQL Editor first.", 500);
    }
    return jsonError("Could not start checkout. Try again.", 500);
  }

  try {
    const result = await initialize({
      email: user.email ?? profile.email,
      amountKobo,
      reference,
      callbackUrl: `${env.siteUrl}/pay/return`,
      metadata: { user_id: user.id, pack_id: pack.id },
    });
    return json({ url: result.authorization_url });
  } catch (err) {
    console.error("[pay/init] paystack", err);
    await admin.from("payments").delete().eq("reference", reference);
    return jsonError("Could not reach Paystack. Try again.", 502);
  }
}
