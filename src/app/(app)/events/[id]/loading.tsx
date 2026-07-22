import { Loader2 } from "lucide-react";

export default function EventLoading() {
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-muted-foreground">
      <Loader2 className="size-8 animate-spin text-foreground" />
      <p className="text-sm">Načítám akci…</p>
    </div>
  );
}
