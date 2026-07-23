import { notFound } from "next/navigation";

import { CloseEventButton } from "@/components/app/close-event-button";
import { ReceiptForm } from "@/components/app/receipt-form";
import { ReceiptsOverview } from "@/components/app/receipts-overview";
import { RevenueForm } from "@/components/app/revenue-form";
import { RevenuesOverview } from "@/components/app/revenues-overview";
import { SettlementView } from "@/components/app/settlement-view";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getAppSession } from "@/lib/auth/session";
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
  const { userId, profile } = await getAppSession();
  const supabase = await createClient();

  const { data: event } = await supabase
    .from("events")
    .select("id, name, status, company_id, created_at")
    .eq("id", id)
    .maybeSingle();

  if (!event || event.company_id !== profile.company_id) notFound();

  const [companyResult, receiptsResult, revenuesResult, settlementResult] =
    await Promise.all([
      supabase
        .from("companies")
        .select("name")
        .eq("id", event.company_id)
        .maybeSingle(),
      supabase
        .from("receipts")
        .select(
          "id, vendor, total_amount, created_at, purchased_at, user_id, uploader_name, items"
        )
        .eq("event_id", id)
        .order("created_at", { ascending: false }),
      supabase
        .from("revenues")
        .select("id, name, amount, created_at, user_id, uploader_name")
        .eq("event_id", id)
        .order("created_at", { ascending: false }),
      event.status === "closed"
        ? supabase
            .from("settlements")
            .select("summary_data")
            .eq("event_id", id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

  const company = companyResult.data;
  const receiptsRaw = receiptsResult.data;
  const revenuesRaw = revenuesResult.data;

  const userIds = Array.from(
    new Set(
      [
        ...(receiptsRaw ?? []).map((r) => r.user_id),
        ...(revenuesRaw ?? []).map((r) => r.user_id),
      ].filter((uid): uid is string => Boolean(uid))
    )
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

  const resolveName = (
    uid: string | null,
    uploaderName: string | null | undefined
  ) =>
    (uid ? nameByUser.get(uid) : null) ??
    uploaderName ??
    "Bývalý uživatel";

  // image_url se stahuje až při otevření detailu (getReceiptImageUrlAction)
  const receipts = (receiptsRaw ?? []).map((r) => ({
    id: r.id,
    vendor: r.vendor,
    total_amount: r.total_amount,
    created_at: r.created_at,
    purchased_at: r.purchased_at,
    user_id: r.user_id,
    uploader_name: r.uploader_name,
    items: r.items,
    image_url: null as string | null,
    profiles: { name: resolveName(r.user_id, r.uploader_name) },
  }));

  const revenues = (revenuesRaw ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    amount: r.amount,
    created_at: r.created_at,
    user_id: r.user_id,
    uploader_name: r.uploader_name,
    profiles: { name: resolveName(r.user_id, r.uploader_name) },
  }));

  const isCompanyAdmin = profile.role === "company";
  let settlement: SettlementSummary | null = null;
  if (settlementResult.data?.summary_data) {
    settlement = normalizeSettlementSummary(settlementResult.data.summary_data);
  }

  const waitingPayment = Boolean(
    event.status === "closed" && settlement && !settlement.allPaid
  );
  const archived = Boolean(event.status === "closed" && settlement?.allPaid);

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
            Přehled dokladů, tržeb a vyúčtování ve Splitnito.
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
          currentUserId={userId}
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

      <section className="flex flex-col gap-4">
        <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
          Tržby
        </h2>
        <RevenuesOverview
          revenues={revenues}
          eventId={event.id}
          currentUserId={userId}
          isCompanyAdmin={isCompanyAdmin}
          eventActive={event.status === "active"}
        />
      </section>

      {event.status === "active" && !isCompanyAdmin ? (
        <Card>
          <CardHeader>
            <CardTitle>Přidat tržby</CardTitle>
            <CardDescription>
              Kdo si bere tržbu domů, zapište název a částku — odečte se ve
              vyúčtování (výdaje − tržby).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RevenueForm eventId={event.id} />
          </CardContent>
        </Card>
      ) : null}

      {event.status === "active" && isCompanyAdmin ? (
        <p className="text-sm text-muted-foreground">
          Jako správce firmy vidíte všechny doklady a tržby a můžete je upravit
          nebo smazat. Přidávat je mohou jen uživatelé.
        </p>
      ) : null}

      {settlement ? (
        <section className="flex flex-col gap-4">
          <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
            Vyúčtování
          </h2>
          <SettlementView
            summary={settlement}
            currentUserId={userId}
            eventId={event.id}
            canReopen={!settlement.allPaid}
            companyName={company?.name ?? "firma"}
            eventName={event.name}
          />
        </section>
      ) : null}
    </div>
  );
}
