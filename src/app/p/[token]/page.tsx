import type { Metadata } from "next";
import Link from "next/link";

import { PublicPaymentCard } from "@/components/app/public-payment-card";
import { getPublicPaymentAction } from "@/lib/actions/public-payment";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Potvrzení platby — Splitnito",
  robots: { index: false, follow: false },
};

export default async function PublicPaymentPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const result = await getPublicPaymentAction(decodeURIComponent(token));

  return (
    <main className="flex min-h-full flex-1 flex-col items-center justify-center bg-linear-to-b from-[oklch(0.985_0.01_200)] to-[oklch(0.96_0.02_195)] px-4 py-10">
      <div className="w-full max-w-lg">
        <Link
          href="/"
          className="mb-6 block text-center font-heading text-2xl font-semibold tracking-tight text-primary"
        >
          Splitnito
        </Link>

        {result.status === "error" ? (
          <div className="rounded-2xl bg-card p-6 text-center ring-1 ring-foreground/10">
            <h1 className="font-heading text-xl font-semibold">
              Odkaz nefunguje
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {result.message}
            </p>
            <Link
              href="/dashboard"
              className="mt-5 inline-block text-sm font-medium text-primary underline underline-offset-4"
            >
              Přejít do aplikace
            </Link>
          </div>
        ) : (
          <PublicPaymentCard view={result} />
        )}

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Splitnito — chytré vyúčtování firemních nákladů.
        </p>
      </div>
    </main>
  );
}
