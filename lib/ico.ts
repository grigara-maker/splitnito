/** IČO: normalizace, kontrolní součet a ověření v registru ARES. */

export function normalizeIco(raw: string): string {
  return raw.replace(/\s+/g, "");
}

/** Kontrolní součet IČO (modulo 11) podle metodiky ČSÚ. */
export function isValidIcoChecksum(ico: string): boolean {
  if (!/^\d{8}$/.test(ico)) return false;
  const digits = ico.split("").map(Number);
  const sum = digits
    .slice(0, 7)
    .reduce((acc, digit, i) => acc + digit * (8 - i), 0);
  const check = (11 - (sum % 11)) % 10;
  return check === digits[7];
}

export type IcoVerification =
  | { ok: true; ico: string; name: string | null; verified: boolean }
  | { ok: false; error: string };

const ARES_URL =
  "https://ares.gov.cz/ekonomicke-subjekty-v-be/rest/ekonomicke-subjekty/";

/**
 * Ověří IČO v ARES. Neexistující nebo zaniklý subjekt odmítne. Když ARES
 * neodpovídá (výpadek), registraci kvůli tomu neblokuje: projde IČO
 * s platným kontrolním součtem a vrátí verified=false.
 */
export async function verifyIco(raw: string): Promise<IcoVerification> {
  const ico = normalizeIco(raw);
  if (!ico) return { ok: false, error: "Zadejte IČO firmy." };
  if (!isValidIcoChecksum(ico)) {
    return { ok: false, error: "IČO není platné. Zkontrolujte 8 číslic." };
  }

  try {
    const response = await fetch(`${ARES_URL}${ico}`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(5000),
      cache: "no-store",
    });

    if (response.status === 404) {
      return {
        ok: false,
        error: "IČO jsme v registru ARES nenašli. Zkontrolujte ho prosím.",
      };
    }
    if (!response.ok) {
      console.warn(`[splitnito/ico] ARES ${response.status} pro ${ico}`);
      return { ok: true, ico, name: null, verified: false };
    }

    const data = (await response.json()) as {
      obchodniJmeno?: string;
      datumZaniku?: string;
    };
    if (data.datumZaniku) {
      return {
        ok: false,
        error: "Podle registru ARES subjekt s tímto IČO zanikl.",
      };
    }
    return { ok: true, ico, name: data.obchodniJmeno ?? null, verified: true };
  } catch (error) {
    console.warn("[splitnito/ico] ARES nedostupný", error);
    return { ok: true, ico, name: null, verified: false };
  }
}
