-- Splitnito: vypínatelné denní e-mailové upomínky (per uživatel)
-- Spusť v Supabase SQL Editoru (Dashboard → SQL → New query)
--
-- Denní připomínky (24 h) lze vypnout. Po 7 dnech od první výzvy
-- přijde vždy jedna povinná upomínka — tu vypnout nelze.

alter table public.profiles
  add column if not exists daily_email_reminders boolean not null default true;

comment on column public.profiles.daily_email_reminders is
  'Když true, chodí denní upomínky na platbu / potvrzení. Po 7 dnech přijde upomínka vždy.';

notify pgrst, 'reload schema';
