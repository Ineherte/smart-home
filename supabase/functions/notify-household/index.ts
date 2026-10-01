// Notificaciones push entre los miembros del hogar.
// GET  -> { publicKey }: la clave pública VAPID que necesita el navegador para suscribirse.
// POST { title, body, url?, tag? } con la sesión del usuario -> avisa a los demás miembros
//      de su hogar en todos sus dispositivos con los avisos activados.
// POST { job: 'plant-reminders' } con la cabecera x-cron-secret -> recordatorio diario de
//      riego para todo el hogar (lo lanza pg_cron, ver supabase/sql/plant-reminders-cron.sql).
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
