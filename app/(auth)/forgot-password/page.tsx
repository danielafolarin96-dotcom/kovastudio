import type { Metadata } from "next";
import Link from "next/link";
import { ForgotForm } from "@/components/AuthForms";

export const metadata: Metadata = { title: "Reset password" };

export default function ForgotPasswordPage() {
  return (
    <>
      <span className="chip mb-5">It happens</span>
      <h1 className="display mb-3 text-4xl">Forgot password</h1>
      <p className="mb-8 text-sm text-mute">Enter your email and we will send you a link to set a new one.</p>
      <ForgotForm />
      <p className="mt-8 text-sm text-mute">
        Remembered it?{" "}
        <Link href="/login" className="font-semibold text-signal-2 hover:underline underline-offset-4">
          Log in
        </Link>
      </p>
    </>
  );
}
