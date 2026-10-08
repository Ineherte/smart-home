// Notificaciones push entre los miembros del hogar.
// GET  -> { publicKey }: la clave pública VAPID que necesita el navegador para suscribirse.
// POST { title, body, url?, tag? } con la sesión del usuario -> avisa a los demás miembros
//      de su hogar en todos sus dispositivos con los avisos activados.
// POST { job } con la cabecera x-cron-secret -> avisos programados (los lanza pg_cron, ver
//      supabase/sql/plant-reminders-cron.sql):
//        plant-reminders  recordatorio diario de riego para todo el hogar.
//        morning-brief    resumen de la mañana para cada persona (tareas, planes, menú, fechas).
//        daily-photo      «¡Foto del día!» a la hora sorpresa de hoy, si aún no hay foto.
// Secretos: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (mailto:tu@correo) y CRON_SECRET.
// Cifrado según RFC 8291 (aes128gcm) y firma VAPID según RFC 8292, solo con WebCrypto.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
};

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const publicKey = Deno.env.get('VAPID_PUBLIC_KEY');
  const privateKey = Deno.env.get('VAPID_PRIVATE_KEY');
  const subject = Deno.env.get('VAPID_SUBJECT') || 'mailto:admin@example.com';
  if (!publicKey || !privateKey) return json({ error: 'Faltan VAPID_PUBLIC_KEY o VAPID_PRIVATE_KEY' }, 500);
  if (request.method === 'GET') return json({ publicKey });
  if (request.method !== 'POST') return json({ error: 'Método no admitido' }, 405);

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const vapid = { publicKey, privateKey, subject };
  const cronSecret = Deno.env.get('CRON_SECRET');
  if (request.headers.has('x-cron-secret')) {
    if (!cronSecret || request.headers.get('x-cron-secret') !== cronSecret) return json({ error: 'Secreto inválido' }, 401);
    let job = 'plant-reminders';
    try {
      job = String((await request.json())?.job || job);
    } catch {
      // Sin cuerpo: el trabajo de siempre.
    }
    if (job === 'morning-brief') return json(await sendMorningBrief(admin, vapid));
    if (job === 'daily-photo') return json(await sendDailyPhoto(admin, vapid));
    return json(await sendPlantReminders(admin, vapid));
  }

  const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  const { data: userData, error: userError } = await admin.auth.getUser(token);
  const user = userData?.user;
  if (userError || !user || user.is_anonymous) return json({ error: 'Inicia sesión' }, 401);

  let input: Record<string, unknown>;
  try {
    input = await request.json();
  } catch {
    return json({ error: 'Cuerpo inválido' }, 400);
  }
  const message = {
    title: String(input.title || 'Umbral').slice(0, 80),
    body: String(input.body || '').slice(0, 240),
    url: typeof input.url === 'string' && input.url.startsWith('./') ? input.url.slice(0, 120) : './',
    tag: input.tag ? String(input.tag).slice(0, 60) : undefined
  };

  const { data: memberships, error: membershipError } = await admin.from('household_members').select('household_id').eq('user_id', user.id);
  if (membershipError) return json({ error: membershipError.message }, 500);
  const households = (memberships || []).map((row) => row.household_id);
  if (!households.length) return json({ sent: 0, removed: 0 });

  const { data: subscriptions, error: subscriptionError } = await admin
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .in('household_id', households)
    .neq('user_id', user.id);
  if (subscriptionError) return json({ error: subscriptionError.message }, 500);

  return json(await deliver(admin, subscriptions || [], message, vapid));
});

type Admin = ReturnType<typeof createClient>;
interface StoredSubscription extends Subscription { id: string }

async function deliver(admin: Admin, subscriptions: StoredSubscription[], message: Record<string, unknown>, vapid: Vapid) {
  const payload = new TextEncoder().encode(JSON.stringify(message));
  const results = await Promise.allSettled(subscriptions.map((subscription) => sendPush(subscription, payload, vapid)));

  // El servicio de push responde 404/410 cuando el teléfono ya no existe o quitó el permiso.
  const gone = subscriptions.filter((_, index) => {
    const result = results[index];
    return result.status === 'fulfilled' && (result.value === 404 || result.value === 410);
  });
  if (gone.length) await admin.from('push_subscriptions').delete().in('id', gone.map((subscription) => subscription.id));

  const sent = results.filter((result) => result.status === 'fulfilled' && result.value >= 200 && result.value < 300).length;
  return { sent, removed: gone.length, total: results.length };
}

// Plantas que tocan hoy (o siguen sin regar): un aviso por hogar a todos sus teléfonos.
// Se repite cada dos días mientras nadie la riegue; al regar, la app borra reminded_on.
async function sendPlantReminders(admin: Admin, vapid: Vapid) {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome' }).format(new Date());
  const twoDaysAgo = new Date(`${today}T12:00:00Z`);
  twoDaysAgo.setUTCDate(twoDaysAgo.getUTCDate() - 2);
  const repeatBefore = twoDaysAgo.toISOString().slice(0, 10);

  const { data: plants, error } = await admin
    .from('plants')
    .select('id, household_id, name, next_water_on, reminded_on')
    .eq('active', true)
    .lte('next_water_on', today)
    .or(`reminded_on.is.null,reminded_on.lte.${repeatBefore}`);
  if (error) return { error: error.message };

  const byHousehold = new Map<string, { id: string; name: string; next_water_on: string }[]>();
  (plants || []).forEach((plant) => byHousehold.set(plant.household_id, [...(byHousehold.get(plant.household_id) || []), plant]));

  let sent = 0;
  for (const [householdId, due] of byHousehold) {
    const names = due.map((plant) => plant.name);
    const list = names.length > 1 ? `${names.slice(0, -1).join(', ')} y ${names.at(-1)}` : names[0];
    const overdue = due.some((plant) => plant.next_water_on < today);
    const message = {
      title: overdue ? 'Tus plantas tienen sed 🥀' : 'Hoy toca regar 🌱',
      body: `${list} ${names.length > 1 ? 'necesitan' : 'necesita'} agua. Toca para marcarlo al regar.`,
      url: './?abrir=plantas',
      tag: 'plants'
    };
    const { data: subscriptions } = await admin.from('push_subscriptions').select('id, endpoint, p256dh, auth').eq('household_id', householdId);
    const result = await deliver(admin, subscriptions || [], message, vapid);
    sent += result.sent;
    await admin.from('plants').update({ reminded_on: today }).in('id', due.map((plant) => plant.id));
  }
  return { households: byHousehold.size, plants: plants?.length || 0, sent };
}

const turinToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome' }).format(new Date());
const addDays = (iso: string, days: number) => {
  const date = new Date(`${iso}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};
const daysBetween = (from: string, to: string) => Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86400000);
const listText = (items: string[]) => (items.length > 1 ? `${items.slice(0, -1).join(', ')} y ${items.at(-1)}` : items[0] || '');

// Si una tabla aún no existe (falta algún .sql), ese apartado simplemente no sale.
async function rows<T>(query: PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  const { data, error } = await query;
  return error ? [] : data || [];
}

interface SpecialDate { title: string; kind: string; date: string; end_date: string | null; yearly: boolean; emoji: string | null }

// Próxima vez que toca una fecha (las anuales se repiten cada año).
function nextOccurrence(entry: SpecialDate, today: string) {
  if (!entry.yearly) return entry.date;
  const year = Number(today.slice(0, 4));
  const thisYear = `${year}${entry.date.slice(4)}`;
  return thisYear >= today ? thisYear : `${year + 1}${entry.date.slice(4)}`;
}

function countdownLine(dates: SpecialDate[], today: string) {
  const short = (title: string) => title.replace(/^Viaje a /, '').replace(/^Cumpleaños de /, 'el cumple de ').replace(/^Nuestro /, 'nuestro ');
  const away = dates.find((entry) => entry.kind === 'trip' && entry.end_date && entry.date <= today && entry.end_date >= today);
  if (away) return `${away.emoji || '🧳'} ¡Disfrutad de ${short(away.title)}!`;
  const next = dates
    .map((entry) => ({ entry, day: nextOccurrence(entry, today) }))
    .filter(({ day }) => day >= today)
    .sort((a, b) => a.day.localeCompare(b.day))[0];
  if (!next) return '';
  const days = daysBetween(today, next.day);
  const { entry } = next;
  const emoji = entry.emoji || '✨';
  if (days === 0) {
    if (entry.kind === 'birthday') return `${emoji} ¡Hoy es ${short(entry.title)}!`;
    if (entry.kind === 'anniversary') return `${emoji} ¡Feliz aniversario!`;
    return `${emoji} ¡Hoy toca ${short(entry.title)}!`;
  }
  if (days === 1) return `${emoji} Mañana: ${entry.title}`;
  if (days <= 30) return `${emoji} ${days} días para ${short(entry.title)}`;
  return '';
}

// Resumen de la mañana: una notificación por teléfono, pensada para su dueño.
async function sendMorningBrief(admin: Admin, vapid: Vapid) {
  const today = turinToday();
  const { data: subscriptions, error } = await admin.from('push_subscriptions').select('id, household_id, user_id, person, endpoint, p256dh, auth');
  if (error) return { error: error.message };
  const byHousehold = new Map<string, typeof subscriptions>();
  (subscriptions || []).forEach((subscription) => byHousehold.set(subscription.household_id, [...(byHousehold.get(subscription.household_id) || []), subscription]));

  let sent = 0;
  for (const [householdId, devices] of byHousehold) {
    const [tasks, events, meals, plants, dates] = await Promise.all([
      // Rutinas que tocan y lo de una vez cuyo plazo vence en 3 días o menos (sale cada mañana hasta hacerlo).
      rows<{ title: string; assignee: string; due_date: string; recurrence: string }>(admin.from('household_tasks').select('title, assignee, due_date, recurrence').eq('household_id', householdId).eq('active', true).lte('due_date', addDaysIso(today, 3)).order('due_date')),
      rows<{ title: string; event_time: string | null; scope: string; owner_id: string }>(admin.from('events').select('title, event_time, scope, owner_id').eq('household_id', householdId).eq('event_date', today).order('event_time', { ascending: true })),
      rows<{ slot: string; title: string }>(admin.from('meal_plan').select('slot, title').eq('household_id', householdId).eq('day', today)),
      rows<{ name: string }>(admin.from('plants').select('name').eq('household_id', householdId).eq('active', true).lte('next_water_on', today)),
      rows<SpecialDate>(admin.from('special_dates').select('title, kind, date, end_date, yearly, emoji').eq('household_id', householdId))
    ]);
    const lunch = meals.find((meal) => meal.slot === 'lunch')?.title;
    const dinner = meals.find((meal) => meal.slot === 'dinner')?.title;
    const countdown = countdownLine(dates, today);

    for (const device of devices || []) {
      const person = device.person || '';
      const myTasks = tasks.filter((task) => task.assignee === 'both' || !person || task.assignee === person);
      const myEvents = events.filter((event) => event.scope === 'shared' || event.owner_id === device.user_id);
      const lines: string[] = [];
      if (countdown) lines.push(countdown);
      if (myEvents.length) lines.push(`📅 ${myEvents.slice(0, 3).map((event) => (event.event_time ? `${event.event_time.slice(0, 5)} ${event.title}` : event.title)).join(' · ')}`);
      if (myTasks.length) {
        const late = myTasks.filter((task) => task.due_date < today).length;
        const first = myTasks[0];
        const left = Math.round((Date.parse(`${first.due_date}T12:00:00Z`) - Date.parse(`${today}T12:00:00Z`)) / 86400000);
        const when = first.recurrence !== 'none' ? '' : left < 0 ? ' (plazo pasado)' : left === 0 ? ' (hoy)' : left === 1 ? ' (mañana)' : ` (quedan ${left} días)`;
        lines.push(`✅ ${myTasks.length === 1 ? `${first.title}${when}` : `${myTasks.length} cosas por hacer · ${first.title}${when}`}${late && myTasks.length > 1 ? ` · ${late} con plazo pasado` : ''}`);
      }
      if (lunch || dinner) lines.push(`🍽️ ${[lunch && `Comida: ${lunch}`, dinner && `Cena: ${dinner}`].filter(Boolean).join(' · ')}`);
      if (plants.length) lines.push(`🌱 Regar ${listText(plants.map((plant) => plant.name))}`);
      if (!lines.length) continue;
      const message = {
        title: `Buenos días${person ? `, ${person}` : ''} ☀️`,
        body: lines.join('\n').slice(0, 240),
        url: './',
        tag: 'morning-brief'
      };
      const result = await deliver(admin, [device], message, vapid);
      sent += result.sent;
    }
  }
  return { households: byHousehold.size, sent };
}

// Misma hora sorpresa que photoPromptTime() en nosotros.js: entre las 10:00 y las 19:50 de Turín.
function photoPromptMinutes(iso: string) {
  let hash = 0;
  for (const char of iso) hash = (hash * 31 + char.charCodeAt(0)) % 1000003;
  const slot = hash % 60;
  return (10 + Math.floor(slot / 6)) * 60 + (slot % 6) * 10;
}

// Se lanza cada 10 minutos; solo avisa en la franja de la hora de hoy y si aún no hay foto.
async function sendDailyPhoto(admin: Admin, vapid: Vapid) {
  const today = turinToday();
  const [hour, minute] = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Rome', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date()).split(':').map(Number);
  const now = hour * 60 + minute;
  const target = photoPromptMinutes(today);
  if (now < target || now >= target + 10) return { skipped: true, target: `${Math.floor(target / 60)}:${String(target % 60).padStart(2, '0')}` };

  const { data: subscriptions, error } = await admin.from('push_subscriptions').select('id, household_id, endpoint, p256dh, auth');
  if (error) return { error: error.message };
  const households = [...new Set((subscriptions || []).map((subscription) => subscription.household_id))];
  const done = new Set((await rows<{ household_id: string }>(admin.from('moments').select('household_id').eq('day', today).in('household_id', households))).map((row) => row.household_id));

  const message = { title: '📸 ¡Foto del día!', body: 'Tenéis 15 minutos para haceros la foto de hoy juntos. ¡Ahora o nunca!', url: './?abrir=nosotros', tag: 'daily-photo' };
  const pending = (subscriptions || []).filter((subscription) => !done.has(subscription.household_id));
  if (!pending.length) return { households: 0, sent: 0 };
  const result = await deliver(admin, pending, message, vapid);
  return { households: households.length - done.size, ...result };
}

function addDaysIso(iso: string, days: number) {
  const date = new Date(`${iso}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function json(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

// ---------- Web Push ----------

interface Subscription { endpoint: string; p256dh: string; auth: string }
interface Vapid { publicKey: string; privateKey: string; subject: string }

export async function sendPush(subscription: Subscription, payload: Uint8Array, vapid: Vapid): Promise<number> {
  const body = await encryptPayload(payload, fromBase64Url(subscription.p256dh), fromBase64Url(subscription.auth));
  const jwt = await vapidJwt(new URL(subscription.endpoint).origin, vapid);
  const response = await fetch(subscription.endpoint, {
    method: 'POST',
    headers: {
      Authorization: `vapid t=${jwt}, k=${vapid.publicKey}`,
      'Content-Encoding': 'aes128gcm',
      'Content-Type': 'application/octet-stream',
      TTL: String(24 * 60 * 60),
      Urgency: 'high'
    },
    body
  });
  await response.body?.cancel();
  return response.status;
}

const encoder = new TextEncoder();

export function fromBase64Url(value: string): Uint8Array {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  return Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
}

export function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const result = new Uint8Array(parts.reduce((total, part) => total + part.length, 0));
  let offset = 0;
  parts.forEach((part) => { result.set(part, offset); offset += part.length; });
  return result;
}

async function hkdf(salt: Uint8Array, secret: Uint8Array, info: Uint8Array, bytes: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', secret, 'HKDF', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, key, bytes * 8));
}

// RFC 8291: un solo registro aes128gcm con la clave pública efímera como keyid.
export async function encryptPayload(payload: Uint8Array, clientPublicKey: Uint8Array, authSecret: Uint8Array): Promise<Uint8Array> {
  const serverKeys = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']) as CryptoKeyPair;
  const serverPublicKey = new Uint8Array(await crypto.subtle.exportKey('raw', serverKeys.publicKey));
  const clientKey = await crypto.subtle.importKey('raw', clientPublicKey, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const sharedSecret = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: clientKey }, serverKeys.privateKey, 256));

  const keyInfo = concat(encoder.encode('WebPush: info\0'), clientPublicKey, serverPublicKey);
  const inputKey = await hkdf(authSecret, sharedSecret, keyInfo, 32);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const contentKey = await hkdf(salt, inputKey, encoder.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(salt, inputKey, encoder.encode('Content-Encoding: nonce\0'), 12);

  const aesKey = await crypto.subtle.importKey('raw', contentKey, 'AES-GCM', false, ['encrypt']);
  const padded = concat(payload, new Uint8Array([2]));
  const cipherText = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, aesKey, padded));

  const recordSize = new Uint8Array(4);
  new DataView(recordSize.buffer).setUint32(0, 4096);
  return concat(salt, recordSize, new Uint8Array([serverPublicKey.length]), serverPublicKey, cipherText);
}

// RFC 8292: JWT ES256 firmado con la clave privada VAPID.
export async function vapidJwt(audience: string, vapid: Vapid): Promise<string> {
  const publicBytes = fromBase64Url(vapid.publicKey);
  const key = await crypto.subtle.importKey('jwk', {
    kty: 'EC',
    crv: 'P-256',
    d: vapid.privateKey,
    x: toBase64Url(publicBytes.slice(1, 33)),
    y: toBase64Url(publicBytes.slice(33, 65)),
    ext: true
  }, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const header = toBase64Url(encoder.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const claims = toBase64Url(encoder.encode(JSON.stringify({ aud: audience, exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60, sub: vapid.subject })));
  const signature = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, encoder.encode(`${header}.${claims}`)));
  return `${header}.${claims}.${toBase64Url(signature)}`;
}
