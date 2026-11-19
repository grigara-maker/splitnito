import Link from "next/link";

import { LEGAL_LINKS, OPERATOR } from "@/lib/legal/operator";
import { cn } from "@/lib/utils";

/** Patička s právními odkazy a identifikací provozovatele (§ 435 OZ). */
export function LegalFooter({ className }: { className?: string }) {
  return (
    <footer
      className={cn(
        "border-t border-border/60 px-4 py-5 text-center text-xs text-muted-foreground",
        className
      )}
    >
      <nav
        aria-label="Právní informace"
        className="flex flex-wrap justify-center gap-x-4 gap-y-1"
      >
        {LEGAL_LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="underline-offset-4 hover:text-foreground hover:underline"
          >
            {link.label}
          </Link>
        ))}
      </nav>
      <p className="mx-auto mt-2 max-w-3xl leading-relaxed">
        Provozovatel: {OPERATOR.name}, IČO {OPERATOR.ico}, {OPERATOR.address},{" "}
        {OPERATOR.register} ·{" "}
        <a
          href={`mailto:${OPERATOR.email}`}
          className="underline-offset-4 hover:text-foreground hover:underline"
        >
          {OPERATOR.email}
        </a>
      </p>
    </footer>
  );
}
