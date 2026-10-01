// Recibe un pago de Apple Pay desde un Atajo del iPhone (automatización «Transacción» de Wallet)
// y lo guarda como gasto personal de su dueño.
// POST { owner, amount, merchant, card? } con la cabecera x-sync-token.
// Secretos (los mismos que sync-iphone-calendar): SYNC_TOKEN e IPHONE_OWNER_IDS,
// un JSON como {"Ines":"<user_id>","Matteo":"<user_id>"}.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-sync-token'
};

// Mismas reglas (resumidas) que CATEGORY_KEYWORDS en bank-import.js.
const CATEGORY_RULES: [RegExp, string][] = [
  [/esselunga|carrefour|coop|conad|lidl|eurospin|\bpam\b|aldi|penny|mercadona|\bdia\b|supermerc|naturasi|bennet|despar|crai/, 'Supermercado'],
  [/\bbar\b|caff|cafe|ristorant|pizzer|trattoria|osteria|restaurante|mcdonald|burger|kebab|sushi|glovo|deliveroo|just ?eat|uber ?eats|gelater|pasticcer|panetter|starbucks/, 'Comer fuera'],
  [/\bgtt\b|trenitalia|italo|\buber\b|taxi|\beni\b|\bq8\b|tamoil|\bip\b|esso|autostrad|telepass|parcheggi|parking|\bbird\b|\blime\b|\bbolt\b/, 'Transporte'],
  [/netflix|spotify|disney|prime video|\bdazn\b|youtube|icloud|apple\.com|google one|palestra|\bgym\b/, 'Suscripciones'],
  [/ryanair|vueling|easyjet|wizz|booking|airbnb|hotel|flixbus/, 'Viajes'],
  [/cinema|\bcine\b|teatro|museo|ticketone|steam|playstation|nintendo|libreria|feltrinelli/, 'Ocio'],
  [/\bzara\b|h&m|\bhm\b|primark|uniqlo|bershka|mango|zalando|decathlon|vinted/, 'Ropa'],
  [/amazon|ikea|mediaworld|unieuro|tiger|ebay|aliexpress|shein|temu/, 'Compras'],
  [/farmac|pharm|parafarm|ospedal|clinic|dentist|ottica|optic|douglas|sephora|parrucch|barbier/, 'Salud y cuidado']
];

function guessCategory(text: string) {
  const normalized = text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  return CATEGORY_RULES.find(([pattern]) => pattern.test(normalized))?.[1] || 'Otros';
}

// «12,50 €», «€12.50», «1.234,56», «-8,00»… → 12.5
function parseAmount(value: unknown) {
  if (typeof value === 'number') return Math.abs(value);
  let text = String(value || '').replace(/[^\d,.-]/g, '');
  if (text.includes(',') && text.includes('.')) text = text.lastIndexOf(',') > text.lastIndexOf('.') ? text.replace(/\./g, '').replace(',', '.') : text.replace(/,/g, '');
  else if (text.includes(',')) text = text.replace(',', '.');
  return Math.abs(Number(text));
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Solo se acepta POST' }, 405);

  const syncToken = Deno.env.get('SYNC_TOKEN');
  if (!syncToken || request.headers.get('x-sync-token') !== syncToken) return json({ error: 'Token inválido' }, 401);

  try {
    const ownerIds = JSON.parse(Deno.env.get('IPHONE_OWNER_IDS') || '{}') as Record<string, string>;
    const body = await request.json();
    const userId = ownerIds[String(body.owner || '')];
    if (!userId) return json({ error: 'owner no está en IPHONE_OWNER_IDS' }, 400);
    const amount = parseAmount(body.amount);
    if (!Number.isFinite(amount) || amount <= 0) return json({ error: 'Importe no válido' }, 400);
    const merchant = String(body.merchant || body.name || 'Pago con Apple Pay').trim().slice(0, 120) || 'Pago con Apple Pay';
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome' }).format(new Date());
    // Un mismo pago enviado dos veces en el mismo minuto no se duplica.
    const minute = new Date().toISOString().slice(0, 16);

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const base = {
      user_id: userId,
      description: merchant,
      amount: Math.round(amount * 100) / 100,
      category: guessCategory(merchant),
      expense_date: today,
      source: 'apple_pay',
      source_reference: `applepay:${minute}:${amount}:${merchant}`.slice(0, 300)
    };
    const save = (row: Record<string, unknown>) => supabase.from('personal_expenses').upsert(row, { onConflict: 'user_id,source_reference', ignoreDuplicates: true });
    // Con finance-personal-v2.sql se guardan también comercio, tipo y sentido.
    let { error } = await save({ ...base, merchant: merchant.slice(0, 80), kind: 'card', direction: 'out' });
    if (error && /column|schema cache/i.test(error.message)) ({ error } = await save(base));
    if (error) return json({ error: error.message }, 500);
    return json({ saved: true, amount, merchant, category: guessCategory(merchant) });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Solicitud inválida' }, 400);
  }
});

function json(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}
