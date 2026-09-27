import type { Metadata } from "next";
import AdminShell from "@/components/admin/AdminShell";
import OverviewView, { type NewUser, type RecentSession } from "@/components/admin/OverviewView";
import SetupNotice from "@/components/SetupNotice";
import { requireAdmin } from "@/lib/auth";
import { loadFinance } from "@/lib/admin-data";
import { createAdminClient } from "@/lib/supabase/server";
import { env, missingEnv } from "@/lib/env";
import { COST_PER_SECOND_USD } from "@/lib/config";

export const metadata: Metadata = { title: "Admin" };
export const dynamic = "force-dynamic";

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const ngn = new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 });

export default async function AdminPage() {
  const missing = missingEnv();
  if (missing.length) return <SetupNotice missing={missing} />;
  await requireAdmin();

  const admin = createAdminClient();
  const now = Date.now();
  // Midnight in Lagos (UTC+1 all year, no daylight saving).
  const DAY = 24 * 3600 * 1000;
  const HOUR = 3600 * 1000;
  const todayIso = new Date(Math.floor((now + HOUR) / DAY) * DAY - HOUR).toISOString();

  const [usersCount, today, live, recent, newest, settings, { finance }] = await Promise.all([
    admin.from("profiles").select("id", { count: "exact", head: true }),
    admin.from("sessions").select("billed_seconds, reported_seconds").gte("started_at", todayIso).limit(5000),
    admin
      .from("sessions")
      .select("id", { count: "exact", head: true })
      .is("ended_at", null)
      .gte("last_heartbeat_at", new Date(now - 45_000).toISOString()),
    admin
      .from("sessions")
      .select("id, user_id, bucket, billed_seconds, reported_seconds, started_at, ended_at, last_heartbeat_at, character_name, profiles(email)")
      .order("started_at", { ascending: false })
      .limit(25)
      .returns<RecentSession[]>(),
    admin.from("profiles").select("id, email, display_name, created_at, has_paid").order("created_at", { ascending: false }).limit(5).returns<NewUser[]>(),
    admin.from("app_settings").select("signup_free_seconds").eq("id", 1).maybeSingle<{ signup_free_seconds: number }>(),
    loadFinance("30d"),
  ]);

  const todaySeconds = ((today.data ?? []) as Array<{ billed_seconds: number | null; reported_seconds: number }>).reduce(
    (s, r) => s + (r.billed_seconds ?? r.reported_seconds ?? 0),
    0,
  );
  const cost = todaySeconds * COST_PER_SECOND_USD;

  return (
    <AdminShell tab="overview" title="Dashboard" sub="Today at a glance.">
      <OverviewView
        usersCount={usersCount.count ?? 0}
        liveNow={live.count ?? 0}
        todaySeconds={todaySeconds}
        todayCost={`${usd.format(cost)} / ${ngn.format(cost * env.nairaPerDollar)}`}
        finance={finance}
        recent={recent.data ?? []}
        newest={newest.data ?? []}
        signupFreeSeconds={settings.data?.signup_free_seconds ?? 0}
        adminEmails={env.adminEmails}
        now={now}
      />
    </AdminShell>
  );
}
