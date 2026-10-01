-- Plantas de casa: cada planta guarda cuándo se regó y cuándo toca el próximo riego
-- (lo calcula la app según la especie y la estación). plant_log guarda los riegos y
-- los aplazamientos («aún está húmeda»). Ejecutar después de push-notifications.sql.
-- Es idempotente.

create table if not exists public.plants (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 40),
  species text not null default 'other' check (species in ('monstera', 'strelitzia', 'pothos', 'other')),
  location text not null default '' check (char_length(location) <= 40),
  water_every_days integer check (water_every_days between 1 and 60),
  last_watered_at timestamptz,
  next_water_on date,
  reminded_on date,
  active boolean not null default true,
  created_by uuid references auth.users(id) default auth.uid(),
  created_at timestamptz not null default now()
);
create index if not exists plants_household_idx on public.plants (household_id, active);
create index if not exists plants_due_idx on public.plants (next_water_on) where active;

create table if not exists public.plant_log (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  plant_id uuid not null references public.plants(id) on delete cascade,
  kind text not null check (kind in ('water', 'snooze')),
  done_by text,
  note text check (char_length(note) <= 500),
  created_at timestamptz not null default now()
);
create index if not exists plant_log_plant_idx on public.plant_log (plant_id, created_at desc);

do $$
declare
  table_name text;
begin
  foreach table_name in array array['plants', 'plant_log']
  loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('alter table public.%I replica identity full', table_name);
    execute format('drop policy if exists "Household members read" on public.%I', table_name);
    execute format('drop policy if exists "Household members create" on public.%I', table_name);
    execute format('drop policy if exists "Household members update" on public.%I', table_name);
    execute format('drop policy if exists "Household members delete" on public.%I', table_name);
    execute format('create policy "Household members read" on public.%I for select to authenticated using (public.is_household_member(household_id))', table_name);
    execute format('create policy "Household members create" on public.%I for insert to authenticated with check (public.is_household_member(household_id))', table_name);
    execute format('create policy "Household members update" on public.%I for update to authenticated using (public.is_household_member(household_id)) with check (public.is_household_member(household_id))', table_name);
    execute format('create policy "Household members delete" on public.%I for delete to authenticated using (public.is_household_member(household_id))', table_name);
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = table_name) then
      execute format('alter publication supabase_realtime add table public.%I', table_name);
    end if;
  end loop;
end $$;

notify pgrst, 'reload schema';
