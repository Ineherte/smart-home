-- Aviso diario de riego. Cada mañana Supabase llama a la función notify-household,
-- que avisa a los teléfonos del hogar si alguna planta tiene que regarse hoy
-- (y otra vez cada dos días si sigue sin regar).
--
-- Antes de ejecutarlo:
--   1. En Edge Functions → Secrets, crea CRON_SECRET con una contraseña larga inventada.
--   2. Sustituye abajo PON_AQUI_EL_CRON_SECRET por ese mismo valor.
-- Se puede ejecutar varias veces: reemplaza la tarea anterior.

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.unschedule(jobid) from cron.job where jobname = 'umbral-plant-reminders';

-- 07:00 UTC = 9:00 en Turín en verano y 8:00 en invierno.
select cron.schedule(
  'umbral-plant-reminders',
  '0 7 * * *',
  $$
  select net.http_post(
    url := 'https://lnctwcizdjaeomvkcbst.supabase.co/functions/v1/notify-household',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', 'PON_AQUI_EL_CRON_SECRET'),
    body := jsonb_build_object('job', 'plant-reminders')
  );
  $$
);
