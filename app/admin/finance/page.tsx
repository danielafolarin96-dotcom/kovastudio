import type { Metadata } from "next";
import AdminShell from "@/components/admin/AdminShell";
import FinanceView from "@/components/admin/FinanceView";
import SetupNotice from "@/components/SetupNotice";
import { requireAdmin } from "@/lib/auth";
import { loadFinance } from "@/lib/admin-data";
import { env, missingEnv } from "@/lib/env";
import { parseRange } from "@/lib/finance";

export const metadata: Metadata = { title: "Finance" };
export const dynamic = "force-dynamic";

export default async function FinancePage({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  const missing = missingEnv();
  if (missing.length) return <SetupNotice missing={missing} />;
  await requireAdmin();

  const { range } = await searchParams;
  const { finance, missingMigration } = await loadFinance(parseRange(range));

  return (
    <AdminShell tab="finance" title="Finance" sub="Money in, money out, and what the AI is costing you.">
      <FinanceView f={finance} fx={env.nairaPerDollar} missingMigration={missingMigration} />
    </AdminShell>
  );
}
