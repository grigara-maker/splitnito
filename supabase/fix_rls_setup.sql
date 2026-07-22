-- Spusť celé v Supabase → SQL Editor → Run
-- Pak případně: Project Settings → API → Reload schema (nebo počkej pár sekund)

drop policy if exists "Users can view own profile" on public.profiles;
create policy "Users can view own profile"
  on public.profiles for select
  using (id = auth.uid());

drop function if exists public.complete_user_setup(text, text, text, text);

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

-- Obnoví PostgREST schema cache
notify pgrst, 'reload schema';
