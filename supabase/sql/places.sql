-- Mapa de Nosotros: los sitios en los que habéis estado juntos (también salen en el corcho
-- del modo Sims). Los dos pueden añadir y quitar sitios.
-- Ejecutar después de life.sql. Es idempotente.

create table if not exists public.places (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  country text check (char_length(country) <= 60),
  lat double precision not null check (lat between -90 and 90),
  lon double precision not null check (lon between -180 and 180),
  kind text not null default 'trip' check (kind in ('home', 'family', 'trip')),
  note text check (char_length(note) <= 200),
  visited_on date,
  added_by text,
  created_by uuid references auth.users(id) default auth.uid(),
  created_at timestamptz not null default now()
);
create index if not exists places_household_idx on public.places (household_id);

alter table public.places enable row level security;
alter table public.places replica identity full;
drop policy if exists "Household members read" on public.places;
drop policy if exists "Household members create" on public.places;
drop policy if exists "Household members update" on public.places;
drop policy if exists "Household members delete" on public.places;
create policy "Household members read" on public.places for select to authenticated using (public.is_household_member(household_id));
create policy "Household members create" on public.places for insert to authenticated with check (public.is_household_member(household_id));
create policy "Household members update" on public.places for update to authenticated using (public.is_household_member(household_id)) with check (public.is_household_member(household_id));
create policy "Household members delete" on public.places for delete to authenticated using (public.is_household_member(household_id));

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'places') then
    alter publication supabase_realtime add table public.places;
  end if;
end $$;

notify pgrst, 'reload schema';
