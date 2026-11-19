import Link from "next/link";

import { LegalFooter } from "@/components/legal/legal-footer";

export default function LegalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-full flex-1 flex-col bg-[linear-gradient(180deg,oklch(0.985_0.01_200)_0%,oklch(0.96_0.015_190)_100%)]">
      <header className="border-b border-border/70 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3 sm:px-6">
          <Link
            href="/"
            className="font-heading text-lg font-semibold tracking-tight"
          >
            Splitnito
          </Link>
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:px-6">
        {children}
      </main>
      <LegalFooter />
    </div>
  );
}
