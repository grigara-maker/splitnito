-- Splitnito: role firma/uživatel, purchased_at, RLS, platby
-- Spusť v Supabase SQL Editoru

-- 1) Role na profilu
alter table public.profiles
  add column if not exists role text not null default 'member'
  check (role in ('company', 'member'));

-- Zakladatelé firem (první profil u firmy) → company
update public.profiles p
set role = 'company'
where p.id = (
  select p2.id from public.profiles p2
  where p2.company_id = p.company_id
  order by p2.created_at asc
  limit 1
);

-- 2) Čas nákupu na dokladu
alter table public.receipts
  add column if not exists purchased_at timestamptz;

update public.receipts
set purchased_at = created_at
where purchased_at is null;

-- 3) Helper: je uživatel admin firmy?
create or replace function public.is_company_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'company'
  );
$$;

grant execute on function public.is_company_admin() to authenticated;

-- 4) complete_user_setup s rolí
create or replace function public.complete_user_setup(
  p_name text,
  p_iban text default null,
  p_invite_code text default null,
  p_company_name text default null,
  p_role text default 'member'
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
  v_role text := case when lower(coalesce(p_role, 'member')) = 'company' then 'company' else 'member' end;
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

  if v_role = 'member' then
    if v_invite is null then
      raise exception 'Uživatel musí zadat kód firmy.';
    end if;
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

  insert into public.profiles (id, company_id, name, iban, role)
  values (v_user_id, v_company_id, v_name, v_iban, v_role);

  return v_user_id;
end;
$$;

revoke all on function public.complete_user_setup(text, text, text, text, text) from public;
grant execute on function public.complete_user_setup(text, text, text, text, text) to authenticated;

-- Drop old 4-arg overload if exists
drop function if exists public.complete_user_setup(text, text, text, text);

-- 5) RLS receipts — firma může editovat/mazat všechny doklady ve firmě
drop policy if exists "Owners can update own receipts on active events" on public.receipts;
drop policy if exists "Owners can delete own receipts on active events" on public.receipts;
drop policy if exists "Company can update receipts on active events" on public.receipts;
drop policy if exists "Company can delete receipts on active events" on public.receipts;

create policy "Update receipts on active events"
  on public.receipts for update
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

create policy "Delete receipts on active events"
  on public.receipts for delete
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

-- 6) Settlements UPDATE (potvrzení plateb) + DELETE (znovuotevření)
drop policy if exists "Members can update company settlements" on public.settlements;
create policy "Members can update company settlements"
  on public.settlements for update
  using (
    exists (
      select 1 from public.events e
      where e.id = event_id and e.company_id = public.current_company_id()
    )
  );

drop policy if exists "Members can delete company settlements" on public.settlements;
create policy "Members can delete company settlements"
  on public.settlements for delete
  using (
    exists (
      select 1 from public.events e
      where e.id = event_id and e.company_id = public.current_company_id()
    )
  );

-- 7) Odstranění člena firmy (jen admin) — přes RPC
create or replace function public.remove_company_member(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin_company uuid;
begin
  if not public.is_company_admin() then
    raise exception 'Pouze firma může odstraňovat uživatele.';
  end if;

  select company_id into v_admin_company
  from public.profiles where id = auth.uid();

  if p_user_id = auth.uid() then
    raise exception 'Nemůžete odstranit sami sebe.';
  end if;

  if not exists (
    select 1 from public.profiles
    where id = p_user_id and company_id = v_admin_company and role = 'member'
  ) then
    raise exception 'Uživatel nenalezen nebo není členem vaší firmy.';
  end if;

  delete from public.profiles where id = p_user_id;
end;
$$;

grant execute on function public.remove_company_member(uuid) to authenticated;

notify pgrst, 'reload schema';
