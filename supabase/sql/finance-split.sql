-- Reparto de cada gasto de la casa: qué parte es de Ines (en %); el resto es de Matteo.
-- 50 = a medias (lo de siempre), 100 = solo de Ines, 0 = solo de Matteo, o cualquier otro
-- reparto (70 = 70 % Ines y 30 % Matteo). Vale para gastos, facturas y gastos fijos.
-- Ejecutar después de finance-schema.sql y finance-fixed-costs.sql. Es idempotente.

alter table public.shared_expenses add column if not exists share_ines numeric(5, 2) not null default 50;
alter table public.shared_bills add column if not exists share_ines numeric(5, 2) not null default 50;
alter table public.shared_fixed_costs add column if not exists share_ines numeric(5, 2) not null default 50;

alter table public.shared_expenses drop constraint if exists shared_expenses_share_ines_check;
alter table public.shared_expenses add constraint shared_expenses_share_ines_check check (share_ines between 0 and 100);
alter table public.shared_bills drop constraint if exists shared_bills_share_ines_check;
alter table public.shared_bills add constraint shared_bills_share_ines_check check (share_ines between 0 and 100);
alter table public.shared_fixed_costs drop constraint if exists shared_fixed_costs_share_ines_check;
alter table public.shared_fixed_costs add constraint shared_fixed_costs_share_ines_check check (share_ines between 0 and 100);

notify pgrst, 'reload schema';
