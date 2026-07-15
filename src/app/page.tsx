import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6">
      <main className="flex max-w-lg flex-col items-center gap-8 text-center">
        <div className="flex flex-col gap-3">
          <h1 className="text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
            Splitnito
          </h1>
          <p className="text-lg text-muted-foreground sm:text-xl">
            Chytré vyúčtování firemních nákladů
          </p>
        </div>
        <Button size="lg" className="min-w-40">
          Přihlásit se
        </Button>
      </main>
    </div>
  );
}
