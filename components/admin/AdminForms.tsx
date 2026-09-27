"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { prepareReferenceImage } from "@/lib/image";
import { CREDIT_PACKS } from "@/lib/pricing";
import type { Preset } from "@/lib/types";

async function send(url: string, method: string, body?: unknown): Promise<string | null> {
  try {
    const res = await fetch(url, {
      method,
      headers: body instanceof FormData ? undefined : { "content-type": "application/json" },
      body: body instanceof FormData ? body : body === undefined ? undefined : JSON.stringify(body),
    });
    if (res.ok) return null;
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    return data.error ?? `Failed (${res.status}).`;
  } catch {
    return "Network error. Try again.";
  }
}

function Msg({ ok, error }: { ok: string | null; error: string | null }) {
  if (error) return <p className="mt-3 text-sm text-signal-2">{error}</p>;
  if (ok) return <p className="mt-3 text-sm text-ok">{ok}</p>;
  return null;
}

/* ---------- grant time ---------- */

export function GrantForm({ defaultEmail = "" }: { defaultEmail?: string }) {
  const router = useRouter();
  const [email, setEmail] = useState(defaultEmail);
  const [pack, setPack] = useState<string>("");
  const [minutes, setMinutes] = useState("10");
  const [bucket, setBucket] = useState<"paid" | "free">("paid");
  const [markPaid, setMarkPaid] = useState(true);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("transfer");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Picking a pack fills in the minutes and the price.
  const pickPack = (id: string) => {
    setPack(id);
    const p = CREDIT_PACKS.find((x) => x.id === id);
    if (!p) return;
    setMinutes(String(p.credits));
    setAmount(String(p.priceNgn));
    setBucket("paid");
    setMarkPaid(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setOk(null);
    setError(null);
    const err = await send("/api/admin/grant", "POST", {
      email,
      minutes: Number(minutes),
      bucket,
      markPaid,
      note,
      amountNgn: markPaid ? Number(amount || 0) : 0,
      method,
      pack: pack || null,
    });
    setBusy(false);
    if (err) return setError(err);
    setOk(`Done. ${minutes} min ${Number(minutes) < 0 ? "removed from" : "added to"} ${email}.`);
    setNote("");
    router.refresh();
  };

  return (
    <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
      <label className="sm:col-span-2">
        <span className="mb-1.5 block text-sm text-soft">User email</span>
        <input className="field field-sm" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </label>
      <div className="sm:col-span-2">
        <span className="mb-1.5 block text-sm text-soft">Pack (optional, fills the rest)</span>
        <div className="flex flex-wrap gap-2">
          {[{ id: "", name: "Custom" }, ...CREDIT_PACKS].map((p) => (
            <button
              key={p.id || "custom"}
              type="button"
              onClick={() => (p.id ? pickPack(p.id) : setPack(""))}
              className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                pack === p.id ? "bg-signal text-white" : "bg-surface-3 text-soft hover:text-fg"
              }`}
            >
              {p.name}
            </button>
          ))}
        </div>
      </div>
      <label>
        <span className="mb-1.5 block text-sm text-soft">Minutes (- to remove)</span>
        <input className="field field-sm" type="number" required step="1" value={minutes} onChange={(e) => setMinutes(e.target.value)} />
      </label>
      <label>
        <span className="mb-1.5 block text-sm text-soft">Type</span>
        <select className="field field-sm" value={bucket} onChange={(e) => setBucket(e.target.value as "paid" | "free")}>
          <option value="paid">Paid credits</option>
          <option value="free">Gift (watermark)</option>
        </select>
      </label>
      <label className="flex items-center gap-2.5 text-sm text-soft sm:col-span-2">
        <input type="checkbox" checked={markPaid} onChange={(e) => setMarkPaid(e.target.checked)} className="h-4 w-4 accent-[#ef1d35]" />
        This is a payment (counts as revenue, removes their watermark for good)
      </label>
      {markPaid && (
        <>
          <label>
            <span className="mb-1.5 block text-sm text-soft">Amount paid (₦)</span>
            <input
              className="field field-sm"
              type="number"
              min={0}
              step="1"
              required
              placeholder="e.g. 35000"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </label>
          <label>
            <span className="mb-1.5 block text-sm text-soft">Paid by</span>
            <select className="field field-sm" value={method} onChange={(e) => setMethod(e.target.value)}>
              <option value="transfer">Bank transfer</option>
              <option value="paystack">Paystack</option>
              <option value="cash">Cash</option>
              <option value="other">Other</option>
            </select>
          </label>
        </>
      )}
      <label className="sm:col-span-2">
        <span className="mb-1.5 block text-sm text-soft">Note (e.g. Paystack ref, bank narration)</span>
        <input className="field field-sm" maxLength={200} value={note} onChange={(e) => setNote(e.target.value)} />
      </label>
      <div className="sm:col-span-2">
        <button disabled={busy} className="btn btn-signal px-7 py-3 text-sm">
          {busy ? "Saving..." : "Update balance"}
        </button>
        <Msg ok={ok} error={error} />
      </div>
    </form>
  );
}

/* ---------- expenses ---------- */

export function ExpenseForm({ fx }: { fx: number }) {
  const router = useRouter();
  const [kind, setKind] = useState("ai_topup");
  const [usdAmount, setUsdAmount] = useState("");
  const [ngn, setNgn] = useState("");
  const [spentOn, setSpentOn] = useState(() => new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setOk(null);
    setError(null);
    const err = await send("/api/admin/expenses", "POST", {
      kind,
      amountNgn: Number(ngn),
      amountUsd: usdAmount ? Number(usdAmount) : null,
      note,
      spentOn,
    });
    setBusy(false);
    if (err) return setError(err);
    setOk("Saved.");
    setUsdAmount("");
    setNgn("");
    setNote("");
    router.refresh();
  };

  return (
    <form onSubmit={submit} className="grid gap-4">
      <label>
        <span className="mb-1.5 block text-sm text-soft">What for</span>
        <select className="field field-sm" value={kind} onChange={(e) => setKind(e.target.value)}>
          <option value="ai_topup">AI top-up (fal / Decart)</option>
          <option value="hosting">Hosting</option>
          <option value="marketing">Marketing</option>
          <option value="fees">Fees</option>
          <option value="other">Other</option>
        </select>
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label>
          <span className="mb-1.5 block text-sm text-soft">Dollars (optional)</span>
          <input
            className="field field-sm"
            type="number"
            min={0}
            step="0.01"
            placeholder="30"
            value={usdAmount}
            onChange={(e) => {
              setUsdAmount(e.target.value);
              if (e.target.value) setNgn(String(Math.round(Number(e.target.value) * fx)));
            }}
          />
        </label>
        <label>
          <span className="mb-1.5 block text-sm text-soft">Naira</span>
          <input className="field field-sm" type="number" min={1} step="1" required value={ngn} onChange={(e) => setNgn(e.target.value)} />
        </label>
      </div>
      <label>
        <span className="mb-1.5 block text-sm text-soft">Date</span>
        <input className="field field-sm" type="date" required value={spentOn} onChange={(e) => setSpentOn(e.target.value)} />
      </label>
      <label>
        <span className="mb-1.5 block text-sm text-soft">Note</span>
        <input className="field field-sm" maxLength={200} placeholder="e.g. fal credit, card ending 1234" value={note} onChange={(e) => setNote(e.target.value)} />
      </label>
      <p className="text-xs text-mute">For AI top-ups, enter the dollars too so the provider balance stays accurate.</p>
      <button disabled={busy} className="btn btn-light py-3 text-sm">
        {busy ? "Saving..." : "Save expense"}
      </button>
      <Msg ok={ok} error={error} />
    </form>
  );
}

export function DeleteExpense({ id }: { id: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      disabled={busy}
      onClick={async () => {
        if (!confirm("Delete this expense?")) return;
        setBusy(true);
        const err = await send("/api/admin/expenses", "DELETE", { id });
        setBusy(false);
        if (err) alert(err);
        router.refresh();
      }}
      className="text-xs font-semibold text-signal-2 hover:underline disabled:opacity-40"
    >
      Delete
    </button>
  );
}

/* ---------- settings ---------- */

export function SettingsForm({ signupFreeSeconds }: { signupFreeSeconds: number }) {
  const router = useRouter();
  const [value, setValue] = useState(String(signupFreeSeconds));
  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setOk(null);
    setError(null);
    const err = await send("/api/admin/settings", "POST", { signupFreeSeconds: Number(value) });
    setBusy(false);
    if (err) return setError(err);
    setOk("Saved. Applies to new signups.");
    router.refresh();
  };

  return (
    <form onSubmit={submit}>
      <label>
        <span className="mb-1.5 block text-sm text-soft">Free seconds for each new signup</span>
        <div className="flex gap-2">
          <input className="field max-w-[10rem]" type="number" min={0} max={3600} value={value} onChange={(e) => setValue(e.target.value)} />
          <button disabled={busy} className="btn btn-light px-6 text-sm">
            Save
          </button>
        </div>
      </label>
      <p className="mt-2 text-xs text-mute">Each free second costs you about $0.02 in AI time. 60 seconds is about $1.20 per signup.</p>
      <Msg ok={ok} error={error} />
    </form>
  );
}

/* ---------- presets ---------- */

export function PresetManager({ presets, imageBase }: { presets: Preset[]; imageBase: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [promptExtra, setPromptExtra] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [rowBusy, setRowBusy] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const categories = Array.from(new Set(presets.map((p) => p.category)));

  const upload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return setError("Pick an image.");
    setBusy(true);
    setOk(null);
    setError(null);
    try {
      // Shrink to 1024px JPEG in the browser so uploads stay small.
      const prepared = await prepareReferenceImage(file);
      URL.revokeObjectURL(prepared.url);
      const form = new FormData();
      form.set("file", new File([prepared.blob], "preset.jpg", { type: "image/jpeg" }));
      form.set("name", name);
      form.set("category", category);
      form.set("promptExtra", promptExtra);
      const err = await send("/api/admin/presets", "POST", form);
      if (err) throw new Error(err);
      setOk(`${name} added to the gallery.`);
      setName("");
      setPromptExtra("");
      setFile(null);
      (e.target as HTMLFormElement).reset();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
  };

  const patch = async (id: string, body: Record<string, unknown>) => {
    setRowBusy(id);
    const err = await send("/api/admin/presets", "PATCH", { id, ...body });
    setRowBusy(null);
    if (err) setError(err);
    router.refresh();
  };

  const remove = async (p: Preset) => {
    if (!confirm(`Delete ${p.name}? This cannot be undone.`)) return;
    setRowBusy(p.id);
    const err = await send("/api/admin/presets", "DELETE", { id: p.id });
    setRowBusy(null);
    if (err) setError(err);
    router.refresh();
  };

  return (
    <div className="grid gap-8 lg:grid-cols-[340px_1fr]">
      <form onSubmit={upload} className="grid content-start gap-4">
        <label>
          <span className="mb-1.5 block text-sm text-soft">Character image</span>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            required
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="field text-sm file:mr-3 file:rounded-full file:border-0 file:bg-white file:px-3 file:py-1 file:text-xs file:font-semibold file:text-black"
          />
        </label>
        <label>
          <span className="mb-1.5 block text-sm text-soft">Name</span>
          <input className="field" required maxLength={60} value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label>
          <span className="mb-1.5 block text-sm text-soft">Category</span>
          <input
            className="field"
            maxLength={40}
            list="preset-categories"
            placeholder="e.g. Anime, Fantasy, Mascots"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          />
          <datalist id="preset-categories">
            {categories.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </label>
        <label>
          <span className="mb-1.5 block text-sm text-soft">Extra prompt (optional)</span>
          <input
            className="field"
            maxLength={200}
            placeholder="e.g. glowing blue eyes, silver armor"
            value={promptExtra}
            onChange={(e) => setPromptExtra(e.target.value)}
          />
        </label>
        <p className="text-xs text-mute">Only upload art you own or have rights to. Clear face, one character, 512px or bigger.</p>
        <button disabled={busy} className="btn btn-signal py-3 text-sm">
          {busy ? "Uploading..." : "Add to gallery"}
        </button>
        <Msg ok={ok} error={error} />
      </form>

      <div>
        {presets.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line-2 p-8 text-center text-sm text-mute">No presets yet. Add the first one.</p>
        ) : (
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
            {presets.map((p) => (
              <li key={p.id} className={`overflow-hidden rounded-2xl border border-line bg-surface-2 ${p.active ? "" : "opacity-50"}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`${imageBase}/${p.image_path}`} alt={p.name} className="aspect-square w-full object-cover" />
                <div className="p-2.5">
                  <p className="truncate text-sm font-bold">{p.name}</p>
                  <p className="text-xs text-mute">{p.category}</p>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <button
                      disabled={rowBusy === p.id}
                      onClick={() => patch(p.id, { active: !p.active })}
                      className="text-xs font-semibold text-soft hover:text-fg disabled:opacity-40"
                    >
                      {p.active ? "Hide" : "Show"}
                    </button>
                    <input
                      type="number"
                      title="Order (lower shows first)"
                      defaultValue={p.sort}
                      onBlur={(e) => Number(e.target.value) !== p.sort && patch(p.id, { sort: Number(e.target.value) })}
                      className="w-12 rounded-md border border-line-2 bg-surface px-1 py-0.5 text-center text-xs text-fg"
                    />
                    <button
                      disabled={rowBusy === p.id}
                      onClick={() => remove(p)}
                      className="text-xs font-semibold text-signal-2 hover:underline disabled:opacity-40"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
