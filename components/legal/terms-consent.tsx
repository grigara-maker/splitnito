import Link from "next/link";

/** Povinný (nezaškrtnutý) souhlas s podmínkami + informace o zpracování OÚ. */
export function TermsConsent() {
  return (
    <div className="flex flex-col gap-2">
      <label
        htmlFor="acceptTerms"
        className="flex cursor-pointer items-start gap-3"
      >
        <input
          id="acceptTerms"
          type="checkbox"
          name="acceptTerms"
          required
          className="mt-0.5 size-4 shrink-0 accent-primary"
        />
        <span className="text-sm leading-snug">
          Seznámil(a) jsem se s{" "}
          <Link
            href="/podminky"
            target="_blank"
            className="font-medium underline underline-offset-4"
          >
            podmínkami užívání
          </Link>{" "}
          a souhlasím s nimi.
        </span>
      </label>
      <p className="text-xs leading-relaxed text-muted-foreground">
        Jak zpracováváme vaše údaje, najdete v{" "}
        <Link
          href="/ochrana-osobnich-udaju"
          target="_blank"
          className="underline underline-offset-4"
        >
          zásadách ochrany osobních údajů
        </Link>
        .
      </p>
    </div>
  );
}

/** Text pro založení firmy: B2B + zpracovatelská smlouva. */
export function CompanyIcoNote() {
  return (
    <p className="text-xs leading-relaxed text-muted-foreground">
      Splitnito je určené podnikatelům, IČO ověříme v registru ARES. Založením
      firmy potvrzujete, že za ni smíte jednat, a přijímáte{" "}
      <Link
        href="/zpracovatelska-smlouva"
        target="_blank"
        className="underline underline-offset-4"
      >
        smlouvu o zpracování osobních údajů
      </Link>
      .
    </p>
  );
}
