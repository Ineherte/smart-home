// Recibe un pago de Apple Pay (automatización «Transacción» de Wallet) o de Satispay desde un
// Atajo del iPhone y lo guarda donde diga quien pagó:
// POST { owner, amount, merchant, method?, share? } con la cabecera x-sync-token.
//   method: 'apple_pay' (por defecto) o 'satispay'.
//   share:  'personal' (por defecto): gasto personal de quien paga.
//           'medias': gasto de la casa pagado por quien paga, a medias.
//           'otro': lo pagó uno pero es todo del otro (se lo debe).
//           'no': no se apunta.
//           o un número de 0 a 100: la parte (en %) de quien paga.
// Si va a la casa, también queda en sus gastos personales marcado «no cuenta», para que al
// importar el extracto del banco ese pago no se duplique.
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

// Las categorías de la casa son otras (ver finance-categories.sql).
const SHARED_CATEGORY: Record<string, string> = {
  Supermercado: 'Compra', 'Comer fuera': 'Alimentación', Transporte: 'Transporte', Suscripciones: 'Ocio', Viajes: 'Viajes',
  Ocio: 'Ocio', Ropa: 'Compras', Compras: 'Compras', 'Salud y cuidado': 'Salud'
};
const euros = (value: number) => `${value.toFixed(2).replace('.', ',')} €`;

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
    const owner = String(body.owner);
    const partner = Object.keys(ownerIds).find((name) => name !== owner) || 'tu pareja';
    const satispay = /satispay/i.test(String(body.method || ''));
    const label = satispay ? 'Pago con Satispay' : 'Pago con Apple Pay';
    const merchant = String(body.merchant || body.name || label).trim().slice(0, 120) || label;
    const rounded = Math.round(amount * 100) / 100;
    const category = guessCategory(merchant);

    // Qué parte es de quien paga (null = solo personal). Vale el texto de la opción del menú tal
    // cual («A medias con Matteo», «Mío», «De Matteo», «No apuntar») o las palabras cortas.
    const shareText = String(body.share ?? 'personal').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/^[^a-z0-9]+/, '').trim();
    if (/^(no\b|nada|ignorar|no apuntar|no he pagado)/.test(shareText)) return json({ saved: false, message: 'No lo he apuntado.' });
    let ownerShare: number | null = null;
    if (/^\d+([.,]\d+)?$/.test(shareText)) ownerShare = Math.min(100, Math.max(0, Number(shareText.replace(',', '.'))));
    else if (/medias|mitad|compart|los dos|ambos/.test(shareText)) ownerShare = 50;
    else if (/otro|suyo|debe|^de /.test(shareText) || shareText === partner.toLowerCase()) ownerShare = 0;
    else if (!/^(personal|mio|mia|yo|solo yo|mi gasto|para mi)$/.test(shareText)) {
      // Lo que llega no se entiende: mejor avisar que apuntarlo mal.
      return json({ saved: false, message: `No he entendido de quién es («${String(body.share)}»). En el atajo, «share» tiene que ser lo que eliges en el menú. No lo he apuntado.` }, 400);
    }
    const shared = ownerShare !== null;

    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome' }).format(new Date());
    // Un mismo pago enviado dos veces en el mismo minuto no se duplica.
    const minute = new Date().toISOString().slice(0, 16);
    const reference = `${satispay ? 'satispay' : 'applepay'}:${minute}:${amount}:${merchant}`.slice(0, 300);

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    if (shared) {
      const { data: membership } = await supabase.from('household_members').select('household_id').eq('user_id', userId).limit(1).maybeSingle();
      if (!membership?.household_id) return json({ error: 'No encuentro vuestro hogar' }, 404);
      const shareInes = owner === 'Ines' ? ownerShare! : 100 - ownerShare!;
      const row: Record<string, unknown> = {
        household_id: membership.household_id,
        description: merchant,
        amount: rounded,
        paid_by: owner,
        category: SHARED_CATEGORY[category] || 'Otros',
        expense_date: today,
        source: 'manual',
        source_reference: `${owner}:${reference}`.slice(0, 300),
        created_by: userId,
        share_ines: shareInes
      };
      let { error } = await supabase.from('shared_expenses').insert(row);
      // Sin finance-split.sql todavía: se guarda a medias.
      if (error && /share_ines/.test(error.message)) ({ error } = await supabase.from('shared_expenses').insert({ ...row, share_ines: undefined }));
      if (error && !/duplicate|unique/i.test(error.message)) return json({ error: error.message }, 500);
    }

    const base = {
      user_id: userId,
      description: shared ? `${merchant} · ${ownerShare === 50 ? `a medias con ${partner}` : ownerShare === 0 ? `de ${partner}` : 'en la casa'}`.slice(0, 120) : merchant,
      amount: rounded,
      category,
      expense_date: today,
      source: satispay ? 'manual' : 'apple_pay',
      source_reference: reference
    };
    const save = (row: Record<string, unknown>) => supabase.from('personal_expenses').upsert(row, { onConflict: 'user_id,source_reference', ignoreDuplicates: true });
    // Con finance-personal-v2.sql se guardan también comercio, tipo, sentido y «no cuenta».
    let { error } = await save({ ...base, merchant: merchant.slice(0, 80), kind: satispay ? 'other' : 'card', direction: 'out', excluded: shared });
    if (error && /column|schema cache/i.test(error.message)) ({ error } = shared ? { error: null } : await save(base));
    if (error) return json({ error: error.message }, 500);

    const message = !shared ? `Apuntado en tus gastos: ${merchant}, ${euros(rounded)}.`
      : ownerShare === 50 ? `Apuntado a medias con ${partner}: ${merchant}, ${euros(rounded)} (${euros(rounded / 2)} cada uno).`
      : ownerShare === 0 ? `Apuntado como gasto de ${partner}: ${merchant}, ${euros(rounded)}. Te lo debe.`
      : `Apuntado en la casa: ${merchant}, ${euros(rounded)} (tu parte, ${ownerShare} %).`;
    return json({ saved: true, shared, amount: rounded, merchant, category, message, version: 2 });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Solicitud inválida' }, 400);
  }
});

function json(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}
