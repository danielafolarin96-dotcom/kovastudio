"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createDecartClient, type RealTimeSubscribeClient } from "@decartai/sdk";
import Logo from "@/components/Logo";
import { WATERMARK_TEXT } from "@/lib/config";

type ChannelInfo =
  | { live: false; hostName: string }
  | {
      live: true;
      hostName: string;
      sessionId: string;
      subscribeToken: string;
      watermark: boolean;
      characterName: string | null;
    };

type Phase = "checking" | "offline" | "connecting" | "live" | "missing";

// Public channel page. Also used as the OBS browser source (?obs=1): video only, transparent background.
export default function Viewer({ slug, hostName, obs }: { slug: string; hostName: string; obs: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const subRef = useRef<RealTimeSubscribeClient | null>(null);
  const sessionRef = useRef<string | null>(null);

  const [phase, setPhase] = useState<Phase>("checking");
  const [info, setInfo] = useState<ChannelInfo | null>(null);
  const [hasAudio, setHasAudio] = useState(false);
  const [muted, setMuted] = useState(true);

  // Transparent page for OBS.
  useEffect(() => {
    if (!obs) return;
    const html = document.documentElement;
    const prev = [html.style.background, document.body.style.background];
    html.style.background = "transparent";
    document.body.style.background = "transparent";
    return () => {
      html.style.background = prev[0];
      document.body.style.background = prev[1];
    };
  }, [obs]);

  useEffect(() => {
    let stopped = false;
    let timer: number | undefined;

    const disconnect = () => {
      try {
        subRef.current?.disconnect();
      } catch {
        /* already closed */
      }
      subRef.current = null;
      sessionRef.current = null;
      if (videoRef.current) videoRef.current.srcObject = null;
      setHasAudio(false);
    };

    const subscribe = async (data: Extract<ChannelInfo, { live: true }>) => {
      disconnect();
      sessionRef.current = data.sessionId;
      setPhase("connecting");
      try {
        const client = createDecartClient({ proxy: `${window.location.origin}/api/decart`, telemetry: false });
        const sub = await client.realtime.subscribe({
          token: data.subscribeToken,
          onRemoteStream: (stream) => {
            const el = videoRef.current;
            if (!el) return;
            el.srcObject = stream;
            setHasAudio(stream.getAudioTracks().length > 0);
            el.play().catch(() => {});
            setPhase("live");
          },
        });
        if (stopped || sessionRef.current !== data.sessionId) {
          sub.disconnect();
          return;
        }
        subRef.current = sub;
        sub.on("connectionChange", (s) => {
          if (subRef.current !== sub) return;
          if (s === "disconnected") {
            disconnect();
            setPhase("offline");
          }
        });
      } catch {
        if (sessionRef.current === data.sessionId) {
          disconnect();
          setPhase("offline");
        }
      }
    };

    const check = async () => {
      if (stopped) return;
      try {
        const res = await fetch(`/api/channel/${slug}`, { cache: "no-store" });
        if (res.status === 404) {
          setPhase("missing");
          return; // stop polling: the link was reset
        }
        if (res.ok) {
          const data = (await res.json()) as ChannelInfo;
          setInfo(data);
          if (data.live) {
            if (sessionRef.current !== data.sessionId) await subscribe(data);
          } else if (sessionRef.current) {
            disconnect();
            setPhase("offline");
          } else {
            setPhase("offline");
          }
        }
      } catch {
        /* network blip, try again */
      }
      if (!stopped) timer = window.setTimeout(check, sessionRef.current ? 15_000 : 5_000);
    };

    void check();
    return () => {
      stopped = true;
      if (timer) window.clearTimeout(timer);
      disconnect();
    };
  }, [slug]);

  const showWatermark = info?.live === true && info.watermark && phase === "live";
  const unmute = () => {
    const el = videoRef.current;
    if (!el) return;
    el.muted = false;
    setMuted(false);
    el.play().catch(() => {});
  };

  const video = (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      muted={muted}
      className={`absolute inset-0 h-full w-full object-contain ${phase === "live" ? "opacity-100" : "opacity-0"}`}
    />
  );

  const bug = showWatermark && (
    <div className="absolute bottom-[3%] right-[2%] z-10 flex items-center gap-2 rounded-full bg-black/60 px-3.5 py-2 text-[clamp(10px,1.6vw,15px)] font-semibold tracking-wide text-white backdrop-blur">
      <span className="h-2 w-2 rounded-full bg-signal" />
      {WATERMARK_TEXT}
    </div>
  );

  if (obs) {
    return (
      <div className="fixed inset-0 overflow-hidden bg-transparent">
        {video}
        {bug}
      </div>
    );
  }

  const isLive = phase === "live";

  return (
    <div className="glow-page flex min-h-screen flex-col">
      <header className="flex items-center justify-between gap-4 px-5 py-4">
        <Logo />
        <Link href="/signup" className="btn btn-signal px-5 py-2.5 text-sm">
          Go live yourself
        </Link>
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 py-6 sm:px-6 sm:py-10">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[linear-gradient(180deg,#ff4358,#c10f25)] text-xl font-bold">
              {(info?.hostName ?? hostName).slice(0, 1).toUpperCase()}
            </span>
            <div>
              <p className="text-sm text-mute">Channel</p>
              <h1 className="display text-2xl sm:text-3xl">{info?.hostName ?? hostName}</h1>
            </div>
          </div>
          <span
            className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold ${
              isLive ? "bg-signal text-white shadow-[0_0_30px_rgb(239_29_53/0.6)]" : "border border-line bg-surface text-soft"
            }`}
          >
            <span className={`h-2 w-2 rounded-full ${isLive ? "tally bg-white" : "bg-mute"}`} />
            {isLive ? "Live" : phase === "connecting" ? "Tuning in" : "Offline"}
          </span>
        </div>

        <div className={`rounded-[1.4rem] border p-2 ${isLive ? "border-signal/50 bg-signal/10" : "border-line bg-surface"}`}>
          <div className="relative aspect-video w-full overflow-hidden rounded-[1rem] bg-black">
            {video}
            {bug}

            {!isLive && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-surface-2 bg-[radial-gradient(30rem_16rem_at_50%_0%,rgb(163_15_34/0.35),transparent_70%)] p-6 text-center">
                {phase === "missing" ? (
                  <>
                    <p className="display text-3xl">Link expired</p>
                    <p className="mt-2 text-sm text-soft">Ask the creator for their new channel link.</p>
                  </>
                ) : phase === "connecting" || phase === "checking" ? (
                  <>
                    <span className="h-9 w-9 animate-spin rounded-full border-2 border-white/15 border-t-signal" />
                    <p className="mt-4 text-sm text-soft">{phase === "checking" ? "Checking channel" : "Tuning in"}</p>
                  </>
                ) : (
                  <>
                    <span className="chip">Standby</span>
                    <p className="display mt-4 text-3xl sm:text-4xl">Not live right now</p>
                    <p className="mt-3 text-sm text-soft">Keep this page open. It starts playing as soon as they go live.</p>
                  </>
                )}
              </div>
            )}

            {isLive && hasAudio && muted && (
              <button onClick={unmute} className="btn btn-light absolute left-3 top-3 z-10 px-4 py-2 text-sm">
                Tap for sound
              </button>
            )}
          </div>
        </div>

        {isLive && info?.live && info.characterName && (
          <p className="mt-4 text-sm text-soft">
            Now playing: <span className="font-semibold text-fg">{info.characterName}</span>
          </p>
        )}
      </main>

      <footer className="px-5 py-5 text-center text-xs text-mute">Streamed with Kova Studio. Characters are AI-generated in real time.</footer>
    </div>
  );
}
