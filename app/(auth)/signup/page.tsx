import type { Metadata } from "next";
import Link from "next/link";
import { SignupForm } from "@/components/AuthForms";

export const metadata: Metadata = { title: "Sign up" };

export default function SignupPage() {
  return (
    <>
      <span className="chip mb-5">Your channel, your characters</span>
      <h1 className="display mb-7 text-4xl">Get your channel</h1>
      <SignupForm />
      <p className="mt-8 text-sm text-mute">
        Already have an account?{" "}
        <Link href="/login" className="font-semibold text-signal-2 hover:underline underline-offset-4">
          Log in
        </Link>
      </p>
    </>
  );
}
