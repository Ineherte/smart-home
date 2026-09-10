alter table public.shared_expenses drop constraint if exists shared_expenses_category_check;
alter table public.shared_expenses add constraint shared_expenses_category_check check (category in ('Hogar', 'Alimentación', 'Transporte', 'Viajes', 'Ocio', 'Compras', 'Salud', 'Otros', 'Alquiler', 'Luz', 'Internet', 'Agua', 'Gas', 'Compra'));
