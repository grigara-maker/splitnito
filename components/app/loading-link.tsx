"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

export function LoadingLink({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [clicked, setClicked] = useState(false);
  const loading = pending || clicked;

  return (
    <Link
      href={href}
      className={cn("relative overflow-hidden", className)}
      aria-busy={loading || undefined}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) {
          return;
        }
        e.preventDefault();
        if (loading) return;
        setClicked(true);
        startTransition(() => {
          router.push(href);
        });
      }}
    >
      <span className={cn(loading && "invisible")}>{children}</span>
      {loading ? (
        <span
          aria-hidden
          className="absolute inset-0 z-10 flex items-center justify-center rounded-[inherit] bg-black/35 shadow-inner backdrop-blur-[1px]"
        >
          <Loader2 className="size-5 animate-spin text-white drop-shadow" />
        </span>
      ) : null}
    </Link>
  );
}
