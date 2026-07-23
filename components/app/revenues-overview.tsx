"use client";

import { useMemo, useState, useTransition } from "react";
import { ArrowLeft, Pencil, Trash2 } from "lucide-react";

import { deleteRevenueAction } from "@/lib/actions/events";
import { formatCzk } from "@/lib/iban";
import { RevenueForm } from "@/components/app/revenue-form";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export type RevenueRow = {
  id: string;
  name: string;
  amount: number;
  created_at: string;
  user_id: string | null;
  uploader_name?: string | null;
  profiles: { name: string } | { name: string }[] | null;
};

function profileName(profiles: RevenueRow["profiles"]): string {
  if (Array.isArray(profiles)) return profiles[0]?.name ?? "Neznámý";
  return profiles?.name ?? "Neznámý";
}

export function RevenuesOverview({
  revenues,
  eventId,
  currentUserId,
  isCompanyAdmin,
  eventActive,
}: {
  revenues: RevenueRow[];
  eventId: string;
  currentUserId: string;
  isCompanyAdmin: boolean;
  eventActive: boolean;
}) {
  const [selected, setSelected] = useState<RevenueRow | null>(null);
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const [actionError, setActionError] = useState<string | null>(null);

  const total = useMemo(
    () => revenues.reduce((s, r) => s + Number(r.amount), 0),
    [revenues]
  );

  const byUser = useMemo(() => {
    const map = new Map<
      string,
      { name: string; items: RevenueRow[]; sum: number }
    >();
    for (const r of revenues) {
      const key =
        r.user_id ?? `anon:${r.uploader_name ?? profileName(r.profiles)}`;
      const entry = map.get(key) ?? {
        name: profileName(r.profiles),
        items: [],
        sum: 0,
      };
      entry.items.push(r);
      entry.sum += Number(r.amount);
      map.set(key, entry);
    }
    return Array.from(map.values()).sort((a, b) => b.sum - a.sum);
  }, [revenues]);

  const canManageSelected =
    selected &&
    eventActive &&
    ((selected.user_id != null && selected.user_id === currentUserId) ||
      isCompanyAdmin);

  if (revenues.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Zatím žádné tržby. Kdo si bere tržbu domů, zapište ji sem — propsíše se
        do vyúčtování.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Celkem tržby{" "}
          <span className="font-medium text-foreground">
            {formatCzk(total)}
          </span>
        </p>
      </div>

      <div className="flex flex-col gap-4">
        {byUser.map((group) => (
          <div
            key={group.name}
            className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10"
          >
            <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
              <p className="font-medium">{group.name}</p>
              <p className="text-sm font-medium">{formatCzk(group.sum)}</p>
            </div>
            <ul>
              {group.items.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    className="flex w-full flex-wrap items-center justify-between gap-2 px-4 py-3 text-left text-sm transition hover:bg-muted/50"
                    onClick={() => {
                      setSelected(r);
                      setEditing(false);
                      setActionError(null);
                    }}
                  >
                    <span className="font-medium">{r.name}</span>
                    <span className="font-medium">{formatCzk(Number(r.amount))}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <Dialog
        open={selected != null}
        onOpenChange={(open) => {
          if (!open) {
            setSelected(null);
            setEditing(false);
          }
        }}
      >
        <DialogContent
          className="max-w-[calc(100%-1.5rem)] sm:max-w-lg"
          showCloseButton
        >
          {selected ? (
            editing && canManageSelected ? (
              <>
                <DialogHeader>
                  <DialogTitle>Upravit tržbu</DialogTitle>
                  <DialogDescription>
                    {selected.name} · {profileName(selected.profiles)}
                  </DialogDescription>
                </DialogHeader>
                <RevenueForm
                  eventId={eventId}
                  initialRevenue={{
                    id: selected.id,
                    name: selected.name,
                    amount: Number(selected.amount),
                  }}
                  onSaved={() => {
                    setEditing(false);
                    setSelected(null);
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditing(false)}
                >
                  <ArrowLeft />
                  Zpět na detail
                </Button>
              </>
            ) : (
              <>
                <DialogHeader>
                  <DialogTitle>{selected.name}</DialogTitle>
                  <DialogDescription>
                    Tržba · {profileName(selected.profiles)}
                  </DialogDescription>
                </DialogHeader>
                <dl className="grid gap-3 text-sm">
                  <div>
                    <dt className="text-muted-foreground">Částka</dt>
                    <dd className="font-medium">
                      {formatCzk(Number(selected.amount))}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Zapsáno</dt>
                    <dd className="font-medium">
                      {new Date(selected.created_at).toLocaleString("cs-CZ")}
                    </dd>
                  </div>
                </dl>

                {actionError ? (
                  <p className="text-sm text-destructive">{actionError}</p>
                ) : null}

                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full sm:w-auto"
                    onClick={() => setSelected(null)}
                  >
                    <ArrowLeft />
                    Zpět
                  </Button>
                  {canManageSelected ? (
                    <>
                      <Button
                        type="button"
                        variant="secondary"
                        className="w-full sm:w-auto"
                        onClick={() => setEditing(true)}
                      >
                        <Pencil />
                        Upravit
                      </Button>
                      <Button
                        type="button"
                        variant="destructive"
                        className="w-full sm:w-auto"
                        loading={pending}
                        onClick={() => {
                          if (!selected) return;
                          if (!confirm("Opravdu smazat tuto tržbu?")) return;
                          startTransition(async () => {
                            const result = await deleteRevenueAction(
                              selected.id,
                              eventId
                            );
                            if (result.error) setActionError(result.error);
                            else setSelected(null);
                          });
                        }}
                      >
                        <Trash2 />
                        Smazat
                      </Button>
                    </>
                  ) : null}
                </div>
              </>
            )
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
