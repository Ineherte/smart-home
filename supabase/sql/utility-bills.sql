-- Facturas de la luz (Octopus) y del teléfono (TIM) leídas del PDF, para Cuentas → Luz:
-- consumo por franjas (F1/F2/F3), precios, desglose de la factura, potencia y PUN.
-- Las rellena la función «bills» (facturas que llegan al Gmail o que se suben desde la app);
-- el PDF queda en Documentos (carpeta Facturas, de los dos).
-- Ejecutar después de documents.sql. Es idempotente.

-- La carpeta Facturas en Documentos (por si documents.sql se ejecutó antes de que existiera).
alter table public.documents drop constraint if exists documents_category_check;
alter table public.documents add constraint documents_category_check check (category in ('Identidad', 'Salud', 'Casa', 'Coche', 'Trabajo', 'Viajes', 'Facturas', 'Dinero', 'Garantías', 'Estudios', 'Otros'));

create table if not exists public.utility_bills (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  provider text not null check (provider in ('Octopus', 'TIM')),
  kind text not null default 'luz' check (kind in ('luz', 'telefono')),
  invoice_number text check (char_length(invoice_number) <= 60),
  supply_code text check (char_length(supply_code) <= 40),
  issue_date date,
  due_date date,
  period_start date,
  period_end date,
  total_amount numeric(10, 2),
  bill_amount numeric(10, 2),
  kwh numeric(10, 2),
  kwh_f1 numeric(10, 2),
  kwh_f2 numeric(10, 2),
  kwh_f3 numeric(10, 2),
  price_f1 numeric(10, 6),
  price_f2 numeric(10, 6),
  price_f3 numeric(10, 6),
  energy_cost numeric(10, 2),
  network_cost numeric(10, 2),
  system_charges numeric(10, 2),
  fixed_fee numeric(10, 2),
  power_fee numeric(10, 2),
  taxes numeric(10, 2),
  vat numeric(10, 2),
  tv_fee numeric(10, 2),
  committed_kw numeric(5, 2),
  offer text check (char_length(offer) <= 80),
  tariff_type text check (char_length(tariff_type) <= 40),
  payment text check (char_length(payment) <= 60),
  pun_month numeric(10, 6),
  annual_kwh numeric(10, 2),
  annual_cost numeric(10, 2),
  details jsonb not null default '{}'::jsonb,
  document_id uuid references public.documents(id) on delete set null,
  source text not null default 'upload' check (source in ('email', 'upload')),
  created_at timestamptz not null default now()
);
alter table public.utility_bills add column if not exists supply_code text;
alter table public.utility_bills add column if not exists payment text;
create unique index if not exists utility_bills_invoice_idx on public.utility_bills (household_id, provider, invoice_number) where invoice_number is not null;
create index if not exists utility_bills_period_idx on public.utility_bills (household_id, period_start desc);

alter table public.utility_bills enable row level security;
alter table public.utility_bills replica identity full;
drop policy if exists "Household members read" on public.utility_bills;
drop policy if exists "Household members create" on public.utility_bills;
drop policy if exists "Household members update" on public.utility_bills;
drop policy if exists "Household members delete" on public.utility_bills;
create policy "Household members read" on public.utility_bills for select to authenticated using (public.is_household_member(household_id));
create policy "Household members create" on public.utility_bills for insert to authenticated with check (public.is_household_member(household_id));
create policy "Household members update" on public.utility_bills for update to authenticated using (public.is_household_member(household_id)) with check (public.is_household_member(household_id));
create policy "Household members delete" on public.utility_bills for delete to authenticated using (public.is_household_member(household_id));

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'utility_bills') then
    alter publication supabase_realtime add table public.utility_bills;
  end if;
end $$;

notify pgrst, 'reload schema';
