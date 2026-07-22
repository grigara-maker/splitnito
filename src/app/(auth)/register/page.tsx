import Link from "next/link";

import { RegisterForm } from "@/components/auth/register-form";

export default function RegisterPage() {
  return (
    <div className="relative flex min-h-full flex-1 flex-col items-center justify-center px-6 py-12">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_oklch(0.92_0.04_200)_0%,_transparent_55%),linear-gradient(180deg,_oklch(0.985_0.01_200)_0%,_oklch(0.96_0.02_180)_100%)]"
      />
      <div className="relative z-10 mb-8 text-center">
        <Link href="/" className="font-heading text-2xl font-semibold tracking-tight">
          Splitnito
        </Link>
      </div>
      <div className="relative z-10 w-full flex justify-center">
        <RegisterForm />
      </div>
    </div>
  );
}
