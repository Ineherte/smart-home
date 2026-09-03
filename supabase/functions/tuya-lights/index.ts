import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

interface TuyaRequestBody {
  deviceId?: string;
  action?: 'on' | 'off';
  deviceCode?: string;
}

function jsonBody(status: number, payload: Record<string, unknown>) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

async function getTuyaToken(): Promise<{ access_token: string; expires_in: number; refresh_token?: string }> {
  const clientId = Deno.env.get('TUYA_ACCESS_ID');
  const clientSecret = Deno.env.get('TUYA_ACCESS_SECRET');
  const apiHost = Deno.env.get('TUYA_API_HOST') || 'https://openapi-ueaz.tuyaeu.com';
  const timestamp = Date.now().toString();

  if (!clientId || !clientSecret) {
    throw new Error('Faltan TUYA_ACCESS_ID o TUYA_ACCESS_SECRET');
  }

  const sign = await hmacSha256(clientSecret, `${clientId}${timestamp}`);
  const response = await fetch(`${apiHost}/v1.0/token?grant_type=1`, {
    headers: {
      client_id: clientId,
      t: timestamp,
      sign,
      sign_method: 'HMAC-SHA256'
    }
  });

  const data = await response.json();
  if (!response.ok || !data.success) {
    throw new Error(`Tuya token error: ${data.msg || response.statusText}`);
  }

  return data.result;
}

async function sendTuyaCommand(token: string, deviceId: string, action: 'on' | 'off', deviceCode: string) {
  const clientId = Deno.env.get('TUYA_ACCESS_ID');
  const clientSecret = Deno.env.get('TUYA_ACCESS_SECRET');
  const apiHost = Deno.env.get('TUYA_API_HOST') || 'https://openapi-ueaz.tuyaeu.com';
  const path = `/v1.0/iot-03/devices/${deviceId}/commands`;
  const body = JSON.stringify({ commands: [{ code: deviceCode, value: action === 'on' }] });
  const timestamp = Date.now().toString();
  const bodyHash = await sha256(body);
  const stringToSign = `POST\n${bodyHash}\n\n${path}`;
  const sign = await hmacSha256(clientSecret!, `${clientId}${token}${timestamp}${stringToSign}`);
  const response = await fetch(`${apiHost}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      client_id: clientId!,
      access_token: token,
      t: timestamp,
      sign,
      sign_method: 'HMAC-SHA256'
    },
    body
  });

  const data = await response.json();
  if (!response.ok || !data.success) {
    throw new Error(`Tuya command error: ${data.msg || response.statusText}`);
  }

  return data.result;
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function hmacSha256(secret: string, value: string) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value));
  return Array.from(new Uint8Array(signature), (byte) => byte.toString(16).padStart(2, '0')).join('').toUpperCase();
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return jsonBody(405, { error: 'Solo se acepta POST' });
  }

  try {
    const body = (await request.json()) as TuyaRequestBody;
    const deviceId = body.deviceId;
    const action = body.action;
    const deviceCode = body.deviceCode || 'switch_led';

    if (!deviceId || !['on', 'off'].includes(action || '')) {
      return jsonBody(400, { error: 'Faltan deviceId y action (on/off)' });
    }

    const accessToken = await getTuyaToken();
    await sendTuyaCommand(accessToken.access_token, deviceId, action, deviceCode);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    await supabase.from('device_state').upsert({
      device_id: deviceId,
      kind: 'light',
      status: action === 'on' ? 'on' : 'off',
      updated_at: new Date().toISOString()
    }, { onConflict: 'device_id' });

    return jsonBody(200, { ok: true, deviceId, action, status: action === 'on' ? 'on' : 'off' });
  } catch (error) {
    return jsonBody(500, { error: error instanceof Error ? error.message : 'Error al controlar luces' });
  }
});
