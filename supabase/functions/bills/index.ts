// Facturas de Octopus (luz) y TIM (teléfono) en PDF → Documentos + datos para Cuentas → Luz.
// Dos formas de llamarla:
//   · Desde el Gmail (script de Google, ver LEEME.md): cabecera x-sync-token y
//     POST { owner, file_name, pdf_base64, subject?, from?, message_id? }. Guarda el PDF en
//     Documentos (carpeta Facturas, de los dos) y lee sus datos.
//   · Desde la app (sesión del usuario): POST { document_id } de un PDF ya subido a Documentos.
// Secretos: SYNC_TOKEN e IPHONE_OWNER_IDS (los mismos que los Atajos).
// supabase functions deploy bills --no-verify-jwt
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { pdfText, parseOctopus, parseTim, detectProvider, billTitle } from '../_shared/bills.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-sync-token'
};
const BUCKET = 'household-documents';

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Solo se acepta POST' }, 405);
  const admin: Admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return json({ error: 'Cuerpo inválido' }, 400); }

  try {
    // ---------- Desde el Gmail ----------
    if (request.headers.has('x-sync-token')) {
      const syncToken = Deno.env.get('SYNC_TOKEN');
      if (!syncToken || request.headers.get('x-sync-token') !== syncToken) return json({ error: 'Token inválido' }, 401);
      const owners = JSON.parse(Deno.env.get('IPHONE_OWNER_IDS') || '{}') as Record<string, string>;
      const userId = owners[String(body.owner || '')];
      if (!userId) return json({ error: 'owner no está en IPHONE_OWNER_IDS' }, 400);
      const { data: membership } = await admin.from('household_members').select('household_id').eq('user_id', userId).limit(1).maybeSingle();
      if (!membership?.household_id) return json({ error: 'No encuentro vuestro hogar' }, 404);
      const bytes = Uint8Array.from(atob(String(body.pdf_base64 || '')), (ch) => ch.charCodeAt(0));
      if (!bytes.length || bytes.length > 15 * 1024 * 1024) return json({ error: 'PDF vacío o de más de 15 MB' }, 400);
      const read = await readBill(bytes, `${body.subject || ''} ${body.from || ''} ${body.file_name || ''}`);
      if (!read) return json({ skipped: true, reason: 'No parece una factura de Octopus ni de TIM' });
      const existing = await findExisting(admin, membership.household_id, read);
      if (existing) return json({ skipped: true, reason: 'Ya estaba guardada', bill_id: existing.id });
      // El PDF a Documentos: carpeta Facturas, de los dos.
      const fileName = String(body.file_name || `${billTitle(read)}.pdf`).slice(0, 160);
      const safe = fileName.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w.-]+/g, '-').slice(-80);
      const path = `${membership.household_id}/shared/${crypto.randomUUID()}-${safe}`;
      const upload = await admin.storage.from(BUCKET).upload(path, bytes, { contentType: 'application/pdf', upsert: false });
      if (upload.error) return json({ error: `Storage: ${upload.error.message}` }, 500);
      const { data: doc, error: docError } = await admin.from('documents').insert({
        household_id: membership.household_id, owner_id: userId, person: 'both', scope: 'shared', category: 'Facturas',
        title: billTitle(read), path, file_name: fileName, mime: 'application/pdf', size_bytes: bytes.length,
        notes: `Llegó por correo${body.subject ? `: ${String(body.subject).slice(0, 200)}` : ''}`
      }).select('id').single();
      if (docError) { await admin.storage.from(BUCKET).remove([path]); return json({ error: docError.message }, 500); }
      const bill = await saveBill(admin, membership.household_id, read, doc.id, 'email');
      return json({ saved: true, provider: read.provider, title: billTitle(read), bill_id: bill?.id, document_id: doc.id, missing: missingFields(read) });
    }

    // ---------- Desde la app ----------
    const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
    const { data: userData } = await admin.auth.getUser(token);
    const user = userData?.user;
    if (!user || user.is_anonymous) return json({ error: 'Inicia sesión' }, 401);
    const { data: doc } = await admin.from('documents').select('id, household_id, owner_id, scope, path, title').eq('id', String(body.document_id || '')).maybeSingle();
    if (!doc) return json({ error: 'No encuentro ese documento' }, 404);
    const { data: member } = await admin.from('household_members').select('household_id').eq('user_id', user.id).eq('household_id', doc.household_id).maybeSingle();
    if (!member || (doc.scope !== 'shared' && doc.owner_id !== user.id)) return json({ error: 'No tienes acceso a ese documento' }, 403);
    const file = await admin.storage.from(BUCKET).download(doc.path);
    if (file.error || !file.data) return json({ error: 'No se pudo abrir el PDF' }, 500);
    const read = await readBill(new Uint8Array(await file.data.arrayBuffer()), doc.title || '');
    if (!read) return json({ error: 'No parece una factura de Octopus ni de TIM' }, 422);
    const existing = await findExisting(admin, doc.household_id, read);
    if (existing) return json({ skipped: true, reason: 'Esa factura ya estaba', bill_id: existing.id });
    const bill = await saveBill(admin, doc.household_id, read, doc.id, 'upload');
    await admin.from('documents').update({ title: billTitle(read), category: 'Facturas' }).eq('id', doc.id);
    return json({ saved: true, provider: read.provider, title: billTitle(read), bill, missing: missingFields(read) });
  } catch (error) {
    console.error(error);
    return json({ error: error instanceof Error ? error.message : 'Error leyendo la factura' }, 500);
  }
});

const COLUMNS = ['provider', 'kind', 'invoice_number', 'supply_code', 'issue_date', 'due_date', 'period_start', 'period_end', 'total_amount', 'bill_amount', 'kwh', 'kwh_f1', 'kwh_f2', 'kwh_f3', 'price_f1', 'price_f2', 'price_f3', 'energy_cost', 'network_cost', 'system_charges', 'fixed_fee', 'power_fee', 'taxes', 'vat', 'tv_fee', 'committed_kw', 'offer', 'tariff_type', 'payment', 'pun_month', 'annual_kwh', 'annual_cost', 'details'];

type Read = ReturnType<typeof parseOctopus> | ReturnType<typeof parseTim>;
// deno-lint-ignore no-explicit-any
type Admin = any;

async function readBill(bytes: Uint8Array, hint: string): Promise<Read | null> {
  const text = await pdfText(bytes);
  const provider = detectProvider(text, hint);
  if (provider === 'Octopus') return parseOctopus(text);
  if (provider === 'TIM') return parseTim(text);
  return null;
}

async function findExisting(admin: Admin, householdId: string, read: Read) {
  if (!read.invoice_number) return null;
  const { data } = await admin.from('utility_bills').select('id').eq('household_id', householdId).eq('provider', read.provider).eq('invoice_number', read.invoice_number).maybeSingle();
  return data;
}

async function saveBill(admin: Admin, householdId: string, read: Read, documentId: string, source: 'email' | 'upload') {
  // Solo las columnas de la tabla (el lector puede devolver más cosas con el tiempo).
  const row: Record<string, unknown> = { household_id: householdId, document_id: documentId, source };
  for (const key of COLUMNS) if (key in read) row[key] = (read as Record<string, unknown>)[key];
  const { data, error } = await admin.from('utility_bills').insert(row).select('*').single();
  if (error) throw new Error(error.message);
  return data;
}

// Lo que no se ha podido leer (para avisar y revisar la factura a mano).
function missingFields(read: Read) {
  const wanted = read.provider === 'Octopus' ? ['period_start', 'total_amount', 'kwh', 'kwh_f1', 'price_f1'] : ['total_amount', 'due_date'];
  return wanted.filter((key) => (read as Record<string, unknown>)[key] == null);
}

function json(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}
