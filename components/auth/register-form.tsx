"use client";

import Link from "next/link";
import { useActionState, useState } from "react";

import { registerAction, type AuthState } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const initial: AuthState = {};

export function RegisterForm() {
  const [state, formAction, pending] = useActionState(registerAction, initial);
  const [mode, setMode] = useState<"create" | "join">("create");

  return (
    <Card className="w-full max-w-md shadow-lg shadow-primary/5 bg-card/90 backdrop-blur-md">
      <CardHeader>
        <CardTitle className="font-heading text-2xl">Registrace</CardTitle>
        <CardDescription>
          Vytvořte firmu ve Splitnito nebo se připojte přes invite kód.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="mode" value={mode} />

          <div className="flex flex-col gap-2">
            <Label htmlFor="name">Jméno</Label>
            <Input id="name" name="name" required placeholder="Jan Novák" />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              placeholder="vy@firma.cz"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="password">Heslo</Label>
            <Input
              id="password"
              name="password"
              type="password"
              required
              minLength={6}
              autoComplete="new-password"
              placeholder="min. 6 znaků"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="iban">IBAN (volitelné)</Label>
            <Input
              id="iban"
              name="iban"
              placeholder="CZ65 0800 0000 0012 3456 7890"
            />
          </div>

          <Tabs
            value={mode}
            onValueChange={(v) => setMode(v as "create" | "join")}
          >
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="create">Nová firma</TabsTrigger>
              <TabsTrigger value="join">Invite kód</TabsTrigger>
            </TabsList>
            <TabsContent value="create" className="mt-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="companyName">Název firmy</Label>
                <Input
                  id="companyName"
                  name="companyName"
                  placeholder="Moje s.r.o."
                  required={mode === "create"}
                />
              </div>
            </TabsContent>
            <TabsContent value="join" className="mt-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="inviteCode">Invite kód</Label>
                <Input
                  id="inviteCode"
                  name="inviteCode"
                  placeholder="ABCD1234"
                  required={mode === "join"}
                  className="uppercase"
                />
              </div>
            </TabsContent>
          </Tabs>

          {state.error ? (
            <p className="text-sm text-destructive" role="alert">
              {state.error}
            </p>
          ) : null}

          <Button type="submit" size="lg" className="w-full" disabled={pending}>
            {pending ? "Vytvářím účet…" : "Vytvořit účet"}
          </Button>
        </form>
        <p className="mt-6 text-center text-sm text-muted-foreground">
          Už máte účet?{" "}
          <Link
            href="/login"
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            Přihlásit se
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
