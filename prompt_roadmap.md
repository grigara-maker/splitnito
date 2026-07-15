# Splitnito – Projektový plán a specifikace

Aplikace pro snadné vyúčtování společných firemních nákladů a nákupů mezi společníky a zaměstnanci na různých akcích.

## 🛠️ Architektura a Stack

- **Frontend & Backend:** Next.js (App Router), Tailwind CSS, shadcn/ui.

- **Databáze & Auth:** Supabase (PostgreSQL).

- **OCR (Čtení účtenek):** Mindee API (Free Tier - 250 dokladů/měsíc).

- **QR Platby:** Knihovna generující CZ standard SPAYD (QR Platba).

---

## 💾 Databázový model (Supabase SQL)

### 1. `companies`

- `id` (uuid, PK)

- `name` (text)

- `created_at` (timestamp)

### 2. `profiles`

- `id` (uuid, PK, odkaz na Supabase auth)

- `company_id` (uuid, FK)

- `name` (text)

- `iban` (text, nepovinné)

- `created_at` (timestamp)

### 3. `events` (Akce / Projekty)

- `id` (uuid, PK)

- `company_id` (uuid, FK)

- `name` (text)

- `status` (text - 'active' / 'closed')

- `created_at` (timestamp)

### 4. `receipts` (Účtenky / Doklady)

- `id` (uuid, PK)

- `event_id` (uuid, FK)

- `user_id` (uuid, FK - kdo to platil)

- `vendor` (text - povinné, např. "Albert")

- `total_amount` (numeric - povinné)

- `items` (jsonb - rozepsané položky, nepovinné)

- `image_url` (text - odkaz na fotku v Supabase Storage, nepovinné)

- `created_at` (timestamp)

### 5. `settlements` (Archivovaná vyúčtování)

- `id` (uuid, PK)

- `event_id` (uuid, FK)

- `summary_data` (jsonb - kdo komu kolik doplácel, finální částky)

- `closed_at` (timestamp)

---

## 🚀 Fáze vývoje (Implementační plán)

### [ ] FÁZE 1: Inicializace & Supabase (Právě probíhá)

- Založení projektu Splitnito v Next.js.

- Nastavení `.cursorrules`.

- Propojení se Supabase a vytvoření databázových tabulek (SQL).

- Nastavení registrace a přihlášení (Email + heslo) spojené s vytvořením profilu a zadáním IBANu.

### [ ] FÁZE 2: Správa akcí a profilů

- dashboard pro vytvoření nové Akce (např. "Výstava", "Kancelář - březen").

- Přepínání mezi aktivními akcemi v horním menu.

- Možnost upravit si vlastní profil (změna jména, IBANu).

### [ ] FÁZE 3: Zapisování výdajů (Ruční + Mindee OCR)

- Formulář pro přidání dokladu přiřazeného k vybrané aktivní Akci.

- Povinná pole: Dodavatel, Celková částka. Nepovinné: rozpis položek.

- Tlačítko "Vyfotit/Nahrát účtenku" -> integrace s Mindee API, které vytáhne dodavatele, částku a datum a předvyplní formulář.

### [ ] FÁZE 4: Přehledy a Dashboard akce

- Zobrazení přehledu pro danou akci:

  - Celková utracená částka na této akci.

  - Seznam všech dokladů rozdělených podle uživatelů.

  - Složky/filtry podle dodavatelů.

### [ ] FÁZE 5: Uzavření akce, Výpočet dluhu & QR Kód

- Tlačítko "Uzavřít akci" (zamkne akci pro další úpravy).

- Algoritmus spočítá:

  1. Celkovou útratu na akci.

  2. Průměrnou útratu na jednoho člověka (Celkem / počet společníků).

  3. Kdo zaplatil méně než průměr (dluží), kdo více (dostane zpět).

- Vygenerování přehledné faktury/souhrnu.

- Vygenerování bankovního QR kódu (SPAYD formát) na přesnou dlužnou částku a IBAN člověka, který má přeplatek.

- Přesun akce do sekce "Historie/Archiv".