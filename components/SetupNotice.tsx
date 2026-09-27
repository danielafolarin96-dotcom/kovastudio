import Logo from "@/components/Logo";

// Shown instead of a page when .env.local is not filled in yet.
export default function SetupNotice({ missing }: { missing: string[] }) {
  return (
    <main className="glow-page min-h-screen px-6 py-6 sm:px-10">
      <Logo />
      <div className="card mx-auto my-12 max-w-xl p-7 sm:p-9">
        <span className="chip">Setup needed</span>
        <h1 className="display mt-5 text-4xl">Almost ready.</h1>
        <p className="mt-3 text-soft">Add these to your .env.local file (or Vercel environment variables), then restart:</p>
        <ul className="mt-6 space-y-2">
          {missing.map((m) => (
            <li key={m} className="rounded-xl border border-line bg-surface-2 px-4 py-3 font-mono text-sm">
              {m}
            </li>
          ))}
        </ul>
        <p className="mt-6 text-sm text-mute">The README walks through where to find each value.</p>
      </div>
    </main>
  );
}
