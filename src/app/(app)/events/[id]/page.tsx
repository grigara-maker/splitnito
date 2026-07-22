import { notFound, redirect } from "next/navigation";

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
import {
  normalizeSettlementSummary,
  type SettlementSummary,
} from "@/lib/settlement";
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

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, company_id")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) redirect("/onboarding");

  const { data: event } = await supabase
    .from("events")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!event || event.company_id !== profile.company_id) notFound();

  const { data: receiptsRaw } = await supabase
    .from("receipts")
    .select(
      "id, vendor, total_amount, created_at, purchased_at, image_url, user_id, items"
    )
    .eq("event_id", id)
    .order("created_at", { ascending: false });

  const userIds = Array.from(
    new Set((receiptsRaw ?? []).map((r) => r.user_id))
  );
  const nameByUser = new Map<string, string>();

  if (userIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, name")
      .in("id", userIds);

    for (const p of profiles ?? []) {
      nameByUser.set(p.id, p.name);
    }
  }

  const receipts = (receiptsRaw ?? []).map((r) => ({
    ...r,
    profiles: { name: nameByUser.get(r.user_id) ?? "Neznámý" },
  }));

  const isCompanyAdmin = profile.role === "company";
  let settlement: SettlementSummary | null = null;
  if (event.status === "closed") {
    const { data: row } = await supabase
      .from("settlements")
      .select("summary_data")
      .eq("event_id", id)
      .maybeSingle();
    if (row?.summary_data) {
      settlement = normalizeSettlementSummary(row.summary_data);
    }
  }

  const waitingPayment = Boolean(
    event.status === "closed" && settlement && !settlement.allPaid
  );
  const archived = Boolean(
    event.status === "closed" && settlement?.allPaid
  );

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-heading text-3xl font-semibold tracking-tight">
              {event.name}
            </h1>
            <Badge
              variant={
                event.status === "active"
                  ? "secondary"
                  : waitingPayment
                    ? "outline"
                    : "secondary"
              }
            >
              {event.status === "active"
                ? "Aktivní"
                : waitingPayment
                  ? "Čeká na platby"
                  : archived
                    ? "Hotovo"
                    : "Uzavřená"}
            </Badge>
          </div>
          <p className="mt-1 text-muted-foreground">
            Přehled dokladů a vyúčtování ve Splitnito.
          </p>
        </div>
        {event.status === "active" ? (
          <CloseEventButton eventId={event.id} />
        ) : null}
      </div>

      <section className="flex flex-col gap-4">
        <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
          Doklady
        </h2>
        <ReceiptsOverview
          receipts={receipts}
          eventId={event.id}
          currentUserId={user.id}
          isCompanyAdmin={isCompanyAdmin}
          eventActive={event.status === "active"}
        />
      </section>

      {event.status === "active" && !isCompanyAdmin ? (
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

      {event.status === "active" && isCompanyAdmin ? (
        <p className="text-sm text-muted-foreground">
          Jako správce firmy vidíte všechny doklady a můžete je upravit nebo
          smazat. Přidávat doklady mohou jen uživatelé.
        </p>
      ) : null}

      {settlement ? (
        <section className="flex flex-col gap-4">
          <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
            Vyúčtování
          </h2>
          <SettlementView
            summary={settlement}
            currentUserId={user.id}
            eventId={event.id}
            canReopen={!settlement.allPaid}
          />
        </section>
      ) : null}
    </div>
  );
}
