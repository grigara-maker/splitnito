import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus } from "lucide-react";

import { CreateEventForm } from "@/components/app/create-event-form";
import { EventCards } from "@/components/app/event-cards";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  isEventOngoing,
  normalizeSettlementSummary,
  type SettlementSummary,
} from "@/lib/settlement";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export default async function DashboardPage() {
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

  const { data: allEvents, error: eventsError } = await supabase
    .from("events")
    .select("id, name, status, created_at")
    .eq("company_id", profile.company_id)
    .order("created_at", { ascending: false });

  if (eventsError) {
    console.error("events query failed", eventsError);
  }

  const closedIds = (allEvents ?? [])
    .filter((e) => e.status === "closed")
    .map((e) => e.id);

  const settlementByEvent = new Map<string, SettlementSummary>();
  if (closedIds.length > 0) {
    const { data: settlements } = await supabase
      .from("settlements")
      .select("event_id, summary_data")
      .in("event_id", closedIds);

    for (const row of settlements ?? []) {
      settlementByEvent.set(
        row.event_id,
        normalizeSettlementSummary(row.summary_data)
      );
    }
  }

  const events = (allEvents ?? []).filter((e) =>
    isEventOngoing(e.status, settlementByEvent.get(e.id))
  );

  const eventIds = events.map((e) => e.id);
  const totals = new Map<string, number>();

  if (eventIds.length > 0) {
    const { data: receipts } = await supabase
      .from("receipts")
      .select("event_id, total_amount")
      .in("event_id", eventIds);

    for (const r of receipts ?? []) {
      totals.set(
        r.event_id,
        (totals.get(r.event_id) ?? 0) + Number(r.total_amount)
      );
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-heading text-3xl font-semibold tracking-tight">
            Dashboard
          </h1>
          <p className="mt-1 text-muted-foreground">
            Aktivní akce a akce čekající na platby ve Splitnito.
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <section className="flex flex-col gap-4">
          <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
            Aktivní akce
          </h2>
          {events.length === 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>Zatím žádná akce</CardTitle>
                <CardDescription>
                  Vytvořte první akci — například „Výstava“ nebo „Kancelář –
                  březen“.
                </CardDescription>
              </CardHeader>
            </Card>
          ) : (
            <EventCards
              events={events.map((event) => ({
                id: event.id,
                name: event.name,
                waiting:
                  event.status === "closed" &&
                  !settlementByEvent.get(event.id)?.allPaid,
                total: totals.get(event.id) ?? 0,
              }))}
            />
          )}
        </section>

        <aside>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plus className="size-4" />
                Nová akce
              </CardTitle>
              <CardDescription>
                Pojmenujte projekt nebo výlet, ke kterému budete psát doklady.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <CreateEventForm />
            </CardContent>
          </Card>
          <div className="mt-4">
            <Link
              href="/history"
              className={cn(buttonVariants({ variant: "outline" }), "w-full")}
            >
              Historie zaplacených akcí
            </Link>
          </div>
        </aside>
      </div>
    </div>
  );
}
