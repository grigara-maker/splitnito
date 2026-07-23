# Splitnito – implementační checklist

- [x] 1. SQL schema + RLS (companies, profiles, events, receipts, settlements, invite_code, storage bucket)
- [x] 2. Supabase klienty (browser + server) a typy
- [x] 3. Auth stránky login/register + proxy session
- [x] 4. Registrace: vytvoření firmy / join přes invite + profil + IBAN
- [x] 5. Protected layout dashboard + redirecty
- [x] 6. Úprava profilu (jméno, IBAN)
- [x] 7. CRUD akcí (events) + přepínač aktivní akce
- [x] 8. Dashboard přehled vybrané akce (prázdný stav)
- [x] 9. Formulář ručního dokladu (vendor, amount, items)
- [x] 10. Upload obrázku účtenky do Supabase Storage
- [x] 11. API route Gemini OCR + předvyplnění formuláře
- [x] 12. Seznam dokladů podle uživatelů
- [x] 13. Filtr podle dodavatelů + total sum
- [x] 14. Uzavření akce (status `closed`)
- [x] 15. Algoritmus settlement (průměr, dlužníci, přeplatky)
- [x] 16. Uložení `settlements.summary_data`
- [x] 17. Souhrn / „faktura“ UI po uzavření
- [x] 18. SPAYD string + QR kód platby
- [x] 19. Archiv / historie uzavřených akcí
- [x] 20. Polish: loading/error stavy, validace IBAN, mobile-first UI

## Čeká na tebe

1. Spusť SQL z `supabase/schema.sql` v Supabase SQL Editoru.
2. Nastav na Vercelu (a lokálně v `.env.local`): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SITE_URL=https://splitnito.fun`, `GEMINI_API_KEY`.
3. Na Vercelu přidej doménu `splitnito.fun` a v Supabase → Authentication → URL Configuration nastav Site URL na `https://splitnito.fun` (+ Redirect URLs).
4. V Supabase Auth vypni „Confirm email“ (nebo ověř e-maily), ať registrace hned přihlásí.
