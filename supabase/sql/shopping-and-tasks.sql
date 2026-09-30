-- Lista de la compra y tareas de casa. Ejecutar después de household-policies-fix.sql.
-- Es idempotente: se puede ejecutar varias veces.

-- Lista de la compra. Los artículos comprados no se borran (status = 'done'):
-- ese historial alimenta las sugerencias de "lo de siempre".
create table if not exists public.shopping_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  quantity text not null default '' check (char_length(quantity) <= 20),
  category text not null default 'Otros',
  status text not null default 'pending' check (status in ('pending', 'in_cart', 'done')),
  added_by text,
  created_by uuid references auth.users(id) default auth.uid(),
  created_at timestamptz not null default now(),
  done_at timestamptz
);
create index if not exists shopping_items_household_status_idx on public.shopping_items (household_id, status);

-- Tareas de casa. Una tarea que se repite guarda la próxima fecha en due_date;
-- con rotate = true, al completarla le toca a la otra persona.
create table if not exists public.household_tasks (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 80),
  recurrence text not null default 'none' check (recurrence in ('none', 'daily', 'weekly', 'biweekly', 'monthly', 'yearly')),
  assignee text not null default 'both',
  rotate boolean not null default false,
  due_date date not null default current_date,
  active boolean not null default true,
  created_by uuid references auth.users(id) default auth.uid(),
  created_at timestamptz not null default now()
);
create index if not exists household_tasks_household_idx on public.household_tasks (household_id, active, due_date);

-- Historial de tareas hechas: sirve para el reparto de quién hace qué.
create table if not exists public.task_completions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  task_id uuid references public.household_tasks(id) on delete set null,
  title text not null,
  done_by text not null,
  done_at timestamptz not null default now()
);
create index if not exists task_completions_household_idx on public.task_completions (household_id, done_at desc);

-- Mismas reglas para las tres tablas: solo los miembros del hogar.
do $$
declare
  table_name text;
begin
  foreach table_name in array array['shopping_items', 'household_tasks', 'task_completions']
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
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = table_name
    ) then
      execute format('alter publication supabase_realtime add table public.%I', table_name);
    end if;
  end loop;
end $$;

notify pgrst, 'reload schema';
