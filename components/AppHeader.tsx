import Link from "next/link";
import Logo from "@/components/Logo";
import { IconLogout } from "@/components/Icons";
import { logout } from "@/app/(auth)/actions";

// Header for signed-in pages (account, admin).
export default function AppHeader({ isAdmin, active }: { isAdmin: boolean; active: "account" | "admin" }) {
  const tab = (href: string, label: string, key: string) => (
    <Link
      href={href}
      className={`rounded-full px-4 py-2 text-sm font-medium transition ${
        active === key ? "bg-white/10 text-fg" : "text-mute hover:bg-white/5 hover:text-fg"
      }`}
    >
      {label}
    </Link>
  );
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-night/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-5">
        <Logo />
        <nav className="flex items-center gap-1.5">
          {tab("/account", "Account", "account")}
          {isAdmin && tab("/admin", "Admin", "admin")}
          <Link href="/studio" className="btn btn-signal ml-2 px-5 py-2.5 text-sm">
            <span className="h-2 w-2 rounded-full bg-white" /> Studio
          </Link>
          <form action={logout}>
            <button type="submit" className="btn btn-ghost h-10 w-10" aria-label="Log out" title="Log out">
              <IconLogout className="h-[18px] w-[18px]" />
            </button>
          </form>
        </nav>
      </div>
    </header>
  );
}
