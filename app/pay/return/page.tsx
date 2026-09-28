import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/server";
import { env } from "@/lib/env";
import { verify } from "@/lib/paystack";

export const dynamic = "force-dynamic";

// Paystack sends the shopper back here after checkout. We only ever redirect from this
// page, we never grant credits from the query string: verify() and complete_payment()
// (the same function the webhook calls) are the source of truth.
export default async function PayReturnPage({
  searchParams,
}: {
  searchParams: Promise<{ reference?: string; trxref?: string }>;
}) {
  const { reference, trxref } = await searchParams;
  const ref = reference || trxref;
  let ok = false;

  if (ref && env.paystackSecretKey) {
    try {
      const result = await verify(ref);
      if (result.status === "success") {
        const { data, error } = await createAdminClient().rpc("complete_payment", {
          p_reference: ref,
          p_amount_kobo: result.amount,
          p_currency: result.currency,
          p_paystack_id: result.id,
          p_channel: result.channel,
          p_raw: result,
        });
        if (error) console.error("[pay/return] complete_payment", error);
        ok = data === "paid" || data === "already";
      }
    } catch (err) {
      console.error("[pay/return] verify", err);
    }
  }

  redirect(ok ? "/account?paid=1" : "/account?paid=0");
}
