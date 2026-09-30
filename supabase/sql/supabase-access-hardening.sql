-- Apply after supabase-foundation.sql on an existing project.
-- Guests can see shared notes/events, but never finance or settlement data.

alter table public.household_members drop constraint if exists household_members_role_check;
alter table public.household_members add constraint household_members_role_check check (role in ('owner', 'member', 'guest'));

create or replace function public.is_household_manager(target_household uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.household_members
    where household_id = target_household and user_id = auth.uid() and role in ('owner', 'member')
  );
$$;
revoke all on function public.is_household_manager(uuid) from public;
grant execute on function public.is_household_manager(uuid) to authenticated;

-- Replace any earlier finance policies with manager-only policies.
drop policy if exists "Read household expenses" on public.shared_expenses;
drop policy if exists "Create household expenses" on public.shared_expenses;
drop policy if exists "Update household expenses" on public.shared_expenses;
drop policy if exists "Delete household expenses" on public.shared_expenses;
create policy "Read household expenses" on public.shared_expenses for select to authenticated using (public.is_household_manager(household_id));
create policy "Create household expenses" on public.shared_expenses for insert to authenticated with check (public.is_household_manager(household_id) and created_by = auth.uid());
create policy "Update household expenses" on public.shared_expenses for update to authenticated using (public.is_household_manager(household_id)) with check (public.is_household_manager(household_id));
create policy "Delete household expenses" on public.shared_expenses for delete to authenticated using (public.is_household_manager(household_id) and created_by = auth.uid());

 drop policy if exists "Read household bills" on public.shared_bills;
drop policy if exists "Create household bills" on public.shared_bills;
drop policy if exists "Update household bills" on public.shared_bills;
drop policy if exists "Delete household bills" on public.shared_bills;
create policy "Read household bills" on public.shared_bills for select to authenticated using (public.is_household_manager(household_id));
create policy "Create household bills" on public.shared_bills for insert to authenticated with check (public.is_household_manager(household_id) and created_by = auth.uid());
create policy "Update household bills" on public.shared_bills for update to authenticated using (public.is_household_manager(household_id)) with check (public.is_household_manager(household_id));
create policy "Delete household bills" on public.shared_bills for delete to authenticated using (public.is_household_manager(household_id) and created_by = auth.uid());

 drop policy if exists "Read household fixed costs" on public.shared_fixed_costs;
drop policy if exists "Create household fixed costs" on public.shared_fixed_costs;
drop policy if exists "Update household fixed costs" on public.shared_fixed_costs;
drop policy if exists "Delete household fixed costs" on public.shared_fixed_costs;
create policy "Read household fixed costs" on public.shared_fixed_costs for select to authenticated using (public.is_household_manager(household_id));
create policy "Create household fixed costs" on public.shared_fixed_costs for insert to authenticated with check (public.is_household_manager(household_id) and (created_by is null or created_by = auth.uid()));
create policy "Update household fixed costs" on public.shared_fixed_costs for update to authenticated using (public.is_household_manager(household_id)) with check (public.is_household_manager(household_id));
create policy "Delete household fixed costs" on public.shared_fixed_costs for delete to authenticated using (public.is_household_manager(household_id));

 drop policy if exists "Read household settlements" on public.shared_settlements;
drop policy if exists "Create household settlements" on public.shared_settlements;
create policy "Read household settlements" on public.shared_settlements for select to authenticated using (public.is_household_manager(household_id));
create policy "Create household settlements" on public.shared_settlements for insert to authenticated with check (public.is_household_manager(household_id) and (created_by is null or created_by = auth.uid()));
