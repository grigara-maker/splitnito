"use client";

import Link from "next/link";
import { useActionState } from "react";

import { loginAction, type AuthState } from "@/lib/actions/auth";
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

const initial: AuthState = {};

export function LoginForm() {
  const [state, formAction, pending] = useActionState(loginAction, initial);

  return (
    <Card className="w-full max-w-md shadow-lg shadow-primary/5 bg-card/90 backdrop-blur-md">
      <CardHeader>
        <CardTitle className="font-heading text-2xl">Přihlášení</CardTitle>
        <CardDescription>
          Vítejte zpět ve Splitnito.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="flex flex-col gap-4">
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
              autoComplete="current-password"
              placeholder="••••••••"
            />
          </div>
          {state.error ? (
            <p className="text-sm text-destructive" role="alert">
              {state.error}
            </p>
          ) : null}
          <Button type="submit" size="lg" className="w-full" disabled={pending}>
            {pending ? "Přihlašuji…" : "Přihlásit se"}
          </Button>
        </form>
        <p className="mt-6 text-center text-sm text-muted-foreground">
          Nemáte účet?{" "}
          <Link
            href="/register"
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            Registrace
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
