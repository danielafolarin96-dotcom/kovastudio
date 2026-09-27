import Link from "next/link";

// Kova Studio mark: a white K on a red gradient tile, with a small "live" dot.
export function LogoMark({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="kova-mark" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ff4358" />
          <stop offset="1" stopColor="#c10f25" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="18" fill="url(#kova-mark)" />
      <path d="M19 16h8.5v13.2L39.8 16H50L36 30.6 50.6 48H40L27.5 32.8V48H19z" fill="#fff" />
      <circle cx="50" cy="50" r="5" fill="#fff" opacity="0.9" />
    </svg>
  );
}

export default function Logo({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="inline-flex items-center gap-2.5 text-fg" aria-label="Kova Studio home">
      <LogoMark />
      <span className="text-[1.2rem] font-bold tracking-tight">
        Kova<span className="hidden font-medium text-soft sm:inline"> Studio</span>
      </span>
    </Link>
  );
}
