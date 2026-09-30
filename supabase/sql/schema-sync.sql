-- Asegura que las tablas tienen todas las columnas que usa la app. Sustituye a las
-- migraciones sueltas antiguas (supabase-migration-urgent.sql, events-optional-time.sql,
-- finance-settled.sql, finance-settlement.sql), que no se podían repetir sin errores.
-- Es idempotente: se puede ejecutar tantas veces como haga falta.

-- Notas: prioridad (urgente) y completada.
alter table public.notes add column if not exists priority text not null default 'normal';
alter table public.notes add column if not exists completed boolean not null default false;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'notes_priority_check' and conrelid = 'public.notes'::regclass) then
    alter table public.notes add constraint notes_priority_check check (priority in ('normal', 'urgent'));
  end if;
end $$;

-- Eventos: la hora es opcional.
alter table public.events add column if not exists duration text not null default '';
alter table public.events add column if not exists location text not null default '';
alter table public.events alter column event_time drop not null;

-- Gastos compartidos.
alter table public.shared_expenses add column if not exists currency text not null default 'EUR';
alter table public.shared_expenses add column if not exists settled boolean not null default false;
alter table public.shared_expenses add column if not exists source_reference text;
alter table public.shared_expenses add column if not exists notes text;

-- Facturas: quién pagó y periodo.
alter table public.shared_bills add column if not exists paid_by text not null default 'Ines' check (paid_by in ('Ines', 'Matteo'));
alter table public.shared_bills add column if not exists billing_period text;
alter table public.shared_bills add column if not exists currency text not null default 'EUR';

-- Gastos fijos.
alter table public.shared_fixed_costs add column if not exists active boolean not null default true;

-- La API de Supabase guarda en caché el esquema: que lo relea para ver las columnas nuevas.
notify pgrst, 'reload schema';
