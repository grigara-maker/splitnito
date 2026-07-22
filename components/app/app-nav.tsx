"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Archive, Building2, LogOut, UserRound } from "lucide-react";

import { signOutAction } from "@/lib/actions/auth";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type EventOption = {
  id: string;
  name: string;
  status: string;
  waitingPayment?: boolean;
};

export function AppNav({
  profileName,
  companyName,
  events,
  isCompanyAdmin,
}: {
  profileName: string;
  companyName: string;
  events: EventOption[];
  isCompanyAdmin: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();

  // events už přicházejí jen ongoing (aktivní + čeká na platby)
  const eventMatch = pathname.match(/^\/events\/([^/]+)/);
  const showEventSwitcher = Boolean(eventMatch);
  const currentEventId =
    eventMatch?.[1] && events.some((e) => e.id === eventMatch[1])
      ? eventMatch[1]
      : (events[0]?.id ?? "");

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
          {showEventSwitcher && events.length > 0 ? (
            <>
              <label className="sr-only" htmlFor="event-switcher">
                Aktivní akce
              </label>
              <select
                id="event-switcher"
                className="h-8 max-w-[14rem] min-w-[10rem] rounded-lg border border-input bg-background px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                value={currentEventId}
                onChange={(e) => {
                  const id = e.target.value;
                  if (id) router.push(`/events/${id}`);
                }}
              >
                {events.map((event) => (
                  <option key={event.id} value={event.id}>
                    {event.waitingPayment
                      ? `${event.name} (platby)`
                      : event.name}
                  </option>
                ))}
              </select>
            </>
          ) : null}

          {isCompanyAdmin ? (
            <Link
              href="/company"
              className={cn(
                buttonVariants({
                  variant: pathname.startsWith("/company")
                    ? "secondary"
                    : "ghost",
                  size: "sm",
                })
              )}
            >
              <Building2 />
              <span className="hidden sm:inline">Firma</span>
            </Link>
          ) : null}

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
          <Link
            href="/profile"
            className={cn(
              buttonVariants({
                variant: pathname.startsWith("/profile") ? "secondary" : "ghost",
                size: "sm",
              })
            )}
          >
            <UserRound />
            <span className="hidden sm:inline">{profileName}</span>
          </Link>
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
