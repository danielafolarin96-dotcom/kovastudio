import type { Metadata } from "next";
import Link from "next/link";
import { LoginForm } from "@/components/AuthForms";

export const metadata: Metadata = { title: "Log in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const sp = await searchParams;
  const next = sp.next?.startsWith("/") && !sp.next.startsWith("//") ? sp.next : "/studio";
  return (
    <>
      <span className="chip mb-5">Back on air</span>
      <h1 className="display mb-7 text-4xl">Log in</h1>
      <LoginForm next={next} linkError={sp.error === "link"} />
      <p className="mt-8 text-sm text-mute">
        New here?{" "}
        <Link href="/signup" className="font-semibold text-signal-2 hover:underline underline-offset-4">
          Create an account
        </Link>
      </p>
    </>
  );
}
