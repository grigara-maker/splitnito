import { HistoryEventList } from "@/components/app/history-event-list";
import { getAppSession } from "@/lib/auth/session";
import { formatCzk } from "@/lib/iban";
import { isEventArchived } from "@/lib/settlement";
import { createClient } from "@/lib/supabase/server";

export default async function HistoryPage() {
  const { profile } = await getAppSession();
  const supabase = await createClient();

  const { data: closedEvents } = await supabase
    .from("events")
    .select("id, name, created_at, status")
    .eq("company_id", profile.company_id)
    .eq("status", "closed")
    .order("created_at", { ascending: false });

  const eventIds = (closedEvents ?? []).map((e) => e.id);
  const settlementByEvent = new Map<
    string,
    { allPaid: boolean; totalAmount: number; closed_at: string }
  >();

  if (eventIds.length > 0) {
    const { data: settlements } = await supabase
      .from("settlements")
      .select(
        "event_id, closed_at, all_paid:summary_data->>allPaid, total_amount:summary_data->>totalAmount"
      )
      .in("event_id", eventIds);

    for (const row of settlements ?? []) {
      const r = row as {
        event_id: string;
        closed_at: string;
        all_paid: string | null;
        total_amount: string | null;
      };
      settlementByEvent.set(r.event_id, {
        allPaid: r.all_paid === "true",
        totalAmount: Number(r.total_amount ?? 0),
        closed_at: r.closed_at,
      });
    }
  }

  const events = (closedEvents ?? []).filter((event) =>
    isEventArchived(event.status, settlementByEvent.get(event.id)?.allPaid)
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
        <HistoryEventList
          events={events.map((event) => {
            const settlement = settlementByEvent.get(event.id);
            return {
              id: event.id,
              name: event.name,
              dateLabel: settlement?.closed_at
                ? new Date(settlement.closed_at).toLocaleString("cs-CZ")
                : new Date(event.created_at).toLocaleDateString("cs-CZ"),
              totalLabel: settlement
                ? formatCzk(settlement.totalAmount)
                : "—",
            };
          })}
        />
      )}
    </div>
  );
}
