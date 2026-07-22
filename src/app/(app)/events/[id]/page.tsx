import { notFound } from "next/navigation";

import { CloseEventButton } from "@/components/app/close-event-button";
import { ReceiptForm } from "@/components/app/receipt-form";
import { ReceiptsOverview } from "@/components/app/receipts-overview";
import { SettlementView } from "@/components/app/settlement-view";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { SettlementSummary } from "@/lib/settlement";
import { createClient } from "@/lib/supabase/server";

export default async function EventPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: event } = await supabase
    .from("events")
    .select("*")
    .eq("id", id)
    .single();

  if (!event) notFound();

  const { data: receipts } = await supabase
    .from("receipts")
    .select("id, vendor, total_amount, created_at, image_url, user_id, profiles(name)")
    .eq("event_id", id)
    .order("created_at", { ascending: false });

  let settlement: SettlementSummary | null = null;
  if (event.status === "closed") {
    const { data: row } = await supabase
      .from("settlements")
      .select("summary_data")
      .eq("event_id", id)
      .single();
    if (row?.summary_data) {
      settlement = row.summary_data as unknown as SettlementSummary;
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-heading text-3xl font-semibold tracking-tight">
              {event.name}
            </h1>
            <Badge variant={event.status === "active" ? "secondary" : "outline"}>
              {event.status === "active" ? "Aktivní" : "Uzavřená"}
            </Badge>
          </div>
          <p className="mt-1 text-muted-foreground">
            Přehled dokladů a vyúčtování ve Splitnito.
          </p>
        </div>
        {event.status === "active" ? <CloseEventButton eventId={event.id} /> : null}
      </div>

      <section className="flex flex-col gap-4">
        <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
          Doklady
        </h2>
        <ReceiptsOverview receipts={receipts ?? []} />
      </section>

      {event.status === "active" ? (
        <Card>
          <CardHeader>
            <CardTitle>Přidat doklad</CardTitle>
            <CardDescription>
              Vyplňte ručně, nebo nahrajte účtenku — OCR předvyplní dodavatele a
              částku.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ReceiptForm eventId={event.id} />
          </CardContent>
        </Card>
      ) : null}

      {settlement ? (
        <section className="flex flex-col gap-4">
          <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
            Vyúčtování
          </h2>
          <SettlementView summary={settlement} currentUserId={user!.id} />
        </section>
      ) : null}
    </div>
  );
}
