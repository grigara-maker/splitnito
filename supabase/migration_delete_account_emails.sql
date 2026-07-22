-- Splitnito: při smazání firmy/uživatele uvolnit e-maily pro novou registraci
-- Spusť v Supabase SQL Editoru

create or replace function public.hard_delete_auth_users(p_ids uuid[])
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if p_ids is null or coalesce(array_length(p_ids, 1), 0) = 0 then
    return;
  end if;

  -- Identities blokují znovupoužití e-mailu, pokud zůstanou
  delete from auth.identities where user_id = any(p_ids);

  begin
    delete from auth.sessions where user_id = any(p_ids);
  exception
    when undefined_table then null;
  end;

  begin
    delete from auth.refresh_tokens where user_id = any(p_ids);
  exception
    when undefined_table then null;
  end;

  begin
    delete from auth.mfa_factors where user_id = any(p_ids);
  exception
    when undefined_table then null;
  end;

  delete from auth.users where id = any(p_ids);
end;
$$;

revoke all on function public.hard_delete_auth_users(uuid[]) from public;

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

    delete from public.profiles where id = v_uid;
    perform public.hard_delete_auth_users(array[v_uid]);
    return 'member';
  end if;

  if v_role = 'company' then
    select coalesce(array_agg(id), array[]::uuid[])
    into v_member_ids
    from public.profiles
    where company_id = v_company;

    -- Firma + všichni podúčty (profily), akce, doklady, settlements
    delete from public.companies where id = v_company;

    -- Auth účty firmy i uživatelů → e-maily jdou znovu registrovat
    perform public.hard_delete_auth_users(v_member_ids);

    return 'company';
  end if;

  raise exception 'Neznámá role účtu.';
end;
$$;

revoke all on function public.delete_own_account() from public;
grant execute on function public.delete_own_account() to authenticated;

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

  delete from public.profiles where id = p_user_id;
  perform public.hard_delete_auth_users(array[p_user_id]);
end;
$$;

grant execute on function public.remove_company_member(uuid) to authenticated;

notify pgrst, 'reload schema';
