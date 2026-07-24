import { ReceiptArchive } from "@/components/app/receipt-archive";

export default function ArchivePage() {
  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-heading text-3xl font-semibold tracking-tight">
          Archiv dokladů
        </h1>
        <p className="mt-1 text-muted-foreground">
          Přehled všech nahraných účtenek ve firmě — podle data, dodavatele nebo
          uživatele.
        </p>
      </div>
      <ReceiptArchive />
    </div>
  );
}
