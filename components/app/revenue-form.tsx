"use client";

import { useActionState, useEffect, useRef, useState } from "react";

import {
  createRevenueAction,
  updateRevenueAction,
  type ActionState,
} from "@/lib/actions/events";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initial: ActionState = {};

export type RevenueFormInitial = {
  id: string;
  name: string;
  amount: number;
};

export function RevenueForm({
  eventId,
  initialRevenue,
  onSaved,
}: {
  eventId: string;
  initialRevenue?: RevenueFormInitial;
  onSaved?: () => void;
}) {
  const isEdit = Boolean(initialRevenue);
  const action = isEdit ? updateRevenueAction : createRevenueAction;
  const [state, formAction, pending] = useActionState(action, initial);
  const formRef = useRef<HTMLFormElement>(null);
  const [name, setName] = useState(initialRevenue?.name ?? "");
  const [amount, setAmount] = useState(
    initialRevenue ? String(initialRevenue.amount) : ""
  );

  useEffect(() => {
    if (state.success && !isEdit) {
      setName("");
      setAmount("");
      formRef.current?.reset();
    }
    if (state.success && onSaved) onSaved();
  }, [state.success, isEdit, onSaved]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="eventId" value={eventId} />
      {initialRevenue ? (
        <input type="hidden" name="revenueId" value={initialRevenue.id} />
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2 sm:col-span-2">
          <Label htmlFor="revenue-name">Název akce</Label>
          <Input
            id="revenue-name"
            name="name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Např. sobotní trh"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="revenue-amount">Tržba (Kč)</Label>
          <Input
            id="revenue-amount"
            name="amount"
            inputMode="decimal"
            required
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0"
          />
        </div>
      </div>

      {state.error ? (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <p className="text-sm text-emerald-700" role="status">
          {state.success}
        </p>
      ) : null}

      <Button type="submit" loading={pending}>
        {isEdit ? "Uložit tržbu" : "Přidat tržbu"}
      </Button>
    </form>
  );
}
