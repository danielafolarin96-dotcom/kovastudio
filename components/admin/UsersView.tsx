import Link from "next/link";
import { Badge, Card, Kpi, tdClass, thClass } from "@/components/admin/AdminShell";
import { IconArrowRight, IconBolt, IconSparkle, IconUser, IconWallet } from "@/components/Icons";
import { USER_FILTERS, USER_SORTS, type UserFilter, type UserRow, type UserSort } from "@/lib/admin-users";
import { formatDuration } from "@/lib/config";
import { formatNaira } from "@/lib/pricing";

const date = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeZone: "Africa/Lagos" });

export function ago(iso: string | null, now: number): string {
  if (!iso) return "Never";
  const m = Math.floor((now - Date.parse(iso)) / 60000);
  if (m < 2) return "Just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return d < 30 ? `${d}d ago` : date.format(new Date(iso));
}

export function PlanBadge({ row }: { row: Pick<UserRow, "isAdmin" | "has_paid" | "accepted_terms_at"> }) {
  return (
    <span className="flex flex-wrap gap-1.5">
      {row.isAdmin ? <Badge tone="violet">Admin</Badge> : row.has_paid ? <Badge tone="green">Paying</Badge> : <Badge tone="gray">Free</Badge>}
      {!row.accepted_terms_at && <Badge tone="amber">No rules yet</Badge>}
    </span>
  );
}

type Props = {
  rows: UserRow[];
  summary: { total: number; paying: number; newThisWeek: number; activeThisWeek: number };
  matched: number;
  page: number;
  pages: number;
  q: string;
  filter: UserFilter;
  sort: UserSort;
  now: number;
};

// Every user, with search, filters, sorting and pages.
export default function UsersView({ rows, summary, matched, page, pages, q, filter, sort, now }: Props) {
  const href = (over: Partial<{ q: string; filter: string; sort: string; page: number }>) => {
    const sp = new URLSearchParams();
    const v = { q, filter, sort, page: 1, ...over };
    if (v.q) sp.set("q", v.q);
    if (v.filter !== "all") sp.set("filter", v.filter);
    if (v.sort !== "newest") sp.set("sort", v.sort);
    if (v.page > 1) sp.set("page", String(v.page));
    const s = sp.toString();
    return `/admin/users${s ? `?${s}` : ""}`;
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Total users" value={summary.total.toLocaleString()} icon={<IconUser className="h-4 w-4" />} tone="bg-grape text-white" />
        <Kpi
          label="Paying customers"
          value={summary.paying.toLocaleString()}
          note={summary.total ? `${Math.round((summary.paying / summary.total) * 100)}% of users` : undefined}
          icon={<IconWallet className="h-4 w-4" />}
          tone="bg-signal text-white"
        />
        <Kpi
          label="New this week"
          value={summary.newThisWeek.toLocaleString()}
          note="Signed up in the last 7 days"
          icon={<IconSparkle className="h-4 w-4" />}
          tone="bg-cue text-black"
        />
        <Kpi
          label="Active this week"
          value={summary.activeThisWeek.toLocaleString()}
          note="Went live in the last 7 days"
          icon={<IconBolt className="h-4 w-4" />}
          tone="bg-ok text-white"
        />
      </div>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-1.5">
            {USER_FILTERS.map(([key, label]) => (
              <Link
                key={key}
                href={href({ filter: key })}
                className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
                  filter === key ? "bg-white text-black" : "bg-surface-3 text-soft hover:text-fg"
                }`}
              >
                {label}
              </Link>
            ))}
          </div>
          <form className="flex w-full gap-2 sm:w-auto" action="/admin/users">
            {filter !== "all" && <input type="hidden" name="filter" value={filter} />}
            {sort !== "newest" && <input type="hidden" name="sort" value={sort} />}
            <input name="q" defaultValue={q} placeholder="Search email or name" className="field field-sm min-w-0 flex-1 sm:w-64" />
            <button className="btn btn-light px-5 text-sm">Search</button>
          </form>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-mute">
          Sort:
          {USER_SORTS.map(([key, label]) => (
            <Link
              key={key}
              href={href({ sort: key })}
              className={`rounded-full px-2.5 py-1 font-medium ${sort === key ? "bg-signal/15 text-signal-2" : "hover:text-fg"}`}
            >
              {label}
            </Link>
          ))}
          <span className="ml-auto">
            {matched.toLocaleString()} {matched === 1 ? "user" : "users"}
            {q && ` matching "${q}"`}
          </span>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr>
                <th className={thClass}>User</th>
                <th className={thClass}>Plan</th>
                <th className={thClass}>Credits left</th>
                <th className={thClass}>Gift left</th>
                <th className={thClass}>Spent</th>
                <th className={thClass}>AI time</th>
                <th className={thClass}>Joined</th>
                <th className={thClass}>Last live</th>
                <th className={thClass} />
              </tr>
            </thead>
            <tbody>
              {rows.map((u) => (
                <tr key={u.id} className="group hover:bg-white/[0.02]">
                  <td className={tdClass}>
                    <Link href={`/admin/users/${u.id}`} className="flex items-center gap-3">
                      <span className="flex h-9 w-9 flex-none items-center justify-center rounded-xl bg-surface-3 font-bold text-soft group-hover:bg-signal group-hover:text-white">
                        {(u.display_name || u.email).slice(0, 1).toUpperCase()}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate font-semibold">{u.display_name || "No name"}</span>
                        <span className="block truncate text-xs text-mute">{u.email}</span>
                      </span>
                    </Link>
                  </td>
                  <td className={tdClass}>
                    <PlanBadge row={u} />
                  </td>
                  <td className={`${tdClass} font-mono text-xs`}>{u.isAdmin ? "Unlimited" : formatDuration(u.paid_seconds)}</td>
                  <td className={`${tdClass} font-mono text-xs text-soft`}>{formatDuration(u.free_seconds)}</td>
                  <td className={`${tdClass} font-semibold`}>{u.spentNgn ? formatNaira(u.spentNgn) : <span className="text-mute">-</span>}</td>
                  <td className={`${tdClass} text-soft`}>
                    {formatDuration(u.aiSeconds)}
                    <span className="ml-1 text-xs text-mute">({u.sessions})</span>
                  </td>
                  <td className={`${tdClass} whitespace-nowrap text-soft`}>{date.format(new Date(u.created_at))}</td>
                  <td className={`${tdClass} whitespace-nowrap text-soft`}>{ago(u.lastActive, now)}</td>
                  <td className={`${tdClass} text-right`}>
                    <Link href={`/admin/users/${u.id}`} className="inline-flex h-8 w-8 items-center justify-center rounded-full text-mute hover:bg-white/5 hover:text-fg" aria-label="Open">
                      <IconArrowRight className="h-4 w-4" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!rows.length && <p className="py-10 text-center text-sm text-mute">No users match.</p>}
        </div>

        {pages > 1 && (
          <div className="mt-5 flex items-center justify-between text-sm">
            <span className="text-mute">
              Page {page} of {pages}
            </span>
            <div className="flex gap-2">
              {page > 1 && (
                <Link href={href({ page: page - 1 })} className="btn btn-line px-4 py-2 text-sm">
                  Previous
                </Link>
              )}
              {page < pages && (
                <Link href={href({ page: page + 1 })} className="btn btn-line px-4 py-2 text-sm">
                  Next
                </Link>
              )}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
