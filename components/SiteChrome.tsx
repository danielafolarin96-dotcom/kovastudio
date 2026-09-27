import Link from "next/link";
import Logo from "@/components/Logo";

// Header and footer for public pages (landing, terms, privacy).

const NAV = [
  ["/#how", "How it works"],
  ["/#characters", "Characters"],
  ["/#pricing", "Pricing"],
  ["/#faq", "FAQ"],
] as const;

export function SiteHeader({ signedIn }: { signedIn: boolean }) {
  return (
    <header className="sticky top-3 z-40 px-3 sm:top-4 sm:px-5">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 rounded-full border border-white/10 bg-[linear-gradient(90deg,rgb(130_12_30/0.55),rgb(22_14_19/0.82)_45%,rgb(22_14_19/0.82))] py-2 pl-4 pr-2 shadow-[0_20px_60px_-25px_rgb(239_29_53/0.6)] backdrop-blur-xl">
        <Logo />
        <nav className="hidden items-center gap-1 text-sm lg:flex">
          {NAV.map(([href, label]) => (
            <a key={href} href={href} className="rounded-full px-4 py-2 text-soft transition hover:bg-white/5 hover:text-fg">
              {label}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          {signedIn ? (
            <Link href="/studio" className="btn btn-light px-5 py-2.5 text-sm">
              <span className="h-2 w-2 rounded-full bg-signal" /> Open studio
            </Link>
          ) : (
            <>
              <Link href="/login" className="btn btn-line px-5 py-2.5 text-sm">
                Log in
              </Link>
              <Link href="/signup" className="btn btn-light px-5 py-2.5 text-sm">
                Sign up
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-line bg-night-2">
      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-14 sm:grid-cols-2 lg:grid-cols-[1.6fr_1fr_1fr]">
        <div>
          <Logo />
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-mute">
            The browser studio for going live as any character. Built in Nigeria for creators everywhere.
          </p>
        </div>
        <div>
          <p className="label text-mute">Product</p>
          <ul className="mt-4 space-y-2.5 text-sm text-soft">
            {NAV.map(([href, label]) => (
              <li key={href}>
                <a href={href} className="hover:text-fg">
                  {label}
                </a>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="label text-mute">Legal</p>
          <ul className="mt-4 space-y-2.5 text-sm text-soft">
            <li>
              <Link href="/terms" className="hover:text-fg">
                Terms of use
              </Link>
            </li>
            <li>
              <Link href="/privacy" className="hover:text-fg">
                Privacy policy
              </Link>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-line">
        <p className="mx-auto max-w-6xl px-5 py-5 text-xs text-mute">&copy; {new Date().getFullYear()} Kova Studio. All rights reserved.</p>
      </div>
    </footer>
  );
}
