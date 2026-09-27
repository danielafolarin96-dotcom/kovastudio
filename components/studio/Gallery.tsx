"use client";

import { useMemo, useState } from "react";
import type { PresetCard } from "@/lib/types";

type Props = {
  presets: PresetCard[];
  selectedId: string | null;
  loadingId: string | null;
  isAdmin: boolean;
  onPick: (preset: PresetCard) => void;
};

// Grid of preset characters with category filters.
export default function Gallery({ presets, selectedId, loadingId, isAdmin, onPick }: Props) {
  const categories = useMemo(() => ["All", ...Array.from(new Set(presets.map((p) => p.category)))], [presets]);
  const [category, setCategory] = useState("All");
  const shown = category === "All" ? presets : presets.filter((p) => p.category === category);

  if (!presets.length) {
    return (
      <div className="rounded-2xl border border-dashed border-line-2 px-4 py-8 text-center text-sm text-mute">
        {isAdmin ? (
          <>
            No preset characters yet.{" "}
            <a href="/admin/gallery" className="text-fg underline underline-offset-4">
              Add some in Admin
            </a>
            .
          </>
        ) : (
          "The gallery is empty for now. Upload your own character instead."
        )}
      </div>
    );
  }

  return (
    <div>
      {categories.length > 2 && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                c === category ? "bg-signal text-white" : "bg-surface-3 text-soft hover:text-fg"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      )}

      <div className="grid max-h-[360px] grid-cols-3 gap-2 overflow-y-auto pr-1">
        {shown.map((p) => {
          const selected = p.id === selectedId;
          const loading = p.id === loadingId;
          return (
            <button
              key={p.id}
              onClick={() => onPick(p)}
              disabled={!!loadingId}
              title={p.name}
              className={`group relative aspect-[4/5] overflow-hidden rounded-xl bg-surface-3 ring-offset-2 ring-offset-surface transition ${
                selected ? "ring-2 ring-signal" : "hover:opacity-90"
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.imageUrl} alt={p.name} loading="lazy" className="h-full w-full object-cover" />
              <span className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/85 to-transparent px-1.5 pb-1 pt-4 text-left text-[11px] font-semibold">
                {p.name}
              </span>
              {loading && (
                <span className="absolute inset-0 flex items-center justify-center bg-black/60">
                  <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/25 border-t-white" />
                </span>
              )}
              {selected && !loading && <span className="absolute right-1.5 top-1.5 h-3 w-3 rounded-full border-2 border-white bg-signal" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
