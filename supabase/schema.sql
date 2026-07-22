-- Splitnito – kompletní schema pro Supabase
-- Spusťte v SQL Editoru (Dashboard → SQL → New query)

-- Extensions
create extension if not exists "pgcrypto";

-- Companies
create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  invite_code text not null unique default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
  created_at timestamptz not null default now()
);

-- Profiles (1:1 with auth.users)
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,
  name text not null,
  iban text,
  created_at timestamptz not null default now()
);

create index if not exists profiles_company_id_idx on public.profiles (company_id);

-- Events
create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  name text not null,
  status text not null default 'active' check (status in ('active', 'closed')),
  created_at timestamptz not null default now()
);

create index if not exists events_company_id_idx on public.events (company_id);

-- Receipts
create table if not exists public.receipts (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  vendor text not null,
  total_amount numeric(12, 2) not null check (total_amount >= 0),
  items jsonb,
  image_url text,
  created_at timestamptz not null default now()
);

create index if not exists receipts_event_id_idx on public.receipts (event_id);
create index if not exists receipts_user_id_idx on public.receipts (user_id);

-- Settlements
create table if not exists public.settlements (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null unique references public.events (id) on delete cascade,
  summary_data jsonb not null,
  closed_at timestamptz not null default now()
);

-- Helper: current user's company
create or replace function public.current_company_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select company_id from public.profiles where id = auth.uid()
$$;

-- RLS
alter table public.companies enable row level security;
alter table public.profiles enable row level security;
alter table public.events enable row level security;
alter table public.receipts enable row level security;
alter table public.settlements enable row level security;

-- Companies policies
create policy "Members can view own company"
  on public.companies for select
  using (id = public.current_company_id());

create policy "Authenticated users can create companies"
  on public.companies for insert
  to authenticated
  with check (true);

create policy "Members can update own company"
  on public.companies for update
  using (id = public.current_company_id());

-- Profiles policies
create policy "Users can view own profile"
  on public.profiles for select
  using (id = auth.uid());

create policy "Members can view company profiles"
  on public.profiles for select
  using (company_id = public.current_company_id());

create policy "Users can insert own profile"
  on public.profiles for insert
  to authenticated
  with check (id = auth.uid());

create policy "Users can update own profile"
  on public.profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());

-- Events policies
create policy "Members can view company events"
  on public.events for select
  using (company_id = public.current_company_id());

create policy "Members can create company events"
  on public.events for insert
  to authenticated
  with check (company_id = public.current_company_id());

create policy "Members can update company events"
  on public.events for update
  using (company_id = public.current_company_id());

-- Receipts policies
create policy "Members can view company receipts"
  on public.receipts for select
  using (
    exists (
      select 1 from public.events e
      where e.id = event_id and e.company_id = public.current_company_id()
    )
  );

create policy "Members can insert receipts on active events"
  on public.receipts for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.events e
      where e.id = event_id
        and e.company_id = public.current_company_id()
        and e.status = 'active'
    )
  );

create policy "Owners can update own receipts on active events"
  on public.receipts for update
  using (
    user_id = auth.uid()
    and exists (
      select 1 from public.events e
      where e.id = event_id and e.status = 'active'
    )
  );

create policy "Owners can delete own receipts on active events"
  on public.receipts for delete
  using (
    user_id = auth.uid()
    and exists (
      select 1 from public.events e
      where e.id = event_id and e.status = 'active'
    )
  );

-- Settlements policies
create policy "Members can view company settlements"
  on public.settlements for select
  using (
    exists (
      select 1 from public.events e
      where e.id = event_id and e.company_id = public.current_company_id()
    )
  );

create policy "Members can insert settlements"
  on public.settlements for insert
  to authenticated
  with check (
    exists (
      select 1 from public.events e
      where e.id = event_id and e.company_id = public.current_company_id()
    )
  );

-- Lookup company by invite (for registration before profile exists)
create or replace function public.get_company_by_invite(code text)
returns table (id uuid, name text)
language sql
security definer
set search_path = public
as $$
  select c.id, c.name
  from public.companies c
  where upper(c.invite_code) = upper(trim(code))
  limit 1;
$$;

grant execute on function public.get_company_by_invite(text) to anon, authenticated;
grant execute on function public.current_company_id() to authenticated;

-- Setup profilu + firmy (obchází RLS chicken-egg při registraci)
create or replace function public.complete_user_setup(
  p_name text,
  p_iban text default null,
  p_invite_code text default null,
  p_company_name text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_company_id uuid;
  v_name text := trim(p_name);
  v_iban text := nullif(trim(coalesce(p_iban, '')), '');
  v_invite text := nullif(trim(coalesce(p_invite_code, '')), '');
  v_company_name text := nullif(trim(coalesce(p_company_name, '')), '');
begin
  if v_user_id is null then
    raise exception 'Nejste přihlášeni.';
  end if;

  if v_name is null or v_name = '' then
    raise exception 'Jméno je povinné.';
  end if;

  if exists (select 1 from public.profiles where id = v_user_id) then
    return v_user_id;
  end if;

  if v_invite is not null then
    select c.id into v_company_id
    from public.companies c
    where upper(c.invite_code) = upper(v_invite)
    limit 1;

    if v_company_id is null then
      raise exception 'Invite kód není platný.';
    end if;
  else
    insert into public.companies (name)
    values (coalesce(v_company_name, 'Firma – ' || v_name))
    returning id into v_company_id;
  end if;

  insert into public.profiles (id, company_id, name, iban)
  values (v_user_id, v_company_id, v_name, v_iban);

  return v_user_id;
end;
$$;

revoke all on function public.complete_user_setup(text, text, text, text) from public;
grant execute on function public.complete_user_setup(text, text, text, text) to authenticated;

-- Storage bucket for receipt images
insert into storage.buckets (id, name, public)
values ('receipts', 'receipts', true)
on conflict (id) do nothing;

create policy "Authenticated users can upload receipts"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'receipts' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Anyone can view receipt images"
  on storage.objects for select
  using (bucket_id = 'receipts');

create policy "Owners can update own receipt images"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'receipts' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Owners can delete own receipt images"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'receipts' and (storage.foldername(name))[1] = auth.uid()::text);
