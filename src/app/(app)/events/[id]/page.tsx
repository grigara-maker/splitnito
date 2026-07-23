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

  const isClosed = event.status === "closed";

  // Jen data potřebná pro první paint — duplicity napříč firmou se donačtou na klientu
  const [receiptsResult, revenuesResult, settlementResult, companyResult] =
    await Promise.all([
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
      isClosed
        ? supabase
            .from("settlements")
            .select("summary_data")
            .eq("event_id", id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      isClosed
        ? supabase
            .from("companies")
            .select("name")
            .eq("id", event.company_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

  const company = companyResult.data;
  const receiptsRaw = receiptsResult.data;
  const revenuesRaw = revenuesResult.data;

  const resolveName = (uploaderName: string | null | undefined) =>
    uploaderName?.trim() || "Bývalý uživatel";

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
    profiles: { name: resolveName(r.uploader_name) },
  }));

  const revenues = (revenuesRaw ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    amount: r.amount,
    created_at: r.created_at,
    user_id: r.user_id,
    uploader_name: r.uploader_name,
    profiles: { name: resolveName(r.uploader_name) },
  }));

  // Okamžité duplicity v rámci této akce; firma se doplní na klientu
  const eventReceiptKeys = receipts.map((r) => ({
    id: r.id,
    vendor: r.vendor,
    totalAmount: Number(r.total_amount),
    purchasedAt: r.purchased_at,
    createdAt: r.created_at,
    eventId: event.id,
    eventName: event.name,
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
          companyReceipts={eventReceiptKeys}
          eventId={event.id}
          currentUserId={userId}
          isCompanyAdmin={isCompanyAdmin}
          eventActive={event.status === "active"}
          loadCompanyDuplicates
        >
          {event.status === "active" && !isCompanyAdmin ? (
            (companyKeys) => (
              <Card>
                <CardHeader>
                  <CardTitle>Přidat doklad</CardTitle>
                  <CardDescription>
                    Vyplňte ručně, nebo nahrajte účtenku — OCR předvyplní
                    dodavatele a částku.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ReceiptForm
                    eventId={event.id}
                    existingReceipts={companyKeys}
                  />
                </CardContent>
              </Card>
            )
          ) : null}
        </ReceiptsOverview>
      </section>

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
