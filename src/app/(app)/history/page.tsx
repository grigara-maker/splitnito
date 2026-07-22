import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { formatCzk } from "@/lib/iban";
import type { SettlementSummary } from "@/lib/settlement";
import { createClient } from "@/lib/supabase/server";

export default async function HistoryPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("company_id")
    .eq("id", user!.id)
    .single();

  const { data: events } = await supabase
    .from("events")
    .select("id, name, created_at, settlements(summary_data, closed_at)")
    .eq("company_id", profile!.company_id)
    .eq("status", "closed")
    .order("created_at", { ascending: false });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-3xl font-semibold tracking-tight">
          Historie
        </h1>
        <p className="mt-1 text-muted-foreground">
          Archiv uzavřených akcí a vyúčtování.
        </p>
      </div>

      {(events ?? []).length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Zatím žádné uzavřené akce.
        </p>
      ) : (
        <ul className="grid gap-3">
          {(events ?? []).map((event) => {
            const settlementRow = Array.isArray(event.settlements)
              ? event.settlements[0]
              : event.settlements;
            const summary = settlementRow?.summary_data as
              | SettlementSummary
              | undefined;
            const closedAt = settlementRow?.closed_at;

            return (
              <li key={event.id}>
                <Link
                  href={`/events/${event.id}`}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10 transition hover:ring-primary/30"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{event.name}</p>
                      <Badge variant="outline">Uzavřená</Badge>
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
