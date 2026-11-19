# Závěrečná zpráva – právní dokumenty Splitnito

Datum: 19. 11. 2026. Legislativa: reference skillu jsou ke stejnému dni, ověření přeskočeno. Ověřeny byly jen podmínky Gemini API (viz nález 1).

## 1. Vytvořené dokumenty

| Dokument | Zdroj (Markdown) | URL |
|---|---|---|
| Podmínky užívání služby (B2B, zdarma) | `pravni/podminky-uzivani.md` | https://splitnito.fun/podminky |
| Zásady zpracování osobních údajů | `pravni/ochrana-osobnich-udaju.md` | https://splitnito.fun/ochrana-osobnich-udaju |
| Zásady používání cookies | `pravni/cookies.md` | https://splitnito.fun/cookies |
| Smlouva o zpracování osobních údajů (DPA, čl. 28 GDPR) | `pravni/zpracovatelska-smlouva.md` | https://splitnito.fun/zpracovatelska-smlouva |

Podklady: `pravni/FAKTA.md` (fakta se zdroji), `pravni/KONTROLA.md` (checklist a útok oponenta).

**Nevytvořeno záměrně:** VOP pro spotřebitele, reklamační řád, poučení o odstoupení a funkce „Odstoupit od smlouvy“, cookie lišta, prohlášení o přístupnosti. Služba je zdarma, určená podnikatelům (IČO) a používá jen nezbytnou cookie. Odůvodnění je v `KONTROLA.md`.

## 2. Změny v kódu

| Soubor | Změna |
|---|---|
| `lib/ico.ts` (nový) | kontrolní součet IČO + ověření v ARES (neexistující a zaniklé subjekty odmítne; při výpadku ARES pustí IČO s platným součtem) |
| `lib/legal/operator.ts` (nový) | identifikace provozovatele, `TERMS_VERSION`, seznam právních odkazů |
| `lib/legal/record.ts` (nový) | uložení verze a času souhlasu s podmínkami a IČO firmy |
| `lib/legal/documents.generated.ts` (generovaný) | HTML dokumentů z `pravni/*.md` |
| `scripts/build-legal.mjs`, `package.json` | `npm run legal` přegeneruje stránky z Markdownu |
| `components/legal/*` (nové) | patička s odkazy a identifikací, souhlas s podmínkami, text o IČO a DPA, šablona dokumentu |
| `src/app/(legal)/*` (nové) | 4 statické stránky dokumentů s obsahem a kotvami |
| `components/auth/register-form.tsx`, `components/app/onboarding-form.tsx` | pole **IČO** u firmy, povinný nezaškrtnutý souhlas s podmínkami, odkaz na zásady OÚ a DPA |
| `lib/actions/auth.ts`, `lib/actions/onboarding.ts` | ověření IČO před vytvořením účtu, kontrola souhlasu, uložení souhlasu (profil i metadata účtu) |
| `components/app/company-name-form.tsx`, `src/app/(app)/company/page.tsx` | IČO v Nastavení firmy (povinné při uložení, upozornění, pokud chybí) |
| `components/app/receipt-form.tsx` | informace, že doklad čte AI (Google Gemini) a výsledek je třeba zkontrolovat |
| `src/app/page.tsx`, `(auth)/login`, `(auth)/register`, `onboarding`, `(app)/layout.tsx`, `p/[token]` | patička s právními odkazy a identifikací provozovatele |
| `src/app/globals.css` | styly `.legal-prose` |
| `lib/types/database.ts`, `supabase/migration_legal_ico.sql` (nový) | sloupce `companies.ico`, `profiles.terms_version`, `profiles.terms_accepted_at` |

Ověřeno: `tsc` (bez nových chyb), `eslint` na změněných souborech, `npm run build` OK, v prohlížeči desktop i mobil (bez vodorovného scrollu), neplatné IČO odmítnuto serverem, ARES test (existující, neexistující IČO), na veřejných stránkách žádné cookies ani localStorage.

## 3. Nálezy

1. **Gemini API na bezplatném tieru (vysoká priorita).** Podmínky Gemini API (Additional Terms, verze 2025) dovolují aplikacím pro uživatele z EHP používat **jen placené služby**. V EHP se zároveň na data uplatní režim placených služeb (bez trénování), a podle toho jsou psané zásady. Provoz na free tieru je porušením smlouvy s Googlem a ohrožuje DPA vůči firmám. → zapnout fakturaci (úkol 1).
2. **Veřejný bucket `receipts`.** Fotky dokladů jsou dostupné komukoli, kdo zná URL (náhodné UUID, neindexováno). Dokumenty to popisují pravdivě, ale pro čl. 32 GDPR doporučuji privátní bucket a podepsané URL.
3. **Chyběla identifikace provozovatele na webu** (§ 435 OZ) a jakékoli právní dokumenty → doplněno.
4. **Registrace firmy bez IČO** → doplněno ověření v ARES, služba je tím vymezena jako B2B.
5. Cookies: jen `sb-…-auth-token` (nezbytná) → lišta není potřeba. Žádné trackery před souhlasem.

## 4. Co musíte udělat ručně

1. **Zapnout fakturaci pro Gemini API:** Google AI Studio → API keys → u projektu klíče `GEMINI_API_KEY` zvolit „Set up billing“ (Google Cloud Billing účet). Ceny Flash-Lite jsou za OCR dokladů zanedbatelné.
2. **Spustit migraci** `supabase/migration_legal_ico.sql` v Supabase → SQL Editor. Bez ní neprojde registrace (aplikace vypíše přesnou hlášku).
3. **Stávající firmy bez IČO:** po nasazení jim v Nastavení svítí výzva k doplnění IČO. Pokud chcete, pošlete správcům e-mail; IČO se vyžádá nejpozději při další úpravě údajů firmy.
4. **Smlouvy se zpracovateli (DPA):** ověřte, že máte přijaté DPA u Supabase (Dashboard → Organization → Legal Documents, „DPA“), Vercelu (vercel.com/legal/dpa je součástí podmínek) a Googlu (Cloud Data Processing Addendum se přijímá v Google Cloud Console při zapnutí billingu). U Seznamu (SMTP) se vztah řídí jeho podmínkami e-mailové služby.
5. **Záznamy o činnostech zpracování** (čl. 30 GDPR) si veďte interně; stačí tabulka z `FAKTA.md` kap. 3–4 doplněná o právní základy ze zásad.
6. **Nasazení:** změny jsou jen lokálně (necommitnuto, nedeployováno).

## 5. Předpoklady k potvrzení

- Pověřenec není jmenován (malý rozsah, bez zvláštních kategorií).
- Uchování korespondence 3 roky, technických logů nejvýše 90 dní, záloh nejvýše 30 dní po smazání. Ověřte podle tarifu Supabase/Vercel (Point-in-time recovery a délka záloh).
- Hlášení porušení zabezpečení firmám do 48 hodin.
- Uživatelé připojení kódem firmy jednají v souvislosti s činností firmy. Pokud by služba začala sloužit hlavně soukromým partám, je potřeba spotřebitelský režim, včetně funkce „Odstoupit od smlouvy“ (§ 1830a OZ, od 1. 1. 2027).

## 6. Kdy dokumenty revidovat

- Nový zpracovatel nebo tracker (analytika, Sentry, e-mailing): zásady OÚ čl. 4, DPA čl. 4.2 (oznámit firmám 30 dní předem), případně cookie lišta.
- Placené funkce: VOP s cenou, tlačítkem „Objednat s povinností platby“, fakturace, předplatné.
- Změna podmínek: upravit `pravni/*.md`, zvýšit `TERMS_VERSION` v `lib/legal/operator.ts`, `npm run legal`, oznámit e-mailem 30 dní předem (čl. 10).
- Sledovat: zákon o digitální ekonomice (tisk 69, v Senátu do 12. 12. 2026), Digital Omnibus (cookies v GDPR), podmínky Gemini API.

Dokumenty jsou připraveny podle aktuální legislativy a praxe velkých českých SaaS služeb; při rozšíření o finanční služby, provoz mimo ČR nebo spotřebitelský model doporučuji revizi advokátem.
