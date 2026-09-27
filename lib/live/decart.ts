"use client";

import { createDecartClient, models } from "@decartai/sdk";
import { MODEL_NAME } from "@/lib/config";
import type { EngineEvents, EngineInput, EngineSession } from "@/lib/live/types";

const model = models.realtime(MODEL_NAME);

function messageOf(err: unknown): string {
  const map: Record<string, string> = {
    INVALID_API_KEY: "The session key was rejected. Refresh the page and try again.",
    WEB_RTC_ERROR: "Video connection failed. Check your internet, turn off any VPN, and try again.",
    MODEL_NOT_FOUND: "The AI model is not available right now. Try again later.",
    INVALID_INPUT: "The AI could not use that picture. Try a clearer, front-facing image.",
  };
  if (err && typeof err === "object") {
    const e = err as { code?: string; message?: string };
    if (e.code && map[e.code]) return map[e.code];
    if (e.message) return e.message;
  }
  return "Something went wrong with the AI connection.";
}

// Lucy 2.5 straight from Decart. Session length is capped by the token our server made.
export async function startDecart(opts: {
  apiKey: string;
  stream: MediaStream;
  input: EngineInput;
  events: EngineEvents;
}): Promise<EngineSession> {
  const { events } = opts;
  const client = createDecartClient({ apiKey: opts.apiKey, telemetry: false });

  const rt = await client.realtime.connect(opts.stream, {
    model,
    mirror: false, // viewers and recordings see you the right way round
    onRemoteStream: events.onRemoteStream,
    onQueuePosition: (q) => events.onQueue?.(q),
    initialState: {
      prompt: { text: opts.input.prompt, enhance: true },
      image: opts.input.image,
    },
  });

  rt.on("connectionChange", (s) => events.onState(s));
  rt.on("generationTick", ({ seconds }) => events.onSeconds(seconds));
  rt.on("sessionEnded", ({ reason }) => events.onEnded(reason));
  rt.on("error", (e) => events.onError(messageOf(e)));
  rt.on("connectionQuality", (r) => events.onQuality?.({ quality: r.quality, fps: r.metrics.fps }));

  events.onState(rt.getConnectionState());

  return {
    provider: "decart",
    supportsChannel: true,
    set: (input) => rt.set({ prompt: input.prompt, image: input.image, enhance: true }),
    disconnect: () => {
      try {
        rt.disconnect();
      } catch {
        /* already closed */
      }
    },
    getSubscribeToken: () => rt.getSubscribeToken(),
  };
}
