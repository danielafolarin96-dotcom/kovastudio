export type Profile = {
  id: string;
  email: string;
  display_name: string | null;
  channel_slug: string;
  has_paid: boolean;
  free_seconds: number;
  paid_seconds: number;
  accepted_terms_at: string | null;
  created_at: string;
};

export type Preset = {
  id: string;
  name: string;
  category: string;
  image_path: string;
  prompt_extra: string | null;
  sort: number;
  active: boolean;
  created_at: string;
};

// What the studio receives about a preset (with a ready-to-use image URL).
export type PresetCard = {
  id: string;
  name: string;
  category: string;
  imageUrl: string;
  promptExtra: string | null;
};

export type SessionRow = {
  id: string;
  user_id: string;
  bucket: "free" | "paid" | "admin";
  watermark: boolean;
  reserved_seconds: number;
  reported_seconds: number;
  billed_seconds: number | null;
  character_name: string | null;
  started_at: string;
  generating_at: string | null;
  last_heartbeat_at: string | null;
  ended_at: string | null;
  end_reason: string | null;
};

// Plan info the studio needs, computed on the server.
export type StudioAccount = {
  displayName: string;
  email: string;
  isAdmin: boolean;
  hasPaid: boolean;
  freeSeconds: number;
  paidSeconds: number;
  channelSlug: string;
  siteUrl: string;
  provider: "decart" | "fal"; // who runs Lucy 2.5 right now
};

export type PaymentMethod = "transfer" | "paystack" | "cash" | "other";

// A row of credit_ledger. amount_kobo/method/pack_id are set for payments.
export type LedgerRow = {
  id: number;
  user_id: string;
  bucket: "free" | "paid";
  seconds: number;
  reason: string; // payment | grant | session | refund ...
  session_id: string | null;
  note: string | null;
  created_by: string | null;
  created_at: string;
  amount_kobo: number | null;
  method: PaymentMethod | null;
  pack_id: string | null;
};

export type ExpenseKind = "ai_topup" | "hosting" | "marketing" | "fees" | "other";

export type Expense = {
  id: number;
  kind: ExpenseKind;
  amount_kobo: number;
  amount_usd: number | null;
  note: string | null;
  spent_on: string; // YYYY-MM-DD
  created_at: string;
};
