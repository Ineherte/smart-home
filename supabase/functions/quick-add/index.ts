// Añadir a Umbral desde Siri o los Atajos del iPhone, sin abrir la app.
//   POST /functions/v1/quick-add   cabecera x-sync-token: <SYNC_TOKEN>
//   { "owner": "Ines", "type": "compra" | "tarea" | "gasto" | "nota", "text": "leche, pan y 6 huevos" }
// Entiende frases cortas:
//   compra → «leche, pan y 6 huevos» (cada cosa por separado, con su cantidad)
//   tarea  → «pagar la luz en 5 días #papeles», «llamar al dentista mañana», «el viernes»
//   gasto  → «24,50 cena en Eataly» (lo pagó quien lo dice, a medias)
//   nota   → «la clave del wifi es castillo» (la primera línea es el título)
// Responde { ok, message } con una frase para que Siri la lea en voz alta.
// Usa el mismo SYNC_TOKEN e IPHONE_OWNER_IDS que sync-iphone-calendar y wallet-ingest.
// Despliegue: supabase functions deploy quick-add --no-verify-jwt
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-sync-token'
};
import { NO_DEADLINE, plain, capitalize, today, shoppingItems, taskFrom, expenseFrom } from './parse.ts';

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ ok: false, message: 'Solo se acepta POST' }, 405);
  const token = Deno.env.get('SYNC_TOKEN');
  if (!token || request.headers.get('x-sync-token') !== token) return json({ ok: false, message: 'Token inválido' }, 401);
  try {
    const ownerIds = JSON.parse(Deno.env.get('IPHONE_OWNER_IDS') || '{}') as Record<string, string>;
    const body = await request.json();
    const owner = String(body.owner || '');
    const ownerId = ownerIds[owner];
    const text = String(body.text || '').trim();
    const type = plain(String(body.type || ''));
    if (!ownerId) return json({ ok: false, message: `${owner || 'Ese nombre'} no está en IPHONE_OWNER_IDS` }, 400);
    if (!text) return json({ ok: false, message: 'No he oído nada. Prueba otra vez.' }, 400);

    const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: membership } = await db.from('household_members').select('household_id').eq('user_id', ownerId).limit(1).maybeSingle();
    const householdId = membership?.household_id;
    if (!householdId) return json({ ok: false, message: 'No encuentro vuestro hogar' }, 404);

    if (type.startsWith('compra')) {
      const items = shoppingItems(text);
      const { error } = await db.from('shopping_items').insert(items.map((item) => ({ ...item, household_id: householdId, status: 'pending', added_by: owner, created_by: ownerId })));
      if (error) throw error;
      return json({ ok: true, message: `Añadido a la compra: ${items.map((item) => (item.quantity ? `${item.quantity} ${item.name.toLowerCase()}` : item.name.toLowerCase())).join(', ')}.` });
    }
    if (type.startsWith('tarea') || type.startsWith('hacer') || type.startsWith('pendiente')) {
      const task = taskFrom(text);
      if (!task.title) return json({ ok: false, message: 'No he entendido qué hay que hacer' }, 400);
      const row: Record<string, unknown> = { household_id: householdId, title: task.title, recurrence: 'none', assignee: 'both', due_date: task.due, active: true, created_by: ownerId };
      if (task.list) row.list = task.list;
      let { error } = await db.from('household_tasks').insert(row);
      if (error && /list/.test(error.message)) ({ error } = await db.from('household_tasks').insert({ ...row, list: undefined }));
      if (error) throw error;
      const days = task.due === NO_DEADLINE ? null : Math.round((Date.parse(`${task.due}T12:00:00Z`) - Date.parse(`${today()}T12:00:00Z`)) / 86400000);
      const when = days === null ? 'sin plazo' : days === 0 ? 'para hoy' : days === 1 ? 'para mañana' : `en ${days} días`;
      return json({ ok: true, message: `Apuntado: ${task.title}, ${when}${task.list ? `, en ${task.list}` : ''}.` });
    }
    if (type.startsWith('gasto')) {
      const expense = expenseFrom(text);
      if (!expense || !(expense.amount > 0)) return json({ ok: false, message: 'Dime el importe, por ejemplo: 24,50 cena' }, 400);
      const row: Record<string, unknown> = { household_id: householdId, description: expense.description, amount: expense.amount, paid_by: owner, category: expense.category, expense_date: today(), source: 'manual', created_by: ownerId };
      const { error } = await db.from('shared_expenses').insert(row);
      if (error) throw error;
      return json({ ok: true, message: `Gasto apuntado: ${expense.description}, ${expense.amount.toFixed(2).replace('.', ',')} €, pagado por ti, a medias.` });
    }
    if (type.startsWith('nota')) {
      const [first, ...more] = text.split('\n');
      const { error } = await db.from('notes').insert({ household_id: householdId, owner_id: ownerId, scope: 'shared', content: capitalize(first).slice(0, 120), details: more.join('\n').trim() || null, priority: 'normal' });
      if (error) throw error;
      return json({ ok: true, message: `Nota guardada: ${capitalize(first).slice(0, 60)}.` });
    }
    return json({ ok: false, message: 'Tipo desconocido: usa compra, tarea, gasto o nota' }, 400);
  } catch (error) {
    return json({ ok: false, message: error instanceof Error ? error.message : 'No se pudo guardar' }, 500);
  }
});

function json(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' } });
}
