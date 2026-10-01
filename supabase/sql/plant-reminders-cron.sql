-- Avisos programados. Supabase llama a la función notify-household para:
--   · el riego: cada mañana, si alguna planta toca hoy (y cada dos días si sigue sin regar);
--   · el resumen de la mañana: tareas, planes, menú, plantas y cuenta atrás de cada persona;
--   · la foto del día: a una hora sorpresa entre las 10:00 y las 20:00, si aún no hay foto.
--
-- Antes de ejecutarlo:
--   1. En Edge Functions → Secrets, crea CRON_SECRET con una contraseña larga inventada.
--   2. Sustituye abajo PON_AQUI_EL_CRON_SECRET por ese mismo valor.
-- Se puede ejecutar varias veces: reemplaza la tarea anterior.

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.unschedule(jobid) from cron.job where jobname in ('umbral-plant-reminders', 'umbral-morning-brief', 'umbral-daily-photo');

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

-- 06:30 UTC = 8:30 en Turín en verano y 7:30 en invierno.
select cron.schedule(
  'umbral-morning-brief',
  '30 6 * * *',
  $$
  select net.http_post(
    url := 'https://lnctwcizdjaeomvkcbst.supabase.co/functions/v1/notify-household',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', 'PON_AQUI_EL_CRON_SECRET'),
    body := jsonb_build_object('job', 'morning-brief')
  );
  $$
);

-- Cada 10 minutos de 8:00 a 18:50 UTC (cubre de 10:00 a 20:00 en Turín todo el año);
-- la función solo avisa en la franja de la hora sorpresa de hoy.
select cron.schedule(
  'umbral-daily-photo',
  '*/10 8-18 * * *',
  $$
  select net.http_post(
    url := 'https://lnctwcizdjaeomvkcbst.supabase.co/functions/v1/notify-household',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', 'PON_AQUI_EL_CRON_SECRET'),
    body := jsonb_build_object('job', 'daily-photo')
  );
  $$
);
