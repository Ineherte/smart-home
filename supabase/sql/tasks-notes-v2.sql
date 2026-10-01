-- Pendientes v2: prioridad, detalles y duración en las tareas; notas fijadas y con detalles.
-- Ejecutar después de finance-personal.sql. Es idempotente.

do $$
begin
  if to_regclass('public.household_tasks') is not null then
    alter table public.household_tasks add column if not exists priority text not null default 'normal';
    alter table public.household_tasks add column if not exists details text;
    alter table public.household_tasks add column if not exists minutes integer;
    if not exists (select 1 from pg_constraint where conname = 'household_tasks_priority_check') then
      alter table public.household_tasks add constraint household_tasks_priority_check check (priority in ('high', 'normal', 'low'));
    end if;
    if not exists (select 1 from pg_constraint where conname = 'household_tasks_details_check') then
      alter table public.household_tasks add constraint household_tasks_details_check check (details is null or char_length(details) <= 600);
    end if;
    if not exists (select 1 from pg_constraint where conname = 'household_tasks_minutes_check') then
      alter table public.household_tasks add constraint household_tasks_minutes_check check (minutes is null or minutes between 1 and 600);
    end if;
  end if;

  -- Los minutos de cada tarea hecha alimentan el reparto de tiempo entre los dos.
  if to_regclass('public.task_completions') is not null then
    alter table public.task_completions add column if not exists minutes integer;
  end if;

  if to_regclass('public.notes') is not null then
    alter table public.notes add column if not exists pinned boolean not null default false;
    alter table public.notes add column if not exists details text;
    if not exists (select 1 from pg_constraint where conname = 'notes_details_check') then
      alter table public.notes add constraint notes_details_check check (details is null or char_length(details) <= 1000);
    end if;
  end if;
end $$;

notify pgrst, 'reload schema';
