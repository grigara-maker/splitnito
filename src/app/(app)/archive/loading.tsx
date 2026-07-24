import { Loader2 } from "lucide-react";

export default function ArchiveLoading() {
  return (
    <div className="flex flex-col gap-8">
      <div>
        <div className="h-9 w-56 animate-pulse rounded-md bg-muted" />
        <div className="mt-2 h-5 w-80 max-w-full animate-pulse rounded-md bg-muted/70" />
      </div>
      <div className="flex items-center justify-center gap-2 py-20 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Připravuji archiv…
      </div>
    </div>
  );
}
