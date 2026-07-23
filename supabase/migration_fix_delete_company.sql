-- Splitnito: oprava mazání firmy/účtu (varchar vs uuid) + spolehlivé uvolnění e-mailů
-- Spusť v Supabase SQL Editoru

create or replace function public.hard_delete_auth_users(p_ids uuid[])
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_ids_text text[];
begin
  if p_ids is null or coalesce(array_length(p_ids, 1), 0) = 0 then
    return;
  end if;

  -- auth.identities / sessions často mají user_id jako text/varchar → cast na text
  v_ids_text := array(select x::text from unnest(p_ids) as x);

  begin
    delete from auth.identities where user_id::text = any (v_ids_text);
  exception
    when undefined_table then null;
    when undefined_column then null;
    when invalid_text_representation then null;
  end;

  begin
    delete from auth.sessions where user_id::text = any (v_ids_text);
  exception
    when undefined_table then null;
    when undefined_column then null;
    when invalid_text_representation then null;
  end;

  begin
    delete from auth.refresh_tokens where user_id::text = any (v_ids_text);
  exception
    when undefined_table then null;
    when undefined_column then null;
    when invalid_text_representation then null;
  end;

  begin
    delete from auth.mfa_factors where user_id::text = any (v_ids_text);
  exception
    when undefined_table then null;
    when undefined_column then null;
    when invalid_text_representation then null;
  end;

  begin
    delete from auth.one_time_tokens where user_id::text = any (v_ids_text);
  exception
    when undefined_table then null;
    when undefined_column then null;
    when invalid_text_representation then null;
  end;

  delete from auth.users where id = any (p_ids);
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

    if to_regclass('public.revenues') is not null then
      update public.revenues
      set
        uploader_name = coalesce(nullif(uploader_name, ''), v_name),
        user_id = null
      where user_id = v_uid;
    end if;

    delete from public.profiles where id = v_uid;
    perform public.hard_delete_auth_users(array[v_uid]);
    return 'member';
  end if;

  if v_role = 'company' then
    select coalesce(array_agg(id), array[]::uuid[])
    into v_member_ids
    from public.profiles
    where company_id = v_company;

    -- Cascade: events → receipts, revenues, settlements + profiles
    delete from public.companies where id = v_company;

    -- Auth účty všech členů (včetně admina) → e-maily znovu použitelné
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

  if to_regclass('public.revenues') is not null then
    update public.revenues
    set
      uploader_name = coalesce(nullif(uploader_name, ''), v_name),
      user_id = null
    where user_id = p_user_id;
  end if;

  delete from public.profiles where id = p_user_id;
  perform public.hard_delete_auth_users(array[p_user_id]);
end;
$$;

grant execute on function public.remove_company_member(uuid) to authenticated;

notify pgrst, 'reload schema';
