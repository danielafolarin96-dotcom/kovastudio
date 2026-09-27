import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

// Supabase client acting as the logged-in user (server components, actions, routes).
export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(env.supabaseUrl, env.supabasePublishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Called from a server component. proxy.ts refreshes the session instead.
        }
      },
    },
  });
}

// Supabase client with full access. Server only. Never send its results to the browser unfiltered.
let adminClient: SupabaseClient | null = null;
export function createAdminClient(): SupabaseClient {
  if (!adminClient) {
    adminClient = createSupabaseClient(env.supabaseUrl, env.supabaseSecretKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return adminClient;
}
