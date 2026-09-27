import type { Metadata } from "next";
import AdminShell, { Card } from "@/components/admin/AdminShell";
import { PresetManager } from "@/components/admin/AdminForms";
import SetupNotice from "@/components/SetupNotice";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/server";
import { env, missingEnv } from "@/lib/env";
import type { Preset } from "@/lib/types";

export const metadata: Metadata = { title: "Gallery" };
export const dynamic = "force-dynamic";

export default async function GalleryPage() {
  const missing = missingEnv();
  if (missing.length) return <SetupNotice missing={missing} />;
  await requireAdmin();

  const { data } = await createAdminClient()
    .from("presets")
    .select("*")
    .order("sort")
    .order("created_at", { ascending: false })
    .returns<Preset[]>();

  return (
    <AdminShell tab="gallery" title="Character gallery" sub="Presets every user can pick in the studio.">
      <Card>
        <PresetManager presets={data ?? []} imageBase={`${env.supabaseUrl}/storage/v1/object/public/presets`} />
      </Card>
    </AdminShell>
  );
}
