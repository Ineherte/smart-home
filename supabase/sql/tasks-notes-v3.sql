-- Por hacer y Notas, versión 3: las tareas pueden ir en listas (Casa, Papeles, Recados…) y
-- las notas pasan a ser apuntes de verdad: más espacio para el texto y la lista que se marca
-- (☐/☑ dentro de details), y un color. Las tareas sin plazo se guardan con fecha 2099-12-31.
-- Ejecutar después de tasks-notes-v2.sql. Es idempotente.

alter table public.household_tasks add column if not exists list text;
alter table public.household_tasks drop constraint if exists household_tasks_list_check;
alter table public.household_tasks add constraint household_tasks_list_check check (list is null or char_length(list) between 1 and 30);

alter table public.notes drop constraint if exists notes_details_check;
alter table public.notes add constraint notes_details_check check (details is null or char_length(details) <= 6000);
alter table public.notes add column if not exists color text;
alter table public.notes drop constraint if exists notes_color_check;
alter table public.notes add constraint notes_color_check check (color is null or color in ('sand', 'sage', 'sky', 'rose', 'lilac', 'lemon'));
alter table public.notes add column if not exists updated_at timestamptz not null default now();

notify pgrst, 'reload schema';
