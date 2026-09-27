"use client";

import { useState } from "react";

// Channel + OBS links with copy buttons and a reset button (account page).
export default function ChannelLinks({ siteUrl, initialSlug }: { siteUrl: string; initialSlug: string }) {
  const [slug, setSlug] = useState(initialSlug);
  const [copied, setCopied] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const channel = `${siteUrl}/c/${slug}`;
  const obs = `${channel}?obs=1`;

  const copy = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(null), 1600);
    } catch {
      setError("Could not copy. Select the link and copy it by hand.");
    }
  };

  const reset = async () => {
    if (!confirm("Make a new link? The old link and your OBS source will stop working.")) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/account/channel", { method: "POST" });
      const data = (await res.json().catch(() => ({}))) as { channelSlug?: string; error?: string };
      if (!res.ok || !data.channelSlug) throw new Error(data.error ?? "Could not reset the link.");
      setSlug(data.channelSlug);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reset the link.");
    } finally {
      setBusy(false);
    }
  };

  const row = (key: string, label: string, url: string) => (
    <div className="mb-4">
      <p className="mb-1.5 text-sm text-mute">{label}</p>
      <div className="flex gap-2">
        <input readOnly value={url} onFocus={(e) => e.target.select()} className="field field-sm min-w-0 flex-1 font-mono text-xs" />
        <button onClick={() => copy(key, url)} className="btn btn-light w-20 flex-none text-xs">
          {copied === key ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  );

  return (
    <div>
      {row("channel", "Watch link (share with friends)", channel)}
      {row("obs", "OBS browser source (keep private)", obs)}
      {error && <p className="mb-3 text-sm text-signal-2">{error}</p>}
      <button onClick={reset} disabled={busy} className="btn btn-line px-4 py-2 text-xs">
        {busy ? "Resetting..." : "Reset link"}
      </button>
    </div>
  );
}
