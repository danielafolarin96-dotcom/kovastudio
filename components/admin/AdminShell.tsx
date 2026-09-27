import Link from "next/link";
import AppHeader from "@/components/AppHeader";
import { IconGrid, IconImage, IconUser, IconWallet } from "@/components/Icons";

export type AdminTab = "overview" | "finance" | "users" | "gallery";

const TABS: Array<[AdminTab, string, string, (p: { className?: string }) => React.ReactNode]> = [
  ["overview", "Overview", "/admin", IconGrid],
  ["finance", "Finance", "/admin/finance", IconWallet],
  ["users", "Users", "/admin/users", IconUser],
  ["gallery", "Gallery", "/admin/gallery", IconImage],
];

// Frame for every admin page: header, section tabs, title row.
export default function AdminShell({
  tab,
  title,
  sub,
  actions,
  children,
}: {
  tab: AdminTab;
  title: string;
  sub?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="glow-page min-h-screen">
      <AppHeader isAdmin active="admin" />
      <main className="mx-auto max-w-6xl px-5 pb-16 pt-6">
        <nav className="flex gap-1.5 overflow-x-auto rounded-full border border-line bg-surface p-1.5 sm:w-fit">
          {TABS.map(([key, label, href, Icon]) => (
            <Link
              key={key}
              href={href}
              className={`flex flex-none items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition ${
                tab === key ? "bg-signal text-white shadow-[0_6px_20px_-6px_rgb(239_29_53/0.8)]" : "text-soft hover:bg-white/5 hover:text-fg"
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          ))}
        </nav>

        <div className="mt-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="display text-3xl sm:text-4xl">{title}</h1>
            {sub && <p className="mt-1 text-sm text-mute">{sub}</p>}
          </div>
          {actions}
        </div>

        <div className="mt-6">{children}</div>
      </main>
    </div>
  );
}

export function Card({
  title,
  sub,
  right,
  className = "",
  children,
}: {
  title?: string;
  sub?: string;
  right?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={`card p-5 sm:p-6 ${className}`}>
      {(title || right) && (
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div>
            {title && <h2 className="text-lg font-bold">{title}</h2>}
            {sub && <p className="mt-0.5 text-sm text-mute">{sub}</p>}
          </div>
          {right}
        </div>
      )}
      {children}
    </section>
  );
}

export function Kpi({
  label,
  value,
  note,
  icon,
  tone = "bg-surface-3 text-soft",
  hot,
}: {
  label: string;
  value: string;
  note?: React.ReactNode;
  icon?: React.ReactNode;
  tone?: string;
  hot?: boolean;
}) {
  return (
    <div className={`p-5 ${hot ? "card-hot" : "card"}`}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-mute">{label}</p>
        {icon && <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${tone}`}>{icon}</span>}
      </div>
      <p className="mt-2 text-[1.7rem] font-extrabold leading-tight tracking-tight">{value}</p>
      {note && <p className="mt-1 text-xs text-mute">{note}</p>}
    </div>
  );
}

export function Badge({ tone, children }: { tone: "red" | "green" | "amber" | "violet" | "gray"; children: React.ReactNode }) {
  const cls = {
    red: "bg-signal/15 text-signal-2",
    green: "bg-ok/15 text-[#4ade80]",
    amber: "bg-cue/15 text-cue",
    violet: "bg-grape/20 text-[#c4b5fd]",
    gray: "bg-white/5 text-soft",
  }[tone];
  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${cls}`}>{children}</span>;
}

export const thClass = "label border-b border-line py-2.5 pr-3 text-left font-semibold text-mute";
export const tdClass = "border-b border-line/60 py-3 pr-3";
