import Link from "next/link";
import { ArrowRight, Receipt, Scale, ShieldCheck } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

export default function Home() {
  return (
    <div className="relative flex min-h-full flex-1 flex-col overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_oklch(0.92_0.04_200)_0%,_transparent_55%),radial-gradient(ellipse_at_bottom_right,_oklch(0.93_0.03_160)_0%,_transparent_45%),linear-gradient(180deg,_oklch(0.985_0.01_200)_0%,_oklch(0.96_0.02_180)_100%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.35] [background-image:linear-gradient(oklch(0.55_0.04_200_/_0.07)_1px,transparent_1px),linear-gradient(90deg,oklch(0.55_0.04_200_/_0.07)_1px,transparent_1px)] [background-size:48px_48px] [mask-image:radial-gradient(ellipse_at_center,black_20%,transparent_75%)]"
      />

      <header className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6">
        <span className="font-heading text-lg font-semibold tracking-tight text-foreground">
          Splitnito
        </span>
        <div className="flex items-center gap-2">
          <Link
            href="/login"
            className={cn(buttonVariants({ variant: "ghost" }))}
          >
            Přihlásit se
          </Link>
          <Link href="/register" className={cn(buttonVariants())}>
            Začít zdarma
          </Link>
        </div>
      </header>

      <main className="relative z-10 mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center gap-16 px-6 pb-20 pt-8 lg:flex-row lg:items-center lg:gap-20 lg:pt-4">
        <section className="flex max-w-xl flex-col gap-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div className="flex flex-col gap-5">
            <h1 className="font-heading text-5xl font-semibold tracking-tight text-foreground sm:text-6xl lg:text-7xl">
              Splitnito
            </h1>
            <p className="max-w-md text-lg leading-relaxed text-muted-foreground sm:text-xl">
              Chytré vyúčtování firemních nákladů — férově, transparentně a bez
              tabulkových chaosů.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/register"
              className={cn(buttonVariants({ size: "lg" }), "min-w-40")}
            >
              Vytvořit účet
              <ArrowRight data-icon="inline-end" />
            </Link>
            <Link
              href="/login"
              className={cn(
                buttonVariants({ size: "lg", variant: "outline" }),
                "min-w-40 bg-background/60 backdrop-blur-sm"
              )}
            >
              Přihlásit se
            </Link>
          </div>

          <ul className="grid gap-4 pt-2 sm:grid-cols-3">
            {[
              {
                icon: Receipt,
                title: "Účtenky",
                text: "Ručně nebo OCR",
              },
              {
                icon: Scale,
                title: "Vyúčtování",
                text: "Automatický průměr",
              },
              {
                icon: ShieldCheck,
                title: "QR platby",
                text: "CZ SPAYD standard",
              },
            ].map(({ icon: Icon, title, text }) => (
              <li key={title} className="flex items-start gap-3">
                <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/8 text-primary ring-1 ring-primary/10">
                  <Icon className="size-4" />
                </span>
                <div>
                  <p className="text-sm font-medium text-foreground">{title}</p>
                  <p className="text-sm text-muted-foreground">{text}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <Card className="w-full max-w-md self-center bg-card/80 shadow-xl shadow-primary/5 ring-foreground/8 backdrop-blur-md animate-in fade-in slide-in-from-bottom-6 duration-1000 fill-mode-both">
          <CardHeader>
            <CardTitle className="font-heading text-xl">Přihlášení</CardTitle>
            <CardDescription>
              Vstupte do Splitnito a spravujte společné firemní výdaje.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="landing-email">E-mail</Label>
                <Input
                  id="landing-email"
                  name="email"
                  type="email"
                  placeholder="vy@firma.cz"
                  autoComplete="email"
                  disabled
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="landing-password">Heslo</Label>
                <Input
                  id="landing-password"
                  name="password"
                  type="password"
                  placeholder="••••••••"
                  autoComplete="current-password"
                  disabled
                />
              </div>
              <Link
                href="/login"
                className={cn(buttonVariants({ size: "lg" }), "w-full")}
              >
                Přihlásit se
              </Link>
            </div>
            <Separator className="my-6" />
            <p className="text-center text-sm text-muted-foreground">
              Nemáte účet?{" "}
              <Link
                href="/register"
                className="font-medium text-foreground underline-offset-4 hover:underline"
              >
                Registrujte se
              </Link>
            </p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
