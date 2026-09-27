import type { Metadata } from "next";
import { ResetForm } from "@/components/AuthForms";

export const metadata: Metadata = { title: "New password" };

export default function ResetPasswordPage() {
  return (
    <>
      <span className="chip mb-5">Almost there</span>
      <h1 className="display mb-7 text-4xl">New password</h1>
      <ResetForm />
    </>
  );
}
