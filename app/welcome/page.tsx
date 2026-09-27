import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Logo from "@/components/Logo";
import { requireUser, displayNameOf } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/server";
import { formatDuration } from "@/lib/config";

export const metadata: Metadata = { title: "House rules" };

async function accept(formData: FormData) {
  "use server";
  const current = await requireUser("/welcome", { allowUnaccepted: true });
  if (formData.get("agree") !== "on") redirect("/welcome?must=1");
  await createAdminClient()
    .from("profiles")
    .update({ accepted_terms_at: new Date().toISOString() })
    .eq("id", current.user.id);
  const next = String(formData.get("next") ?? "/studio");
  redirect(next.startsWith("/") && !next.startsWith("//") ? next : "/studio");
}

const RULES = [
  ["Your pictures only", "Upload characters you made, own, or have permission to use."],
  ["No real people without consent", "Never turn yourself into a real person who has not agreed to it."],
  ["No scams or impersonation", "Do not use Kova Studio to trick, defraud or mislead anyone."],
  ["Keep it clean", "No sexual content, no violence, no hate. Accounts that break this are closed."],
] as const;

export default async function WelcomePage({ searchParams }: { searchParams: Promise<{ next?: string; must?: string }> }) {
  const { profile, isAdmin } = await requireUser("/welcome", { allowUnaccepted: true });
  const sp = await searchParams;
  const next = sp.next?.startsWith("/") && !sp.next.startsWith("//") ? sp.next : "/studio";
  if (profile.accepted_terms_at) redirect(next);

  return (
    <main className="glow-page min-h-screen px-6 py-6 sm:px-10">
      <Logo />
      <div className="card mx-auto my-10 max-w-2xl p-7 sm:p-10">
        <span className="chip">Before your first stream</span>
        <h1 className="display mt-5 text-4xl sm:text-5xl">Welcome, {displayNameOf(profile)}.</h1>
        <p className="mt-4 max-w-lg text-soft">
          {isAdmin
            ? "You are an admin: no watermark and no time limits."
            : profile.free_seconds > 0
              ? `You have ${formatDuration(profile.free_seconds)} of gift time from the Kova team.`
              : "Grab a credit pack from your account when you are ready to go live."}{" "}
          Four house rules first.
        </p>

        <ol className="mt-8 grid gap-3 sm:grid-cols-2">
          {RULES.map(([title, body], i) => (
            <li key={title} className="rounded-2xl border border-line bg-surface-2 p-5">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-signal/15 text-sm font-bold text-signal-2">{i + 1}</span>
              <div className="mt-3">
                <p className="font-semibold">{title}</p>
                <p className="mt-1 text-sm text-mute">{body}</p>
              </div>
            </li>
          ))}
        </ol>

        <form action={accept} className="mt-8">
          <input type="hidden" name="next" value={next} />
          {sp.must && <p className="mb-4 rounded-xl border border-signal/40 bg-signal/10 px-4 py-3 text-sm text-[#ffc2c9]">Tick the box to continue.</p>}
          <label className="flex cursor-pointer items-start gap-3 text-sm text-soft">
            <input type="checkbox" name="agree" className="mt-0.5 h-5 w-5 accent-[#ef1d35]" />
            <span>I agree to follow these rules and the Terms. I understand my account can be closed if I break them.</span>
          </label>
          <button type="submit" className="btn btn-signal mt-8 px-8 py-3.5 text-sm">
            Enter the studio
          </button>
        </form>
      </div>
    </main>
  );
}
