-- Splitnito: kategorie dokladů — běžné doklady vs. daně a poplatky
-- Spusť v Supabase SQL Editoru

alter table public.receipts
  add column if not exists category text not null default 'expense';

alter table public.receipts
  drop constraint if exists receipts_category_check;

alter table public.receipts
  add constraint receipts_category_check check (category in ('expense', 'tax'));

notify pgrst, 'reload schema';
