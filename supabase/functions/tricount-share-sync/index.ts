import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Solo se acepta POST' }, 405);

  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return json({ error: 'Se requiere un JWT válido' }, 401);

  const url = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  if (!url || !anonKey) return json({ error: 'Faltan variables de Supabase' }, 500);

  const supabase = createClient(url, anonKey);
  const token = authHeader.replace('Bearer ', '').trim();
  const { data: { user }, error: userError } = await supabase.auth.getUser(token);
  if (userError || !user) return json({ error: 'No autorizado para importar Tricount' }, 401);

  try {
    const body = await request.json();
    const tricountId = extractTricountId(body?.shareLink || body?.id);
    if (!tricountId || !/^[a-zA-Z0-9._~-]+$/.test(tricountId)) return json({ error: 'Enlace o ID de Tricount no válido' }, 400);

    const response = await fetch(`https://tricount-exporter.pages.dev/api/tricount/${encodeURIComponent(tricountId)}`);
    const data = await response.json().catch(() => null);
    if (!response.ok || !data) return json({ error: data?.error || `No se pudo cargar Tricount (${response.status})` }, 502);

    return json({ ok: true, tricountId, importedBy: user.id, tricount: data });
  } catch {
    return json({ error: 'No se pudo consultar el enlace compartido' }, 502);
  }
});
