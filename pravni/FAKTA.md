# Fakta o provozu – Splitnito

Stav k 19. 11. 2026. Dokumenty v této složce se píší jen z těchto faktů. Zdroj je u každého bodu.

## 1. Provozovatel

| Údaj | Hodnota | Zdroj |
|---|---|---|
| Jméno | Adam Grigar (fyzická osoba podnikající) | ARES 23007966 |
| IČO | 23007966 | provozovatel + ARES |
| Sídlo | Tyršova 843, 357 35 Chodov | ARES |
| Zápis | živnostenský rejstřík (v obchodním rejstříku nezapsán) | ARES `stavZdrojeRzp: AKTIVNI`, `stavZdrojeVr: NEEXISTUJICI` |
| DPH | není plátcem DPH | ARES `stavZdrojeDph: NEEXISTUJICI` |
| E-mail | grigar.adam@gmail.com | sdělil provozovatel |
| Web | https://splitnito.fun | `lib/site.ts:2` |
| Pověřenec (DPO) | nejmenován – malý rozsah, žádné zvláštní kategorie | předpoklad |

## 2. Služba

- Webová aplikace pro vyúčtování společných nákladů firem a týmů (akce, doklady, tržby, vyúčtování, QR platby). `src/app/page.tsx`, `TODO.md`
- **Celá služba je zdarma**, žádné placené funkce ani předplatné. Sdělil provozovatel.
- **Registrace je otevřená všem, ale založení firmy jen s platným IČO** (ověření v ARES). Uživatelé se připojují kódem firmy, který jim dá správce. Sdělil provozovatel; IČO doplněno v kódu touto úpravou.
- Služba je určena **podnikatelům** (B2B) a osobám, které ji používají na pozvání firmy v souvislosti s její činností.
- Jazyk: čeština. Bez mobilní aplikace.

## 3. Procesy a údaje

| Proces | Údaje | Kde v kódu |
|---|---|---|
| Registrace firmy (správce) | e-mail, heslo (hash v Supabase Auth), název firmy, **IČO** | `components/auth/register-form.tsx`, `lib/actions/auth.ts` |
| Registrace uživatele | e-mail, heslo, jméno, kód firmy, IBAN (volitelný) | tamtéž |
| Dokončení účtu (onboarding) | stejné jako registrace | `src/app/onboarding/page.tsx`, `lib/actions/onboarding.ts` |
| Přihlášení | e-mail + heslo, session cookie | `lib/actions/auth.ts:20`, `lib/supabase/*` |
| Akce, doklady | název akce, dodavatel, částka, položky, datum, kategorie (náklad/daň), fotka nebo PDF dokladu | `supabase/schema.sql`, `components/app/receipt-form.tsx` |
| Tržby | název, částka, jméno nahrávajícího | `supabase/migration_revenues.sql` |
| OCR dokladu | fotka/PDF se posílá do Google Gemini API, výsledek předvyplní formulář | `src/app/api/ocr/route.ts` |
| Vyúčtování | výpočet dluhů mezi uživateli, QR platba (SPAYD) s IBAN příjemce, jména, částky | `lib/settlement.ts`, `lib/spayd.ts` |
| Veřejná stránka platby `/p/<token>` | jméno plátce/příjemce, částka, IBAN, QR; podepsaný odkaz platný 120 dní, noindex | `src/app/p/[token]/page.tsx`, `docs/emailove-notifikace.md` |
| Transakční e-maily | výzva k platbě, potvrzení přijetí, denní upomínky (vypínatelné, po 7 dnech jedna povinná), souhrn | `lib/email/*`, `docs/emailove-notifikace.md` |
| Log e-mailů | příjemce, druh, stav, chyba, čas | `supabase/migration_email_notifications.sql` |
| Smazání účtu uživatele | účet a přihlášení smazány, doklady zůstávají firmě bez vazby | `components/app/delete-account-form.tsx` |
| Smazání firmy | firma, všechny účty, akce, doklady a soubory | `lib/actions/auth.ts` `deleteAccountAction` |
| Odebrání uživatele správcem | smazání účtu uživatele | `removeMemberAction` |

- **Marketingové e-maily, newsletter:** žádné. `lib/email/*` obsahuje jen transakční šablony.
- **Kontaktní formulář, chat, recenze, veřejný obsah:** žádné. Obsah je viditelný jen členům firmy (RLS).
- **Platby za službu:** žádné. QR platby jsou platby mezi uživateli navzájem, provozovatel peníze nepřijímá ani nedrží.
- **Retence:** data firmy existují, dokud je firma nebo správce nesmaže. Automatické mazání neaktivních účtů v kódu není.

## 4. Zpracovatelé a třetí strany

| Poskytovatel | Účel | Umístění | Zdroj |
|---|---|---|---|
| Supabase Inc. | databáze, autentizace, úložiště souborů | region EU – Irsko (Dublin); společnost USA | `lib/supabase/*`, commit „Přesuň funkce do Dublinu k databázi“ |
| Vercel Inc. | hosting aplikace, serverové funkce, cron | funkce v regionu `dub1` (Dublin); společnost USA, CDN globálně | `vercel.json` |
| Google (Gemini API) | rozpoznání textu z dokladů (OCR) | USA a další země | `src/app/api/ocr/route.ts`, `.env.example` |
| Seznam.cz, a.s. (SMTP) | odesílání transakčních e-mailů | ČR | sdělil provozovatel |
| ARES (Ministerstvo financí) | ověření IČO při založení firmy | ČR | nová úprava kódu |

- **Gemini tier:** bezplatný (sdělil provozovatel). Podmínky Gemini API (Additional Terms) umožňují vůči uživatelům v EHP používat jen placené služby; v EHP se na zpracování dat uplatní režim placených služeb (bez použití k trénování, logy jen omezenou dobu k odhalování zneužití). → nález, doporučeno zapnout fakturaci.
- Písma DM Sans a Fraunces se načítají přes `next/font/google`, tj. self-hosted při buildu, prohlížeč nekontaktuje Google. `src/app/layout.tsx`

## 5. Cookies a úložiště

| Název | Účel | Doba | Zdroj |
|---|---|---|---|
| `sb-<projekt>-auth-token` (případně `.0`, `.1`) | přihlášení (session Supabase) | 400 dní, obnovuje se; smaže se odhlášením | `node_modules/@supabase/ssr/dist/main/utils/constants.js:10` |

- Žádná analytika, reklamní ani jiné neesenciální cookies; žádný localStorage v kódu aplikace (grep `localStorage|sessionStorage|gtag|analytics` bez výsledku). → **cookie lišta není potřeba.**
- Živý web nebyl skenován (`scan_live.py`), ověřeno z kódu a v lokálním prohlížeči.

## 6. Zjištění o zabezpečení relevantní pro GDPR

- Bucket `receipts` je veřejný (`supabase/schema.sql:268`, `getPublicUrl` v `src/app/api/ocr/route.ts`): kdo zná URL, otevře fotku dokladu bez přihlášení. URL obsahuje náhodné UUID, není indexovaná. Doporučeno přejít na privátní bucket + podepsané URL.
