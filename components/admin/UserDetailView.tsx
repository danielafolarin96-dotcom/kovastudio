import Link from "next/link";
import { Badge, Card, Kpi, tdClass, thClass } from "@/components/admin/AdminShell";
import { GrantForm } from "@/components/admin/AdminForms";
import { PlanBadge, ago } from "@/components/admin/UsersView";
import { IconBolt, IconClock, IconWallet } from "@/components/Icons";
import type { UserRow } from "@/lib/admin-users";
import { formatDuration } from "@/lib/config";
import { METHOD_LABEL } from "@/lib/finance";
import { formatNaira, packById } from "@/lib/pricing";
import type { LedgerRow, SessionRow } from "@/lib/types";

const when = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Lagos" });

const REASON: Record<string, { label: string; tone: "green" | "gray" | "red" | "amber" | "violet" }> = {
  payment: { label: "Payment", tone: "green" },
  grant: { label: "Gift / adjustment", tone: "violet" },
  signup: { label: "Signup gift", tone: "violet" },
  session_reserve: { label: "Went live", tone: "gray" },
  session_refund: { label: "Unused time back", tone: "amber" },
};

// One user: balances, money, credit history, sessions, and a quick "add time" form.
export default function UserDetailView({
  user,
  ledger,
  sessions,
  now,
}: {
  user: UserRow;
  ledger: LedgerRow[];
  sessions: SessionRow[];
  now: number;
}) {
  const name = user.display_name || user.email.split("@")[0];
  return (
    <div className="space-y-4">
      <Link href="/admin/users" className="text-sm text-mute hover:text-fg">
        &larr; All users
      </Link>

      <div className="card flex flex-wrap items-center gap-5 p-6">
        <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[linear-gradient(180deg,#ff4358,#c10f25)] text-2xl font-bold">
          {name.slice(0, 1).toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="display truncate text-2xl sm:text-3xl">{name}</h2>
          <p className="truncate text-sm text-mute">{user.email}</p>
          <div className="mt-2">
            <PlanBadge row={user} />
          </div>
        </div>
        <dl className="grid grid-cols-2 gap-x-8 gap-y-1 text-sm">
          <dt className="text-mute">Joined</dt>
          <dd>{when.format(new Date(user.created_at))}</dd>
          <dt className="text-mute">Last live</dt>
          <dd>{ago(user.lastActive, now)}</dd>
          <dt className="text-mute">Channel</dt>
          <dd className="font-mono text-xs">/c/{user.channel_slug}</dd>
        </dl>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi
          label="Credits left"
          value={user.isAdmin ? "Unlimited" : formatDuration(user.paid_seconds)}
          icon={<IconWallet className="h-4 w-4" />}
          tone="bg-signal text-white"
        />
        <Kpi label="Gift time left" value={formatDuration(user.free_seconds)} icon={<IconClock className="h-4 w-4" />} tone="bg-cue text-black" />
        <Kpi label="Total spent" value={formatNaira(user.spentNgn)} note={`${user.payments} payment${user.payments === 1 ? "" : "s"}`} hot={user.spentNgn > 0} />
        <Kpi
          label="AI time used"
          value={formatDuration(user.aiSeconds)}
          note={`${user.sessions} session${user.sessions === 1 ? "" : "s"}`}
          icon={<IconBolt className="h-4 w-4" />}
          tone="bg-sky text-white"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[380px_1fr]">
        <Card title="Add time or record a payment">
          <GrantForm defaultEmail={user.email} />
        </Card>

        <Card title="Credit history" sub="Every change to this user's balance, newest first.">
          {ledger.length ? (
            <div className="max-h-[520px] overflow-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead className="sticky top-0 bg-surface">
                  <tr>
                    <th className={thClass}>When</th>
                    <th className={thClass}>What</th>
                    <th className={thClass}>Time</th>
                    <th className={thClass}>Money</th>
                    <th className={thClass}>Note</th>
                  </tr>
                </thead>
                <tbody>
                  {ledger.map((l) => {
                    const r = REASON[l.reason] ?? { label: l.reason, tone: "gray" as const };
                    return (
                      <tr key={l.id}>
                        <td className={`${tdClass} whitespace-nowrap text-soft`}>{when.format(new Date(l.created_at))}</td>
                        <td className={tdClass}>
                          <Badge tone={r.tone}>{r.label}</Badge>
                          <span className="ml-2 text-xs text-mute">{l.bucket === "paid" ? "credits" : "gift"}</span>
                        </td>
                        <td className={`${tdClass} font-mono text-xs ${l.seconds >= 0 ? "text-[#4ade80]" : "text-soft"}`}>
                          {l.seconds >= 0 ? "+" : "-"}
                          {formatDuration(Math.abs(l.seconds))}
                        </td>
                        <td className={tdClass}>
                          {l.amount_kobo !== null ? (
                            <>
                              <span className="font-semibold">{formatNaira(l.amount_kobo / 100)}</span>
                              <span className="block text-xs text-mute">
                                {packById(l.pack_id)?.name ?? "Custom"}, {METHOD_LABEL[l.method ?? "unknown"]}
                              </span>
                            </>
                          ) : (
                            <span className="text-mute">-</span>
                          )}
                        </td>
                        <td className={`${tdClass} max-w-[12rem] truncate text-mute`}>{l.note ?? ""}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-mute">No balance changes yet.</p>
          )}
        </Card>
      </div>

      <Card title="Sessions" sub="Last 30 live sessions.">
        {sessions.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr>
                  <th className={thClass}>Started</th>
                  <th className={thClass}>Character</th>
                  <th className={thClass}>Type</th>
                  <th className={thClass}>Used</th>
                  <th className={thClass}>Watermark</th>
                  <th className={thClass}>Ended</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((s) => (
                  <tr key={s.id}>
                    <td className={`${tdClass} whitespace-nowrap text-soft`}>{when.format(new Date(s.started_at))}</td>
                    <td className={tdClass}>{s.character_name ?? "Untitled"}</td>
                    <td className={`${tdClass} capitalize text-soft`}>{s.bucket}</td>
                    <td className={`${tdClass} font-mono text-xs`}>{formatDuration(s.billed_seconds ?? s.reported_seconds)}</td>
                    <td className={tdClass}>{s.watermark ? <Badge tone="amber">On</Badge> : <Badge tone="gray">Off</Badge>}</td>
                    <td className={`${tdClass} text-soft`}>
                      {s.ended_at ? (s.end_reason ?? "Ended").replace(/_/g, " ") : <Badge tone="red">Live</Badge>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-mute">Has not gone live yet.</p>
        )}
      </Card>
    </div>
  );
}
