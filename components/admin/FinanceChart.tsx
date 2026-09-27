"use client";

import { useState } from "react";
import type { SeriesPoint } from "@/lib/finance";

const REVENUE = "#ef1d35";
const COST = "#3b82f6";

const short = (n: number) =>
  n >= 1_000_000 ? `₦${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}m` : n >= 1_000 ? `₦${Math.round(n / 1_000)}k` : `₦${Math.round(n)}`;
const full = (n: number) => `₦${Math.round(n).toLocaleString("en-NG")}`;

// Revenue vs AI cost, grouped bars on one naira axis, with a hover tooltip.
export default function FinanceChart({ points }: { points: SeriesPoint[] }) {
  const [hover, setHover] = useState<number | null>(null);

  const W = 760;
  const H = 260;
  const pad = { l: 48, r: 8, t: 12, b: 28 };
  const iw = W - pad.l - pad.r;
  const ih = H - pad.t - pad.b;

  const max = Math.max(1, ...points.map((p) => Math.max(p.revenue, p.aiCost)));
  const step = niceStep(max / 3);
  const top = Math.ceil(max / step) * step;
  const ticks = Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step);

  const slot = iw / Math.max(1, points.length);
  const barW = Math.max(2, Math.min(14, (slot - 4) / 2 - 1));
  const y = (v: number) => pad.t + ih - (v / top) * ih;
  const labelEvery = Math.ceil(points.length / 8);
  const hp = hover !== null ? points[hover] : null;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-4 text-xs text-soft">
        <Legend color={REVENUE} label="Revenue" />
        <Legend color={COST} label="AI cost" />
      </div>
      <div className="relative">
        <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Revenue and AI cost over time">
          {ticks.map((t) => (
            <g key={t}>
              <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="#2c2329" strokeWidth={1} />
              <text x={pad.l - 8} y={y(t) + 4} textAnchor="end" fontSize="11" fill="#8d8087">
                {short(t)}
              </text>
            </g>
          ))}
          {points.map((p, i) => {
            const cx = pad.l + slot * i + slot / 2;
            return (
              <g key={p.key}>
                {hover === i && <rect x={cx - slot / 2} y={pad.t} width={slot} height={ih} fill="#ffffff" opacity={0.04} rx={4} />}
                <Bar x={cx - barW - 1} w={barW} y={y(p.revenue)} base={y(0)} color={REVENUE} />
                <Bar x={cx + 1} w={barW} y={y(p.aiCost)} base={y(0)} color={COST} />
                {i % labelEvery === 0 && (
                  <text x={cx} y={H - 8} textAnchor="middle" fontSize="11" fill="#8d8087">
                    {p.label}
                  </text>
                )}
                <rect
                  x={cx - slot / 2}
                  y={pad.t}
                  width={slot}
                  height={ih}
                  fill="transparent"
                  onMouseEnter={() => setHover(i)}
                  onMouseLeave={() => setHover(null)}
                />
              </g>
            );
          })}
        </svg>
        {hp && hover !== null && (
          <div
            className="pointer-events-none absolute top-2 z-10 min-w-40 rounded-xl border border-line-2 bg-night/95 px-3 py-2.5 text-xs shadow-xl backdrop-blur"
            style={{
              left: `${((pad.l + slot * hover + slot / 2) / W) * 100}%`,
              transform: hover > points.length / 2 ? "translateX(calc(-100% - 12px))" : "translateX(12px)",
            }}
          >
            <p className="font-semibold text-fg">{hp.label}</p>
            <Row color={REVENUE} label="Revenue" value={full(hp.revenue)} />
            <Row color={COST} label="AI cost" value={full(hp.aiCost)} />
            <p className="mt-1.5 border-t border-line pt-1.5 text-soft">
              Profit before fees <span className="float-right ml-4 font-semibold text-fg">{full(hp.revenue - hp.aiCost)}</span>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function Bar({ x, w, y, base, color }: { x: number; w: number; y: number; base: number; color: string }) {
  const h = base - y;
  if (h <= 0.5) return null;
  const r = Math.min(4, w / 2, h);
  // Rounded top, square base.
  return (
    <path
      d={`M${x},${base} V${y + r} Q${x},${y} ${x + r},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${base} Z`}
      fill={color}
    />
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-2">
      <span className="h-2.5 w-2.5 rounded-sm" style={{ background: color }} />
      {label}
    </span>
  );
}

function Row({ color, label, value }: { color: string; label: string; value: string }) {
  return (
    <p className="mt-1 flex items-center gap-2 text-soft">
      <span className="h-2 w-2 rounded-sm" style={{ background: color }} />
      {label}
      <span className="ml-auto pl-4 font-semibold text-fg">{value}</span>
    </p>
  );
}

function niceStep(raw: number): number {
  const p = Math.pow(10, Math.floor(Math.log10(Math.max(raw, 1))));
  const n = raw / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
}
