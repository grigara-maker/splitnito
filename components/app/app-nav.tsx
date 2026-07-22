"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Archive, LogOut, UserRound } from "lucide-react";

import { signOutAction } from "@/lib/actions/auth";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

type EventOption = {
  id: string;
  name: string;
  status: "active" | "closed";
};

export function AppNav({
  profileName,
  companyName,
  events,
}: {
  profileName: string;
  companyName: string;
  events: EventOption[];
}) {
  const pathname = usePathname();
  const router = useRouter();

  const activeEvents = events.filter((e) => e.status === "active");
  const eventMatch = pathname.match(/^\/events\/([^/]+)/);
  const currentEventId = eventMatch?.[1] ?? activeEvents[0]?.id ?? "";

  return (
    <header className="sticky top-0 z-20 border-b border-border/70 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard"
            className="font-heading text-lg font-semibold tracking-tight"
          >
            Splitnito
          </Link>
          <span className="hidden text-sm text-muted-foreground sm:inline">
            {companyName}
          </span>
        </div>

        <div className="flex flex-1 items-center justify-end gap-2 sm:gap-3">
          {activeEvents.length > 0 ? (
            <Select
              value={currentEventId || undefined}
              onValueChange={(id) => {
                if (id) router.push(`/events/${id}`);
              }}
            >
              <SelectTrigger className="min-w-[10rem] max-w-[14rem] bg-background">
                <SelectValue placeholder="Vyberte akci" />
              </SelectTrigger>
              <SelectContent>
                {activeEvents.map((event) => (
                  <SelectItem key={event.id} value={event.id}>
                    {event.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
            <Button type="submit" variant="ghost" size="icon-sm" aria-label="Odhlásit">
              <LogOut />
            </Button>
          </form>
        </div>
      </div>
    </header>
  );
}
