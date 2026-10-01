-- Mis gastos v2: ingresos, comercio limpio, tipo de movimiento y «no contar como gasto»,
-- reglas de categoría aprendidas y presupuestos mensuales por categoría.
-- Ejecutar después de tasks-notes-v2.sql. Es idempotente.

alter table public.personal_expenses add column if not exists direction text not null default 'out';
alter table public.personal_expenses add column if not exists merchant text;
alter table public.personal_expenses add column if not exists kind text;
alter table public.personal_expenses add column if not exists bank_description text;
alter table public.personal_expenses add column if not exists excluded boolean not null default false;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'personal_expenses_direction_check') then
    alter table public.personal_expenses add constraint personal_expenses_direction_check check (direction in ('out', 'in'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'personal_expenses_merchant_check') then
    alter table public.personal_expenses add constraint personal_expenses_merchant_check check (merchant is null or char_length(merchant) <= 80);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'personal_expenses_kind_check') then
    alter table public.personal_expenses add constraint personal_expenses_kind_check check (kind is null or kind in ('card', 'transfer', 'sdd', 'withdraw', 'fee', 'other'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'personal_expenses_bank_description_check') then
    alter table public.personal_expenses add constraint personal_expenses_bank_description_check check (bank_description is null or char_length(bank_description) <= 500);
  end if;
end $$;

-- «Esselunga siempre es Supermercado»: se aplica al importar y al cambiar una categoría.
create table if not exists public.personal_category_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  merchant_key text not null check (char_length(merchant_key) between 1 and 80),
  category text not null check (char_length(category) <= 40),
  excluded boolean not null default false,
  created_at timestamptz not null default now(),
  unique (user_id, merchant_key)
);

-- Presupuesto mensual por categoría.
create table if not exists public.personal_budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  category text not null check (char_length(category) <= 40),
  amount numeric(10, 2) not null check (amount > 0),
  created_at timestamptz not null default now(),
  unique (user_id, category)
);

do $$
declare
  table_name text;
begin
  foreach table_name in array array['personal_category_rules', 'personal_budgets']
  loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('drop policy if exists "Own rows read" on public.%I', table_name);
    execute format('drop policy if exists "Own rows create" on public.%I', table_name);
    execute format('drop policy if exists "Own rows update" on public.%I', table_name);
    execute format('drop policy if exists "Own rows delete" on public.%I', table_name);
    execute format('create policy "Own rows read" on public.%I for select to authenticated using (user_id = auth.uid())', table_name);
    execute format('create policy "Own rows create" on public.%I for insert to authenticated with check (user_id = auth.uid())', table_name);
    execute format('create policy "Own rows update" on public.%I for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())', table_name);
    execute format('create policy "Own rows delete" on public.%I for delete to authenticated using (user_id = auth.uid())', table_name);
  end loop;
end $$;

notify pgrst, 'reload schema';
