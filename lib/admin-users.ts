// User list math for the admin panel. Pure functions, no database calls.
import type { Profile } from "@/lib/types";

export type UserFilter = "all" | "paying" | "free" | "admin" | "new" | "active";
export type UserSort = "newest" | "spent" | "usage" | "credits" | "active";

export const USER_FILTERS: Array<[UserFilter, string]> = [
  ["all", "All"],
  ["paying", "Paying"],
  ["free", "Never paid"],
  ["active", "Active 7 days"],
  ["new", "New 7 days"],
  ["admin", "Admins"],
];

export const USER_SORTS: Array<[UserSort, string]> = [
  ["newest", "Newest"],
  ["spent", "Top spenders"],
  ["usage", "Most AI time"],
  ["credits", "Most credits left"],
  ["active", "Last active"],
];

export type UserPayment = { user_id: string; amount_kobo: number | null; created_at: string };
export type UserUsage = { user_id: string; billed_seconds: number | null; reported_seconds: number; started_at: string };

export type UserRow = Profile & {
  isAdmin: boolean;
  spentNgn: number;
  payments: number;
  aiSeconds: number;
  sessions: number;
  lastActive: string | null;
};

const WEEK = 7 * 24 * 3600 * 1000;

export function buildUserRows(
  profiles: Profile[],
  payments: UserPayment[],
  usage: UserUsage[],
  isAdmin: (email: string) => boolean,
): UserRow[] {
  const spent = new Map<string, { ngn: number; n: number }>();
  for (const p of payments) {
    const s = spent.get(p.user_id) ?? { ngn: 0, n: 0 };
    s.ngn += (p.amount_kobo ?? 0) / 100;
    s.n += 1;
    spent.set(p.user_id, s);
  }
  const use = new Map<string, { sec: number; n: number; last: string }>();
  for (const u of usage) {
    const s = use.get(u.user_id) ?? { sec: 0, n: 0, last: u.started_at };
    s.sec += u.billed_seconds ?? u.reported_seconds ?? 0;
    s.n += 1;
    if (u.started_at > s.last) s.last = u.started_at;
    use.set(u.user_id, s);
  }
  return profiles.map((p) => ({
    ...p,
    isAdmin: isAdmin(p.email),
    spentNgn: spent.get(p.id)?.ngn ?? 0,
    payments: spent.get(p.id)?.n ?? 0,
    aiSeconds: use.get(p.id)?.sec ?? 0,
    sessions: use.get(p.id)?.n ?? 0,
    lastActive: use.get(p.id)?.last ?? null,
  }));
}

export function summarizeUsers(rows: UserRow[], now: number) {
  return {
    total: rows.length,
    paying: rows.filter((r) => r.has_paid && !r.isAdmin).length,
    newThisWeek: rows.filter((r) => now - Date.parse(r.created_at) < WEEK).length,
    activeThisWeek: rows.filter((r) => r.lastActive && now - Date.parse(r.lastActive) < WEEK).length,
  };
}

export function queryUsers(
  rows: UserRow[],
  opts: { q: string; filter: UserFilter; sort: UserSort; page: number; perPage: number; now: number },
) {
  const q = opts.q.trim().toLowerCase();
  let list = rows.filter((r) => !q || r.email.toLowerCase().includes(q) || (r.display_name ?? "").toLowerCase().includes(q));
  list = list.filter((r) => {
    switch (opts.filter) {
      case "paying":
        return r.has_paid && !r.isAdmin;
      case "free":
        return !r.has_paid && !r.isAdmin;
      case "admin":
        return r.isAdmin;
      case "new":
        return opts.now - Date.parse(r.created_at) < WEEK;
      case "active":
        return !!r.lastActive && opts.now - Date.parse(r.lastActive) < WEEK;
      default:
        return true;
    }
  });
  const by: Record<UserSort, (a: UserRow, b: UserRow) => number> = {
    newest: (a, b) => (a.created_at < b.created_at ? 1 : -1),
    spent: (a, b) => b.spentNgn - a.spentNgn,
    usage: (a, b) => b.aiSeconds - a.aiSeconds,
    credits: (a, b) => b.paid_seconds - a.paid_seconds,
    active: (a, b) => (a.lastActive ?? "") < (b.lastActive ?? "") ? 1 : -1,
  };
  list.sort(by[opts.sort]);
  const pages = Math.max(1, Math.ceil(list.length / opts.perPage));
  const page = Math.min(Math.max(1, opts.page), pages);
  return { rows: list.slice((page - 1) * opts.perPage, page * opts.perPage), matched: list.length, page, pages };
}

export function parseUserFilter(v: string | undefined): UserFilter {
  return USER_FILTERS.some(([k]) => k === v) ? (v as UserFilter) : "all";
}
export function parseUserSort(v: string | undefined): UserSort {
  return USER_SORTS.some(([k]) => k === v) ? (v as UserSort) : "newest";
}
