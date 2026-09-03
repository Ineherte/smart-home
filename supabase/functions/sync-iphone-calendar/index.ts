import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-sync-token'
};

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Solo se acepta POST' }, 405);

  const syncToken = Deno.env.get('SYNC_TOKEN');
  if (!syncToken || request.headers.get('x-sync-token') !== syncToken) {
    return json({ error: 'Token de sincronización inválido' }, 401);
  }

  try {
    const body = await request.json();
    const owner = body.owner;
    const events = body.events;
    if (!['Ines', 'Matteo'].includes(owner) || !Array.isArray(events)) {
      return json({ error: 'El cuerpo debe incluir owner y events' }, 400);
    }

    const rows = events.map((event) => ({
      external_id: String(event.external_id),
      owner,
      title: String(event.title || 'Evento sin título').slice(0, 80),
      event_date: event.event_date,
      event_time: event.event_time || null,
      duration_minutes: Number(event.duration_minutes || 0),
      location: String(event.location || '').slice(0, 80),
      calendar_name: String(event.calendar_name || '').slice(0, 80),
      updated_at: new Date().toISOString()
    }));

    if (rows.some((event) => !event.external_id || !event.event_date)) {
      return json({ error: 'Cada evento necesita external_id y event_date' }, 400);
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );
    const { error } = await supabase.from('iphone_events').upsert(rows, { onConflict: 'external_id,owner' });
    if (error) return json({ error: error.message }, 500);
    return json({ synced: rows.length });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Solicitud inválida' }, 400);
  }
});

function json(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}
