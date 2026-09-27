import Link from "next/link";
import Logo from "@/components/Logo";

export default function NotFound() {
  return (
    <main className="glow-page flex min-h-screen flex-col p-6 sm:p-10">
      <Logo />
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <p className="text-glow text-[7rem] font-extrabold leading-none sm:text-[10rem]">404</p>
        <h1 className="display mt-2 text-3xl sm:text-4xl">This page is off the air</h1>
        <p className="mt-3 text-soft">The page or channel you are looking for does not exist.</p>
        <Link href="/" className="btn btn-signal mt-8 px-7 py-3.5 text-sm">
          Back to Kova Studio
        </Link>
      </div>
    </main>
  );
}
