-- Splitnito: tržby (revenues) u akcí — jméno + částka, propsání do vyúčtování
-- Spusť v Supabase SQL Editoru

create table if not exists public.revenues (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  user_id uuid references public.profiles (id) on delete set null,
  uploader_name text,
  name text not null,
  amount numeric(12, 2) not null check (amount >= 0),
  created_at timestamptz not null default now()
);

create index if not exists revenues_event_id_idx on public.revenues (event_id);
create index if not exists revenues_user_id_idx on public.revenues (user_id);

alter table public.revenues enable row level security;

drop policy if exists "Members can view company revenues" on public.revenues;
create policy "Members can view company revenues"
  on public.revenues for select
  using (
    exists (
      select 1 from public.events e
      where e.id = event_id and e.company_id = public.current_company_id()
    )
  );

drop policy if exists "Members can insert revenues on active events" on public.revenues;
create policy "Members can insert revenues on active events"
  on public.revenues for insert
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

drop policy if exists "Update revenues on active events" on public.revenues;
create policy "Update revenues on active events"
  on public.revenues for update
  using (
    exists (
      select 1 from public.events e
      where e.id = event_id
        and e.company_id = public.current_company_id()
        and e.status = 'active'
    )
    and (
      user_id = auth.uid()
      or public.is_company_admin()
    )
  );

drop policy if exists "Delete revenues on active events" on public.revenues;
create policy "Delete revenues on active events"
  on public.revenues for delete
  using (
    exists (
      select 1 from public.events e
      where e.id = event_id
        and e.company_id = public.current_company_id()
        and e.status = 'active'
    )
    and (
      user_id = auth.uid()
      or public.is_company_admin()
    )
  );

-- Při smazání účtu zachovat tržby (jako doklady)
create or replace function public.delete_own_account()
returns text
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_uid uuid := auth.uid();
  v_role text;
  v_company uuid;
  v_name text;
  v_member_ids uuid[];
begin
  if v_uid is null then
    raise exception 'Nejste přihlášeni.';
  end if;

  select role, company_id, name
  into v_role, v_company, v_name
  from public.profiles
  where id = v_uid;

  if v_role is null then
    raise exception 'Profil nenalezen.';
  end if;

  if v_role = 'member' then
    update public.receipts
    set
      uploader_name = coalesce(nullif(uploader_name, ''), v_name),
      user_id = null
    where user_id = v_uid;

    update public.revenues
    set
      uploader_name = coalesce(nullif(uploader_name, ''), v_name),
      user_id = null
    where user_id = v_uid;

    delete from public.profiles where id = v_uid;
    perform public.hard_delete_auth_users(array[v_uid]);
    return 'member';
  end if;

  if v_role = 'company' then
    select coalesce(array_agg(id), array[]::uuid[])
    into v_member_ids
    from public.profiles
    where company_id = v_company;

    delete from public.companies where id = v_company;
    perform public.hard_delete_auth_users(v_member_ids);
    return 'company';
  end if;

  raise exception 'Neznámá role účtu.';
end;
$$;

create or replace function public.remove_company_member(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_admin_company uuid;
  v_name text;
begin
  if not public.is_company_admin() then
    raise exception 'Pouze firma může odstraňovat uživatele.';
  end if;

  select company_id into v_admin_company
  from public.profiles where id = auth.uid();

  if p_user_id = auth.uid() then
    raise exception 'Nemůžete odstranit sami sebe.';
  end if;

  select name into v_name
  from public.profiles
  where id = p_user_id and company_id = v_admin_company and role = 'member';

  if v_name is null then
    raise exception 'Uživatel nenalezen nebo není členem vaší firmy.';
  end if;

  update public.receipts
  set
    uploader_name = coalesce(nullif(uploader_name, ''), v_name),
    user_id = null
  where user_id = p_user_id;

  update public.revenues
  set
    uploader_name = coalesce(nullif(uploader_name, ''), v_name),
    user_id = null
  where user_id = p_user_id;

  delete from public.profiles where id = p_user_id;
  perform public.hard_delete_auth_users(array[p_user_id]);
end;
$$;

notify pgrst, 'reload schema';
