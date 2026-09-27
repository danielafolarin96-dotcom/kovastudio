import { IconArrowRight } from "@/components/Icons";

type Pair = { imageUrl: string | null; name: string | null };

// Landing hero visual: your camera on the left, the character Kova outputs on the right.
export default function HeroMonitor({ pairs }: { pairs: Pair[] }) {
  const rows = [pairs[0] ?? { imageUrl: null, name: null }, pairs[1] ?? { imageUrl: null, name: null }];
  return (
    <div className="relative">
      <div className="pointer-events-none absolute -inset-10 rounded-[3rem] bg-[radial-gradient(closest-side,rgb(239_29_53/0.35),transparent)] blur-2xl" />
      <div className="relative grid gap-4">
        {rows.map((row, i) => (
          <div key={i} className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 sm:gap-4">
            <Frame label="Your camera" badge="HD">
              <YouPlaceholder variant={i} />
            </Frame>
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-signal text-white shadow-[0_0_30px_rgb(239_29_53/0.7)]">
              <IconArrowRight className="h-5 w-5" />
            </span>
            <Frame label="Kova output" badge="Live" live>
              {row.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={row.imageUrl} alt={row.name ?? "Character"} className="h-full w-full object-cover" />
              ) : (
                <CharacterPlaceholder variant={i} />
              )}
              {row.name && (
                <span className="absolute bottom-2.5 left-2.5 rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-semibold backdrop-blur">
                  {row.name}
                </span>
              )}
            </Frame>
          </div>
        ))}
      </div>
    </div>
  );
}

function Frame({ label, badge, live, children }: { label: string; badge: string; live?: boolean; children: React.ReactNode }) {
  return (
    <div className={`rounded-[1.1rem] border p-1.5 ${live ? "border-signal/50 bg-signal/10" : "border-line bg-surface"}`}>
      <div className="flex items-center justify-between px-1.5 pb-1.5 pt-0.5">
        <span className="label truncate pr-2 text-[10px] text-soft">{label}</span>
        <span
          className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
            live ? "bg-signal text-white" : "bg-white/10 text-soft"
          }`}
        >
          {live && <span className="tally h-1.5 w-1.5 rounded-full bg-white" />}
          {badge}
        </span>
      </div>
      <div className="relative aspect-[4/3] overflow-hidden rounded-[0.8rem] bg-surface-2">{children}</div>
    </div>
  );
}

function YouPlaceholder({ variant }: { variant: number }) {
  const bg = variant === 0 ? ["#2a2327", "#171215"] : ["#23262b", "#131417"];
  return (
    <svg viewBox="0 0 160 120" className="h-full w-full" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <linearGradient id={`you-bg-${variant}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={bg[0]} />
          <stop offset="1" stopColor={bg[1]} />
        </linearGradient>
        <linearGradient id={`you-body-${variant}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#5b4f55" />
          <stop offset="1" stopColor="#3a3237" />
        </linearGradient>
      </defs>
      <rect width="160" height="120" fill={`url(#you-bg-${variant})`} />
      <rect x="112" y="14" width="30" height="40" rx="3" fill="#ffffff" opacity="0.04" />
      <circle cx="80" cy="50" r="19" fill={`url(#you-body-${variant})`} />
      <path d="M40 120c2-26 18-40 40-40s38 14 40 40z" fill={`url(#you-body-${variant})`} />
    </svg>
  );
}

function CharacterPlaceholder({ variant }: { variant: number }) {
  const c = variant === 0 ? ["#ef1d35", "#5a0a16"] : ["#8b5cf6", "#23104a"];
  return (
    <svg viewBox="0 0 160 120" className="h-full w-full" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <radialGradient id={`ch-bg-${variant}`} cx="0.5" cy="0.3" r="0.8">
          <stop offset="0" stopColor={c[0]} stopOpacity="0.7" />
          <stop offset="1" stopColor={c[1]} />
        </radialGradient>
      </defs>
      <rect width="160" height="120" fill={`url(#ch-bg-${variant})`} />
      <circle cx="80" cy="50" r="19" fill="#0d0a0c" />
      <path d="M62 44 80 22l18 22z" fill="#0d0a0c" />
      <rect x="70" y="47" width="7" height="3" rx="1.5" fill={c[0]} />
      <rect x="83" y="47" width="7" height="3" rx="1.5" fill={c[0]} />
      <path d="M40 120c2-26 18-40 40-40s38 14 40 40z" fill="#0d0a0c" />
    </svg>
  );
}
