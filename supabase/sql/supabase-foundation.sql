-- Umbral foundation: real identity, household membership and least-privilege RLS.
-- Run this after the existing schema files. Existing anonymous/local rows are not
-- silently assigned to a person; review and migrate them explicitly.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 60),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Casa',
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.household_members (
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member', 'guest')),
  created_at timestamptz not null default now(),
  primary key (household_id, user_id)
);

alter table public.household_members drop constraint if exists household_members_role_check;
alter table public.household_members add constraint household_members_role_check check (role in ('owner', 'member', 'guest'));

create index if not exists household_members_user_idx on public.household_members(user_id);

create or replace function public.is_household_member(target_household uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.household_members
    where household_id = target_household and user_id = auth.uid()
  );
$$;

revoke all on function public.is_household_member(uuid) from public;
grant execute on function public.is_household_member(uuid) to authenticated;

create or replace function public.is_household_manager(target_household uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.household_members
    where household_id = target_household and user_id = auth.uid() and role in ('owner', 'member')
  );
$$;
revoke all on function public.is_household_manager(uuid) from public;
grant execute on function public.is_household_manager(uuid) to authenticated;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(nullif(new.raw_user_meta_data->>'name', ''), split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

-- Add ownership scope without fabricating ownership for old anonymous rows.
alter table public.notes add column if not exists household_id uuid references public.households(id) on delete cascade;
alter table public.events add column if not exists household_id uuid references public.households(id) on delete cascade;
alter table public.shared_expenses add column if not exists household_id uuid references public.households(id) on delete cascade;
alter table public.shared_bills add column if not exists household_id uuid references public.households(id) on delete cascade;
alter table public.shared_fixed_costs add column if not exists household_id uuid references public.households(id) on delete cascade;
alter table public.shared_settlements add column if not exists household_id uuid references public.households(id) on delete cascade;

alter table public.profiles enable row level security;
alter table public.households enable row level security;
alter table public.household_members enable row level security;

-- Remove permissive legacy policies before adding scoped policies.
drop policy if exists "Read own profile" on public.profiles;
drop policy if exists "Update own profile" on public.profiles;
drop policy if exists "Read member households" on public.households;
drop policy if exists "Create households" on public.households;
drop policy if exists "Read household members" on public.household_members;
drop policy if exists "Create first household owner" on public.household_members;
drop policy if exists "Manage members as owner" on public.household_members;
drop policy if exists "Read household expenses" on public.shared_expenses;
drop policy if exists "Create household expenses" on public.shared_expenses;
drop policy if exists "Update household expenses" on public.shared_expenses;
drop policy if exists "Delete household expenses" on public.shared_expenses;
drop policy if exists "Read household notes" on public.notes;
drop policy if exists "Create household notes" on public.notes;
drop policy if exists "Update household notes" on public.notes;
drop policy if exists "Delete household notes" on public.notes;
drop policy if exists "Read household events" on public.events;
drop policy if exists "Create household events" on public.events;
drop policy if exists "Update household events" on public.events;
drop policy if exists "Delete household events" on public.events;
drop policy if exists "Read household bills" on public.shared_bills;
drop policy if exists "Create household bills" on public.shared_bills;
drop policy if exists "Update household bills" on public.shared_bills;
drop policy if exists "Delete household bills" on public.shared_bills;
drop policy if exists "Read household fixed costs" on public.shared_fixed_costs;
drop policy if exists "Create household fixed costs" on public.shared_fixed_costs;
drop policy if exists "Update household fixed costs" on public.shared_fixed_costs;
drop policy if exists "Delete household fixed costs" on public.shared_fixed_costs;
drop policy if exists "Read household settlements" on public.shared_settlements;
drop policy if exists "Create household settlements" on public.shared_settlements;
drop policy if exists "Read shared expenses" on public.shared_expenses;
drop policy if exists "Create shared expenses" on public.shared_expenses;
drop policy if exists "Update shared expenses" on public.shared_expenses;
drop policy if exists "Delete own shared expenses" on public.shared_expenses;
drop policy if exists "Read shared bills" on public.shared_bills;
drop policy if exists "Create shared bills" on public.shared_bills;
drop policy if exists "Update shared bills" on public.shared_bills;
drop policy if exists "Delete own shared bills" on public.shared_bills;
drop policy if exists "Read shared fixed costs" on public.shared_fixed_costs;
drop policy if exists "Create shared fixed costs" on public.shared_fixed_costs;
drop policy if exists "Update shared fixed costs" on public.shared_fixed_costs;
drop policy if exists "Delete own shared fixed costs" on public.shared_fixed_costs;

create policy "Read own profile" on public.profiles for select to authenticated using (id = auth.uid());
create policy "Update own profile" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy "Read member households" on public.households for select to authenticated using (public.is_household_member(id));
create policy "Create households" on public.households for insert to authenticated with check (created_by = auth.uid());
create policy "Read household members" on public.household_members for select to authenticated using (public.is_household_member(household_id));
create policy "Create first household owner" on public.household_members for insert to authenticated with check (user_id = auth.uid() and role = 'owner' and exists (select 1 from public.households where id = household_id and created_by = auth.uid()));
create policy "Manage members as owner" on public.household_members for all to authenticated using (exists (select 1 from public.household_members owner where owner.household_id = household_members.household_id and owner.user_id = auth.uid() and owner.role = 'owner')) with check (exists (select 1 from public.household_members owner where owner.household_id = household_members.household_id and owner.user_id = auth.uid() and owner.role = 'owner'));

create policy "Read household expenses" on public.shared_expenses for select to authenticated using (public.is_household_manager(household_id));
create policy "Create household expenses" on public.shared_expenses for insert to authenticated with check (public.is_household_manager(household_id) and created_by = auth.uid());
create policy "Update household expenses" on public.shared_expenses for update to authenticated using (public.is_household_manager(household_id)) with check (public.is_household_manager(household_id));
create policy "Delete household expenses" on public.shared_expenses for delete to authenticated using (public.is_household_manager(household_id) and created_by = auth.uid());

drop policy if exists "Read shared or own notes" on public.notes;
drop policy if exists "Create notes for self" on public.notes;
drop policy if exists "Update shared or own notes" on public.notes;
drop policy if exists "Delete own notes" on public.notes;
create policy "Read household notes" on public.notes for select to authenticated using (public.is_household_member(household_id) and (scope = 'shared' or owner_id = auth.uid()));
create policy "Create household notes" on public.notes for insert to authenticated with check (public.is_household_member(household_id) and owner_id = auth.uid());
create policy "Update household notes" on public.notes for update to authenticated using (public.is_household_member(household_id) and (scope = 'shared' or owner_id = auth.uid())) with check (public.is_household_member(household_id) and (scope = 'shared' or owner_id = auth.uid()));
create policy "Delete household notes" on public.notes for delete to authenticated using (public.is_household_member(household_id) and owner_id = auth.uid());

drop policy if exists "Read events" on public.events;
drop policy if exists "Create events" on public.events;
drop policy if exists "Update events" on public.events;
drop policy if exists "Delete events" on public.events;
create policy "Read household events" on public.events for select to authenticated using (public.is_household_member(household_id));
create policy "Create household events" on public.events for insert to authenticated with check (public.is_household_member(household_id) and owner_id = auth.uid());
create policy "Update household events" on public.events for update to authenticated using (public.is_household_member(household_id)) with check (public.is_household_member(household_id));
create policy "Delete household events" on public.events for delete to authenticated using (public.is_household_member(household_id));

create policy "Read household bills" on public.shared_bills for select to authenticated using (public.is_household_manager(household_id));
create policy "Create household bills" on public.shared_bills for insert to authenticated with check (public.is_household_manager(household_id) and created_by = auth.uid());
create policy "Update household bills" on public.shared_bills for update to authenticated using (public.is_household_manager(household_id)) with check (public.is_household_manager(household_id));
create policy "Delete household bills" on public.shared_bills for delete to authenticated using (public.is_household_manager(household_id) and created_by = auth.uid());

create policy "Read household fixed costs" on public.shared_fixed_costs for select to authenticated using (public.is_household_manager(household_id));
create policy "Create household fixed costs" on public.shared_fixed_costs for insert to authenticated with check (public.is_household_manager(household_id) and (created_by is null or created_by = auth.uid()));
create policy "Update household fixed costs" on public.shared_fixed_costs for update to authenticated using (public.is_household_manager(household_id)) with check (public.is_household_manager(household_id));
create policy "Delete household fixed costs" on public.shared_fixed_costs for delete to authenticated using (public.is_household_manager(household_id));

-- Shared settlement visibility is scoped to the household.
alter table public.shared_settlements enable row level security;
drop policy if exists "Read shared settlements" on public.shared_settlements;
drop policy if exists "Create shared settlements" on public.shared_settlements;
create policy "Read household settlements" on public.shared_settlements for select to authenticated using (public.is_household_manager(household_id));
create policy "Create household settlements" on public.shared_settlements for insert to authenticated with check (public.is_household_manager(household_id) and (created_by is null or created_by = auth.uid()));

-- Realtime must never be used as an authorization layer; RLS remains authoritative.
alter table public.shared_expenses replica identity full;
alter table public.shared_bills replica identity full;
