"use client";

import { useState } from "react";
import Link from "next/link";
import { IconCheck } from "@/components/Icons";
import { CREDIT_PACKS, formatNaira, perMinuteNgn } from "@/lib/pricing";

// Credit packs. mode "public" links to signup or the buy section, mode "account" checks out for real.
export default function RateCard({
  mode,
  supportEmail,
  signedIn,
}: {
  mode: "public" | "account";
  supportEmail?: string;
  signedIn?: boolean;
}) {
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function buy(packId: string) {
    setError(null);
    setLoadingId(packId);
    try {
      const res = await fetch("/api/pay/init", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ packId }),
      });
      const body = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!res.ok || !body.url) {
        setError(body.error || "Could not start checkout. Try again.");
        setLoadingId(null);
        return;
      }
      window.location.href = body.url;
    } catch {
      setError("Could not reach the server. Try again.");
      setLoadingId(null);
    }
  }

  return (
    <div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {CREDIT_PACKS.map((p) => {
          const featured = p.id === "creator";
          const busy = loadingId === p.id;
          return (
            <div key={p.id} className={`relative flex flex-col p-6 ${featured ? "card-hot" : "card card-hover"}`}>
              <div className="flex items-center justify-between">
                <p className="text-lg font-bold">{p.name}</p>
                {p.tag && (
                  <span
                    className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                      featured ? "bg-signal text-white" : "bg-white/10 text-soft"
                    }`}
                  >
                    {p.tag}
                  </span>
                )}
              </div>
              <p className="mt-6 text-4xl font-extrabold tracking-tight">{formatNaira(p.priceNgn)}</p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-signal/15 px-3 py-1 text-xs font-semibold text-signal-2">
                  {p.credits} credits
                </span>
                <span className="text-xs text-mute">{formatNaira(perMinuteNgn(p))} / min</span>
              </div>
              <ul className="mt-6 space-y-2.5 text-sm text-soft">
                {[`${p.credits} minutes of live AI`, "No watermark", "Billed by the second", "Credits never expire"].map((f) => (
                  <li key={f} className="flex items-center gap-2.5">
                    <span className="flex h-5 w-5 flex-none items-center justify-center rounded-full bg-signal/15 text-signal-2">
                      <IconCheck className="h-3 w-3" />
                    </span>
                    {f}
                  </li>
                ))}
              </ul>
              <div className="mt-auto pt-8">
                {mode === "public" ? (
                  <Link
                    href={signedIn ? "/account#buy" : "/signup"}
                    className={`btn w-full py-3 text-sm ${featured ? "btn-signal" : "btn-line"}`}
                  >
                    Get {p.name}
                  </Link>
                ) : (
                  <button
                    type="button"
                    onClick={() => buy(p.id)}
                    disabled={loadingId !== null}
                    className={`btn w-full py-3 text-sm disabled:opacity-60 ${featured ? "btn-signal" : "btn-line"}`}
                  >
                    {busy ? "Opening checkout..." : `Buy ${p.name}`}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {mode === "account" && error && <p className="mt-4 text-center text-sm text-signal-2">{error}</p>}
      <p className="mt-4 text-center text-xs text-mute">
        Prices in naira. 1 credit = 1 minute of live AI. You only pay while the AI is running.
        {mode === "account" &&
          (supportEmail ? (
            <>
              {" "}
              Having trouble paying? Email{" "}
              <a href={`mailto:${supportEmail}`} className="text-soft underline">
                {supportEmail}
              </a>
              .
            </>
          ) : (
            " Having trouble paying? Contact the Kova Studio team."
          ))}
      </p>
    </div>
  );
}
