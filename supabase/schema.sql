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
