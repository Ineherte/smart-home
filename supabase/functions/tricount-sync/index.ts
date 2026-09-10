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

function normalizeExpense(row: Record<string, unknown>, userId: string) {
  const description = String(row.description ?? row.descripcion ?? row.concept ?? row.concepto ?? row.name ?? 'Gasto importado').trim();
  const amountSource = row.amount ?? row.importe ?? row.total ?? row.cantidad ?? row.value ?? 0;
  const amount = Number(String(amountSource).replace(',', '.').replace(/[^\d.-]/g, ''));

  if (!description || !Number.isFinite(amount) || amount < 0) {
    return null;
  }

  const paidBy = String(row.paid_by ?? row.paidBy ?? row.pagopor ?? row.payer ?? 'Ines').trim();
  const category = String(row.category ?? row.categoria ?? 'Otros').trim() || 'Otros';
  const dateSource = row.expense_date ?? row.date ?? row.fecha ?? new Date().toISOString().slice(0, 10);
  const categoryAllowed = ['Alquiler', 'Luz', 'Internet', 'Agua', 'Gas', 'Compra', 'Transporte', 'Ocio', 'Otros'];

  return {
    description: description.slice(0, 160),
    amount: Number(amount.toFixed(2)),
    currency: 'EUR',
    paid_by: paidBy.toLowerCase().includes('matteo') ? 'Matteo' : 'Ines',
    category: categoryAllowed.includes(category) ? category : 'Otros',
    expense_date: String(dateSource).slice(0, 10),
    source: 'tricount',
    source_reference: String(row.source_reference ?? row.external_id ?? `tricount-${Date.now()}`),
    notes: row.notes ? String(row.notes) : null,
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
    return json({ error: 'No autorizado para sincronizar Tricount' }, 401);
  }

  try {
    const payload = await request.json();
    const rows = Array.isArray(payload?.expenses) ? payload.expenses : Array.isArray(payload?.rows) ? payload.rows : [];
    const normalized = rows.map((row) => normalizeExpense(row as Record<string, unknown>, user.id)).filter(Boolean) as Record<string, unknown>[];

    if (!normalized.length) {
      return json({ error: 'No hay gastos válidos para importar' }, 400);
    }

    const { error: insertError } = await supabase.from('shared_expenses').insert(normalized);
    if (insertError) {
      return json({ error: insertError.message }, 500);
    }

    return json({ ok: true, imported: normalized.length, provider: 'tricount' }, 200);
  } catch {
    return json({ error: 'Payload inválido' }, 400);
  }
});
