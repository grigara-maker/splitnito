"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

export function LoadingLink({
  href,
  className,
  children,
  spinner = "md",
  layout = "inline",
  prefetch = true,
}: {
  href: string;
  className?: string;
  children: React.ReactNode;
  spinner?: "sm" | "md";
  /** inline = navbar/tlačítka, block = karty (zachová původní formátování) */
  layout?: "inline" | "block";
  /** Vypnout prefetch těžkých stránek (detail akce). */
  prefetch?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const [clicked, setClicked] = useState(false);
  const loading = pending || clicked;

  useEffect(() => {
    setClicked(false);
  }, [pathname]);

  return (
    <Link
      href={href}
      prefetch={prefetch}
      className={cn("relative overflow-hidden", className)}
      aria-busy={loading || undefined}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) {
          return;
        }
        if (pathname === href) return;
        e.preventDefault();
        if (loading) return;
        setClicked(true);
        startTransition(() => {
          router.push(href);
        });
      }}
    >
      <span
        className={cn(
          loading && "invisible",
          layout === "block"
            ? "block w-full"
            : "inline-flex items-center justify-center gap-[inherit]"
        )}
      >
        {children}
      </span>
      {loading ? (
        <span
          aria-hidden
          className="absolute inset-0 z-10 flex items-center justify-center rounded-[inherit] bg-black/35 shadow-inner backdrop-blur-[1px]"
        >
          <Loader2
            className={cn(
              "animate-spin text-white drop-shadow",
              spinner === "sm" ? "size-3.5" : "size-5"
            )}
          />
        </span>
      ) : null}
    </Link>
  );
}
