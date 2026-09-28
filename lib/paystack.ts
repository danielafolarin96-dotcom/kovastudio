import "server-only";
import crypto from "crypto";
import { env } from "@/lib/env";

// Thin wrapper around the Paystack REST API. SERVER ONLY: never import this into a client component.

const BASE = "https://api.paystack.co";

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${env.paystackSecretKey}`, "content-type": "application/json", ...(init?.headers ?? {}) },
    cache: "no-store",
  });
  const body = (await res.json().catch(() => null)) as { status?: boolean; message?: string; data?: T } | null;
  if (!res.ok || !body?.status) {
    throw new Error(body?.message ?? `Paystack error (${res.status})`);
  }
  return body.data as T;
}

export type PaystackInitResult = {
  authorization_url: string;
  access_code: string;
  reference: string;
};

export async function initialize(opts: {
  email: string;
  amountKobo: number;
  reference: string;
  callbackUrl: string;
  metadata: Record<string, unknown>;
}): Promise<PaystackInitResult> {
  return call<PaystackInitResult>("/transaction/initialize", {
    method: "POST",
    body: JSON.stringify({
      email: opts.email,
      amount: opts.amountKobo,
      currency: "NGN",
      reference: opts.reference,
      callback_url: opts.callbackUrl,
      metadata: opts.metadata,
    }),
  });
}

export type PaystackVerifyResult = {
  status: string; // "success" | "failed" | "abandoned" | ...
  reference: string;
  amount: number; // kobo
  currency: string;
  id: number;
  channel: string | null;
  paid_at: string | null;
};

export async function verify(reference: string): Promise<PaystackVerifyResult> {
  return call<PaystackVerifyResult>(`/transaction/verify/${encodeURIComponent(reference)}`);
}

// Verifies Paystack signed the raw webhook body with our secret key. Constant time compare.
export function verifySignature(rawBody: string, signatureHeader: string | null): boolean {
  if (!signatureHeader || !env.paystackSecretKey) return false;
  const expected = crypto.createHmac("sha512", env.paystackSecretKey).update(rawBody).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(signatureHeader);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}
