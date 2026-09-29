// Finance math for the admin panel. Pure functions: the page loads rows, this turns them into numbers.
import { CREDIT_PACKS, packById, paystackFeeNgn } from "@/lib/pricing";
import type { Expense, ExpenseKind, LedgerRow, PaymentMethod } from "@/lib/types";

export type FinanceRange = "7d" | "30d" | "90d" | "all";
export const FINANCE_RANGES: Array<[FinanceRange, string]> = [
  ["7d", "7 days"],
  ["30d", "30 days"],
  ["90d", "90 days"],
  ["all", "All time"],
];

export function parseRange(v: string | undefined): FinanceRange {
  return v === "7d" || v === "90d" || v === "all" ? v : "30d";
}

export type UsageRow = {
  bucket: string;
  billed_seconds: number | null;
  reported_seconds: number;
  started_at: string;
  end_reason?: string | null;
};
export type PaymentRow = LedgerRow & { profiles?: { email: string; display_name: string | null } | null };

export type FinanceInput = {
  range: FinanceRange;
  now: number;
  payments: PaymentRow[]; // reason = payment, all time
  usage: UsageRow[]; // sessions, all time
  expenses: Expense[]; // all time
  outstandingPaidSeconds: number; // sum of profiles.paid_seconds
  outstandingFreeSeconds: number; // sum of profiles.free_seconds
  nairaPerDollar: number;
  costPerSecondUsd: number;
};

export type SeriesPoint = { key: string; label: string; revenue: number; aiCost: number };

export type Finance = {
  range: FinanceRange;
  fromLabel: string;
  revenue: number;
  payments: number;
  payingCustomers: number;
  avgOrder: number;
  minutesSold: number;
  fees: number;
  aiSeconds: number;
  aiSecondsByBucket: Record<"paid" | "free" | "admin", number>;
  aiCost: number;
  aiCostUsd: number;
  otherExpenses: number;
  net: number;
  margin: number | null;
  series: SeriesPoint[];
  seriesUnit: "day" | "month";
  byPack: Array<{ id: string; name: string; count: number; revenue: number }>;
  byMethod: Array<{ method: PaymentMethod | "unknown"; count: number; revenue: number }>;
  expensesByKind: Array<{ kind: ExpenseKind; amount: number }>;
  provider: {
    toppedUpUsd: number;
    usedUsd: number;
    balanceUsd: number;
    owedUsd: number; // what unused paid credits will cost to serve
    status: "ok" | "low" | "empty" | "untracked";
  };
  outstanding: { paidMinutes: number; freeMinutes: number; costToServe: number };
  staleSessions: { count: number; minutes: number };
  transactions: PaymentRow[];
  expenseRows: Expense[];
  lifetimeRevenue: number;
};

const DAY = 24 * 3600 * 1000;
const lagosDay = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Lagos", year: "numeric", month: "2-digit", day: "2-digit" });
const dayLabel = new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Lagos", day: "numeric", month: "short" });
const monthLabel = new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Lagos", month: "short", year: "2-digit" });

export const dayKey = (ms: number) => lagosDay.format(new Date(ms)); // YYYY-MM-DD in Lagos
const monthKey = (ms: number) => dayKey(ms).slice(0, 7);

const used = (u: UsageRow) => u.billed_seconds ?? u.reported_seconds ?? 0;
const naira = (kobo: number | null | undefined) => (kobo ?? 0) / 100;

export function computeFinance(input: FinanceInput): Finance {
  const { range, now, nairaPerDollar: fx, costPerSecondUsd: cps } = input;
  const days = range === "7d" ? 7 : range === "30d" ? 30 : range === "90d" ? 90 : null;

  let firstActivity = now;
  for (const p of input.payments) firstActivity = Math.min(firstActivity, Date.parse(p.created_at));
  for (const u of input.usage) firstActivity = Math.min(firstActivity, Date.parse(u.started_at));
  const fromMs = days ? Date.parse(`${dayKey(now - (days - 1) * DAY)}T00:00:00+01:00`) : firstActivity;
  const inRange = (iso: string) => Date.parse(iso) >= fromMs;
  const fromKey = dayKey(fromMs);

  const pays = input.payments.filter((p) => inRange(p.created_at));
  const usage = input.usage.filter((u) => inRange(u.started_at));
  const exps = input.expenses.filter((e) => e.spent_on >= fromKey);

  const revenue = pays.reduce((s, p) => s + naira(p.amount_kobo), 0);
  const fees = pays.reduce((s, p) => s + (p.method === "paystack" ? paystackFeeNgn(naira(p.amount_kobo)) : 0), 0);

  const aiSecondsByBucket = { paid: 0, free: 0, admin: 0 };
  for (const u of usage) {
    const b = u.bucket === "free" || u.bucket === "admin" ? u.bucket : "paid";
    aiSecondsByBucket[b] += used(u);
  }
  const aiSeconds = aiSecondsByBucket.paid + aiSecondsByBucket.free + aiSecondsByBucket.admin;
  const aiCostUsd = aiSeconds * cps;
  const aiCost = aiCostUsd * fx;

  // AI top-ups are money moved to the provider, not a cost on their own. The cost is the usage above.
  const otherExpenses = exps.filter((e) => e.kind !== "ai_topup").reduce((s, e) => s + naira(e.amount_kobo), 0);
  const net = revenue - fees - aiCost - otherExpenses;

  // Chart: by day for short ranges, by month for long ones.
  const spanDays = Math.max(1, Math.ceil((now - fromMs) / DAY));
  const seriesUnit: "day" | "month" = spanDays > 92 ? "month" : "day";
  const points = new Map<string, SeriesPoint>();
  if (seriesUnit === "day") {
    for (let t = fromMs + DAY / 2; t <= now + DAY / 2; t += DAY) {
      const k = dayKey(t);
      if (!points.has(k)) points.set(k, { key: k, label: dayLabel.format(new Date(t)), revenue: 0, aiCost: 0 });
    }
  } else {
    for (let t = fromMs; t <= now + 31 * DAY; t += 15 * DAY) {
      const k = monthKey(Math.min(t, now));
      if (!points.has(k)) points.set(k, { key: k, label: monthLabel.format(new Date(Math.min(t, now))), revenue: 0, aiCost: 0 });
    }
  }
  const keyOf = (iso: string) => (seriesUnit === "day" ? dayKey(Date.parse(iso)) : monthKey(Date.parse(iso)));
  for (const p of pays) {
    const pt = points.get(keyOf(p.created_at));
    if (pt) pt.revenue += naira(p.amount_kobo);
  }
  for (const u of usage) {
    const pt = points.get(keyOf(u.started_at));
    if (pt) pt.aiCost += used(u) * cps * fx;
  }

  const packMap = new Map<string, { id: string; name: string; count: number; revenue: number }>();
  for (const pk of CREDIT_PACKS) packMap.set(pk.id, { id: pk.id, name: pk.name, count: 0, revenue: 0 });
  packMap.set("custom", { id: "custom", name: "Custom", count: 0, revenue: 0 });
  for (const p of pays) {
    const row = packMap.get(packById(p.pack_id) ? p.pack_id! : "custom")!;
    row.count += 1;
    row.revenue += naira(p.amount_kobo);
  }

  const methodMap = new Map<PaymentMethod | "unknown", { method: PaymentMethod | "unknown"; count: number; revenue: number }>();
  for (const p of pays) {
    const m = p.method ?? "unknown";
    const row = methodMap.get(m) ?? { method: m, count: 0, revenue: 0 };
    row.count += 1;
    row.revenue += naira(p.amount_kobo);
    methodMap.set(m, row);
  }

  const kindMap = new Map<ExpenseKind, number>();
  for (const e of exps) kindMap.set(e.kind, (kindMap.get(e.kind) ?? 0) + naira(e.amount_kobo));

  // Provider balance estimate, all time: what we topped up minus what the AI has used.
  const topups = input.expenses.filter((e) => e.kind === "ai_topup");
  const toppedUpUsd = topups.reduce((s, e) => s + (e.amount_usd ?? naira(e.amount_kobo) / fx), 0);
  const usedUsd = input.usage.reduce((s, u) => s + used(u), 0) * cps;
  const balanceUsd = toppedUpUsd - usedUsd;
  const owedUsd = input.outstandingPaidSeconds * cps;
  const status = !topups.length ? "untracked" : balanceUsd <= 0 ? "empty" : balanceUsd < owedUsd ? "low" : "ok";

  // Sessions the server had to force-close after the client went silent past its reserved
  // time (see settle_session's floor and the cron sweep). We can't see fal's own usage
  // numbers, so a rising count/total here is the visible proxy for "someone tried to
  // stream past what they paid for."
  const staleRows = usage.filter((u) => u.end_reason === "stale" || u.end_reason === "time_up");
  const staleSessions = {
    count: staleRows.length,
    minutes: staleRows.reduce((s, u) => s + used(u), 0) / 60,
  };

  return {
    range,
    fromLabel: dayLabel.format(new Date(fromMs)),
    revenue,
    payments: pays.length,
    payingCustomers: new Set(pays.map((p) => p.user_id)).size,
    avgOrder: pays.length ? revenue / pays.length : 0,
    minutesSold: pays.reduce((s, p) => s + Math.max(0, p.seconds), 0) / 60,
    fees,
    aiSeconds,
    aiSecondsByBucket,
    aiCost,
    aiCostUsd,
    otherExpenses,
    net,
    margin: revenue > 0 ? net / revenue : null,
    series: Array.from(points.values()),
    seriesUnit,
    byPack: Array.from(packMap.values()).filter((r) => r.count > 0 || r.id !== "custom"),
    byMethod: Array.from(methodMap.values()).sort((a, b) => b.revenue - a.revenue),
    expensesByKind: Array.from(kindMap, ([kind, amount]) => ({ kind, amount })).sort((a, b) => b.amount - a.amount),
    provider: { toppedUpUsd, usedUsd, balanceUsd, owedUsd, status },
    outstanding: {
      paidMinutes: input.outstandingPaidSeconds / 60,
      freeMinutes: input.outstandingFreeSeconds / 60,
      costToServe: owedUsd * fx,
    },
    staleSessions,
    transactions: [...pays].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at)).slice(0, 50),
    expenseRows: [...exps].sort((a, b) => (a.spent_on < b.spent_on ? 1 : -1)).slice(0, 50),
    lifetimeRevenue: input.payments.reduce((s, p) => s + naira(p.amount_kobo), 0),
  };
}

export const METHOD_LABEL: Record<PaymentMethod | "unknown", string> = {
  transfer: "Bank transfer",
  paystack: "Paystack",
  cash: "Cash",
  other: "Other",
  unknown: "Not recorded",
};

export const EXPENSE_LABEL: Record<ExpenseKind, string> = {
  ai_topup: "AI top-up (fal / Decart)",
  hosting: "Hosting",
  marketing: "Marketing",
  fees: "Fees",
  other: "Other",
};
