"use client";

import { usePathname } from "next/navigation";
import { useFormStatus } from "react-dom";
import {
  Building2,
  CalendarDays,
  History,
  LogOut,
  Receipt,
  UserRound,
} from "lucide-react";

import { signOutAction } from "@/lib/actions/auth";
import { LoadingLink } from "@/components/app/loading-link";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function SignOutButton() {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant="ghost"
      size="icon-sm"
      aria-label="Odhlásit"
      loading={pending}
    >
      <LogOut />
    </Button>
  );
}

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
          <LoadingLink
            href="/dashboard"
            spinner="sm"
            className="font-heading text-lg font-semibold tracking-tight rounded-lg px-1"
          >
            Splitnito
          </LoadingLink>
          <span className="hidden truncate text-sm text-muted-foreground sm:inline">
            {companyName}
            {isCompanyAdmin ? " · firma" : ""}
          </span>
        </div>

        <div className="flex flex-1 items-center justify-end gap-2 sm:gap-3">
          <LoadingLink
            href="/dashboard"
            spinner="sm"
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
          </LoadingLink>

          <LoadingLink
            href="/archive"
            spinner="sm"
            prefetch={false}
            className={cn(
              buttonVariants({
                variant: pathname.startsWith("/archive") ? "secondary" : "ghost",
                size: "sm",
              })
            )}
          >
            <Receipt />
            <span className="hidden sm:inline">Doklady</span>
          </LoadingLink>

          <LoadingLink
            href="/history"
            spinner="sm"
            className={cn(
              buttonVariants({
                variant: pathname.startsWith("/history") ? "secondary" : "ghost",
                size: "sm",
              })
            )}
          >
            <History />
            <span className="hidden sm:inline">Historie</span>
          </LoadingLink>

          {isCompanyAdmin ? (
            <LoadingLink
              href="/company"
              spinner="sm"
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
            </LoadingLink>
          ) : (
            <LoadingLink
              href="/profile"
              spinner="sm"
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
            </LoadingLink>
          )}
          <form action={signOutAction}>
            <SignOutButton />
          </form>
        </div>
      </div>
    </header>
  );
}
