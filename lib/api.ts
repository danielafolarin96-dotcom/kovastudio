import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/env";
import { getCurrentUser, type CurrentUser } from "@/lib/auth";

// Small helpers shared by the API routes.

export function jsonError(message: string, status: number, extra: Record<string, unknown> = {}) {
  return NextResponse.json({ error: message, ...extra }, { status, headers: { "Cache-Control": "no-store" } });
}

export function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

// Blocks other websites from calling our private routes from a browser.
export function originAllowed(req: NextRequest): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return false;
  return env.allowedOrigins.includes(origin.replace(/\/$/, ""));
}

export function clientIp(req: NextRequest): string {
  return (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || req.headers.get("x-real-ip") || "local";
}

type Guard = { ok: true; current: CurrentUser } | { ok: false; response: NextResponse };

export async function guardUser(req: NextRequest, opts: { admin?: boolean; checkOrigin?: boolean } = {}): Promise<Guard> {
  if (opts.checkOrigin !== false && !originAllowed(req)) {
    return {
      ok: false,
      response: jsonError(
        `This site (${req.headers.get("origin") ?? "unknown"}) is not in ALLOWED_ORIGINS. Open the app at ${env.allowedOrigins[0]}.`,
        403,
      ),
    };
  }
  const current = await getCurrentUser();
  if (!current) return { ok: false, response: jsonError("Please log in again.", 401) };
  if (opts.admin && !current.isAdmin) return { ok: false, response: jsonError("Admins only.", 403) };
  return { ok: true, current };
}

export async function readJson<T>(req: NextRequest): Promise<Partial<T>> {
  try {
    return (await req.json()) as Partial<T>;
  } catch {
    return {};
  }
}

// True when a Supabase/PostgREST error means a table or column is missing, for example a migration
// that has not been run yet, or (PGRST205/PGRST204) PostgREST has not reloaded its schema cache yet
// right after one was. Used to show a friendly "run the migration" message instead of a generic error.
export function isMissingTable(e: { message: string; code?: string } | null | undefined): boolean {
  return (
    !!e &&
    (e.code === "42703" || e.code === "42P01" || e.code === "PGRST205" || e.code === "PGRST204" || /does not exist|could not find/i.test(e.message))
  );
}
