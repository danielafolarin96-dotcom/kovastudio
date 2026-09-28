import "server-only";

// Server-only environment settings. Never import this from a client component.

function list(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

function int(value: string | undefined, fallback: number, min: number, max: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(n)));
}

export const env = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabasePublishableKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "",
  supabaseSecretKey: process.env.SUPABASE_SECRET_KEY ?? "",
  // Which company runs Lucy 2.5 for us: "decart" (direct) or "fal" (reseller).
  aiProvider: (process.env.AI_PROVIDER === "fal" ? "fal" : "decart") as "decart" | "fal",
  decartApiKey: process.env.DECART_API_KEY ?? "",
  falKey: process.env.FAL_KEY ?? "",
  paystackSecretKey: process.env.PAYSTACK_SECRET_KEY ?? "",
  siteUrl: (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, ""),
  adminEmails: list(process.env.ADMIN_EMAILS).map((e) => e.toLowerCase()),
  allowedOrigins: list(process.env.ALLOWED_ORIGINS ?? process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").map((o) =>
    o.replace(/\/$/, ""),
  ),
  // Longest single session per bucket, in seconds. Decart tokens cap out at one hour.
  maxFreeSession: int(process.env.MAX_FREE_SESSION_SECONDS, 120, 10, 3500),
  maxPaidSession: int(process.env.MAX_PAID_SESSION_SECONDS, 900, 10, 3500),
  maxAdminSession: int(process.env.MAX_ADMIN_SESSION_SECONDS, 3500, 10, 3500),
  nairaPerDollar: int(process.env.NAIRA_PER_DOLLAR, 1330, 1, 100000),
};

export function isAdminEmail(email: string | null | undefined): boolean {
  return !!email && env.adminEmails.includes(email.toLowerCase());
}

// Settings that are not filled in yet. Pages that do not go live (account, admin) only need Supabase,
// so the site works before the AI key or the Paystack key is added.
// Pass { ai: true } where the AI provider is needed, { pay: true } where Paystack is needed.
export function missingEnv(opts: { ai?: boolean; pay?: boolean } = {}): string[] {
  const missing: string[] = [];
  if (!env.supabaseUrl) missing.push("NEXT_PUBLIC_SUPABASE_URL");
  if (!env.supabasePublishableKey) missing.push("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  if (!env.supabaseSecretKey) missing.push("SUPABASE_SECRET_KEY");
  if (opts.ai && env.aiProvider === "decart" && !env.decartApiKey) missing.push("DECART_API_KEY");
  if (opts.ai && env.aiProvider === "fal" && !env.falKey) missing.push("FAL_KEY");
  if (opts.pay && !env.paystackSecretKey) missing.push("PAYSTACK_SECRET_KEY");
  return missing;
}
