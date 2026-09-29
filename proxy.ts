import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

// Runs before every page request: keeps the Supabase login cookie fresh,
// sends logged-out visitors away from private pages, and sets the CSP header.

const PRIVATE_PREFIXES = ["/studio", "/account", "/admin", "/welcome"];

// Report-only click-through came back clean (2026-09-29), CSP is now enforced.
// The one report-only hit was zod's Function("") probe (from @decartai/sdk), caught
// internally and harmless, see the note below. Do not add 'unsafe-eval' to undo it.
const CSP_ENFORCE = true;
const CSP_HEADER = CSP_ENFORCE ? "Content-Security-Policy" : "Content-Security-Policy-Report-Only";

const supabaseHost = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").host;
  } catch {
    return "";
  }
})();

// fal (wss://fal.run + WebRTC), Decart (wss://api3.decart.ai, dormant while AI_PROVIDER=fal),
// Supabase (REST + a future Realtime websocket for the Phase 3 viewer count), stun:/turn: as bare
// schemes since fal/Decart hand back ICE/TURN servers on hosts we do not control ahead of time.
function buildCsp(nonce: string): string {
  const dev = process.env.NODE_ENV !== "production";
  const supabaseHttp = supabaseHost ? `https://${supabaseHost}` : "";
  const supabaseWs = supabaseHost ? `wss://${supabaseHost}` : "";
  // No 'unsafe-eval' in prod. zod (pulled in by @decartai/sdk) probes with Function("") on
  // /studio and /c/[slug] to decide whether it can JIT-compile, catches the throw itself and
  // falls back cleanly, so it works fine without this. Do not add it back for that probe.
  const scriptSrc = dev
    ? `'self' 'unsafe-eval' 'nonce-${nonce}' 'strict-dynamic'`
    : `'self' 'nonce-${nonce}' 'strict-dynamic'`;

  const directives = [
    `default-src 'self'`,
    `script-src ${scriptSrc}`,
    // Inline style="..." attributes are used throughout (FinanceView meter/bars, FinanceChart tooltip,
    // others) and render as a literal HTML attribute, which a script nonce does not cover.
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' blob: data: ${supabaseHttp}`,
    `font-src 'self'`, // next/font self-hosts Poppins/JetBrains Mono, no external font host needed
    `connect-src 'self' ${supabaseHttp} ${supabaseWs} wss://fal.run https://api.decart.ai https://api3.decart.ai wss://api3.decart.ai stun: turn:`,
    `worker-src 'self' blob:`,
    `media-src 'self' blob:`,
    `object-src 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `frame-ancestors 'none'`,
  ];
  if (!dev) directives.push("upgrade-insecure-requests");
  return directives.join("; ");
}

export async function proxy(request: NextRequest) {
  const nonce = crypto.randomUUID();
  request.headers.set("x-nonce", nonce);
  const csp = buildCsp(nonce);

  let response = NextResponse.next({ request });
  response.headers.set(CSP_HEADER, csp);

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return response; // not configured yet, let pages show the setup message

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        response.headers.set(CSP_HEADER, csp);
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        Object.entries(headers ?? {}).forEach(([k, v]) => response.headers.set(k, v));
      },
    },
  });

  const { data } = await supabase.auth.getClaims();
  const signedIn = !!data?.claims?.sub;
  const path = request.nextUrl.pathname;

  if (!signedIn && PRIVATE_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`))) {
    const to = request.nextUrl.clone();
    to.pathname = "/login";
    to.search = `?next=${encodeURIComponent(path)}`;
    const redirect = NextResponse.redirect(to);
    redirect.headers.set(CSP_HEADER, csp);
    return redirect;
  }

  if (signedIn && (path === "/login" || path === "/signup")) {
    const to = request.nextUrl.clone();
    to.pathname = "/studio";
    to.search = "";
    const redirect = NextResponse.redirect(to);
    redirect.headers.set(CSP_HEADER, csp);
    return redirect;
  }

  return response;
}

export const config = {
  matcher: [
    // Skip static files, images and API routes (API routes check auth themselves).
    "/((?!_next/static|_next/image|api/|favicon.ico|icon.svg|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico)$).*)",
  ],
};
