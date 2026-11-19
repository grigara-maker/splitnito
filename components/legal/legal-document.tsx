import Link from "next/link";

import { LEGAL_DOCUMENTS, type LegalSlug } from "@/lib/legal/documents.generated";

export function legalMetadata(slug: LegalSlug) {
  const doc = LEGAL_DOCUMENTS[slug];
  return { title: `${doc.title} — Splitnito` };
}

export function LegalDocument({ slug }: { slug: LegalSlug }) {
  const doc = LEGAL_DOCUMENTS[slug];

  return (
    <article className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <h1 className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
          {doc.title}
        </h1>
        <p className="text-sm text-muted-foreground">
          Účinné od {doc.effectiveFrom} · verze {doc.version}
        </p>
      </header>

      {doc.toc.length > 2 ? (
        <nav
          aria-label="Obsah dokumentu"
          className="rounded-xl bg-card p-4 text-sm ring-1 ring-foreground/10"
        >
          <p className="mb-2 font-medium">Obsah</p>
          <ol className="grid gap-1 sm:grid-cols-2">
            {doc.toc.map((item) => (
              <li key={item.id}>
                <Link
                  href={`#${item.id}`}
                  className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                >
                  {item.text}
                </Link>
              </li>
            ))}
          </ol>
        </nav>
      ) : null}

      <div
        className="legal-prose"
        dangerouslySetInnerHTML={{ __html: doc.html }}
      />
    </article>
  );
}
