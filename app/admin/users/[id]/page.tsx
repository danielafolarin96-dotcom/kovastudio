import type { Metadata } from "next";
import { notFound } from "next/navigation";
import AdminShell from "@/components/admin/AdminShell";
import UserDetailView from "@/components/admin/UserDetailView";
import SetupNotice from "@/components/SetupNotice";
import { requireAdmin } from "@/lib/auth";
import { loadUser } from "@/lib/admin-data";
import { missingEnv } from "@/lib/env";

export const metadata: Metadata = { title: "User" };
export const dynamic = "force-dynamic";

export default async function UserPage({ params }: { params: Promise<{ id: string }> }) {
  const missing = missingEnv();
  if (missing.length) return <SetupNotice missing={missing} />;
  await requireAdmin();

  const { id } = await params;
  const data = await loadUser(id);
  if (!data) notFound();

  return (
    <AdminShell tab="users" title="User details">
      <UserDetailView user={data.user} ledger={data.ledger} sessions={data.sessions} now={Date.now()} />
    </AdminShell>
  );
}
