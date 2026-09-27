"use client";

import type { AiProvider, EngineEvents, EngineInput, EngineSession } from "@/lib/live/types";

export type { AiProvider, EngineEvents, EngineInput, EngineSession, EngineState, EngineQuality } from "@/lib/live/types";

// What /api/session/start hands back, per provider.
export type ProviderAuth = { provider: "decart"; apiKey: string } | { provider: "fal"; sessionId: string };

// Starts a live Lucy 2.5 session with whichever provider the server picked.
// Providers are loaded on demand so the studio only downloads the one it uses.
export async function startEngine(opts: {
  auth: ProviderAuth;
  stream: MediaStream;
  input: EngineInput;
  events: EngineEvents;
}): Promise<EngineSession> {
  if (opts.auth.provider === "fal") {
    const { startFal } = await import("@/lib/live/fal");
    return startFal({ sessionId: opts.auth.sessionId, stream: opts.stream, input: opts.input, events: opts.events });
  }
  const { startDecart } = await import("@/lib/live/decart");
  return startDecart({ apiKey: opts.auth.apiKey, stream: opts.stream, input: opts.input, events: opts.events });
}

export function providerLabel(p: AiProvider): string {
  return p === "fal" ? "fal.ai" : "Decart";
}
