-- Cocina y Nosotros: recetas (con sus fotos), menú semanal, foto del día, fechas especiales
-- y planes por hacer. Más un bucket privado de Storage para las fotos del hogar.
-- Ejecutar después de finance-personal-v2.sql. Es idempotente.

create table if not exists public.recipes (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 80),
  category text not null default 'otros' check (category in ('legumbres', 'pescado', 'carne', 'aves', 'huevos', 'verdura', 'pasta', 'arroz', 'sopa', 'otros')),
  meal text not null default 'any' check (meal in ('any', 'lunch', 'dinner')),
  minutes integer check (minutes between 1 and 600),
  servings integer check (servings between 1 and 20),
  ingredients jsonb not null default '[]'::jsonb,
  steps text check (char_length(steps) <= 4000),
  notes text check (char_length(notes) <= 600),
  favorite boolean not null default false,
  photo_path text check (char_length(photo_path) <= 400),
  active boolean not null default true,
  created_by uuid references auth.users(id) default auth.uid(),
  created_at timestamptz not null default now()
);
create index if not exists recipes_household_idx on public.recipes (household_id, active);

-- Cada vez que cocináis una receta podéis guardar una foto: forman su galería.
create table if not exists public.recipe_photos (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  recipe_id uuid not null references public.recipes(id) on delete cascade,
  path text not null check (char_length(path) <= 400),
  taken_on date not null default current_date,
  created_by uuid references auth.users(id) default auth.uid(),
  created_at timestamptz not null default now()
);
create index if not exists recipe_photos_recipe_idx on public.recipe_photos (recipe_id, taken_on desc);

create table if not exists public.meal_plan (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  day date not null,
  slot text not null check (slot in ('lunch', 'dinner')),
  recipe_id uuid references public.recipes(id) on delete set null,
  title text not null check (char_length(title) between 1 and 80),
  created_by uuid references auth.users(id) default auth.uid(),
  created_at timestamptz not null default now(),
  unique (household_id, day, slot)
);
create index if not exists meal_plan_household_day_idx on public.meal_plan (household_id, day);

-- La foto del día (o las que queráis): forman el álbum por meses.
create table if not exists public.moments (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  day date not null default current_date,
  path text not null check (char_length(path) <= 400),
  caption text check (char_length(caption) <= 200),
  author text,
  created_by uuid references auth.users(id) default auth.uid(),
  created_at timestamptz not null default now()
);
create index if not exists moments_household_day_idx on public.moments (household_id, day desc);

create table if not exists public.special_dates (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 60),
  kind text not null default 'event' check (kind in ('birthday', 'anniversary', 'trip', 'event')),
  date date not null,
  end_date date,
  yearly boolean not null default false,
  emoji text check (char_length(emoji) <= 8),
  created_by uuid references auth.users(id) default auth.uid(),
  created_at timestamptz not null default now()
);
create index if not exists special_dates_household_idx on public.special_dates (household_id);

-- Planes por hacer: pelis, series, restaurantes… con la nota de cada uno.
create table if not exists public.plans (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  kind text not null default 'other' check (kind in ('movie', 'series', 'restaurant', 'trip', 'book', 'activity', 'other')),
  title text not null check (char_length(title) between 1 and 120),
  notes text check (char_length(notes) <= 600),
  link text check (char_length(link) <= 300),
  status text not null default 'todo' check (status in ('todo', 'done')),
  done_on date,
  ratings jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) default auth.uid(),
  created_by_name text,
  created_at timestamptz not null default now()
);
create index if not exists plans_household_idx on public.plans (household_id, status);

do $$
declare
  table_name text;
begin
  foreach table_name in array array['recipes', 'recipe_photos', 'meal_plan', 'moments', 'special_dates', 'plans']
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

-- Fotos: bucket privado. Cada archivo va en una carpeta con el id del hogar
-- (household_id/moments/…, household_id/recipes/…) y solo lo ven sus miembros.
do $$
begin
  if to_regclass('storage.objects') is null then
    raise notice 'Storage no disponible: se omite el bucket de fotos';
    return;
  end if;
  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('household-media', 'household-media', false, 8388608, array['image/jpeg', 'image/png', 'image/webp'])
  on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

  drop policy if exists "Household media read" on storage.objects;
  drop policy if exists "Household media upload" on storage.objects;
  drop policy if exists "Household media delete" on storage.objects;
  create policy "Household media read" on storage.objects for select to authenticated
    using (bucket_id = 'household-media' and public.is_household_member(((storage.foldername(name))[1])::uuid));
  create policy "Household media upload" on storage.objects for insert to authenticated
    with check (bucket_id = 'household-media' and public.is_household_member(((storage.foldername(name))[1])::uuid));
  create policy "Household media delete" on storage.objects for delete to authenticated
    using (bucket_id = 'household-media' and public.is_household_member(((storage.foldername(name))[1])::uuid));
end $$;

notify pgrst, 'reload schema';
