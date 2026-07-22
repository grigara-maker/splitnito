import Link from "next/link";
import { Plus } from "lucide-react";

import { CreateEventForm } from "@/components/app/create-event-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatCzk } from "@/lib/iban";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user!.id)
    .single();

  const { data: events } = await supabase
    .from("events")
    .select("id, name, status, created_at")
    .eq("company_id", profile!.company_id)
    .eq("status", "active")
    .order("created_at", { ascending: false });

  const eventIds = (events ?? []).map((e) => e.id);
  let totals = new Map<string, number>();

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
            Aktivní akce a společné výdaje ve Splitnito.
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <section className="flex flex-col gap-4">
          <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
            Aktivní akce
          </h2>
          {(events ?? []).length === 0 ? (
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
            <ul className="grid gap-3 sm:grid-cols-2">
              {(events ?? []).map((event) => (
                <li key={event.id}>
                  <Link
                    href={`/events/${event.id}`}
                    className="block rounded-xl bg-card p-4 ring-1 ring-foreground/10 transition hover:ring-primary/30 hover:shadow-md"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium text-foreground">{event.name}</p>
                      <Badge variant="secondary">Aktivní</Badge>
                    </div>
                    <p className="mt-3 text-2xl font-semibold tracking-tight text-foreground">
                      {formatCzk(totals.get(event.id) ?? 0)}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Celková útrata
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
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
            <Button
              variant="outline"
              className="w-full"
              render={<Link href="/history" />}
            >
              Historie uzavřených akcí
            </Button>
          </div>
        </aside>
      </div>
    </div>
  );
}
