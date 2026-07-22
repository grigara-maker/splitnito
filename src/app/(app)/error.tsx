"use client";

import Link from "next/link";
import { useEffect } from "react";

import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-4 py-16 text-center">
      <h1 className="font-heading text-2xl font-semibold">
        Stránku se nepodařilo načíst
      </h1>
      <p className="text-sm text-muted-foreground">
        {error.message || "Došlo k neočekávané chybě ve Splitnito."}
      </p>
      <div className="flex justify-center gap-2">
        <Button onClick={() => reset()}>Zkusit znovu</Button>
        <Link
          href="/dashboard"
          className={cn(buttonVariants({ variant: "outline" }))}
        >
          Zpět na dashboard
        </Link>
      </div>
    </div>
  );
}
