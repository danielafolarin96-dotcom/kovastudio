"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { forgotPassword, login, resetPassword, signup, type FormState } from "@/app/(auth)/actions";

function Submit({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn btn-signal w-full py-3.5 text-sm">
      {pending ? "One sec..." : children}
    </button>
  );
}

function Notice({ state }: { state: FormState }) {
  if (!state?.error && !state?.message) return null;
  return (
    <p
      role="status"
      className={`mb-5 rounded-xl border px-4 py-3 text-sm ${
        state.error ? "border-signal/40 bg-signal/10 text-[#ffc2c9]" : "border-ok/40 bg-ok/10 text-fg"
      }`}
    >
      {state.error ?? state.message}
    </p>
  );
}

function Field(props: React.InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }) {
  const { label, hint, ...rest } = props;
  return (
    <label className="mb-4 block">
      <span className="mb-2 flex justify-between text-sm font-medium text-soft">
        {label}
        {hint && <span className="font-normal text-mute">{hint}</span>}
      </span>
      <input className="field" {...rest} />
    </label>
  );
}

function PasswordField({ name, label, autoComplete }: { name: string; label: string; autoComplete: string }) {
  const [show, setShow] = useState(false);
  return (
    <label className="mb-4 block">
      <span className="mb-2 flex justify-between text-sm font-medium text-soft">
        {label}
        <button type="button" onClick={() => setShow((s) => !s)} className="text-mute hover:text-fg">
          {show ? "Hide" : "Show"}
        </button>
      </span>
      <input className="field" name={name} type={show ? "text" : "password"} required minLength={8} autoComplete={autoComplete} />
    </label>
  );
}

export function LoginForm({ next, linkError }: { next: string; linkError: boolean }) {
  const [state, action] = useActionState(
    login,
    linkError ? { error: "That link expired or was already used. Log in, or request a new one." } : null,
  );
  return (
    <form action={action}>
      <Notice state={state} />
      <input type="hidden" name="next" value={next} />
      <Field label="Email" name="email" type="email" required autoComplete="email" defaultValue={state?.email} />
      <PasswordField name="password" label="Password" autoComplete="current-password" />
      <div className="mb-6 -mt-1 text-right">
        <Link href="/forgot-password" className="text-sm text-mute underline-offset-4 hover:text-fg hover:underline">
          Forgot password?
        </Link>
      </div>
      <Submit>Log in</Submit>
    </form>
  );
}

export function SignupForm() {
  const [state, action] = useActionState(signup, null);
  if (state?.message) return <Notice state={state} />;
  return (
    <form action={action}>
      <Notice state={state} />
      <Field label="Creator name" name="displayName" required maxLength={40} autoComplete="nickname" hint="Shown on your channel" />
      <Field label="Email" name="email" type="email" required autoComplete="email" defaultValue={state?.email} />
      <PasswordField name="password" label="Password" autoComplete="new-password" />
      <p className="mb-6 text-xs leading-relaxed text-mute">
        By signing up you agree to the{" "}
        <Link href="/terms" className="text-soft underline">
          Terms
        </Link>{" "}
        and{" "}
        <Link href="/privacy" className="text-soft underline">
          Privacy Policy
        </Link>
        .
      </p>
      <Submit>Create account</Submit>
    </form>
  );
}

export function ForgotForm() {
  const [state, action] = useActionState(forgotPassword, null);
  return (
    <form action={action}>
      <Notice state={state} />
      <Field label="Email" name="email" type="email" required autoComplete="email" defaultValue={state?.email} />
      <div className="mt-2">
        <Submit>Send reset link</Submit>
      </div>
    </form>
  );
}

export function ResetForm() {
  const [state, action] = useActionState(resetPassword, null);
  return (
    <form action={action}>
      <Notice state={state} />
      <PasswordField name="password" label="New password" autoComplete="new-password" />
      <PasswordField name="confirm" label="Repeat it" autoComplete="new-password" />
      <div className="mt-2">
        <Submit>Save password</Submit>
      </div>
    </form>
  );
}
