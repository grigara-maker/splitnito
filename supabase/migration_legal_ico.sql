-- Splitnito: IČO firmy (služba jen pro podnikatele) a evidence souhlasu s podmínkami
-- Spusť v Supabase SQL Editoru. Bez téhle migrace neprojde registrace firmy.

alter table public.companies
  add column if not exists ico text
  check (ico is null or ico ~ '^[0-9]{8}$');

alter table public.profiles
  add column if not exists terms_version text,
  add column if not exists terms_accepted_at timestamptz;

notify pgrst, 'reload schema';
