import Link from "next/link";
import { redirect } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { formatCzk } from "@/lib/iban";
import {
  isEventArchived,
  normalizeSettlementSummary,
  type SettlementSummary,
} from "@/lib/settlement";
import { createClient } from "@/lib/supabase/server";

export default async function HistoryPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("company_id")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) {
    redirect("/onboarding");
  }

  const { data: closedEvents } = await supabase
    .from("events")
    .select("id, name, created_at, status")
    .eq("company_id", profile.company_id)
    .eq("status", "closed")
    .order("created_at", { ascending: false });

  const eventIds = (closedEvents ?? []).map((e) => e.id);
  const settlementByEvent = new Map<
    string,
    { summary: SettlementSummary; closed_at: string }
  >();

  if (eventIds.length > 0) {
    const { data: settlements } = await supabase
      .from("settlements")
      .select("event_id, summary_data, closed_at")
      .in("event_id", eventIds);

    for (const row of settlements ?? []) {
      settlementByEvent.set(row.event_id, {
        summary: normalizeSettlementSummary(row.summary_data),
        closed_at: row.closed_at,
      });
    }
  }

  const events = (closedEvents ?? []).filter((event) =>
    isEventArchived(event.status, settlementByEvent.get(event.id)?.summary)
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-3xl font-semibold tracking-tight">
          Historie
        </h1>
        <p className="mt-1 text-muted-foreground">
          Archiv akcí, u kterých je vyúčtování kompletně zaplacené.
        </p>
      </div>

      {events.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Zatím žádné dokončené (zaplacené) akce.
        </p>
      ) : (
        <ul className="grid gap-3">
          {events.map((event) => {
            const settlement = settlementByEvent.get(event.id);
            const summary = settlement?.summary;
            const closedAt = settlement?.closed_at;

            return (
              <li key={event.id}>
                <Link
                  href={`/events/${event.id}`}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10 transition hover:ring-primary/30"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{event.name}</p>
                      <Badge variant="secondary">Hotovo</Badge>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {closedAt
                        ? new Date(closedAt).toLocaleString("cs-CZ")
                        : new Date(event.created_at).toLocaleDateString("cs-CZ")}
                    </p>
                  </div>
                  <p className="text-lg font-semibold">
                    {summary ? formatCzk(summary.totalAmount) : "—"}
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
