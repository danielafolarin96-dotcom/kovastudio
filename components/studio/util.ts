import { WATERMARK_TEXT } from "@/lib/config";

const ERROR_TEXT: Record<string, string> = {
  INVALID_API_KEY: "The session key was rejected. Refresh the page and try again.",
  WEB_RTC_ERROR: "Video connection failed. Check your internet, turn off any VPN, and try again.",
  MODEL_NOT_FOUND: "The AI model is not available right now. Try again later.",
  INVALID_INPUT: "The AI could not use that picture. Try a clearer, front-facing image.",
};

export function describeError(err: unknown): string {
  if (err && typeof err === "object") {
    const e = err as { code?: string; message?: string };
    if (e.code && ERROR_TEXT[e.code]) return ERROR_TEXT[e.code];
    if (e.message) return e.message;
  }
  return "Something went wrong. Try again.";
}

export function cameraErrorText(err: unknown): string {
  const name = err && typeof err === "object" && "name" in err ? String((err as { name: string }).name) : "";
  if (name === "NotAllowedError") return "Camera access was blocked. Click the camera icon in the address bar, allow it, then try again.";
  if (name === "NotFoundError") return "No camera found. Plug one in and try again.";
  if (name === "NotReadableError") return "Your camera is busy in another app (Zoom, OBS, Teams). Close it and try again.";
  return "Could not start the camera. Try again.";
}

export function endReasonText(reason: string): string {
  if (/duration|limit|time|expire/i.test(reason)) return "Session hit its time limit. Press Go live to keep going.";
  if (/balance|credit|quota|payment/i.test(reason)) return "The studio is out of AI credit right now. Try again later.";
  return `The session was ended by the server (${reason}).`;
}

export function pickRecorderMime(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  const options = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm", "video/mp4"];
  return options.find((t) => MediaRecorder.isTypeSupported(t));
}

export function fileStamp(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

// Bottom-right "bug", like a TV channel logo.
export function drawWatermark(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const size = Math.max(13, Math.round(h * 0.026));
  ctx.save();
  ctx.font = `600 ${size}px Poppins, ui-sans-serif, system-ui, sans-serif`;
  ctx.textBaseline = "middle";
  const padX = size * 0.9;
  const dot = size * 0.32;
  const textW = ctx.measureText(WATERMARK_TEXT).width;
  const boxW = textW + padX * 2 + dot * 2 + size * 0.5;
  const boxH = size * 2.1;
  const x = w - boxW - size;
  const y = h - boxH - size;
  ctx.fillStyle = "rgba(7, 6, 10, 0.68)";
  ctx.beginPath();
  if (typeof ctx.roundRect === "function") ctx.roundRect(x, y, boxW, boxH, boxH / 2);
  else ctx.rect(x, y, boxW, boxH);
  ctx.fill();
  ctx.fillStyle = "#ef1d35";
  ctx.beginPath();
  ctx.arc(x + padX + dot, y + boxH / 2, dot, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(255, 255, 255, 0.95)";
  ctx.fillText(WATERMARK_TEXT, x + padX + dot * 2 + size * 0.5, y + boxH / 2 + 1);
  ctx.restore();
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function readPref(key: string, fallback: boolean): boolean {
  try {
    const v = window.localStorage.getItem(key);
    return v === null ? fallback : v === "1";
  } catch {
    return fallback;
  }
}

export function writePref(key: string, value: boolean) {
  try {
    window.localStorage.setItem(key, value ? "1" : "0");
  } catch {
    /* storage blocked */
  }
}
