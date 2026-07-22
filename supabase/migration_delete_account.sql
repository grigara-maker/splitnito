-- Splitnito: mazání účtu (uživatel vs firma)
-- Spusť v Supabase SQL Editoru

-- 1) Doklady přežijí smazání uživatele (user_id → null), soubory zůstanou
alter table public.receipts
  alter column user_id drop not null;

alter table public.receipts
  drop constraint if exists receipts_user_id_fkey;

alter table public.receipts
  add constraint receipts_user_id_fkey
  foreign key (user_id)
  references public.profiles (id)
  on delete set null;

-- Zachované jméno uploadéra po smazání účtu
alter table public.receipts
  add column if not exists uploader_name text;

update public.receipts r
set uploader_name = p.name
from public.profiles p
where r.user_id = p.id
  and (r.uploader_name is null or r.uploader_name = '');

-- 2) Smazání vlastního účtu
create or replace function public.delete_own_account()
returns text
language plpgsql
security definer
set search_path = public
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
    -- Doklady a uploady zůstanou ve firmě
    update public.receipts
    set
      uploader_name = coalesce(nullif(uploader_name, ''), v_name),
      user_id = null
    where user_id = v_uid;

    delete from public.profiles where id = v_uid;
    delete from auth.users where id = v_uid;
    return 'member';
  end if;

  if v_role = 'company' then
    select coalesce(array_agg(id), array[]::uuid[])
    into v_member_ids
    from public.profiles
    where company_id = v_company;

    -- Cascade smaže events, receipts, settlements, profiles
    delete from public.companies where id = v_company;

    if array_length(v_member_ids, 1) is not null then
      delete from auth.users where id = any(v_member_ids);
    end if;

    return 'company';
  end if;

  raise exception 'Neznámá role účtu.';
end;
$$;

revoke all on function public.delete_own_account() from public;
grant execute on function public.delete_own_account() to authenticated;

-- 3) Odstranění člena adminem — doklady zůstanou, smaže se i auth
create or replace function public.remove_company_member(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
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

  delete from public.profiles where id = p_user_id;
  delete from auth.users where id = p_user_id;
end;
$$;

grant execute on function public.remove_company_member(uuid) to authenticated;

notify pgrst, 'reload schema';
