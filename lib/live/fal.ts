"use client";

import { createFalClient } from "@fal-ai/client";
import type { EngineEvents, EngineInput, EngineSession, EngineState } from "@/lib/live/types";

// Lucy 2.5 through fal.ai.
// fal opens a WebSocket for signaling, then the video itself flows over WebRTC:
//   we send the first input (prompt + character) -> fal says "ready" (with ICE servers)
//   -> we send an "offer" -> fal sends an "answer" -> both sides swap "icecandidate" messages.
// Later prompt / character changes are sent over the same WebSocket.

export const FAL_ENDPOINT = "decart/lucy-2-5/realtime";

const FALLBACK_ICE: RTCIceServer[] = [{ urls: "stun:stun.l.google.com:19302" }];
const NEGOTIATION_TIMEOUT_MS = 25_000;
const ICE_GRACE_MS = 1_000;

type Signal = {
  type?: string;
  sdp?: string;
  candidate?: RTCIceCandidateInit;
  iceServers?: RTCIceServer[];
  ice_servers?: RTCIceServer[];
  iceservers?: RTCIceServer[];
  error?: unknown;
  message?: string;
};

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read the character image."));
    reader.readAsDataURL(blob);
  });
}

async function fetchToken(sessionId: string): Promise<string> {
  const res = await fetch("/api/fal/token", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ sessionId }),
  });
  const data = (await res.json().catch(() => ({}))) as { token?: string; error?: string };
  if (!res.ok || !data.token) throw new Error(data.error ?? "Could not get an AI token.");
  return data.token;
}

export async function startFal(opts: {
  sessionId: string;
  stream: MediaStream;
  input: EngineInput;
  events: EngineEvents;
}): Promise<EngineSession> {
  const { events, stream } = opts;
  const fal = createFalClient();
  const firstImage = await blobToDataUrl(opts.input.image);

  let pc: RTCPeerConnection | null = null;
  let answered = false;
  let settled = false;
  let closed = false;
  let remoteSent = false;
  let state: EngineState = "connecting";
  let seconds = 0;
  let tick: number | undefined;
  let iceTimer: number | undefined;
  const pending: RTCIceCandidateInit[] = [];

  const setState = (s: EngineState) => {
    if (state === s) return;
    state = s;
    events.onState(s);
    if (s === "generating" && tick === undefined) {
      tick = window.setInterval(() => {
        if (state === "generating") {
          seconds += 1;
          events.onSeconds(seconds);
        }
      }, 1000);
    }
  };

  type Message = Record<string, unknown>;
  // eslint-disable-next-line prefer-const
  let conn: { send: (m: Message) => void; close: () => void } | undefined;

  const cleanup = () => {
    closed = true;
    window.clearInterval(tick);
    window.clearTimeout(iceTimer);
    try {
      conn?.close();
    } catch {
      /* ignore */
    }
    try {
      pc?.close();
    } catch {
      /* ignore */
    }
    pc = null;
  };

  return new Promise<EngineSession>((resolve, reject) => {
    const session: EngineSession = {
      provider: "fal",
      supportsChannel: false,
      set: async (input) => {
        if (closed) throw new Error("The session has ended.");
        const url = await blobToDataUrl(input.image);
        conn?.send({ prompt: input.prompt, reference_image_url: url, enable_prompt_expansion: true });
      },
      disconnect: () => {
        if (closed) return;
        cleanup();
        setState("disconnected");
      },
      getSubscribeToken: () => null,
    };

    const timeout = window.setTimeout(() => {
      fail(new Error("The AI did not answer in time. Try again in a moment."));
    }, NEGOTIATION_TIMEOUT_MS);

    const finish = () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      resolve(session);
    };

    const fail = (err: Error) => {
      if (closed) return;
      if (!settled) {
        settled = true;
        window.clearTimeout(timeout);
        cleanup();
        reject(err);
        return;
      }
      events.onError(err.message);
      cleanup();
      setState("disconnected");
    };

    const createPeer = async (iceServers?: RTCIceServer[]) => {
      if (pc || closed) return;
      const peer = new RTCPeerConnection({ iceServers: iceServers?.length ? iceServers : FALLBACK_ICE });
      pc = peer;
      stream.getTracks().forEach((t) => peer.addTrack(t, stream));

      peer.ontrack = (e) => {
        if (remoteSent) return;
        remoteSent = true;
        events.onRemoteStream(e.streams[0] ?? new MediaStream([e.track]));
        if (peer.connectionState === "connected") setState("generating");
      };
      peer.onicecandidate = (e) => {
        if (!e.candidate) return;
        conn?.send({
          type: "icecandidate",
          candidate: { candidate: e.candidate.candidate, sdpMid: e.candidate.sdpMid, sdpMLineIndex: e.candidate.sdpMLineIndex },
        });
      };
      peer.onconnectionstatechange = () => {
        const cs = peer.connectionState;
        if (cs === "connected") setState(remoteSent ? "generating" : "connected");
        else if (cs === "disconnected") setState("reconnecting");
        else if (cs === "failed") fail(new Error("Video connection failed. Check your internet, turn off any VPN, and try again."));
        else if (cs === "closed" && !closed) {
          cleanup();
          setState("disconnected");
        }
      };

      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      if (!offer.sdp) throw new Error("Could not start the video connection.");
      conn?.send({ type: "offer", sdp: offer.sdp });
    };

    const onSignal = async (msg: Signal) => {
      if (closed || !msg || typeof msg !== "object") return;
      const type = String(msg.type ?? "").toLowerCase();
      const ice = msg.iceServers ?? msg.ice_servers ?? msg.iceservers;
      switch (type) {
        case "ready":
          if (ice) await createPeer(ice);
          else iceTimer = window.setTimeout(() => void createPeer().catch((e) => fail(e as Error)), ICE_GRACE_MS);
          break;
        case "iceservers":
          window.clearTimeout(iceTimer);
          await createPeer(ice);
          break;
        case "answer":
          if (!pc || !msg.sdp || answered) return;
          answered = true;
          await pc.setRemoteDescription({ type: "answer", sdp: msg.sdp });
          for (const c of pending.splice(0)) await pc.addIceCandidate(c);
          finish();
          break;
        case "icecandidate":
          if (!msg.candidate) return;
          if (pc && answered) await pc.addIceCandidate(msg.candidate);
          else pending.push(msg.candidate);
          break;
        case "stream_exhausted":
          events.onEnded("stream_exhausted");
          cleanup();
          setState("disconnected");
          break;
        case "error":
          fail(new Error(typeof msg.message === "string" ? msg.message : "The AI reported an error."));
          break;
        default:
          // "configured", status updates and anything new: ignore.
          break;
      }
    };

    conn = fal.realtime.connect<Message, Signal>(FAL_ENDPOINT, {
      connectionKey: `kova-${crypto.randomUUID()}`,
      throttleInterval: 0,
      tokenProvider: () => fetchToken(opts.sessionId),
      onResult: (msg: Signal) => {
        onSignal(msg).catch((e) => fail(e instanceof Error ? e : new Error(String(e))));
      },
      onError: (err) => {
        const message = err?.message || "Could not reach the AI.";
        if (!settled) fail(new Error(message));
        // After the video is flowing, the peer connection state decides if we are still live.
      },
    });

    // First message: what to become. Queued until the socket opens.
    conn.send({ prompt: opts.input.prompt, reference_image_url: firstImage, enable_prompt_expansion: true });
    events.onState("connecting");
  });
}
