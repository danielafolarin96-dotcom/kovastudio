"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { env, missingEnv } from "@/lib/env";

export type FormState = { error?: string; message?: string; email?: string } | null;

function safeNext(value: FormDataEntryValue | null, fallback: string): string {
  const v = typeof value === "string" ? value : "";
  return v.startsWith("/") && !v.startsWith("//") ? v : fallback;
}

function setupError(): FormState | null {
  const missing = missingEnv().filter((m) => m.includes("SUPABASE"));
  return missing.length ? { error: `Server setup incomplete. Missing: ${missing.join(", ")}` } : null;
}

function friendly(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login")) return "Wrong email or password.";
  if (m.includes("email not confirmed")) return "Confirm your email first. Check your inbox (and spam).";
  if (m.includes("already registered")) return "That email already has an account. Log in instead.";
  if (m.includes("rate limit") || m.includes("too many")) return "Too many attempts. Wait a minute and try again.";
  if (m.includes("password")) return message;
  return "Something went wrong. Try again.";
}

export async function login(_: FormState, formData: FormData): Promise<FormState> {
  const bad = setupError();
  if (bad) return bad;

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: "Enter your email and password.", email };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: friendly(error.message), email };

  redirect(safeNext(formData.get("next"), "/studio"));
}

export async function signup(_: FormState, formData: FormData): Promise<FormState> {
  const bad = setupError();
  if (bad) return bad;

  const displayName = String(formData.get("displayName") ?? "").trim().slice(0, 40);
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!displayName) return { error: "Pick a creator name.", email };
  if (!/^\S+@\S+\.\S+$/.test(email)) return { error: "Enter a valid email.", email };
  if (password.length < 8) return { error: "Password must be at least 8 characters.", email };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { display_name: displayName },
      emailRedirectTo: `${env.siteUrl}/auth/confirm?next=/welcome`,
    },
  });
  if (error) return { error: friendly(error.message), email };

  // Email confirmation turned off in Supabase: the user is logged in already.
  if (data.session) redirect("/welcome");

  return { message: `We sent a confirmation link to ${email}. Open it to finish signing up.`, email };
}

export async function forgotPassword(_: FormState, formData: FormData): Promise<FormState> {
  const bad = setupError();
  if (bad) return bad;

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(email)) return { error: "Enter a valid email.", email };

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${env.siteUrl}/auth/confirm?next=/reset-password`,
  });
  if (error && error.message.toLowerCase().includes("rate")) return { error: friendly(error.message), email };

  // Same answer whether or not the account exists, so nobody can fish for emails.
  return { message: "If that email has an account, a reset link is on its way.", email };
}

export async function resetPassword(_: FormState, formData: FormData): Promise<FormState> {
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  if (password.length < 8) return { error: "Password must be at least 8 characters." };
  if (password !== confirm) return { error: "Passwords do not match." };

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { error: "Your reset link expired. Request a new one." };

  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: friendly(error.message) };

  redirect("/studio");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
