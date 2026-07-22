"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Archive,
  Building2,
  CalendarDays,
  LogOut,
  UserRound,
} from "lucide-react";

import { signOutAction } from "@/lib/actions/auth";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function AppNav({
  profileName,
  companyName,
  isCompanyAdmin,
}: {
  profileName: string;
  companyName: string;
  isCompanyAdmin: boolean;
}) {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-20 border-b border-border/70 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-4">
          <Link
            href="/dashboard"
            className="font-heading text-lg font-semibold tracking-tight"
          >
            Splitnito
          </Link>
          <span className="hidden truncate text-sm text-muted-foreground sm:inline">
            {companyName}
            {isCompanyAdmin ? " · firma" : ""}
          </span>
        </div>

        <div className="flex flex-1 items-center justify-end gap-2 sm:gap-3">
          <Link
            href="/dashboard"
            className={cn(
              buttonVariants({
                variant:
                  pathname.startsWith("/dashboard") ||
                  pathname.startsWith("/events")
                    ? "secondary"
                    : "ghost",
                size: "sm",
              })
            )}
          >
            <CalendarDays />
            <span className="hidden sm:inline">Akce</span>
          </Link>

          <Link
            href="/history"
            className={cn(
              buttonVariants({
                variant: pathname.startsWith("/history") ? "secondary" : "ghost",
                size: "sm",
              })
            )}
          >
            <Archive />
            <span className="hidden sm:inline">Historie</span>
          </Link>

          {isCompanyAdmin ? (
            <Link
              href="/company"
              className={cn(
                buttonVariants({
                  variant:
                    pathname.startsWith("/company") ||
                    pathname.startsWith("/profile")
                      ? "secondary"
                      : "ghost",
                  size: "sm",
                })
              )}
            >
              <Building2 />
              <span className="hidden sm:inline">Nastavení</span>
            </Link>
          ) : (
            <Link
              href="/profile"
              className={cn(
                buttonVariants({
                  variant: pathname.startsWith("/profile")
                    ? "secondary"
                    : "ghost",
                  size: "sm",
                })
              )}
            >
              <UserRound />
              <span className="hidden sm:inline">{profileName}</span>
            </Link>
          )}
          <form action={signOutAction}>
            <Button
              type="submit"
              variant="ghost"
              size="icon-sm"
              aria-label="Odhlásit"
            >
              <LogOut />
            </Button>
          </form>
        </div>
      </div>
    </header>
  );
}
