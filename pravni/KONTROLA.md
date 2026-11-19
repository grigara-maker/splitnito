# Kontrola dokumentů – Splitnito

Stav k 19. 11. 2026. Typ webu podle matice: **SaaS + AI (OCR) + B2B**, bez plateb, bez UGC zveřejňovaného veřejnosti, bez marketingu.

## 1. Automatická kontrola

`check_docs.py pravni --typ saas` → **0 chyb, 0 varování.**

## 2. Matice dokumentů (references/matice-dokumentu.md)

| Povinnost | Stav | Důkaz |
|---|---|---|
| Identifikace provozovatele (jméno, IČO, sídlo, rejstřík, e-mail) | ✔ | patička všech stránek (`components/legal/legal-footer.tsx`), podmínky čl. 1.1, zásady čl. 1 |
| Zásady zpracování OÚ | ✔ | `/ochrana-osobnich-udaju` |
| Zásady cookies | ✔ | `/cookies` |
| Cookie lišta | – nepotřebná | jen nezbytná cookie `sb-…-auth-token`; ověřeno v kódu a v prohlížeči (FAKTA.md kap. 5) |
| Podmínky užívání (účet, pravidla, licence) | ✔ | `/podminky` |
| Obchodní podmínky B2B | ✔ součást podmínek | podmínky čl. 1.3, 12.1 |
| Zpracovatelská smlouva (DPA, čl. 28) | ✔ | `/zpracovatelska-smlouva`, přijímá se založením firmy (podmínky čl. 4.4) |
| VOP spotřebitelské, reklamační řád | – | služba zdarma a určená podnikatelům; ochranná doložka pro případného spotřebitele v čl. 1.3, 8.2, 12.2 |
| Poučení o odstoupení + funkce „Odstoupit od smlouvy“ | – | B2B, bezplatná služba; účet lze kdykoli zrušit jedním krokem v aplikaci (čl. 9). Riziko viz kap. 4 bod 1 |
| Prohlášení o přístupnosti | – | nejde o službu elektronického obchodu se spotřebiteli; provozovatel je mikropodnik |
| Informace o AI (čl. 50 AI Act) | ✔ dobrovolně | OCR není chatbot ani deepfake; přesto informace u tlačítka nahrání (`receipt-form.tsx`), podmínky čl. 5, zásady čl. 3.7 |
| Registrace: odkaz na podmínky + zásady OÚ | ✔ | `register-form.tsx`, `onboarding-form.tsx` – povinný checkbox + uložení verze a času souhlasu |
| Smazání účtu | ✔ (existovalo) | Profil → Smazat účet, Nastavení → Smazat firmu |
| Ověření IČO u B2B | ✔ | `lib/ico.ts` – kontrolní součet + ARES (existence, zánik) |
| Záznamy o činnostech zpracování (čl. 30) | ◐ | výjimka čl. 30 odst. 5 se na pravidelné zpracování nevztahuje → provozovatel si má vést interně (ZPRAVA.md, ruční úkoly) |

## 3. Kap. 8–10 eshop-vop.md (nezákonná ujednání) – relevantní body

| Kontrola | Stav |
|---|---|
| Odkaz na platformu ODR | ✔ není nikde |
| Plošné vyloučení odpovědnosti | ✔ není; čl. 8.2 zachovává úmysl, hrubou nedbalost, § 2898 OZ a spotřebitele |
| Jednostranná změna podmínek bez oznámení | ✔ čl. 10: důvody, 30 dní e-mailem, právo bezplatně ukončit |
| Volba soudu / práva vůči spotřebiteli | ✔ prorogace jen pro podnikatele; čl. 12.2 ADR ČOI pro případného spotřebitele |
| Souhlas se zpracováním OÚ jako podmínka registrace | ✔ není; checkbox je souhlas s podmínkami, zásady jen „seznámení“ |
| Předzaškrtnuté checkboxy | ✔ žádné |
| Neurčité retenční doby | ✔ všechny doby konkrétní nebo vázané na smazání účtu/firmy |

## 4. Útok oponenta

**Inspektor ČOI / spotřebitelský advokát**
1. *„Uživatel připojený kódem firmy může být spotřebitel (parta kamarádů, firmu založí jeden OSVČ).“* Služba je bezplatná, obsah je vázaný na činnost firmy, a uživatel může smlouvu kdykoli ukončit smazáním účtu bez sankcí. Podmínky přesto výslovně zachovávají kogentní spotřebitelská práva (čl. 1.3), neomezují odpovědnost vůči spotřebiteli (čl. 8.2) a uvádějí ADR (čl. 12.2). Zbytkové riziko: § 1830a OZ od 1. 1. 2027 (funkce odstoupení). U bezplatné smlouvy bez peněžitého plnění prakticky bez dopadu; zdokumentováno v ZPRAVA.md.
2. *„Kde je identifikace podnikatele na webu?“* Patička všech stránek: jméno, IČO, sídlo, zápis v živnostenském rejstříku, e-mail.

**ÚOOÚ**
3. *„Kdo je správce obsahu firemního prostoru?“* Rozděleno jasně (zásady čl. 2): provozovatel správce účtů, firma správce obsahu, provozovatel zpracovatel s DPA. DPA obsahuje všechny náležitosti čl. 28 odst. 3 včetně hlášení porušení (48 h) a seznamu dalších zpracovatelů.
4. *„Gemini na bezplatném tieru.“* **Nález.** Podmínky Gemini API dovolují vůči uživatelům v EHP jen placené služby. Dokumenty popisují režim, který podle těchto podmínek platí v EHP (bez trénování). Provozovatel musí zapnout fakturaci, aby provoz odpovídal smlouvě s Googlem (ZPRAVA.md, ruční úkol 1).
5. *„Fotky dokladů ve veřejném bucketu.“* **Nález.** Zásady neříkají nic nepravdivého (čl. 9 popisuje náhodnou adresu, ne omezení přístupu), ale z hlediska čl. 32 GDPR je doporučen privátní bucket s podepsanými URL (ZPRAVA.md).
6. *„Prokažte, s jakým zněním uživatel souhlasil.“* Registrace ukládá `terms_version` a `terms_accepted_at` do profilu a do metadat účtu; znění verze 1.0 je v gitu (`pravni/*.md`).
7. *„Upomínka po 7 dnech nejde vypnout.“* Je to provozní (ne marketingové) sdělení v rámci vyúčtování firmy; popsáno v zásadách čl. 3.6.
8. *„Neomezené uchovávání.“* Obsah firemního prostoru maže firma (správce); doba je vázaná na existenci firmy. Doporučeno doplnit pravidlo pro neaktivní firmy (ZPRAVA.md).
