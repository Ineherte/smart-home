// Resumen para el widget del iPhone (Scriptable): lo de hoy en casa en una sola llamada.
// Igual que sync-iphone-calendar y wallet-ingest: se protege con un token (cabecera
// x-sync-token: WIDGET_TOKEN, o SYNC_TOKEN si no hay) y IPHONE_OWNER_IDS dice qué user_id es cada persona. Lee con la service role
// en el servidor; el teléfono nunca ve más que este resumen.
//   GET /functions/v1/widget-summary?owner=Ines   (cabecera x-sync-token: <SYNC_TOKEN>)
// Despliegue: supabase functions deploy widget-summary --no-verify-jwt
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-sync-token',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
};
const TIME_ZONE = 'Europe/Rome';
// Lo mismo que avatars.js: cuánto baja cada necesidad por hora.
const NEED_DECAY: Record<string, number> = { hunger: 6, energy: 4, fun: 5, hygiene: 3, social: 4 };

const isoInZone = (date: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
const addDays = (iso: string, days: number) => {
  const date = new Date(`${iso}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};
const daysBetween = (from: string, to: string) => Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86400000);

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  // Mejor un WIDGET_TOKEN propio (solo sirve para leer este resumen); si no hay, vale SYNC_TOKEN.
  const syncToken = Deno.env.get('WIDGET_TOKEN') || Deno.env.get('SYNC_TOKEN');
  if (!syncToken || request.headers.get('x-sync-token') !== syncToken) return json({ error: 'Token inválido' }, 401);

  try {
    const ownerIds = JSON.parse(Deno.env.get('IPHONE_OWNER_IDS') || '{}') as Record<string, string>;
    const url = new URL(request.url);
    const owner = url.searchParams.get('owner') || (request.method === 'POST' ? (await request.json().catch(() => ({}))).owner : '');
    const ownerId = ownerIds[owner];
    if (!ownerId) return json({ error: 'owner no configurado en IPHONE_OWNER_IDS' }, 400);
    const partner = Object.keys(ownerIds).find((name) => name !== owner) || '';

    const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: membership } = await db.from('household_members').select('household_id').eq('user_id', ownerId).limit(1).maybeSingle();
    const householdId = membership?.household_id;
    if (!householdId) return json({ error: 'Sin hogar para esta persona' }, 404);

    const today = isoInZone(new Date());
    const week = addDays(today, 7);
    // Cada consulta va por su cuenta: si una tabla aún no existe, el resto del widget funciona.
    const safe = async <T>(query: PromiseLike<{ data: T | null; error: unknown }>, fallback: T): Promise<T> => {
      try { const { data, error } = await query; return error || data == null ? fallback : data; } catch { return fallback; }
    };
    const [tasks, shopping, meals, events, iphoneEvents, plants, care, dates, avatars] = await Promise.all([
      safe(db.from('household_tasks').select('title, assignee, due_date').eq('household_id', householdId).eq('active', true).lte('due_date', today).order('due_date'), [] as { title: string; assignee: string; due_date: string }[]),
      safe(db.from('shopping_items').select('name, quantity, status').eq('household_id', householdId).in('status', ['pending', 'in_cart']).order('created_at', { ascending: false }), [] as { name: string; quantity: string; status: string }[]),
      safe(db.from('meal_plan').select('slot, title').eq('household_id', householdId).eq('day', today), [] as { slot: string; title: string }[]),
      safe(db.from('events').select('title, event_date, event_time, scope, owner_id').eq('household_id', householdId).gte('event_date', today).lte('event_date', week).order('event_date').order('event_time'), [] as { title: string; event_date: string; event_time: string; scope: string; owner_id: string }[]),
      safe(db.from('iphone_events').select('title, event_date, event_time, owner_id').eq('owner_id', ownerId).gte('event_date', today).lte('event_date', week).order('event_date').order('event_time'), [] as { title: string; event_date: string; event_time: string | null; owner_id: string }[]),
      safe(db.from('plants').select('name, next_water_on').eq('household_id', householdId).eq('active', true).lte('next_water_on', today), [] as { name: string; next_water_on: string }[]),
      safe(db.from('home_care').select('title, every_days, last_done').eq('household_id', householdId), [] as { title: string; every_days: number; last_done: string | null }[]),
      safe(db.from('special_dates').select('title, kind, date, end_date, yearly, emoji').eq('household_id', householdId), [] as { title: string; kind: string; date: string; end_date: string | null; yearly: boolean; emoji: string | null }[]),
      safe(db.from('avatars').select('person, mood, mood_at, message, message_at, activity, activity_at, needs, needs_at, place').eq('household_id', householdId), [] as Record<string, unknown>[])
    ]);

    const agenda = [
      ...events.filter((event) => event.scope === 'shared' || event.owner_id === ownerId).map((event) => ({ title: event.title, date: event.event_date, time: (event.event_time || '').slice(0, 5) })),
      ...iphoneEvents.map((event) => ({ title: event.title, date: event.event_date, time: (event.event_time || '').slice(0, 5) }))
    ].sort((a, b) => `${a.date} ${a.time || '00:00'}`.localeCompare(`${b.date} ${b.time || '00:00'}`));
    // Ya pasados de hoy, fuera.
    const nowTime = new Intl.DateTimeFormat('en-GB', { timeZone: TIME_ZONE, hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date());
    const upcoming = agenda.filter((event) => event.date > today || !event.time || event.time >= nowTime);

    // La próxima fecha señalada (cumpleaños y aniversarios cada año; viajes en curso cuentan).
    const nextDates = dates.map((entry) => {
      let start = entry.date;
      let end = entry.end_date || entry.date;
      if (entry.yearly) {
        const year = Number(today.slice(0, 4));
        start = `${year}${entry.date.slice(4)}`;
        if (start < today) start = `${year + 1}${entry.date.slice(4)}`;
        end = start;
      }
      const ongoing = start <= today && end >= today;
      return { title: entry.title, emoji: entry.emoji || '📅', kind: entry.kind, days: ongoing ? 0 : daysBetween(today, start), ongoing, years: entry.yearly ? Number(start.slice(0, 4)) - Number(entry.date.slice(0, 4)) : null };
    }).filter((entry) => entry.ongoing || entry.days >= 0).sort((a, b) => a.days - b.days);

    const people = Object.fromEntries(avatars.map((row) => {
      const hours = row.needs_at ? Math.max(0, (Date.now() - Date.parse(String(row.needs_at))) / 3600000) : 0;
      const base = (row.needs || {}) as Record<string, number>;
      const needs = Object.fromEntries(Object.entries(NEED_DECAY).map(([key, decay]) => [key, Math.max(0, Math.min(100, Math.round((base[key] ?? 80) - decay * hours)))]));
      const fresh = (at: unknown, hoursMax: number) => at && Date.now() - Date.parse(String(at)) < hoursMax * 3600000;
      return [row.person, {
        mood: fresh(row.mood_at, 24) ? row.mood : null,
        message: fresh(row.message_at, 24) ? row.message : null,
        activity: fresh(row.activity_at, 1) ? row.activity : null,
        place: row.place || 'house',
        needs
      }];
    }));

    const careDue = care.filter((item) => item.last_done && daysBetween(item.last_done, today) >= item.every_days).map((item) => item.title);

    return json({
      owner,
      partner,
      today,
      tasks: { count: tasks.length, overdue: tasks.filter((task) => task.due_date < today).length, mine: tasks.filter((task) => task.assignee === owner || task.assignee === 'both').length, list: tasks.slice(0, 4).map((task) => ({ title: task.title, who: task.assignee, late: task.due_date < today })) },
      shopping: { count: shopping.filter((item) => item.status === 'pending').length, inCart: shopping.filter((item) => item.status === 'in_cart').length, list: shopping.filter((item) => item.status === 'pending').slice(0, 6).map((item) => item.quantity ? `${item.name} (${item.quantity})` : item.name) },
      meals: { lunch: meals.find((meal) => meal.slot === 'lunch')?.title || null, dinner: meals.find((meal) => meal.slot === 'dinner')?.title || null },
      agenda: upcoming.slice(0, 5),
      plants: plants.map((plant) => plant.name),
      care: careDue,
      next: nextDates[0] || null,
      dates: nextDates.slice(0, 3),
      people,
      updatedAt: new Date().toISOString()
    });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Error' }, 500);
  }
});

function json(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
}
