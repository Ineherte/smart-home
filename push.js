// Avisos push: cuando uno añade algo compartido, el teléfono del otro recibe una notificación.
// La función notify-household (Supabase) los envía; aquí se suscribe este dispositivo y se
// pide el aviso. Usa supabaseClient, authUserId, householdId, currentUser y showToast de app.js.
const pushSupported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
const isIosBrowser = () => /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.matchMedia('(display-mode: standalone)').matches && !navigator.standalone;
let pushPublicKey = null;

function base64UrlToBytes(value) {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  return Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
}

async function getPushPublicKey() {
  if (pushPublicKey) return pushPublicKey;
  const { data, error } = await supabaseClient.functions.invoke('notify-household', { method: 'GET' });
  if (error || !data?.publicKey) throw new Error('Los avisos aún no están configurados en Supabase (función notify-household).');
  pushPublicKey = data.publicKey;
  return pushPublicKey;
}

async function currentPushSubscription() {
  if (!pushSupported()) return null;
  const registration = await navigator.serviceWorker.ready;
  return registration.pushManager.getSubscription();
}

async function savePushSubscription(subscription) {
  const { endpoint, keys } = subscription.toJSON();
  const { error } = await supabaseClient.from('push_subscriptions').upsert({
    endpoint,
    p256dh: keys.p256dh,
    auth: keys.auth,
    user_id: authUserId,
    household_id: householdId,
    person: currentUser,
    user_agent: navigator.userAgent.slice(0, 200),
    updated_at: new Date().toISOString()
  }, { onConflict: 'endpoint' });
  if (error) throw error;
}

async function enablePush() {
  if (!pushSupported()) {
    showToast(isIosBrowser() ? 'En iPhone: añade Umbral a la pantalla de inicio y actívalos desde la app' : 'Este navegador no admite avisos');
    return;
  }
  if (!supabaseClient || !authUserId || !householdId) {
    showToast('Inicia sesión para recibir avisos');
    return;
  }
  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      showToast('Permiso denegado: actívalo en Ajustes > Notificaciones > Umbral');
      return;
    }
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription()
      || await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64UrlToBytes(await getPushPublicKey()) });
    await savePushSubscription(subscription);
    showToast(`Avisos activados: te avisaremos cuando ${otherPerson(currentUser)} añada algo`);
  } catch (error) {
    showToast(error.message || 'No se pudieron activar los avisos');
  } finally {
    renderPushStatus();
  }
}

async function disablePush() {
  try {
    const subscription = await currentPushSubscription();
    if (subscription) {
      if (supabaseClient && authUserId) await supabaseClient.from('push_subscriptions').delete().eq('endpoint', subscription.endpoint);
      await subscription.unsubscribe();
    }
    showToast('Avisos desactivados en este teléfono');
  } catch {
    showToast('No se pudieron desactivar los avisos');
  } finally {
    renderPushStatus();
  }
}

async function renderPushStatus() {
  const button = document.querySelector('#pushToggle');
  const status = document.querySelector('#pushStatus');
  if (!button || !status) return;
  let enabled = false;
  let text;
  if (!pushSupported()) {
    text = isIosBrowser() ? 'En iPhone funcionan con Umbral instalada en la pantalla de inicio (iOS 16.4 o posterior).' : 'Este navegador no admite avisos.';
  } else if (Notification.permission === 'denied') {
    text = 'Bloqueados. Actívalos en los ajustes del teléfono para Umbral.';
  } else {
    enabled = Notification.permission === 'granted' && Boolean(await currentPushSubscription().catch(() => null));
    text = enabled ? `Te avisamos cuando ${otherPerson(currentUser)} añade algo a la casa.` : `Recibe un aviso cuando ${otherPerson(currentUser)} añade algo a la casa.`;
  }
  status.textContent = text;
  button.hidden = !pushSupported() || Notification.permission === 'denied';
  button.setAttribute('aria-pressed', String(enabled));
  button.innerHTML = enabled ? '<i data-lucide="bell-off"></i> Desactivar' : '<i data-lucide="bell-ring"></i> Activar avisos';
  if (window.lucide) lucide.createIcons();
}

// Avisa a la otra persona. No bloquea ni falla: si no hay avisos configurados, no pasa nada.
function notifyHousehold(title, body, { open, tag } = {}) {
  if (!supabaseClient || !authUserId || !householdId) return;
  const url = open ? `./?abrir=${encodeURIComponent(open)}` : './';
  supabaseClient.functions.invoke('notify-household', { body: { title, body, url, tag } }).catch(() => {});
}

// Lista corta para el texto del aviso: "leche, pan y 3 más".
function summarizeList(names, max = 3) {
  const shown = names.slice(0, max);
  const rest = names.length - shown.length;
  if (rest > 0) return `${shown.join(', ')} y ${rest} más`;
  return shown.length > 1 ? `${shown.slice(0, -1).join(', ')} y ${shown.at(-1)}` : shown[0] || '';
}

document.querySelector('#pushToggle')?.addEventListener('click', async (event) => {
  const button = event.currentTarget;
  button.disabled = true;
  if (button.getAttribute('aria-pressed') === 'true') await disablePush();
  else await enablePush();
  button.disabled = false;
});

// Al conectar: si este teléfono ya tenía avisos, se refresca su registro (hogar y nombre).
document.addEventListener('umbral:ready', async () => {
  renderPushStatus();
  if (!pushSupported() || Notification.permission !== 'granted' || !supabaseClient || !authUserId || !householdId) return;
  const subscription = await currentPushSubscription().catch(() => null);
  if (subscription) savePushSubscription(subscription).catch(() => {});
});
