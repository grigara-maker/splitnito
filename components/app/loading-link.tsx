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
}: {
  href: string;
  className?: string;
  children: React.ReactNode;
  spinner?: "sm" | "md";
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
      className={cn("relative overflow-hidden", className)}
      aria-busy={loading || undefined}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) {
          return;
        }
        if (pathname === href || pathname.startsWith(href + "/")) {
          // už jsme na cílové stránce — jen jemné potvrzení
          if (pathname === href) return;
        }
        e.preventDefault();
        if (loading) return;
        setClicked(true);
        startTransition(() => {
          router.push(href);
        });
      }}
    >
      <span className={cn("inline-flex items-center justify-center gap-[inherit]", loading && "invisible")}>
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
