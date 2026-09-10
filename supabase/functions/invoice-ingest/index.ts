import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

function json(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

function detectProvider(description: string) {
  if (/octopus/i.test(description)) return 'Octopus';
  if (/tim|telecom/i.test(description)) return 'TIM';
  return 'Otro';
}

function extractAmount(text: string) {
  const match = text.match(/(?:€|EUR)?\s*(\d+(?:[.,]\d{1,2}))/i);
  if (!match) return 0;
  return Number(match[1].replace(',', '.'));
}

function parseInvoice(payload: Record<string, unknown>, userId: string) {
  const rawText = String(payload.text ?? payload.content ?? payload.subject ?? payload.message ?? '').trim();
  const description = String(payload.description ?? payload.title ?? payload.subject ?? (rawText || 'Factura recibida')).trim();
  const amount = Number(payload.amount ?? extractAmount(rawText) ?? 0);
  const provider = detectProvider(description || rawText);
  const dueDate = String(payload.due_date ?? payload.dueDate ?? payload.date ?? '').slice(0, 10) || null;

  if (!description || !Number.isFinite(amount) || amount <= 0) {
    return null;
  }

  return {
    provider,
    description: description.slice(0, 160),
    amount: Number(amount.toFixed(2)),
    currency: 'EUR',
    due_date: dueDate,
    billing_period: payload.billing_period ? String(payload.billing_period) : null,
    status: 'pending',
    source: 'email',
    source_reference: String(payload.source_reference ?? payload.message_id ?? `invoice-${Date.now()}`),
    attachment_url: payload.attachment_url ? String(payload.attachment_url) : null,
    created_by: userId,
    created_at: new Date().toISOString()
  };
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return json({ error: 'Solo se acepta POST' }, 405);
  }

  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return json({ error: 'Se requiere un JWT válido' }, 401);
  }

  const url = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  if (!url || !anonKey) {
    return json({ error: 'Configura SUPABASE_URL y SUPABASE_ANON_KEY' }, 500);
  }

  const supabase = createClient(url, anonKey);
  const token = authHeader.replace('Bearer ', '').trim();
  const { data: { user }, error: userError } = await supabase.auth.getUser(token);

  if (userError || !user) {
    return json({ error: 'No autorizado para sincronizar facturas' }, 401);
  }

  try {
    const payload = await request.json();
    const normalized = Array.isArray(payload?.invoices)
      ? payload.invoices.map((invoice) => parseInvoice(invoice as Record<string, unknown>, user.id)).filter(Boolean)
      : [parseInvoice(payload as Record<string, unknown>, user.id)].filter(Boolean);

    if (!normalized.length) {
      return json({ error: 'No hay facturas válidas para importar' }, 400);
    }

    const { error: insertError } = await supabase.from('shared_bills').insert(normalized as Record<string, unknown>[]);
    if (insertError) {
      return json({ error: insertError.message }, 500);
    }

    return json({ ok: true, imported: normalized.length, provider: 'email' }, 200);
  } catch {
    return json({ error: 'Payload inválido' }, 400);
  }
});
