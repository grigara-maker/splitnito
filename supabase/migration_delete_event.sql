-- Splitnito: povolení smazání akce (events) členům firmy
-- Spusť v Supabase SQL Editoru

drop policy if exists "Members can delete company events" on public.events;
create policy "Members can delete company events"
  on public.events for delete
  to authenticated
  using (company_id = public.current_company_id());

notify pgrst, 'reload schema';
