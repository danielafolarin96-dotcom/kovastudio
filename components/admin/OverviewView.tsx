import Link from "next/link";
import { Badge, Card, Kpi, tdClass, thClass } from "@/components/admin/AdminShell";
import { GrantForm, SettingsForm } from "@/components/admin/AdminForms";
import { IconArrowRight, IconBolt, IconUser, IconWallet } from "@/components/Icons";
import { formatDuration } from "@/lib/config";
import type { Finance } from "@/lib/finance";
import { formatNaira } from "@/lib/pricing";

const when = new Intl.DateTimeFormat("en-GB", { dateStyle: "short", timeStyle: "short", timeZone: "Africa/Lagos" });

export type RecentSession = {
  id: string;
  user_id: string;
  bucket: string;
  billed_seconds: number | null;
  reported_seconds: number;
  started_at: string;
  ended_at: string | null;
  last_heartbeat_at: string | null;
  character_name: string | null;
  profiles: { email: string } | null;
};

export type NewUser = { id: string; email: string; display_name: string | null; created_at: string; has_paid: boolean };

type Props = {
  usersCount: number;
  liveNow: number;
  todaySeconds: number;
  todayCost: string;
  finance: Finance;
  recent: RecentSession[];
  newest: NewUser[];
  signupFreeSeconds: number;
  adminEmails: string[];
  now: number;
};

// Admin home: the numbers that matter today, quick actions, latest activity.
export default function OverviewView({ usersCount, liveNow, todaySeconds, todayCost, finance, recent, newest, signupFreeSeconds, adminEmails, now }: Props) {
  const p = finance.provider;
  return (
    <div className="space-y-4">
      {(p.status === "low" || p.status === "empty") && (
        <Link
          href="/admin/finance"
          className="flex items-center justify-between gap-4 rounded-2xl border border-signal/40 bg-signal/10 px-5 py-4 text-sm text-[#ffc9cf]"
        >
          <span>
            <span className="font-semibold text-white">AI balance {p.status === "empty" ? "is empty" : "is low"}.</span> About $
            {Math.max(0, p.balanceUsd).toFixed(2)} left, users are owed ${p.owedUsd.toFixed(2)} of AI time. Top up fal.
          </span>
          <IconArrowRight className="h-4 w-4 flex-none" />
        </Link>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Users" value={usersCount.toLocaleString()} note={<Link href="/admin/users" className="hover:text-fg">See all users &rarr;</Link>} icon={<IconUser className="h-4 w-4" />} tone="bg-grape text-white" />
        <Kpi label="Live now" value={String(liveNow)} note="Sessions with a heartbeat in the last 45s" hot={liveNow > 0} />
        <Kpi label="AI time today" value={formatDuration(todaySeconds)} note={todayCost} icon={<IconBolt className="h-4 w-4" />} tone="bg-sky text-white" />
        <Kpi
          label="Revenue, 30 days"
          value={formatNaira(finance.revenue)}
          note={<Link href="/admin/finance" className="hover:text-fg">Net {formatNaira(finance.net)}. Open finance &rarr;</Link>}
          icon={<IconWallet className="h-4 w-4" />}
          tone="bg-signal text-white"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
        <Card title="Add time or record a payment" sub="Payments count as revenue in Finance.">
          <GrantForm />
        </Card>
        <div className="space-y-4">
          <Card title="Signup gift" sub="Free time every new account gets. Keep at 0 for paid-only.">
            <SettingsForm signupFreeSeconds={signupFreeSeconds} />
            <div className="mt-5 border-t border-line pt-4 text-sm">
              <p className="mb-2 text-xs text-mute">Admins (from ADMIN_EMAILS)</p>
              <ul className="space-y-1 font-mono text-xs text-soft">
                {adminEmails.length ? adminEmails.map((e) => <li key={e}>{e}</li>) : <li>None set</li>}
              </ul>
            </div>
          </Card>
          <Card title="Newest users" right={<Link href="/admin/users" className="text-sm text-signal-2 hover:underline">All users</Link>}>
            <ul className="space-y-3">
              {newest.map((u) => (
                <li key={u.id}>
                  <Link href={`/admin/users/${u.id}`} className="flex items-center gap-3">
                    <span className="flex h-9 w-9 flex-none items-center justify-center rounded-xl bg-surface-3 font-bold text-soft">
                      {(u.display_name || u.email).slice(0, 1).toUpperCase()}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{u.display_name || "No name"}</span>
                      <span className="block truncate text-xs text-mute">{u.email}</span>
                    </span>
                    {u.has_paid ? <Badge tone="green">Paying</Badge> : <span className="text-xs text-mute">{when.format(new Date(u.created_at))}</span>}
                  </Link>
                </li>
              ))}
              {!newest.length && <li className="text-sm text-mute">No users yet.</li>}
            </ul>
          </Card>
        </div>
      </div>

      <Card title="Recent sessions" sub="Last 25 across everyone.">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] text-sm">
            <thead>
              <tr>
                <th className={thClass}>Started</th>
                <th className={thClass}>User</th>
                <th className={thClass}>Character</th>
                <th className={thClass}>Type</th>
                <th className={thClass}>Used</th>
                <th className={thClass}>Status</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((s) => {
                const alive = !s.ended_at && now - new Date(s.last_heartbeat_at ?? s.started_at).getTime() < 45_000;
                return (
                  <tr key={s.id}>
                    <td className={`${tdClass} whitespace-nowrap text-soft`}>{when.format(new Date(s.started_at))}</td>
                    <td className={tdClass}>
                      <Link href={`/admin/users/${s.user_id}`} className="hover:text-signal-2">
                        {s.profiles?.email ?? "Deleted"}
                      </Link>
                    </td>
                    <td className={`${tdClass} max-w-[10rem] truncate`}>{s.character_name ?? "Untitled"}</td>
                    <td className={`${tdClass} capitalize text-soft`}>{s.bucket}</td>
                    <td className={`${tdClass} font-mono text-xs`}>{formatDuration(s.billed_seconds ?? s.reported_seconds)}</td>
                    <td className={tdClass}>
                      {s.ended_at ? <Badge tone="gray">Ended</Badge> : alive ? <Badge tone="red">Live</Badge> : <Badge tone="amber">Stale</Badge>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!recent.length && <p className="py-8 text-center text-sm text-mute">No sessions yet.</p>}
        </div>
      </Card>
    </div>
  );
}
