import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Viewer from "@/components/Viewer";
import { createAdminClient } from "@/lib/supabase/server";
import { displayNameOf } from "@/lib/auth";
import { missingEnv } from "@/lib/env";

export const dynamic = "force-dynamic";

async function findHost(slug: string) {
  if (!/^[a-z0-9]{6,32}$/i.test(slug) || missingEnv().length) return null;
  const { data } = await createAdminClient()
    .from("profiles")
    .select("display_name, email")
    .eq("channel_slug", slug)
    .maybeSingle<{ display_name: string | null; email: string }>();
  return data ? displayNameOf(data) : null;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const host = await findHost(slug);
  return {
    title: host ? `${host} on Kova Studio` : "Channel",
    robots: { index: false },
  };
}

export default async function ChannelPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ obs?: string }>;
}) {
  const { slug } = await params;
  const { obs } = await searchParams;
  const host = await findHost(slug);
  if (!host) notFound();
  return <Viewer slug={slug} hostName={host} obs={obs === "1"} />;
}
