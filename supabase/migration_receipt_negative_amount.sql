-- Refundy: záporná celková částka na dokladu
-- Spusťte v Supabase SQL Editoru

alter table public.receipts
  drop constraint if exists receipts_total_amount_check;

alter table public.receipts
  add constraint receipts_total_amount_check
  check (total_amount >= -99999999.99 and total_amount <= 99999999.99);
