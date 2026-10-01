-- Cuentas: gastos personales y «poner a cero» las deudas.
-- Ejecutar después de plants.sql. Es idempotente.

-- Gastos personales: solo los ve quien los crea (ni siquiera el resto del hogar).
-- source: 'manual', 'apple_pay' (Atajo de Wallet, función wallet-ingest) o 'bank' (extracto importado).
-- source_reference evita duplicados al importar el mismo extracto o recibir dos veces un pago.
create table if not exists public.personal_expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  description text not null check (char_length(description) between 1 and 160),
  amount numeric(10, 2) not null check (amount >= 0),
  category text not null default 'Otros' check (char_length(category) <= 40),
  expense_date date not null default current_date,
  source text not null default 'manual' check (source in ('manual', 'apple_pay', 'bank')),
  source_reference text check (char_length(source_reference) <= 300),
  created_at timestamptz not null default now(),
  unique (user_id, source_reference)
);
create index if not exists personal_expenses_user_date_idx on public.personal_expenses (user_id, expense_date desc);

alter table public.personal_expenses enable row level security;
alter table public.personal_expenses replica identity full;
drop policy if exists "Own personal expenses read" on public.personal_expenses;
drop policy if exists "Own personal expenses create" on public.personal_expenses;
drop policy if exists "Own personal expenses update" on public.personal_expenses;
drop policy if exists "Own personal expenses delete" on public.personal_expenses;
create policy "Own personal expenses read" on public.personal_expenses for select to authenticated using (user_id = auth.uid());
create policy "Own personal expenses create" on public.personal_expenses for insert to authenticated with check (user_id = auth.uid());
create policy "Own personal expenses update" on public.personal_expenses for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "Own personal expenses delete" on public.personal_expenses for delete to authenticated using (user_id = auth.uid());

-- Poner a cero: el balance de quién debe a quién solo cuenta lo posterior a until_date
-- (lo del mismo día, si se añadió después del reinicio). Se guarda el historial para deshacer.
create table if not exists public.finance_resets (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  until_date date not null,
  mode text not null default 'all' check (mode in ('previous', 'all')),
  created_by uuid references auth.users(id) default auth.uid(),
  created_by_name text,
  created_at timestamptz not null default now()
);
create index if not exists finance_resets_household_idx on public.finance_resets (household_id, created_at desc);

alter table public.finance_resets enable row level security;
alter table public.finance_resets replica identity full;
drop policy if exists "Household members read" on public.finance_resets;
drop policy if exists "Household members create" on public.finance_resets;
drop policy if exists "Household members delete" on public.finance_resets;
create policy "Household members read" on public.finance_resets for select to authenticated using (public.is_household_member(household_id));
create policy "Household members create" on public.finance_resets for insert to authenticated with check (public.is_household_member(household_id));
create policy "Household members delete" on public.finance_resets for delete to authenticated using (public.is_household_member(household_id));

do $$
declare
  table_name text;
begin
  foreach table_name in array array['personal_expenses', 'finance_resets']
  loop
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = table_name) then
      execute format('alter publication supabase_realtime add table public.%I', table_name);
    end if;
  end loop;
end $$;

notify pgrst, 'reload schema';
