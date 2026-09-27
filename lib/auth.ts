import "server-only";
import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { env, isAdminEmail } from "@/lib/env";
import type { Preset, PresetCard, Profile } from "@/lib/types";

export type CurrentUser = {
  user: User;
  profile: Profile;
  isAdmin: boolean;
};

// Returns the logged-in user and their profile, or null.
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;

  const admin = createAdminClient();
  let { data: profile } = await admin.from("profiles").select("*").eq("id", data.user.id).maybeSingle<Profile>();

  // Safety net if the signup trigger was missing when this user signed up.
  if (!profile) {
    const { data: created } = await admin
      .from("profiles")
      .upsert({ id: data.user.id, email: data.user.email ?? "" }, { onConflict: "id" })
      .select("*")
      .single<Profile>();
    profile = created ?? null;
  }
  if (!profile) return null;

  return { user: data.user, profile, isAdmin: isAdminEmail(data.user.email) };
}

// For pages: sends visitors to login, and new users to the rules screen first.
export async function requireUser(nextPath: string, opts: { allowUnaccepted?: boolean } = {}): Promise<CurrentUser> {
  const current = await getCurrentUser();
  if (!current) redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  if (!opts.allowUnaccepted && !current.profile.accepted_terms_at) {
    redirect(`/welcome?next=${encodeURIComponent(nextPath)}`);
  }
  return current;
}

export async function requireAdmin(): Promise<CurrentUser> {
  const current = await requireUser("/admin");
  if (!current.isAdmin) redirect("/studio");
  return current;
}

export function displayNameOf(profile: Pick<Profile, "display_name" | "email">): string {
  return profile.display_name?.trim() || profile.email.split("@")[0];
}

export function presetImageUrl(path: string): string {
  return `${env.supabaseUrl}/storage/v1/object/public/presets/${path}`;
}

export function toPresetCard(p: Preset): PresetCard {
  return {
    id: p.id,
    name: p.name,
    category: p.category,
    imageUrl: presetImageUrl(p.image_path),
    promptExtra: p.prompt_extra,
  };
}

export async function getActivePresets(): Promise<PresetCard[]> {
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("presets")
      .select("*")
      .eq("active", true)
      .order("sort", { ascending: true })
      .order("created_at", { ascending: false })
      .returns<Preset[]>();
    return (data ?? []).map(toPresetCard);
  } catch {
    return [];
  }
}
