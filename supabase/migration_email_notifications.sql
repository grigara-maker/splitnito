-- Splitnito: e-mailové notifikace k vyúčtování
-- Spusť v Supabase SQL Editoru (Dashboard → SQL → New query)

-- 1) E-mail na profilu (zrcadlí auth.users.email, ať se nemusí sahat do auth schématu)
alter table public.profiles
  add column if not exists email text;

update public.profiles p
set email = u.email
from auth.users u
where u.id = p.id
  and p.email is distinct from u.email;

-- Změna e-mailu v auth se propíše do profilu
create or replace function public.sync_profile_email()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
  set email = new.email
  where id = new.id;
  return new;
end;
$$;

drop trigger if exists auth_user_email_to_profile on auth.users;
create trigger auth_user_email_to_profile
  after insert or update of email on auth.users
  for each row execute function public.sync_profile_email();

-- Profil vzniká až po signUp (complete_user_setup) — e-mail doplníme při insertu
create or replace function public.set_profile_email()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.email is null then
    select u.email into new.email from auth.users u where u.id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_set_email on public.profiles;
create trigger profiles_set_email
  before insert on public.profiles
  for each row execute function public.set_profile_email();

-- 2) Přepínač rozesílání e-mailů na akci
alter table public.events
  add column if not exists notify_emails boolean not null default true;

-- 3) Log odeslaných notifikací (idempotence + rozvrh 24h připomínek)
create table if not exists public.email_notifications (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references public.events (id) on delete cascade,
  company_id uuid references public.companies (id) on delete cascade,
  kind text not null check (kind in ('payment_request', 'payment_received', 'event_summary')),
  transfer_id text,
  recipient_id uuid,
  recipient_email text not null,
  status text not null default 'sent' check (status in ('sent', 'failed')),
  error text,
  reminder_index integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists email_notifications_event_idx
  on public.email_notifications (event_id, kind, created_at desc);

create index if not exists email_notifications_transfer_idx
  on public.email_notifications (event_id, transfer_id, kind, created_at desc);

alter table public.email_notifications enable row level security;

-- Zápis běží výhradně přes service-role klienta (obchází RLS).
drop policy if exists "Members can view company email notifications" on public.email_notifications;
create policy "Members can view company email notifications"
  on public.email_notifications for select
  using (company_id = public.current_company_id());

notify pgrst, 'reload schema';
