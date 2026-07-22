"use client";

import { useActionState } from "react";

import { createEventAction, type ActionState } from "@/lib/actions/events";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initial: ActionState = {};

export function CreateEventForm() {
  const [state, formAction, pending] = useActionState(createEventAction, initial);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <div className="flex flex-col gap-2">
        <Label htmlFor="event-name">Název</Label>
        <Input
          id="event-name"
          name="name"
          required
          placeholder="Např. Výstava 2026"
        />
      </div>
      {state.error ? (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      ) : null}
      <Button type="submit" loading={pending}>
        Vytvořit akci
      </Button>
    </form>
  );
}
