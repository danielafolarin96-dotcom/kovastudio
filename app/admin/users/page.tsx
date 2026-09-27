import type { Metadata } from "next";
import AdminShell from "@/components/admin/AdminShell";
import UsersView from "@/components/admin/UsersView";
import SetupNotice from "@/components/SetupNotice";
import { requireAdmin } from "@/lib/auth";
import { loadUsers } from "@/lib/admin-data";
import { parseUserFilter, parseUserSort, queryUsers, summarizeUsers } from "@/lib/admin-users";
import { missingEnv } from "@/lib/env";

export const metadata: Metadata = { title: "Users" };
export const dynamic = "force-dynamic";

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; filter?: string; sort?: string; page?: string }>;
}) {
  const missing = missingEnv();
  if (missing.length) return <SetupNotice missing={missing} />;
  await requireAdmin();

  const sp = await searchParams;
  const q = (sp.q ?? "").slice(0, 80);
  const filter = parseUserFilter(sp.filter);
  const sort = parseUserSort(sp.sort);
  const now = Date.now();

  const all = await loadUsers();
  const result = queryUsers(all, { q, filter, sort, page: Number(sp.page) || 1, perPage: 25, now });

  return (
    <AdminShell tab="users" title="Users" sub="Everyone who has signed up. Click a user to see their history and add time.">
      <UsersView {...result} summary={summarizeUsers(all, now)} q={q} filter={filter} sort={sort} now={now} />
    </AdminShell>
  );
}
