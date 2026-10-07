-- Casa al día: el mantenimiento que se repite cada cierto tiempo (caldera, filtros, cortinas,
-- detector de humo, seguro…). Cada cosa tiene una frecuencia en días y la fecha de la última
-- vez que se hizo; la app calcula cuándo toca. Lo ven y lo marcan los dos.
-- Ejecutar después de supabase-foundation.sql. Es idempotente.

create table if not exists public.home_care (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 80),
  icon text check (char_length(icon) <= 40),
  every_days integer not null default 90 check (every_days between 1 and 1825),
  last_done date,
  done_by text check (char_length(done_by) <= 40),
  notes text check (char_length(notes) <= 200),
  created_by uuid references auth.users(id) default auth.uid(),
  created_at timestamptz not null default now()
);
create index if not exists home_care_household_idx on public.home_care (household_id);

alter table public.home_care enable row level security;
alter table public.home_care replica identity full;
drop policy if exists "Household members read" on public.home_care;
drop policy if exists "Household members create" on public.home_care;
drop policy if exists "Household members update" on public.home_care;
drop policy if exists "Household members delete" on public.home_care;
create policy "Household members read" on public.home_care for select to authenticated using (public.is_household_member(household_id));
create policy "Household members create" on public.home_care for insert to authenticated with check (public.is_household_member(household_id));
create policy "Household members update" on public.home_care for update to authenticated using (public.is_household_member(household_id)) with check (public.is_household_member(household_id));
create policy "Household members delete" on public.home_care for delete to authenticated using (public.is_household_member(household_id));

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'home_care') then
    alter publication supabase_realtime add table public.home_care;
  end if;
end $$;

notify pgrst, 'reload schema';
