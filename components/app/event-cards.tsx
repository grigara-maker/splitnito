"use client";

import { LoadingLink } from "@/components/app/loading-link";
import { Badge } from "@/components/ui/badge";
import { formatCzk } from "@/lib/iban";

type EventCard = {
  id: string;
  name: string;
  waiting: boolean;
  total: number;
};

export function EventCards({ events }: { events: EventCard[] }) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {events.map((event) => (
        <li key={event.id}>
          <LoadingLink
            href={`/events/${event.id}`}
            className="block rounded-xl bg-card p-4 ring-1 ring-foreground/10 transition hover:shadow-md hover:ring-primary/30"
          >
            <div className="flex items-start justify-between gap-2">
              <p className="font-medium text-foreground">{event.name}</p>
              <Badge variant={event.waiting ? "outline" : "secondary"}>
                {event.waiting ? "Čeká na platby" : "Aktivní"}
              </Badge>
            </div>
            <p className="mt-3 text-2xl font-semibold tracking-tight text-foreground">
              {formatCzk(event.total)}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">Celková útrata</p>
          </LoadingLink>
        </li>
      ))}
    </ul>
  );
}
