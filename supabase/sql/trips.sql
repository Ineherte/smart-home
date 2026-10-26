-- Viajes de Nosotros: el organizador de viajes (itinerario por días, sitios con su tipo y
-- su ubicación, datos prácticos). Lo que hay que hacer antes de ir son tareas normales de
-- household_tasks (en la lista que guarda task_list) y la maleta y las precauciones son notas
-- normales (packing_note_id y care_note_id), así que salen también en Casa → Pendientes.
-- Ejecutar después de life.sql. Es idempotente.

create table if not exists public.trips (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 60),
  destination text check (char_length(destination) <= 80),
  country text check (char_length(country) <= 60),
  lat double precision check (lat between -90 and 90),
  lon double precision check (lon between -180 and 180),
  start_date date,
  end_date date,
  emoji text check (char_length(emoji) <= 8),
  color text check (char_length(color) <= 16),
  summary text check (char_length(summary) <= 600),
  -- Datos prácticos: {"stay": "...", "transport": "...", "money": "...", ...}
  info jsonb not null default '{}'::jsonb,
  -- Título y nota de cada día: {"2026-11-03": {"title": "...", "note": "..."}}
  days jsonb not null default '{}'::jsonb,
  task_list text check (char_length(task_list) <= 30),
  packing_note_id uuid,
  care_note_id uuid,
  date_id uuid,
  created_by_name text,
  created_by uuid references auth.users(id) default auth.uid(),
  created_at timestamptz not null default now()
);
create index if not exists trips_household_idx on public.trips (household_id);

create table if not exists public.trip_stops (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  trip_id uuid not null references public.trips(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  category text not null default 'other' check (category in ('food', 'cafe', 'beach', 'nature', 'view', 'culture', 'shop', 'fun', 'stay', 'move', 'other')),
  lat double precision check (lat between -90 and 90),
  lon double precision check (lon between -180 and 180),
  address text check (char_length(address) <= 200),
  day date,
  time text check (time is null or time ~ '^[0-2][0-9]:[0-5][0-9]$'),
  position integer not null default 0,
  notes text check (char_length(notes) <= 1000),
  url text check (char_length(url) <= 500),
  must boolean not null default false,
  booked boolean not null default false,
  created_by_name text,
  created_at timestamptz not null default now()
);
create index if not exists trip_stops_trip_idx on public.trip_stops (trip_id);
create index if not exists trip_stops_household_idx on public.trip_stops (household_id);

do $$
declare t text;
begin
  foreach t in array array['trips', 'trip_stops'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I replica identity full', t);
    execute format('drop policy if exists "Household members read" on public.%I', t);
    execute format('drop policy if exists "Household members create" on public.%I', t);
    execute format('drop policy if exists "Household members update" on public.%I', t);
    execute format('drop policy if exists "Household members delete" on public.%I', t);
    execute format('create policy "Household members read" on public.%I for select to authenticated using (public.is_household_member(household_id))', t);
    execute format('create policy "Household members create" on public.%I for insert to authenticated with check (public.is_household_member(household_id))', t);
    execute format('create policy "Household members update" on public.%I for update to authenticated using (public.is_household_member(household_id)) with check (public.is_household_member(household_id))', t);
    execute format('create policy "Household members delete" on public.%I for delete to authenticated using (public.is_household_member(household_id))', t);
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

notify pgrst, 'reload schema';
