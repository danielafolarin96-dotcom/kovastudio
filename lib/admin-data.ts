import "server-only";
import { createAdminClient } from "@/lib/supabase/server";
import { env, isAdminEmail } from "@/lib/env";
import { COST_PER_SECOND_USD } from "@/lib/config";
import { computeFinance, type FinanceRange, type PaymentRow, type UsageRow } from "@/lib/finance";
import { buildUserRows, type UserPayment, type UserUsage } from "@/lib/admin-users";
import type { Expense, LedgerRow, Profile, SessionRow } from "@/lib/types";

// Loads rows for the admin finance and users pages. The math lives in lib/finance.ts and lib/admin-users.ts.

type Page<T> = { data: T[] | null; error: { message: string; code?: string } | null };

// Supabase returns at most 1000 rows per request, so read in pages.
async function fetchAll<T>(page: (from: number, to: number) => PromiseLike<Page<T>>, cap = 50_000) {
  const rows: T[] = [];
  for (let from = 0; from < cap; from += 1000) {
    const { data, error } = await page(from, from + 999);
    if (error) return { rows, error };
    rows.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return { rows, error: null };
}

// True when the finance migration has not been run yet (missing column or table).
const isMissing = (e: { message: string; code?: string } | null) =>
  !!e && (e.code === "42703" || e.code === "42P01" || e.code === "PGRST205" || e.code === "PGRST204" || /does not exist|could not find/i.test(e.message));

export async function loadFinance(range: FinanceRange) {
  const db = createAdminClient();
  let missingMigration = false;

  let payments = await fetchAll<PaymentRow>((a, b) =>
    db
      .from("credit_ledger")
      .select("*, profiles(email, display_name)")
      .eq("reason", "payment")
      .order("created_at", { ascending: false })
      .range(a, b),
  );
  if (payments.rows.length && payments.rows[0].amount_kobo === undefined) missingMigration = true;

  const expenses = await fetchAll<Expense>((a, b) => db.from("expenses").select("*").order("spent_on", { ascending: false }).range(a, b));
  if (isMissing(expenses.error)) missingMigration = true;
  if (payments.error && !isMissing(payments.error)) console.error("[finance] payments", payments.error);

  const usage = await fetchAll<UsageRow>((a, b) =>
    db.from("sessions").select("bucket, billed_seconds, reported_seconds, started_at").order("started_at").range(a, b),
  );
  const balances = await fetchAll<{ paid_seconds: number; free_seconds: number }>((a, b) =>
    db.from("profiles").select("paid_seconds, free_seconds").order("id").range(a, b),
  );

  payments = { ...payments, rows: payments.rows.map((p) => ({ ...p, amount_kobo: p.amount_kobo ?? null, method: p.method ?? null, pack_id: p.pack_id ?? null })) };

  const finance = computeFinance({
    range,
    now: Date.now(),
    payments: payments.rows,
    usage: usage.rows,
    expenses: expenses.error ? [] : expenses.rows,
    outstandingPaidSeconds: balances.rows.reduce((s, r) => s + r.paid_seconds, 0),
    outstandingFreeSeconds: balances.rows.reduce((s, r) => s + r.free_seconds, 0),
    nairaPerDollar: env.nairaPerDollar,
    costPerSecondUsd: COST_PER_SECOND_USD,
  });
  return { finance, missingMigration };
}

async function paymentsFor(db: ReturnType<typeof createAdminClient>, userId?: string) {
  const withAmount = await fetchAll<UserPayment>((a, b) => {
    let q = db.from("credit_ledger").select("user_id, amount_kobo, created_at").eq("reason", "payment");
    if (userId) q = q.eq("user_id", userId);
    return q.order("id").range(a, b);
  });
  if (!withAmount.error) return withAmount.rows;
  // Before the finance migration there is no amount column: count payments with no money attached.
  const plain = await fetchAll<{ user_id: string; created_at: string }>((a, b) => {
    let q = db.from("credit_ledger").select("user_id, created_at").eq("reason", "payment");
    if (userId) q = q.eq("user_id", userId);
    return q.order("id").range(a, b);
  });
  return plain.rows.map((r) => ({ ...r, amount_kobo: null }));
}

export async function loadUsers() {
  const db = createAdminClient();
  const [profiles, payments, usage] = await Promise.all([
    fetchAll<Profile>((a, b) => db.from("profiles").select("*").order("created_at", { ascending: false }).range(a, b)),
    paymentsFor(db),
    fetchAll<UserUsage>((a, b) => db.from("sessions").select("user_id, billed_seconds, reported_seconds, started_at").order("started_at").range(a, b)),
  ]);
  return buildUserRows(profiles.rows, payments, usage.rows, isAdminEmail);
}

export async function loadUser(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const db = createAdminClient();
  const { data: profile } = await db.from("profiles").select("*").eq("id", id).maybeSingle<Profile>();
  if (!profile) return null;

  const [payments, usage, ledger, sessions] = await Promise.all([
    paymentsFor(db, id),
    fetchAll<UserUsage>((a, b) => db.from("sessions").select("user_id, billed_seconds, reported_seconds, started_at").eq("user_id", id).order("started_at").range(a, b)),
    db.from("credit_ledger").select("*").eq("user_id", id).order("created_at", { ascending: false }).limit(200).returns<LedgerRow[]>(),
    db.from("sessions").select("*").eq("user_id", id).order("started_at", { ascending: false }).limit(30).returns<SessionRow[]>(),
  ]);

  const [user] = buildUserRows([profile], payments, usage.rows, isAdminEmail);
  const ledgerRows = (ledger.data ?? []).map((l) => ({ ...l, amount_kobo: l.amount_kobo ?? null, method: l.method ?? null, pack_id: l.pack_id ?? null }));
  return { user, ledger: ledgerRows, sessions: sessions.data ?? [] };
}
