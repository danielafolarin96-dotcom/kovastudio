import Link from "next/link";
import FinanceChart from "@/components/admin/FinanceChart";
import { Badge, Card, Kpi, tdClass, thClass } from "@/components/admin/AdminShell";
import { DeleteExpense, ExpenseForm } from "@/components/admin/AdminForms";
import { IconBolt, IconClock, IconWallet } from "@/components/Icons";
import { EXPENSE_LABEL, FINANCE_RANGES, METHOD_LABEL, type Finance } from "@/lib/finance";
import { formatNaira, packById } from "@/lib/pricing";
import type { PaystackPaymentRow } from "@/lib/admin-data";

const usd = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const mins = (m: number) => `${Math.round(m).toLocaleString("en-NG")} min`;
const when = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Lagos" });
const dateOnly = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeZone: "UTC" });

// The finance dashboard. Pure view: all numbers come from computeFinance().
export default function FinanceView({
  f,
  fx,
  missingMigration,
  paystackPayments,
}: {
  f: Finance;
  fx: number;
  missingMigration?: boolean;
  paystackPayments: PaystackPaymentRow[];
}) {
  const rangeLabel = FINANCE_RANGES.find(([k]) => k === f.range)?.[1] ?? "";
  const maxPack = Math.max(1, ...f.byPack.map((p) => p.revenue));
  const providerTone = { ok: "green", low: "amber", empty: "red", untracked: "gray" } as const;
  const providerText = {
    ok: "Enough for all unused paid credits",
    low: "Less than your users' unused paid credits. Top up soon.",
    empty: "Probably empty. Top up now or live sessions will fail.",
    untracked: "Log your first top-up below to track this.",
  }[f.provider.status];

  return (
    <div className="space-y-4">
      {missingMigration && (
        <p className="rounded-2xl border border-cue/30 bg-cue/10 px-5 py-4 text-sm text-[#ffe2a8]">
          Finance tracking is not switched on yet. Run <span className="font-mono">supabase/migrations/2026-09-28_finance.sql</span> in
          the Supabase SQL Editor, then reload this page.
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 rounded-full border border-line bg-surface p-1">
          {FINANCE_RANGES.map(([key, label]) => (
            <Link
              key={key}
              href={`/admin/finance?range=${key}`}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
                f.range === key ? "bg-white text-black" : "text-soft hover:text-fg"
              }`}
            >
              {label}
            </Link>
          ))}
        </div>
        <p className="text-xs text-mute">
          Since {f.fromLabel}. Lagos time. AI cost at $0.02/sec and ₦{fx.toLocaleString("en-NG")}/$.
        </p>
      </div>

      {/* headline numbers */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi
          label="Revenue"
          value={formatNaira(f.revenue)}
          note={`${f.payments} payment${f.payments === 1 ? "" : "s"} in ${rangeLabel.toLowerCase()}`}
          icon={<IconWallet className="h-4 w-4" />}
          tone="bg-signal text-white"
        />
        <Kpi
          label="AI cost"
          value={formatNaira(f.aiCost)}
          note={`${usd(f.aiCostUsd)} for ${mins(f.aiSeconds / 60)} of live AI`}
          icon={<IconBolt className="h-4 w-4" />}
          tone="bg-sky text-white"
        />
        <Kpi
          label="Fees and other costs"
          value={formatNaira(f.fees + f.otherExpenses)}
          note={`Paystack ${formatNaira(f.fees)} + expenses ${formatNaira(f.otherExpenses)}`}
          icon={<IconClock className="h-4 w-4" />}
          tone="bg-cue text-black"
        />
        <Kpi
          label="Net profit"
          value={`${f.net < 0 ? "-" : ""}${formatNaira(Math.abs(f.net))}`}
          note={f.margin === null ? "No sales in this range yet" : `${Math.round(f.margin * 100)}% margin`}
          hot={f.net > 0}
        />
      </div>

      {/* chart + provider */}
      <div className="grid gap-4 lg:grid-cols-[1.75fr_1fr]">
        <Card title="Revenue vs AI cost" sub={f.seriesUnit === "day" ? "Per day" : "Per month"}>
          <FinanceChart points={f.series} />
          <details className="mt-3 text-sm">
            <summary className="cursor-pointer text-xs text-mute hover:text-soft">Show as a table</summary>
            <div className="mt-3 max-h-64 overflow-y-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th className={thClass}>{f.seriesUnit === "day" ? "Day" : "Month"}</th>
                    <th className={thClass}>Revenue</th>
                    <th className={thClass}>AI cost</th>
                  </tr>
                </thead>
                <tbody>
                  {f.series.map((p) => (
                    <tr key={p.key}>
                      <td className={tdClass}>{p.label}</td>
                      <td className={tdClass}>{formatNaira(p.revenue)}</td>
                      <td className={tdClass}>{formatNaira(p.aiCost)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </Card>

        <Card title="AI provider balance" sub="Estimate: top-ups minus usage, all time" right={<Badge tone={providerTone[f.provider.status]}>{f.provider.status === "untracked" ? "Not tracked" : f.provider.status === "ok" ? "Healthy" : f.provider.status === "low" ? "Low" : "Empty"}</Badge>}>
          <p className="text-4xl font-extrabold tracking-tight">{usd(Math.max(0, f.provider.balanceUsd))}</p>
          <p className="mt-1 text-sm text-soft">{providerText}</p>
          <Meter used={f.provider.owedUsd} total={Math.max(f.provider.balanceUsd, 0.01)} />
          <dl className="mt-4 space-y-2 text-sm">
            <Line label="Topped up" value={usd(f.provider.toppedUpUsd)} />
            <Line label="Used by the AI" value={usd(f.provider.usedUsd)} />
            <Line label="Owed to users (unused paid credits)" value={usd(f.provider.owedUsd)} />
          </dl>
          <p className="mt-4 text-xs text-mute">Always check the real balance on the fal dashboard. This is our own count.</p>
        </Card>
      </div>

      {/* breakdowns */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Sales by pack">
          <ul className="space-y-3.5">
            {f.byPack.map((p) => (
              <li key={p.id}>
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{p.name}</span>
                  <span className="text-soft">
                    {p.count} sold <span className="ml-2 font-semibold text-fg">{formatNaira(p.revenue)}</span>
                  </span>
                </div>
                <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-surface-3">
                  <div className="h-full rounded-full bg-signal" style={{ width: `${(p.revenue / maxPack) * 100}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </Card>

        <Card title="Customers">
          <dl className="space-y-3 text-sm">
            <Line label="Paying customers" value={String(f.payingCustomers)} big />
            <Line label="Average order" value={formatNaira(f.avgOrder)} big />
            <Line label="Minutes sold" value={mins(f.minutesSold)} big />
            <Line label="Revenue, all time" value={formatNaira(f.lifetimeRevenue)} big />
          </dl>
          <p className="label mb-2 mt-5 text-mute">How they paid</p>
          {f.byMethod.length ? (
            <ul className="space-y-1.5 text-sm">
              {f.byMethod.map((m) => (
                <li key={m.method} className="flex justify-between text-soft">
                  {METHOD_LABEL[m.method]} ({m.count})<span className="font-semibold text-fg">{formatNaira(m.revenue)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-mute">No payments yet.</p>
          )}
        </Card>

        <Card title="Live AI usage" sub={`Minutes in ${rangeLabel.toLowerCase()}`}>
          <dl className="space-y-3 text-sm">
            <Line label="Paid users" value={mins(f.aiSecondsByBucket.paid / 60)} big />
            <Line label="Gift time" value={mins(f.aiSecondsByBucket.free / 60)} big />
            <Line label="Admins (testing)" value={mins(f.aiSecondsByBucket.admin / 60)} big />
          </dl>
          <p className="label mb-2 mt-5 text-mute">Unused credits (all users)</p>
          <dl className="space-y-1.5 text-sm">
            <Line label="Paid credits left" value={mins(f.outstanding.paidMinutes)} />
            <Line label="Gift time left" value={mins(f.outstanding.freeMinutes)} />
            <Line label="Cost to serve paid credits" value={formatNaira(f.outstanding.costToServe)} />
          </dl>
        </Card>
      </div>

      {/* transactions */}
      <Card
        title="Payments"
        sub={`Latest ${Math.min(15, f.payments)} of ${f.payments} in ${rangeLabel.toLowerCase()}. The CSV has every payment.`}
        right={
          <a href="/api/admin/finance/export" className="btn btn-line px-4 py-2 text-sm">
            Download CSV
          </a>
        }
      >
        {f.transactions.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr>
                  <th className={thClass}>Date</th>
                  <th className={thClass}>Customer</th>
                  <th className={thClass}>Pack</th>
                  <th className={thClass}>Credits</th>
                  <th className={thClass}>Amount</th>
                  <th className={thClass}>Method</th>
                  <th className={thClass}>Note</th>
                </tr>
              </thead>
              <tbody>
                {f.transactions.slice(0, 15).map((t) => (
                  <tr key={t.id} className="hover:bg-white/[0.02]">
                    <td className={`${tdClass} whitespace-nowrap text-soft`}>{when.format(new Date(t.created_at))}</td>
                    <td className={tdClass}>
                      <Link href={`/admin/users/${t.user_id}`} className="font-medium hover:text-signal-2">
                        {t.profiles?.display_name || t.profiles?.email || "Deleted user"}
                      </Link>
                      {t.profiles?.display_name && <p className="text-xs text-mute">{t.profiles.email}</p>}
                    </td>
                    <td className={tdClass}>{packById(t.pack_id)?.name ?? "Custom"}</td>
                    <td className={tdClass}>{Math.round(t.seconds / 60)}</td>
                    <td className={`${tdClass} font-semibold`}>{formatNaira((t.amount_kobo ?? 0) / 100)}</td>
                    <td className={tdClass}>
                      <Badge tone={t.method === "paystack" ? "violet" : "gray"}>{METHOD_LABEL[t.method ?? "unknown"]}</Badge>
                    </td>
                    <td className={`${tdClass} max-w-[12rem] truncate text-mute`}>{t.note ?? ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-mute">No payments in this range.</p>
        )}
      </Card>

      {/* paystack checkout attempts, including stuck ones */}
      <Card title="Paystack transactions" sub="Latest checkout attempts (any status), so you can spot stuck ones by reference.">
        {paystackPayments.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr>
                  <th className={thClass}>Date</th>
                  <th className={thClass}>Customer</th>
                  <th className={thClass}>Pack</th>
                  <th className={thClass}>Amount</th>
                  <th className={thClass}>Status</th>
                  <th className={thClass}>Reference</th>
                </tr>
              </thead>
              <tbody>
                {paystackPayments.map((p) => (
                  <tr key={p.id}>
                    <td className={`${tdClass} whitespace-nowrap text-soft`}>{when.format(new Date(p.created_at))}</td>
                    <td className={tdClass}>{p.profiles?.display_name || p.profiles?.email || "Deleted user"}</td>
                    <td className={tdClass}>{packById(p.pack_id)?.name ?? p.pack_id}</td>
                    <td className={`${tdClass} font-semibold`}>{formatNaira(p.amount_kobo / 100)}</td>
                    <td className={tdClass}>
                      <Badge tone={p.status === "paid" ? "green" : p.status === "pending" ? "amber" : "gray"}>{p.status}</Badge>
                    </td>
                    <td className={`${tdClass} font-mono text-xs text-mute`}>{p.reference}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-mute">No Paystack checkouts yet.</p>
        )}
      </Card>

      {/* expenses */}
      <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
        <Card title="Log money out" sub="fal / Decart top-ups, hosting, ads.">
          <ExpenseForm fx={fx} />
        </Card>
        <Card title="Expenses" sub={`In ${rangeLabel.toLowerCase()}`}>
          {f.expensesByKind.length > 0 && (
            <div className="mb-4 flex flex-wrap gap-2">
              {f.expensesByKind.map((e) => (
                <span key={e.kind} className="rounded-full border border-line bg-surface-2 px-3 py-1.5 text-xs text-soft">
                  {EXPENSE_LABEL[e.kind]} <span className="ml-1 font-semibold text-fg">{formatNaira(e.amount)}</span>
                </span>
              ))}
            </div>
          )}
          {f.expenseRows.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-sm">
                <thead>
                  <tr>
                    <th className={thClass}>Date</th>
                    <th className={thClass}>What</th>
                    <th className={thClass}>Amount</th>
                    <th className={thClass}>Note</th>
                    <th className={thClass} />
                  </tr>
                </thead>
                <tbody>
                  {f.expenseRows.map((e) => (
                    <tr key={e.id}>
                      <td className={`${tdClass} whitespace-nowrap text-soft`}>{dateOnly.format(new Date(e.spent_on))}</td>
                      <td className={tdClass}>{EXPENSE_LABEL[e.kind]}</td>
                      <td className={`${tdClass} font-semibold`}>
                        {formatNaira(e.amount_kobo / 100)}
                        {e.amount_usd !== null && <span className="ml-1.5 text-xs font-normal text-mute">{usd(Number(e.amount_usd))}</span>}
                      </td>
                      <td className={`${tdClass} max-w-[14rem] truncate text-mute`}>{e.note ?? ""}</td>
                      <td className={`${tdClass} text-right`}>
                        <DeleteExpense id={e.id} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-mute">Nothing logged in this range.</p>
          )}
        </Card>
      </div>
    </div>
  );
}

function Line({ label, value, big }: { label: string; value: string; big?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-soft">{label}</dt>
      <dd className={big ? "text-base font-bold" : "font-semibold"}>{value}</dd>
    </div>
  );
}

function Meter({ used, total }: { used: number; total: number }) {
  const pct = Math.min(100, (used / total) * 100);
  return (
    <div className="mt-4">
      <div className="h-2.5 overflow-hidden rounded-full bg-surface-3">
        <div className={`h-full rounded-full ${pct >= 100 ? "bg-signal" : pct > 70 ? "bg-cue" : "bg-ok"}`} style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-1.5 text-xs text-mute">{Math.round(pct)}% of the balance is already owed to users</p>
    </div>
  );
}
