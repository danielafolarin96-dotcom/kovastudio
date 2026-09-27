import Logo from "@/components/Logo";
import HeroMonitor from "@/components/HeroMonitor";
import { IconCheck } from "@/components/Icons";

// Split screen: the form on the left, a red-lit preview panel on the right.
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="glow-page grid min-h-screen lg:grid-cols-[1fr_1.05fr]">
      <div className="flex flex-col px-6 py-6 sm:px-10">
        <Logo />
        <div className="flex flex-1 items-center justify-center py-10">
          <div className="card w-full max-w-md p-7 sm:p-9">{children}</div>
        </div>
        <p className="text-center text-xs text-mute">Kova Studio. Built in Nigeria.</p>
      </div>

      <aside className="hidden p-4 lg:block">
        <div className="card-hot flex h-full flex-col justify-center gap-10 px-12 py-12">
          <div>
            <span className="chip">Live in your browser</span>
            <h2 className="display mt-5 text-5xl">
              Be <span className="text-glow">anyone.</span>
              <br />
              On camera. Live.
            </h2>
          </div>
          <div className="max-w-lg">
            <HeroMonitor pairs={[]} />
          </div>
          <ul className="space-y-2.5 text-sm text-soft">
            {["Nothing to download", "Switch characters mid-stream", "Record or stream through OBS"].map((t) => (
              <li key={t} className="flex items-center gap-2.5">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-signal/20 text-signal-2">
                  <IconCheck className="h-3 w-3" />
                </span>
                {t}
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </div>
  );
}
