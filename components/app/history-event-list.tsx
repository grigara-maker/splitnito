"use client";

import { LoadingLink } from "@/components/app/loading-link";
import { Badge } from "@/components/ui/badge";
import { formatCzk } from "@/lib/iban";

type HistoryItem = {
  id: string;
  name: string;
  dateLabel: string;
  totalLabel: string;
};

export function HistoryEventList({ events }: { events: HistoryItem[] }) {
  return (
    <ul className="grid gap-3">
      {events.map((event) => (
        <li key={event.id}>
          <LoadingLink
            href={`/events/${event.id}`}
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10 transition hover:ring-primary/30"
          >
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-medium">{event.name}</p>
                <Badge variant="secondary">Hotovo</Badge>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {event.dateLabel}
              </p>
            </div>
            <p className="text-lg font-semibold">{event.totalLabel}</p>
          </LoadingLink>
        </li>
      ))}
    </ul>
  );
}
