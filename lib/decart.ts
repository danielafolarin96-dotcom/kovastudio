import "server-only";
import { createDecartClient } from "@decartai/sdk";
import { env } from "@/lib/env";
import { MODEL_NAME } from "@/lib/config";

// Creates a short-lived Decart key for one live session.
// The browser gets this key, never DECART_API_KEY itself.
export async function createSessionToken(opts: { sessionSeconds: number; sessionId: string; userId: string }) {
  const client = createDecartClient({ apiKey: env.decartApiKey, telemetry: false });
  const token = await client.tokens.create({
    // Must outlive the session so the SDK can reconnect after a network blip.
    expiresIn: Math.min(3600, opts.sessionSeconds + 60),
    allowedModels: [MODEL_NAME],
    allowedOrigins: env.allowedOrigins,
    constraints: { realtime: { maxSessionDuration: opts.sessionSeconds } },
    metadata: { app: "kovastudio", session_id: opts.sessionId, user_id: opts.userId },
  });
  return token.apiKey;
}

// Decart's viewer endpoint. Viewers never get a Decart key: our server calls this for them.
export const DECART_WATCH_BASE = "https://api3.decart.ai";

// The subscribe token Decart gives the broadcaster is base64 JSON holding the room name.
export function roomFromSubscribeToken(token: string): string | null {
  try {
    const payload = JSON.parse(Buffer.from(token, "base64").toString("utf8")) as { room_name?: unknown };
    return typeof payload.room_name === "string" && payload.room_name.length > 0 && payload.room_name.length < 200
      ? payload.room_name
      : null;
  } catch {
    return null;
  }
}
