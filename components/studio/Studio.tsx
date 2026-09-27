"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { models, resolveFpsNumber } from "@decartai/sdk";
import { startEngine, type EngineQuality, type EngineSession, type EngineState, type ProviderAuth } from "@/lib/live";
import Logo from "@/components/Logo";
import Gallery from "@/components/studio/Gallery";
import {
  IconBolt,
  IconBroadcast,
  IconCamera,
  IconCheck,
  IconDrop,
  IconExpand,
  IconImage,
  IconLink,
  IconMic,
  IconMonitor,
  IconRecord,
  IconShield,
  IconStop,
  IconSwap,
  IconUpload,
  IconWallet,
} from "@/components/Icons";
import {
  copyText,
  cameraErrorText,
  describeError,
  drawWatermark,
  endReasonText,
  fileStamp,
  pickRecorderMime,
  readPref,
  writePref,
} from "@/components/studio/util";
import { HEARTBEAT_MS, MODEL_NAME, buildPrompt, formatClock, formatDuration } from "@/lib/config";
import { prepareFromUrl, prepareReferenceImage, type PreparedImage } from "@/lib/image";
import type { PresetCard, StudioAccount } from "@/lib/types";

const model = models.realtime(MODEL_NAME);
const MODEL_FPS = resolveFpsNumber(model.fps, 25);

type Status = "idle" | "starting" | EngineState;
type Bucket = "free" | "paid" | "admin";
type Character = {
  prepared: PreparedImage;
  name: string;
  source: "preset" | "upload";
  presetId: string | null;
  promptExtra: string | null;
};
type StartResponse = {
  sessionId?: string;
  apiKey?: string;
  provider?: "decart" | "fal";
  bucket?: Bucket;
  reservedSeconds?: number;
  watermark?: boolean;
  error?: string;
  code?: string;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function useIsDesktop() {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia("(min-width: 1024px)");
      mq.addEventListener("change", cb);
      return () => mq.removeEventListener("change", cb);
    },
    () => window.matchMedia("(min-width: 1024px)").matches,
    () => true,
  );
}

function promptFor(character: Character, extra: string) {
  return buildPrompt([character.promptExtra, extra.trim()].filter(Boolean).join(", "));
}

export default function Studio({ account, presets }: { account: StudioAccount; presets: PresetCard[] }) {
  const isDesktop = useIsDesktop();

  /* ----- element refs ----- */
  const cameraVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /* ----- live session refs (read from timers and SDK events) ----- */
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const engineRef = useRef<EngineSession | null>(null);
  const attemptRef = useRef(0);
  const userStopRef = useRef(-1);
  const sessionIdRef = useRef<string | null>(null);
  const secondsRef = useRef(0);
  const statusRef = useRef<Status>("idle");
  const watermarkRef = useRef(true);
  const channelOnRef = useRef(false);
  const heartbeatRef = useRef<number | null>(null);
  const stopRenderRef = useRef<(() => void) | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);

  /* ----- UI state ----- */
  const [cameraOn, setCameraOn] = useState(false);
  const [hasMic, setHasMic] = useState(false);
  const [tab, setTab] = useState<"gallery" | "upload">(presets.length ? "gallery" : "upload");
  const [character, setCharacter] = useState<Character | null>(null);
  const [loadingPreset, setLoadingPreset] = useState<string | null>(null);
  const [extra, setExtra] = useState("");
  const [consent, setConsent] = useState(false);
  const [dragging, setDragging] = useState(false);

  const [status, setStatusState] = useState<Status>("idle");
  const [hasOutput, setHasOutput] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [reserved, setReserved] = useState(0);
  const [bucket, setBucket] = useState<Bucket | null>(null);
  const [watermark, setWatermark] = useState(!(account.isAdmin || account.hasPaid));
  const [queue, setQueue] = useState<{ position: number; queueSize: number } | null>(null);
  const [quality, setQuality] = useState<EngineQuality | null>(null);
  const [appliedKey, setAppliedKey] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);

  const [showPip, setShowPip] = useState(true);
  const [recording, setRecording] = useState(false);
  const [recordStart, setRecordStart] = useState<number | null>(null);
  const [clock, setClock] = useState(0);

  const [channelOn, setChannelOn] = useState(false);
  const [channelLive, setChannelLive] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const [balances, setBalances] = useState({ free: account.freeSeconds, paid: account.paidSeconds });
  const [outOfTime, setOutOfTime] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const setStatus = useCallback((s: Status) => {
    statusRef.current = s;
    setStatusState(s);
  }, []);

  const busy = status === "starting" || status === "connecting";
  const live = status === "connected" || status === "generating" || status === "reconnecting";
  const characterKey = character ? `${character.prepared.url}|${extra.trim()}` : null;
  const dirty = live && characterKey !== null && characterKey !== appliedKey;
  const needsConsent = character?.source === "upload";
  const hasTime = account.isAdmin || balances.free > 0 || balances.paid > 0;
  const canStart = cameraOn && !!character && (!needsConsent || consent) && !busy && !live && hasTime;

  const channelSupported = account.provider === "decart";
  const channelUrl = `${account.siteUrl}/c/${account.channelSlug}`;
  const obsUrl = `${channelUrl}?obs=1`;

  // Load the saved channel preference after mount (browser storage is not available on the server).
  useEffect(() => {
    const saved = readPref("kova.channelOn", false);
    channelOnRef.current = saved;
    setChannelOn(saved);
  }, []);

  /* ================= output canvas ================= */

  const stopRenderLoop = useCallback(() => {
    stopRenderRef.current?.();
    stopRenderRef.current = null;
  }, []);

  const startRenderLoop = useCallback(() => {
    stopRenderLoop();
    const video = remoteVideoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!video || !canvas || !ctx) return;

    let active = true;
    let rafId = 0;
    const draw = () => {
      if (!active) return;
      if (video.readyState >= 2 && video.videoWidth > 0) {
        if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
        }
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        if (watermarkRef.current) drawWatermark(ctx, canvas.width, canvas.height);
      }
      rafId = requestAnimationFrame(draw);
    };
    rafId = requestAnimationFrame(draw);
    stopRenderRef.current = () => {
      active = false;
      cancelAnimationFrame(rafId);
    };
  }, [stopRenderLoop]);

  /* ================= recording ================= */

  const stopRecording = useCallback(() => {
    const rec = recorderRef.current;
    if (rec && rec.state !== "inactive") rec.stop();
  }, []);

  const startRecording = () => {
    const canvas = canvasRef.current;
    if (!canvas || !hasOutput) return;
    if (typeof MediaRecorder === "undefined") {
      setError("Recording is not supported in this browser. Use Chrome or Edge.");
      return;
    }
    const out = canvas.captureStream(30);
    const mic = cameraStreamRef.current?.getAudioTracks()[0];
    if (mic) out.addTrack(mic);

    const mimeType = pickRecorderMime();
    let recorder: MediaRecorder;
    try {
      recorder = new MediaRecorder(out, { ...(mimeType ? { mimeType } : {}), videoBitsPerSecond: 6_000_000 });
    } catch {
      out.getVideoTracks().forEach((t) => t.stop());
      setError("Recording is not supported in this browser. Use Chrome or Edge.");
      return;
    }

    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };
    recorder.onstop = () => {
      out.getVideoTracks().forEach((t) => t.stop()); // the canvas track only, never the mic
      recorderRef.current = null;
      setRecording(false);
      setRecordStart(null);
      if (!chunks.length) return;
      const type = recorder.mimeType || mimeType || "video/webm";
      const url = URL.createObjectURL(new Blob(chunks, { type }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `kovastudio-${fileStamp()}.${type.includes("mp4") ? "mp4" : "webm"}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 30_000);
    };

    recorder.start(1000);
    recorderRef.current = recorder;
    setRecording(true);
    setRecordStart(Date.now());
    setClock(Date.now());
  };

  useEffect(() => {
    if (!recording) return;
    const id = window.setInterval(() => setClock(Date.now()), 500);
    return () => window.clearInterval(id);
  }, [recording]);

  /* ================= server calls ================= */

  const postJson = (url: string, body: unknown, method = "POST", keepalive = false) =>
    fetch(url, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body), keepalive });

  const endOnServer = useCallback(async (reason: string) => {
    const id = sessionIdRef.current;
    if (!id) return;
    sessionIdRef.current = null;
    try {
      const res = await postJson("/api/session/end", { sessionId: id, seconds: secondsRef.current, reason }, "POST", true);
      const data = (await res.json().catch(() => null)) as { freeSeconds?: number; paidSeconds?: number } | null;
      if (res.ok && data) setBalances({ free: data.freeSeconds ?? 0, paid: data.paidSeconds ?? 0 });
    } catch {
      /* the server settles abandoned sessions on its own */
    }
  }, []);

  const stopHeartbeat = useCallback(() => {
    if (heartbeatRef.current !== null) window.clearInterval(heartbeatRef.current);
    heartbeatRef.current = null;
  }, []);

  /* ================= teardown ================= */

  const teardownSession = useCallback(
    (message?: string, reason = "ended") => {
      attemptRef.current += 1;
      stopHeartbeat();
      stopRecording();
      const engine = engineRef.current;
      engineRef.current = null; // attempt was bumped above, so the "disconnected" event below is ignored
      try {
        engine?.disconnect();
      } catch {
        /* already closed */
      }
      stopRenderLoop();
      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
      setHasOutput(false);
      setQueue(null);
      setQuality(null);
      setAppliedKey(null);
      setApplying(false);
      setChannelLive(false);
      setStatus("idle");
      void endOnServer(reason);
      if (message) setNotice(message);
    },
    [endOnServer, setStatus, stopHeartbeat, stopRecording, stopRenderLoop],
  );

  const teardownRef = useRef(teardownSession);
  useEffect(() => {
    teardownRef.current = teardownSession;
  }, [teardownSession]);

  const startHeartbeat = useCallback(() => {
    stopHeartbeat();
    heartbeatRef.current = window.setInterval(async () => {
      const id = sessionIdRef.current;
      if (!id) return;
      try {
        const res = await postJson("/api/session/heartbeat", {
          sessionId: id,
          seconds: secondsRef.current,
          generating: statusRef.current === "generating",
        });
        const data = (await res.json().catch(() => null)) as { ok?: boolean } | null;
        if (res.ok && data?.ok === false && sessionIdRef.current === id) {
          sessionIdRef.current = null;
          teardownRef.current("This session was closed by the server.", "server_closed");
        }
      } catch {
        /* network blip, try again next beat */
      }
    }, HEARTBEAT_MS);
  }, [stopHeartbeat]);

  // Stop billing if the tab closes or the user leaves the page.
  useEffect(() => {
    const onHide = () => {
      const id = sessionIdRef.current;
      if (id) {
        sessionIdRef.current = null;
        void postJson("/api/session/end", { sessionId: id, seconds: secondsRef.current, reason: "page_closed" }, "POST", true);
      }
      engineRef.current?.disconnect();
      engineRef.current = null;
    };
    window.addEventListener("pagehide", onHide);
    return () => {
      window.removeEventListener("pagehide", onHide);
      onHide();
      if (heartbeatRef.current !== null) window.clearInterval(heartbeatRef.current);
      if (recorderRef.current && recorderRef.current.state !== "inactive") recorderRef.current.stop();
      stopRenderRef.current?.();
      cameraStreamRef.current?.getTracks().forEach((t) => t.stop());
      cameraStreamRef.current = null;
    };
  }, []);

  // Free the preview image memory when a character is replaced.
  useEffect(() => {
    if (!character) return;
    const url = character.prepared.url;
    return () => URL.revokeObjectURL(url);
  }, [character]);

  /* ================= camera ================= */

  const enableCamera = async () => {
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("This browser cannot use a camera here. Use Chrome or Edge on a computer.");
      return;
    }
    const video: MediaTrackConstraints = {
      width: { ideal: model.width },
      height: { ideal: model.height },
      frameRate: { ideal: MODEL_FPS },
      facingMode: "user",
    };
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video, audio: { echoCancellation: true, noiseSuppression: true } });
    } catch {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video });
      } catch (err) {
        setError(cameraErrorText(err));
        return;
      }
    }
    cameraStreamRef.current = stream;
    setHasMic(stream.getAudioTracks().length > 0);
    const el = cameraVideoRef.current;
    if (el) {
      el.srcObject = stream;
      el.play().catch(() => {});
    }
    setCameraOn(true);
  };

  const disableCamera = () => {
    if (live || busy) return;
    cameraStreamRef.current?.getTracks().forEach((t) => t.stop());
    cameraStreamRef.current = null;
    if (cameraVideoRef.current) cameraVideoRef.current.srcObject = null;
    setCameraOn(false);
    setHasMic(false);
  };

  /* ================= character ================= */

  const pickPreset = async (preset: PresetCard) => {
    setError(null);
    setLoadingPreset(preset.id);
    try {
      const prepared = await prepareFromUrl(preset.imageUrl);
      setCharacter({ prepared, name: preset.name, source: "preset", presetId: preset.id, promptExtra: preset.promptExtra });
    } catch (err) {
      setError(describeError(err));
    } finally {
      setLoadingPreset(null);
    }
  };

  const pickFile = async (file: File | undefined | null) => {
    if (!file) return;
    setError(null);
    try {
      const prepared = await prepareReferenceImage(file);
      const name = file.name.replace(/\.[^.]+$/, "").slice(0, 40) || "My character";
      setCharacter({ prepared, name, source: "upload", presetId: null, promptExtra: null });
      setConsent(false);
    } catch (err) {
      setError(describeError(err));
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  /* ================= channel ================= */

  const publishChannel = useCallback(async () => {
    const engine = engineRef.current;
    const id = sessionIdRef.current;
    if (!engine || !id || !engine.supportsChannel) return;
    let token = engine.getSubscribeToken();
    for (let i = 0; !token && i < 12; i++) {
      await sleep(500);
      if (engineRef.current !== engine) return;
      token = engine.getSubscribeToken();
    }
    if (!token) {
      setError("Could not put you on your channel. Try switching it off and on.");
      return;
    }
    try {
      const res = await postJson("/api/live", { sessionId: id, subscribeToken: token });
      if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as { error?: string }).error);
      if (engineRef.current === engine) setChannelLive(true);
    } catch (err) {
      setError(describeError(err) || "Could not put you on your channel.");
    }
  }, []);

  const toggleChannel = async (on: boolean) => {
    channelOnRef.current = on;
    setChannelOn(on);
    writePref("kova.channelOn", on);
    if (!live) return;
    if (on) {
      void publishChannel();
    } else if (sessionIdRef.current) {
      await postJson("/api/live", { sessionId: sessionIdRef.current }, "DELETE").catch(() => {});
      setChannelLive(false);
    }
  };

  const copy = async (what: "channel" | "obs") => {
    const ok = await copyText(what === "channel" ? channelUrl : obsUrl);
    setCopied(ok ? what : null);
    if (ok) setTimeout(() => setCopied(null), 1600);
  };

  /* ================= go live ================= */

  const start = async () => {
    const stream = cameraStreamRef.current;
    if (!stream || !character || !canStart) return;

    setError(null);
    setNotice(null);
    setOutOfTime(false);
    setSeconds(0);
    secondsRef.current = 0;
    setQueue(null);
    setStatus("starting");

    const attempt = ++attemptRef.current;
    const key = characterKey;
    const chosen = character;
    let engine: EngineSession | null = null;

    try {
      const res = await postJson("/api/session/start", { character: chosen.name });
      const data = (await res.json().catch(() => ({}))) as StartResponse;
      const provider = data.provider ?? account.provider;
      if (!res.ok || !data.sessionId || (provider === "decart" && !data.apiKey)) {
        if (data.code === "no_time") setOutOfTime(true);
        throw new Error(data.error ?? "Could not start a session.");
      }
      sessionIdRef.current = data.sessionId;
      if (attempt !== attemptRef.current) {
        void endOnServer("cancelled");
        return;
      }

      const wm = data.watermark !== false;
      watermarkRef.current = wm;
      setWatermark(wm);
      const reservedSeconds = data.reservedSeconds ?? 0;
      setReserved(reservedSeconds);
      setBucket(data.bucket ?? null);
      setStatus("connecting");
      startHeartbeat();

      const auth: ProviderAuth =
        provider === "fal" ? { provider: "fal", sessionId: data.sessionId } : { provider: "decart", apiKey: data.apiKey! };

      // Every event checks the attempt number, so a stopped or restarted session never updates the screen.
      const current = () => attempt === attemptRef.current;
      engine = await startEngine({
        auth,
        stream,
        input: { prompt: promptFor(chosen, extra), image: chosen.prepared.blob },
        events: {
          onRemoteStream: (remote) => {
            if (!current()) return;
            const el = remoteVideoRef.current;
            if (!el) return;
            el.srcObject = remote;
            el.play().catch(() => {});
            startRenderLoop();
          },
          onState: (st) => {
            if (!current()) return;
            if (st === "disconnected") {
              teardownRef.current(userStopRef.current === attempt ? undefined : "Session ended.", "disconnected");
              return;
            }
            setStatus(st);
            if (st === "generating") {
              setQueue(null);
              if (channelOnRef.current) void publishChannel();
            }
          },
          onSeconds: (sec) => {
            if (!current()) return;
            secondsRef.current = sec;
            setSeconds(sec);
            // Our own stop for providers that do not cut the stream when paid time runs out.
            if (reservedSeconds > 0 && sec >= reservedSeconds) {
              teardownRef.current("Session hit its time limit. Press Go live to keep going.", "time_up");
            }
          },
          onQueue: (q) => {
            if (current()) setQueue(q);
          },
          onQuality: (q) => {
            if (current()) setQuality(q);
          },
          onError: (message) => {
            if (current()) setError(message);
          },
          onEnded: (reason) => {
            if (current() && userStopRef.current !== attempt) setNotice(endReasonText(reason));
          },
        },
      });

      if (!current()) {
        engine.disconnect(); // user cancelled while connecting; the server session was already closed
        return;
      }

      engineRef.current = engine;
      setAppliedKey(key);
      if (statusRef.current === "generating" && channelOnRef.current) void publishChannel();
    } catch (err) {
      if (attempt !== attemptRef.current) return;
      try {
        engine?.disconnect();
      } catch {
        /* ignore */
      }
      teardownSession(undefined, "start_failed");
      setError(describeError(err));
    }
  };

  const stop = () => {
    userStopRef.current = attemptRef.current;
    teardownSession(undefined, "user_stop");
  };

  const applyChanges = async () => {
    const engine = engineRef.current;
    if (!engine || !character) return;
    if (needsConsent && !consent) {
      setError("Tick the permission box for the new picture first.");
      return;
    }
    setApplying(true);
    setError(null);
    try {
      await engine.set({ prompt: promptFor(character, extra), image: character.prepared.blob });
      setAppliedKey(characterKey);
    } catch (err) {
      setError(describeError(err));
    } finally {
      setApplying(false);
    }
  };

  const goFullscreen = () => {
    stageRef.current?.requestFullscreen?.().catch(() => {});
  };

  /* ================= render ================= */

  if (!isDesktop) {
    return (
      <main className="glow-page flex min-h-screen flex-col p-6">
        <Logo />
        <div className="card my-auto p-7">
          <span className="icon-tile bg-signal">
            <IconMonitor />
          </span>
          <h1 className="display mt-5 text-3xl">Open the studio on a computer.</h1>
          <p className="mt-3 text-soft">
            Kova Studio needs a laptop or desktop with a webcam, in Chrome or Edge. Your viewers can still watch on their phones.
          </p>
          <Link href="/account" className="btn btn-light mt-7 w-full py-3.5 text-sm">
            Go to my account
          </Link>
        </div>
      </main>
    );
  }

  const statusInfo: Record<Status, { label: string; tone: string; blink?: boolean }> = {
    idle: { label: "Standby", tone: "bg-mute" },
    disconnected: { label: "Standby", tone: "bg-mute" },
    starting: { label: "Starting", tone: "bg-cue", blink: true },
    connecting: { label: queue ? "In line" : "Connecting", tone: "bg-cue", blink: true },
    connected: { label: "Warming up", tone: "bg-cue", blink: true },
    generating: { label: "Live", tone: "bg-signal", blink: true },
    reconnecting: { label: "Reconnecting", tone: "bg-cue", blink: true },
  };
  const st = statusInfo[status];
  const onAir = status === "generating";

  const missing: string[] = [];
  if (!cameraOn) missing.push("turn on your camera");
  if (!character) missing.push("pick a character");
  if (needsConsent && !consent) missing.push("tick the permission box");
  if (!hasTime) missing.push("buy credits in your account");

  const qualityTone =
    quality?.quality === "good" ? "text-ok" : quality?.quality === "fair" ? "text-cue" : quality ? "text-signal-2" : "text-soft";

  const pipClass = hasOutput
    ? showPip
      ? "absolute bottom-3 left-3 z-10 w-[22%] rounded-xl border border-white/25 shadow-2xl [:fullscreen_&]:hidden"
      : "hidden"
    : cameraOn
      ? "absolute inset-0 h-full w-full object-cover"
      : "hidden";

  const creditText = account.isAdmin
    ? "Unlimited"
    : balances.paid > 0
      ? `${formatDuration(balances.paid)}${balances.free > 0 ? ` + ${formatDuration(balances.free)} gift` : ""}`
      : balances.free > 0
        ? `${formatDuration(balances.free)} gift`
        : "0 credits";

  return (
    <div className="glow-page min-h-screen">
      {/* ---------- top bar ---------- */}
      <header className="sticky top-0 z-30 border-b border-line bg-night/75 backdrop-blur-xl">
        <div className="mx-auto grid h-16 max-w-[1600px] grid-cols-[1fr_auto_1fr] items-center gap-4 px-5">
          <Logo href="/" />

          <div
            className={`flex items-center gap-3 rounded-full border px-4 py-1.5 ${
              onAir ? "border-signal/50 bg-signal/15" : "border-line bg-surface"
            }`}
          >
            <span className={`h-2.5 w-2.5 rounded-full ${st.tone} ${st.blink ? "tally" : ""}`} />
            <span className="text-sm font-semibold">{st.label}</span>
            <span className="h-4 w-px bg-line-2" />
            <span className="font-mono text-sm tabular-nums">{formatClock(seconds)}</span>
            {live && reserved > 0 && (
              <span className="text-xs text-mute">{formatClock(Math.max(0, reserved - seconds))} left</span>
            )}
          </div>

          <nav className="flex items-center justify-end gap-2">
            <span className="flex items-center gap-2 rounded-full border border-line bg-surface py-1.5 pl-3 pr-1.5 text-sm">
              <IconWallet className="h-4 w-4 text-signal-2" />
              <span className="font-semibold">{creditText}</span>
              {account.isAdmin ? (
                <span className="rounded-full bg-grape/20 px-2.5 py-1 text-xs font-semibold text-[#c4b5fd]">Admin</span>
              ) : (
                <Link href="/account#buy" className="rounded-full bg-signal px-3 py-1 text-xs font-semibold text-white hover:bg-signal-2">
                  Top up
                </Link>
              )}
            </span>
            {account.isAdmin && (
              <Link href="/admin" className="btn btn-ghost px-4 py-2 text-sm">
                Admin
              </Link>
            )}
            <Link
              href="/account"
              title={account.displayName}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-[linear-gradient(180deg,#ff4358,#c10f25)] text-sm font-bold"
            >
              {account.displayName.slice(0, 1).toUpperCase()}
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto grid max-w-[1600px] gap-5 p-5 lg:grid-cols-[330px_1fr] xl:grid-cols-[330px_1fr_300px]">
        {/* ---------- character ---------- */}
        <aside className="flex flex-col gap-5">
          <Panel icon={<IconImage className="h-[18px] w-[18px]" />} tone="bg-signal" title="Character">
            <div className="mb-4 grid grid-cols-2 rounded-full bg-surface-2 p-1">
              {(["gallery", "upload"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`rounded-full py-2 text-sm font-medium transition ${
                    tab === t ? "bg-signal text-white shadow-[0_6px_20px_-6px_rgb(239_29_53/0.8)]" : "text-soft hover:text-fg"
                  }`}
                >
                  {t === "gallery" ? `Gallery (${presets.length})` : "Upload"}
                </button>
              ))}
            </div>

            {tab === "gallery" ? (
              <Gallery
                presets={presets}
                selectedId={character?.presetId ?? null}
                loadingId={loadingPreset}
                isAdmin={account.isAdmin}
                onPick={pickPreset}
              />
            ) : (
              <label
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragging(false);
                  void pickFile(e.dataTransfer.files?.[0]);
                }}
                className={`flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed px-4 py-9 text-center transition ${
                  dragging ? "border-signal bg-signal/10" : "border-line-2 bg-surface-2/60 hover:border-soft"
                }`}
              >
                <span className="icon-tile bg-signal/15 text-signal-2">
                  <IconUpload />
                </span>
                <span className="mt-3 font-semibold">Drop a picture</span>
                <span className="mt-1 text-xs text-mute">or click to browse. JPG, PNG or WebP. Clear face, one character.</span>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => void pickFile(e.target.files?.[0])}
                />
              </label>
            )}

            {character && (
              <div className="mt-4 flex items-center gap-3 rounded-2xl border border-line bg-surface-2 p-2.5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={character.prepared.url} alt="" className="h-12 w-12 flex-none rounded-xl object-cover" />
                <div className="min-w-0">
                  <p className="text-xs text-mute">{character.source === "preset" ? "From the gallery" : "Your upload"}</p>
                  <p className="truncate font-semibold">{character.name}</p>
                </div>
                <IconCheck className="ml-auto mr-1 h-5 w-5 flex-none text-ok" />
              </div>
            )}
            {character?.prepared.warning && <p className="mt-2 text-xs text-cue">{character.prepared.warning}</p>}

            <label className="mt-5 block text-sm font-medium text-soft" htmlFor="extra">
              Extra details <span className="font-normal text-mute">(optional)</span>
            </label>
            <input
              id="extra"
              value={extra}
              maxLength={200}
              onChange={(e) => setExtra(e.target.value)}
              placeholder="e.g. wearing a red cape"
              className="field field-sm mt-2"
            />

            {needsConsent && (
              <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl border border-line bg-surface-2 p-3 text-xs leading-relaxed text-soft">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                  className="mt-0.5 h-4 w-4 flex-none accent-[#ef1d35]"
                />
                <span>
                  I own this picture or have permission to use it. If it shows a real person, they agreed. I will not use it to
                  impersonate or deceive anyone.
                </span>
              </label>
            )}

            {dirty && (
              <button onClick={applyChanges} disabled={applying} className="btn btn-signal mt-4 w-full py-3 text-sm">
                <IconSwap className="h-4 w-4" />
                {applying ? "Switching..." : "Switch to this character"}
              </button>
            )}
          </Panel>
        </aside>

        {/* ---------- stage ---------- */}
        <section className="flex min-w-0 flex-col gap-4">
          {error && (
            <Banner tone="error" onClose={() => setError(null)}>
              {error}
              {outOfTime && (
                <>
                  {" "}
                  <Link href="/account#buy" className="font-semibold underline underline-offset-4">
                    Buy credits
                  </Link>
                </>
              )}
            </Banner>
          )}
          {notice && !error && (
            <Banner tone="info" onClose={() => setNotice(null)}>
              {notice}
            </Banner>
          )}

          <div
            className={`rounded-[1.4rem] border p-2 transition ${
              onAir ? "border-signal/60 bg-signal/10 shadow-[0_30px_90px_-30px_rgb(239_29_53/0.7)]" : "border-line bg-surface"
            }`}
          >
            <div ref={stageRef} className="relative aspect-video w-full overflow-hidden rounded-[1rem] bg-black">
              <canvas
                ref={canvasRef}
                className={`absolute inset-0 h-full w-full object-contain transition-opacity ${hasOutput ? "opacity-100" : "opacity-0"}`}
              />
              <video
                ref={remoteVideoRef}
                muted
                playsInline
                autoPlay
                onPlaying={() => setHasOutput(true)}
                className="pointer-events-none absolute left-0 top-0 h-px w-px opacity-0"
              />
              <video ref={cameraVideoRef} muted playsInline autoPlay className={`-scale-x-100 ${pipClass}`} />

              {/* stage chrome */}
              <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-center justify-between p-3 [:fullscreen_&]:hidden">
                <span
                  className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold backdrop-blur ${
                    onAir ? "bg-signal text-white" : "bg-black/55 text-white/85"
                  }`}
                >
                  {onAir && <span className="tally h-2 w-2 rounded-full bg-white" />}
                  {hasOutput ? "Live output" : cameraOn ? "Camera preview" : "Stage"}
                </span>
                {recording && (
                  <span className="flex items-center gap-2 rounded-full bg-black/60 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur">
                    <span className="tally h-2 w-2 rounded-full bg-signal" />
                    REC {formatClock(((recordStart ? clock - recordStart : 0) || 0) / 1000)}
                  </span>
                )}
              </div>

              {!cameraOn && !hasOutput && (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-surface-2 bg-[radial-gradient(30rem_16rem_at_50%_0%,rgb(163_15_34/0.35),transparent_70%)] text-center">
                  <span className="icon-tile h-14 w-14 rounded-2xl bg-signal shadow-[0_10px_40px_-8px_rgb(239_29_53/0.9)]">
                    <IconCamera className="h-6 w-6" />
                  </span>
                  <p className="mt-5 text-xl font-bold">Your camera is off</p>
                  <p className="mt-1.5 max-w-xs text-sm text-mute">Chrome or Edge. Your video goes to the AI only while you are live.</p>
                  <button onClick={enableCamera} className="btn btn-signal mt-6 px-7 py-3 text-sm">
                    Turn on camera
                  </button>
                </div>
              )}

              {(busy || (live && !hasOutput)) && (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/65 backdrop-blur-sm">
                  <span className="h-9 w-9 animate-spin rounded-full border-2 border-white/15 border-t-signal" />
                  <p className="mt-4 text-sm font-medium text-white/90">
                    {queue
                      ? `You are number ${queue.position} of ${queue.queueSize} in line`
                      : status === "starting"
                        ? "Starting your session"
                        : "Warming up the AI"}
                  </p>
                </div>
              )}

              {status === "reconnecting" && hasOutput && (
                <div className="absolute left-1/2 top-3 z-20 -translate-x-1/2 rounded-full bg-cue px-3.5 py-1.5 text-xs font-semibold text-black">
                  Reconnecting
                </div>
              )}
            </div>
          </div>

          {/* controls */}
          <div className="card flex flex-wrap items-center gap-3 p-3">
            {!live && !busy && (
              <button
                onClick={start}
                disabled={!canStart}
                className="btn btn-signal px-9 py-3.5 text-base disabled:bg-none disabled:bg-surface-3 disabled:text-mute disabled:shadow-none"
              >
                <IconBroadcast className="h-5 w-5" /> Go live
              </button>
            )}
            {busy && (
              <button onClick={stop} className="btn btn-line px-7 py-3.5 text-sm">
                Cancel
              </button>
            )}
            {live && (
              <>
                <button onClick={stop} className="btn btn-light px-7 py-3.5 text-sm">
                  <IconStop className="h-4 w-4" /> End
                </button>
                <button
                  onClick={recording ? stopRecording : startRecording}
                  disabled={!hasOutput}
                  className={`btn px-6 py-3.5 text-sm ${recording ? "btn-signal" : "btn-line"}`}
                >
                  <IconRecord className={`h-4 w-4 ${recording ? "" : "text-signal-2"}`} />
                  {recording ? "Stop recording" : "Record"}
                </button>
                <button onClick={goFullscreen} disabled={!hasOutput} className="btn btn-line px-5 py-3.5 text-sm">
                  <IconExpand className="h-4 w-4" /> Fullscreen
                </button>
              </>
            )}

            <div className="ml-auto flex items-center gap-4 pr-2 text-sm text-soft">
              {hasOutput && <Toggle checked={showPip} onChange={setShowPip} label="Show my cam" />}
              {cameraOn && !live && !busy && (
                <button onClick={disableCamera} className="btn btn-ghost px-3 py-2 text-sm">
                  Camera off
                </button>
              )}
            </div>
          </div>

          {!live && !busy && missing.length > 0 && <p className="px-1 text-sm text-mute">To go live, {missing.join(", ")}.</p>}

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat icon={<IconShield className="h-4 w-4" />} label="Plan" value={account.isAdmin ? "Admin" : account.hasPaid ? "Paid" : "Free"} />
            <Stat
              icon={<IconDrop className="h-4 w-4" />}
              label="Watermark"
              value={watermark ? "On" : "Off"}
              tone={watermark ? "text-cue" : "text-ok"}
            />
            <Stat
              icon={<IconBolt className="h-4 w-4" />}
              label="Connection"
              value={quality ? `${quality.quality}${quality.fps ? ` ${Math.round(quality.fps)}fps` : ""}` : "N/A"}
              tone={qualityTone}
            />
            <Stat icon={<IconMic className="h-4 w-4" />} label="Mic" value={cameraOn ? (hasMic ? "On" : "None") : "N/A"} />
          </div>
          {watermark && !account.isAdmin && (
            <p className="px-1 text-xs text-mute">
              Gift time carries the Kova Studio mark in the corner of your video and recordings. Any paid credit pack removes it for good.
            </p>
          )}
          {bucket && live && <span className="sr-only">Using {bucket} time</span>}
        </section>

        {/* ---------- output ---------- */}
        <aside className="flex flex-col gap-5 lg:col-start-2 xl:col-start-auto">
          {channelSupported ? (
            <>
              <Panel icon={<IconLink className="h-[18px] w-[18px]" />} tone="bg-ok" title="Your channel">
                <Toggle checked={channelOn} onChange={(v) => void toggleChannel(v)} label="Broadcast to my channel link" large />
                <p className="mt-2 flex items-center gap-2 text-xs text-mute">
                  <span className={`h-2 w-2 rounded-full ${channelLive ? "tally bg-signal" : "bg-line-2"}`} />
                  {channelLive ? "Viewers can watch you now" : channelOn ? "Goes live when you do" : "Off. Only you can see your stream."}
                </p>

                <LinkRow label="Watch link" url={channelUrl} copied={copied === "channel"} onCopy={() => void copy("channel")} />
                <LinkRow label="OBS browser source" url={obsUrl} copied={copied === "obs"} onCopy={() => void copy("obs")} />
                <p className="mt-3 text-xs leading-relaxed text-mute">
                  Anyone with the link can watch while you are live. Reset it any time in your account.
                </p>
              </Panel>

              <Panel icon={<IconBroadcast className="h-[18px] w-[18px]" />} tone="bg-sky" title="Stream anywhere">
                <Steps
                  items={[
                    "Turn on the channel switch above.",
                    "In OBS: Sources, +, Browser.",
                    "Paste the OBS link. Width 1280, height 720.",
                    "Go live here, then stream from OBS to TikTok, YouTube or Twitch.",
                  ]}
                />
              </Panel>
            </>
          ) : (
            <Panel icon={<IconBroadcast className="h-[18px] w-[18px]" />} tone="bg-sky" title="Stream anywhere">
              <Steps
                items={[
                  "Go live here and press Fullscreen, or untick \"Show my cam\".",
                  "In OBS: Sources, +, Window Capture, pick this browser window.",
                  "Crop to the video (hold Alt and drag the edges).",
                  "Stream from OBS to TikTok, YouTube or Twitch. For Zoom or Discord, press Start Virtual Camera in OBS.",
                ]}
              />
              <p className="mt-4 rounded-xl bg-surface-2 px-3 py-2.5 text-xs leading-relaxed text-mute">
                Your personal watch link and one-paste OBS source are coming soon.
              </p>
            </Panel>
          )}

          <Panel icon={<IconRecord className="h-[18px] w-[18px]" />} tone="bg-cue" title="Recordings">
            <p className="text-sm leading-relaxed text-mute">
              Press Record while live. The video saves to your Downloads with your mic audio. Keep this tab in front while live.
            </p>
          </Panel>
        </aside>
      </main>
    </div>
  );
}

/* ================= small pieces ================= */

function Panel({ icon, tone, title, children }: { icon: React.ReactNode; tone: string; title: string; children: React.ReactNode }) {
  return (
    <section className="card p-5">
      <header className="mb-4 flex items-center gap-3">
        <span className={`icon-tile h-9 w-9 rounded-xl ${tone}`}>{icon}</span>
        <h2 className="font-bold">{title}</h2>
      </header>
      {children}
    </section>
  );
}

function Steps({ items }: { items: string[] }) {
  return (
    <ol className="space-y-3">
      {items.map((t, i) => (
        <li key={t} className="flex gap-3 text-sm leading-relaxed text-soft">
          <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-surface-3 text-xs font-bold text-fg">
            {i + 1}
          </span>
          {t}
        </li>
      ))}
    </ol>
  );
}

function Toggle({
  checked,
  onChange,
  label,
  large,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  large?: boolean;
}) {
  return (
    <label className={`flex cursor-pointer items-center gap-2.5 ${large ? "text-sm font-semibold text-fg" : ""}`}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 flex-none rounded-full transition ${checked ? "bg-signal" : "bg-surface-3"}`}
      >
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${checked ? "left-[22px]" : "left-0.5"}`} />
      </button>
      {label}
    </label>
  );
}

function LinkRow({ label, url, copied, onCopy }: { label: string; url: string; copied: boolean; onCopy: () => void }) {
  return (
    <div className="mt-4">
      <p className="mb-1.5 text-xs text-mute">{label}</p>
      <div className="flex gap-2">
        <input readOnly value={url} className="field field-sm min-w-0 flex-1 font-mono text-xs" onFocus={(e) => e.target.select()} />
        <button onClick={onCopy} className="btn btn-light w-16 flex-none text-xs">
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}

function Stat({ icon, label, value, tone = "text-fg" }: { icon: React.ReactNode; label: string; value: string; tone?: string }) {
  return (
    <div className="card flex items-center gap-3 rounded-2xl px-4 py-3">
      <span className="flex h-8 w-8 flex-none items-center justify-center rounded-lg bg-surface-3 text-soft">{icon}</span>
      <div className="min-w-0">
        <p className="text-xs text-mute">{label}</p>
        <p className={`truncate text-sm font-semibold capitalize ${tone}`}>{value}</p>
      </div>
    </div>
  );
}

function Banner({ tone, children, onClose }: { tone: "error" | "info"; children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      className={`flex items-start justify-between gap-4 rounded-2xl border px-4 py-3 text-sm ${
        tone === "error" ? "border-signal/40 bg-signal/10 text-[#ffc9cf]" : "border-cue/30 bg-cue/10 text-[#ffe2a8]"
      }`}
    >
      <p>{children}</p>
      <button onClick={onClose} aria-label="Dismiss" className="text-xs font-semibold text-white/60 hover:text-white">
        Close
      </button>
    </div>
  );
}
