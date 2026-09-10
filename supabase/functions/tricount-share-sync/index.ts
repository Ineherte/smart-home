const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

function json(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

function extractTricountId(value: unknown) {
  const input = String(value || '').trim();
  if (!input) return null;
  if (!input.includes('/') && !input.includes('tricount.com')) return input;
  try {
    const url = new URL(input.startsWith('http') ? input : `https://${input}`);
    const parts = url.pathname.split('/').filter(Boolean);
    return parts.length ? decodeURIComponent(parts[parts.length - 1]) : null;
  } catch {
    return input.split('/').filter(Boolean).pop() || null;
  }
}

function normalizeTricount(raw: Record<string, unknown>) {
  const registry = (raw.Response as Array<Record<string, unknown>> | undefined)?.[0]?.Registry as Record<string, unknown> | undefined;
  if (!registry) return null;
  const memberships = Array.isArray(registry.memberships) ? registry.memberships : [];
  const members = memberships.map((item) => {
    const member = (item as Record<string, unknown>).RegistryMembershipNonUser as Record<string, unknown>;
    const alias = member?.alias as Record<string, unknown> | undefined;
    return { uuid: String(member?.uuid || ''), name: String(alias?.display_name || alias?.name || 'Miembro') };
  }).filter((member) => member.uuid);
  const memberNames = Object.fromEntries(members.map((member) => [member.uuid, member.name]));
  const entries = Array.isArray(registry.all_registry_entry) ? registry.all_registry_entry : [];
  const expenses = entries.map((item) => (item as Record<string, unknown>).RegistryEntry as Record<string, unknown>)
    .filter((entry) => entry && entry.type_transaction !== 'BALANCE')
    .map((entry) => {
      const owned = entry.membership_owned as Record<string, unknown> | undefined;
      const member = owned?.RegistryMembershipNonUser as Record<string, unknown> | undefined;
      const alias = member?.alias as Record<string, unknown> | undefined;
      const payerUuid = String(member?.uuid || '');
      const amount = Math.abs(Number((entry.amount as Record<string, unknown>)?.value || 0));
      const category = typeof entry.category === 'string' ? entry.category : 'Otros';
      return {
        id: String(entry.uuid || entry.id || crypto.randomUUID()),
        date: String(entry.date || entry.created || '').slice(0, 10),
        description: String(entry.description || 'Gasto Tricount'),
        category,
        payerUuid,
        payer: memberNames[payerUuid] || String(alias?.display_name || 'Ines'),
        totalAmount: amount
      };
    }).filter((entry) => Number.isFinite(entry.totalAmount) && entry.totalAmount >= 0);
  return {
    title: String(registry.title || 'Tricount'),
    currency: String(registry.currency || 'EUR'),
    members,
    expenses,
    reimbursements: [],
    summaries: []
  };
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Solo se acepta POST' }, 405);

  try {
    const body = await request.json();
    const tricountId = extractTricountId(body?.shareLink || body?.id);
    if (!tricountId || !/^[a-zA-Z0-9._~-]+$/.test(tricountId)) return json({ error: 'Enlace o ID de Tricount no válido' }, 400);

    const response = await fetch(`https://tricount-exporter.pages.dev/api/tricount/${encodeURIComponent(tricountId)}`);
    const data = await response.json().catch(() => null);
    if (!response.ok || !data) return json({ error: data?.error || `No se pudo cargar Tricount (${response.status})` }, 502);

    const tricount = normalizeTricount(data);
    if (!tricount) return json({ error: 'El enlace no contiene un Tricount reconocible' }, 422);
    return json({ ok: true, tricountId, tricount });
  } catch {
    return json({ error: 'No se pudo consultar el enlace compartido' }, 502);
  }
});
