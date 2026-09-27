"use client";

import { createBrowserClient } from "@supabase/ssr";

// Supabase client for client components (reads the logged-in user's own rows only).
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}
