// App-wide settings shared by the server and the browser.

export const APP_NAME = "Kova Studio";

// Burned into free users' video, recordings and channel stream.
export const WATERMARK_TEXT = "KOVA STUDIO | AI";

// Decart realtime model used for the character swap.
export const MODEL_NAME = "lucy-2.5" as const;

// Decart list price for Lucy 2.5 realtime at 720p, in USD per second.
export const COST_PER_SECOND_USD = 0.02;

// Reference image rules.
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
export const MIN_IMAGE_SIDE = 256;
export const RECOMMENDED_IMAGE_SIDE = 512;
export const MAX_IMAGE_SIDE = 1024;

// How often the studio reports usage to the server while live.
export const HEARTBEAT_MS = 10_000;

// Studio background field cap. The combined prompt still hard-caps at 200 chars below.
export const MAX_BACKGROUND_CHARS = 150;

// Decart's recommended prompt for reference-image character swaps.
export function buildPrompt(
  presetExtra: string | null | undefined,
  background: string | null | undefined,
  details: string | null | undefined,
): string {
  const base = "Transform into this character";
  const bg = (background ?? "").trim();
  const segments = [presetExtra, bg ? `background: ${bg}` : null, details]
    .map((s) => (s ?? "").trim())
    .filter(Boolean);
  const cleaned = segments.join(", ").replace(/\s+/g, " ").slice(0, 200);
  return cleaned ? `${base}, ${cleaned}` : base;
}

export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return sec ? `${m}m ${sec}s` : `${m}m`;
  return `${sec}s`;
}

export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(h)}:${pad(m)}:${pad(sec)}`;
}
