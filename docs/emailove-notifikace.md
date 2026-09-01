# E-mailové notifikace k vyúčtování

Po uzavření akce Splitnito rozešle e-maily s QR platbou, hlídá potvrzení plateb
a nakonec pošle všem souhrn. Tenhle dokument popisuje, jak to funguje a co je
potřeba nastavit.

## Průběh

1. **Uzavření akce** — v menu akce zvolíte „Uzavřít vyúčtování“. V potvrzení je
   zaškrtávátko *Rozeslat e-maily s QR kódem*. Po uzavření dostane každý, kdo má
   platit, e-mail s částkou, QR platbou a tlačítkem **Zaplaceno**.
2. **Označení platby** — tlačítko v e-mailu vede na veřejnou stránku `/p/<token>`,
   kde je znovu QR kód a potvrzovací tlačítko. Stejné tlačítko je i v detailu
   akce v aplikaci, hned pod QR kódem. Přihlášení není potřeba, odkaz je
   podepsaný HMAC a platí 120 dní.
3. **Potvrzení příjemcem** — jakmile plátce označí platbu, příjemce dostane
   e-mail „bylo vám zaplaceno“ s tlačítkem **Peníze dorazily**.
4. **Připomínky** — každých 24 hodin se rozešle připomínka všem, kdo ještě
   nepotvrdili svůj krok. Běží to, dokud se akce nedoklikne.
5. **Souhrn** — po potvrzení poslední platby dostanou všichni (účastníci i
   správce firmy) souhrnný e-mail: náklady akce, rozpis podle lidí, provedené
   platby a celkový součet za všechny uzavřené akce.

E-maily se posílají na adresu použitou při registraci. Sloupec `profiles.email`
je zrcadlem `auth.users.email` a drží ho v synchronizaci databázový trigger.

## Nastavení

### 1. Migrace databáze

V Supabase → SQL Editor spusťte `supabase/migration_email_notifications.sql`.
Přidá e-mail na profil, přepínač `events.notify_emails` a tabulku
`email_notifications` (log odeslaných zpráv + rozvrh připomínek).

**Bez téhle migrace se detail akce nenačte** — kód počítá s novými sloupci.

### 2. Proměnné prostředí

Vzor je v `.env.example`. Minimum pro provoz:

| Proměnná | K čemu |
| --- | --- |
| `SUPABASE_SERVICE_ROLE_KEY` | čtení e-mailů a zápis logu mimo RLS; zároveň podepisuje odkazy |
| `NEXT_PUBLIC_SITE_URL` | absolutní odkazy a QR obrázky v e-mailech |
| `EMAIL_FROM`, `EMAIL_FROM_NAME` | odesílatel |
| `RESEND_API_KEY` **nebo** `SMTP_HOST` (+ `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`) | doručení |
| `CRON_SECRET` | ochrana `/api/cron/reminders` |

Když není nastavený ani Resend, ani SMTP, aplikace funguje dál — e-maily se
jen nerozesílají a v UI se volba nenabídne.

### 3. Doména odesílatele

Aby e-maily nekončily ve spamu, musí být doména v `EMAIL_FROM` ověřená u
poskytovatele (SPF, DKIM, DMARC). U Resendu stačí přidat doménu a doplnit DNS
záznamy, u vlastního SMTP je potřeba mít je nastavené ručně.

### 4. Cron

`vercel.json` definuje denní běh `/api/cron/reminders` v 7:00 UTC. Vercel k němu
sám přikládá hlavičku `Authorization: Bearer $CRON_SECRET`. Ručně se dá spustit
i přes `?secret=<CRON_SECRET>`.

## Vývoj

- Náhled šablon: `http://localhost:3000/api/email-preview?type=request|received|summary`
  (v produkci vrací 404). Parametr `&reminder=2` ukáže variantu s připomínkou.
- QR kódy pro e-maily generuje `/api/qr?t=<podepsaný token>` jako PNG.
