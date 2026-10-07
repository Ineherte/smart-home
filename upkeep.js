// Casa al día (Vida): el mantenimiento que se repite cada cierto tiempo. Cada cosa tiene
// una frecuencia y la fecha de la última vez; aquí se ve cuánto falta, se marca como hecha
// con un toque y, si se pasa de fecha, aparece en el estado de la casa de Inicio.
// Usa createHouseholdStore (store.js), escapeHtml, showToast y currentUser de app.js.
// Sin la tabla home_care (home-care.sql) funciona solo en este teléfono y lo avisa.
const upkeepStore = createHouseholdStore({ table: 'home_care', localKey: 'umbral-home-care' });
const UPKEEP_EVERY = [[7, 'Cada semana'], [14, 'Cada 2 semanas'], [30, 'Cada mes'], [60, 'Cada 2 meses'], [90, 'Cada 3 meses'], [180, 'Cada 6 meses'], [365, 'Cada año'], [730, 'Cada 2 años']];
const UPKEEP_PRESETS = [
  ['Revisar la caldera', 'flame', 365],
  ['Limpiar los filtros del aire', 'wind', 90],
  ['Probar el detector de humo', 'alarm-smoke', 180],
  ['Descalcificar la cafetera', 'coffee', 60],
  ['Limpiar la nevera', 'refrigerator', 30],
  ['Lavar las cortinas', 'blinds', 180],
  ['Cambiar los cepillos de dientes', 'smile', 90],
  ['Limpiar la lavadora', 'washing-machine', 30],
  ['Dar la vuelta al colchón', 'bed-double', 180],
  ['Renovar el seguro de casa', 'shield-check', 365]
];
// Si no se elige icono, se adivina por el nombre.
const UPKEEP_ICON_WORDS = [
  [/caldera|calefac|radiador/, 'flame'], [/filtro|aire|ventil/, 'wind'], [/humo|alarma|extintor/, 'alarm-smoke'],
  [/cafe/, 'coffee'], [/nevera|frigo|congel/, 'refrigerator'], [/cortina|persiana/, 'blinds'], [/cepillo|dient/, 'smile'],
  [/lavadora|lavavajillas|secadora/, 'washing-machine'], [/colchon|cama|sabana/, 'bed-double'], [/seguro|contrato|alquiler/, 'shield-check'],
  [/coche|itv|rueda/, 'car'], [/bici/, 'bike'], [/planta|jardin|maceta/, 'sprout'], [/horno|cocina|campana/, 'chef-hat'],
  [/ventana|cristal/, 'app-window'], [/bano|ducha|grifo|cal\b/, 'shower-head'], [/pasaporte|dni|documento|carnet/, 'id-card'],
  [/perro|gato|vacuna|veterin/, 'paw-print'], [/medic|botiquin/, 'pill'], [/bombilla|luz/, 'lightbulb']
];
let upkeepItems = [];
let upkeepLoaded = false;
let upkeepShared = true;
let upkeepOpenId = null;
let upkeepFormOpen = false;

const upkeepToday = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};
const upkeepDays = (from, to) => Math.round((Date.parse(`${to}T12:00:00`) - Date.parse(`${from}T12:00:00`)) / 86400000);
const upkeepIconFor = (title) => UPKEEP_ICON_WORDS.find(([pattern]) => pattern.test(normalizeText(title)))?.[1] || 'wrench';
const upkeepEveryLabel = (days) => UPKEEP_EVERY.find(([value]) => value === Number(days))?.[1] || `Cada ${days} días`;

// Cuánto falta (negativo si se ha pasado) y qué parte del intervalo ha corrido ya.
function upkeepStatus(item) {
  const today = upkeepToday();
  if (!item.last_done) return { left: 0, ratio: 1, never: true };
  const since = upkeepDays(item.last_done, today);
  return { left: item.every_days - since, ratio: Math.min(1, Math.max(0, since / item.every_days)), since };
}
function upkeepDueText({ left, never }) {
  if (never) return '¿Cuándo fue la última vez?';
  if (left < 0) return `${-left} ${left === -1 ? 'día' : 'días'} tarde`;
  if (left === 0) return 'Toca hoy';
  if (left === 1) return 'Mañana';
  if (left < 31) return `En ${left} días`;
  const months = Math.round(left / 30);
  return months < 12 ? `En ${months} ${months === 1 ? 'mes' : 'meses'}` : `En ${Math.round(left / 365)} ${Math.round(left / 365) === 1 ? 'año' : 'años'}`;
}
const upkeepTone = ({ left, never }) => (never ? 'is-new' : left <= 0 ? 'is-due' : left <= 7 ? 'is-soon' : 'is-ok');
const upkeepSorted = () => [...upkeepItems].sort((a, b) => upkeepStatus(a).left - upkeepStatus(b).left || a.title.localeCompare(b.title));
// Lo que hay que hacer ya (atrasado o de hoy), para el estado de la casa de Inicio. Lo recién
// apuntado sin fecha no cuenta: aún no se sabe cuándo toca.
function upkeepDueItems() {
  return upkeepItems.filter((item) => { const status = upkeepStatus(item); return !status.never && status.left <= 0; });
}
window.upkeepDueItems = upkeepDueItems;

async function loadUpkeep() {
  try {
    upkeepItems = await upkeepStore.list({ build: (query) => query.order('created_at') });
    upkeepShared = true;
  } catch (error) {
    console.warn('[Umbral] Casa al día:', error?.message || error);
    upkeepShared = false;
    try { upkeepItems = JSON.parse(localStorage.getItem('umbral-home-care-fallback') || '[]'); } catch { upkeepItems = []; }
  }
  upkeepLoaded = true;
  renderUpkeep();
  window.renderHouseSummary?.();
}
const saveUpkeepFallback = () => { try { localStorage.setItem('umbral-home-care-fallback', JSON.stringify(upkeepItems)); } catch {} };

function upkeepRow(item) {
  const status = upkeepStatus(item);
  const open = upkeepOpenId === item.id;
  const last = item.last_done ? `${status.since === 0 ? 'hecho hoy' : status.since === 1 ? 'hecho ayer' : `hace ${status.since} días`}${item.done_by ? ` por ${escapeHtml(item.done_by === currentUser ? 'ti' : item.done_by)}` : ''}` : '';
  return `<li class="upkeep-item ${upkeepTone(status)}${open ? ' is-open' : ''}" data-upkeep-id="${escapeHtml(item.id)}">
    <div class="upkeep-main">
      <button type="button" class="upkeep-open" data-upkeep-toggle="${escapeHtml(item.id)}" aria-expanded="${open}">
        <span class="upkeep-icon"><i data-lucide="${escapeHtml(item.icon || upkeepIconFor(item.title))}"></i></span>
        <span class="upkeep-copy"><strong>${escapeHtml(item.title)}</strong><small><b class="upkeep-due">${escapeHtml(upkeepDueText(status))}</b> · ${escapeHtml(upkeepEveryLabel(item.every_days).toLowerCase())}${last ? ` · ${last}` : ''}</small></span>
      </button>
      <button type="button" class="upkeep-done" data-upkeep-done="${escapeHtml(item.id)}" aria-label="Marcar «${escapeHtml(item.title)}» como hecho" title="Hecho"><i data-lucide="check"></i></button>
    </div>
    <span class="upkeep-track" aria-hidden="true"><b style="width:${Math.round(status.ratio * 100)}%"></b></span>
    ${open ? `<form class="upkeep-edit" data-upkeep-edit="${escapeHtml(item.id)}">
      <label><span>Frecuencia</span><select name="every_days">${upkeepEveryOptions(item.every_days)}</select></label>
      <label><span>Última vez</span><input name="last_done" type="date" value="${escapeHtml(item.last_done || '')}" max="${upkeepToday()}" /></label>
      <div class="upkeep-edit-actions"><button type="submit" class="pill-button"><i data-lucide="save"></i> Guardar</button><button type="button" class="link-button is-danger" data-upkeep-delete="${escapeHtml(item.id)}">Eliminar</button></div>
    </form>` : ''}
  </li>`;
}
function upkeepEveryOptions(selected = 90) {
  const list = UPKEEP_EVERY.some(([value]) => value === Number(selected)) ? UPKEEP_EVERY : [...UPKEEP_EVERY, [Number(selected), `Cada ${selected} días`]];
  return list.map(([value, label]) => `<option value="${value}" ${value === Number(selected) ? 'selected' : ''}>${label}</option>`).join('');
}

function renderUpkeep() {
  const host = document.querySelector('#upkeepSection');
  if (!host) return;
  if (!upkeepLoaded) { host.querySelector('#upkeepBody').innerHTML = '<p class="empty-note">Cargando…</p>'; return; }
  const due = upkeepDueItems().length;
  const soon = upkeepItems.filter((item) => { const { left, never } = upkeepStatus(item); return !never && left > 0 && left <= 7; }).length;
  const fresh = upkeepItems.filter((item) => !item.last_done).length;
  const summary = !upkeepItems.length ? 'Apunta lo que hay que revisar de vez en cuando y Umbral os avisa cuando toca.'
    : due ? `${due === 1 ? 'Hay 1 cosa' : `Hay ${due} cosas`} que ya toca${soon ? ` y ${soon} esta semana` : ''}.`
      : soon ? `Todo al día. ${soon === 1 ? '1 cosa toca' : `${soon} cosas tocan`} esta semana.`
        : fresh === upkeepItems.length ? 'Toca cada una para decir cuándo se hizo por última vez, o márcala como hecha hoy.' : 'Todo al día. Nada que hacer esta semana.';
  const unused = UPKEEP_PRESETS.filter(([title]) => !upkeepItems.some((item) => normalizeText(item.title) === normalizeText(title)));
  host.querySelector('#upkeepSummary').textContent = summary;
  host.querySelector('#upkeepSummary').className = `upkeep-summary${due ? ' is-due' : ''}`;
  host.querySelector('#upkeepBody').innerHTML = `
    ${upkeepFormOpen ? `<form class="upkeep-form" data-upkeep-new>
      <input name="title" type="text" maxlength="80" placeholder="Revisar la caldera, limpiar filtros…" aria-label="Qué hay que hacer" required />
      <div class="upkeep-form-row">
        <label><span>Frecuencia</span><select name="every_days">${upkeepEveryOptions(90)}</select></label>
        <label><span>Última vez (opcional)</span><input name="last_done" type="date" max="${upkeepToday()}" /></label>
      </div>
      <div class="upkeep-edit-actions"><button type="submit" class="primary-button"><i data-lucide="plus"></i> Añadir</button><button type="button" class="link-button" data-upkeep-cancel>Cancelar</button></div>
    </form>` : ''}
    ${upkeepItems.length ? `<ul class="upkeep-list">${upkeepSorted().map(upkeepRow).join('')}</ul>` : ''}
    ${unused.length ? `<div class="upkeep-presets"><p class="suggestions-label"><i data-lucide="wand-sparkles"></i> ${upkeepItems.length ? 'Más ideas' : 'Ideas para empezar'}, con un toque</p><div class="upkeep-preset-row">${unused.slice(0, upkeepItems.length ? 4 : 8).map(([title, icon, every]) => `<button type="button" class="upkeep-preset" data-upkeep-preset="${escapeHtml(title)}"><i data-lucide="${icon}"></i>${escapeHtml(title)}<small>${escapeHtml(upkeepEveryLabel(every).toLowerCase())}</small></button>`).join('')}</div></div>` : ''}
    ${upkeepShared ? '' : '<p class="notes-local-warning"><i data-lucide="info"></i> Para compartirlo entre los dos, ejecutad supabase/sql/home-care.sql en Supabase.</p>'}`;
  document.querySelector('#upkeepAddButton')?.setAttribute('aria-expanded', String(upkeepFormOpen));
  lucide.createIcons();
}

async function addUpkeep({ title, every_days, last_done, icon }) {
  const clean = String(title || '').trim().slice(0, 80);
  if (!clean) return;
  if (upkeepItems.some((item) => normalizeText(item.title) === normalizeText(clean))) return showToast(`«${clean}» ya está en la lista`);
  const row = { title: clean, icon: icon || upkeepIconFor(clean), every_days: Number(every_days) || 90, last_done: last_done || null };
  try {
    if (upkeepShared) { const [created] = await upkeepStore.insert(row); upkeepItems.push(created); }
    else { upkeepItems.push({ ...row, id: createLocalId(), created_at: new Date().toISOString() }); saveUpkeepFallback(); }
    upkeepFormOpen = false;
    renderUpkeep();
    window.renderHouseSummary?.();
    showToast(`🛠️ ${clean}, apuntado`);
  } catch (error) {
    showSupabaseError('No se pudo añadir', error);
  }
}
async function updateUpkeep(id, changes) {
  const item = upkeepItems.find((entry) => entry.id === id);
  if (!item) return false;
  try {
    if (upkeepShared) await upkeepStore.update(id, changes);
    Object.assign(item, changes);
    if (!upkeepShared) saveUpkeepFallback();
    renderUpkeep();
    window.renderHouseSummary?.();
    return true;
  } catch (error) {
    showSupabaseError('No se pudo guardar', error);
    return false;
  }
}
async function markUpkeepDone(id) {
  const item = upkeepItems.find((entry) => entry.id === id);
  if (!item) return;
  const ok = await updateUpkeep(id, { last_done: upkeepToday(), done_by: currentUser });
  if (!ok) return;
  window.umbralMobile?.tap?.();
  showToast(`✨ ${item.title}: hecho. Próxima vez ${upkeepDueText(upkeepStatus(item)).toLowerCase()}`);
  window.dispatchEvent(new CustomEvent('umbral:life', { detail: { kind: 'upkeep' } }));
  document.querySelector(`[data-upkeep-id="${CSS.escape(id)}"]`)?.classList.add('is-celebrating');
}
async function deleteUpkeep(id) {
  const item = upkeepItems.find((entry) => entry.id === id);
  if (!item || !window.confirm(`¿Quitar «${item.title}» de Casa al día?`)) return;
  try {
    if (upkeepShared) await upkeepStore.remove(id);
    upkeepItems = upkeepItems.filter((entry) => entry.id !== id);
    if (!upkeepShared) saveUpkeepFallback();
    upkeepOpenId = null;
    renderUpkeep();
    window.renderHouseSummary?.();
  } catch (error) {
    showSupabaseError('No se pudo eliminar', error);
  }
}

document.querySelector('#upkeepSection')?.addEventListener('click', (event) => {
  const target = event.target;
  if (target.closest('#upkeepAddButton')) { upkeepFormOpen = !upkeepFormOpen; renderUpkeep(); if (upkeepFormOpen) document.querySelector('[data-upkeep-new] input')?.focus(); return; }
  if (target.closest('[data-upkeep-cancel]')) { upkeepFormOpen = false; renderUpkeep(); return; }
  const done = target.closest('[data-upkeep-done]');
  if (done) return markUpkeepDone(done.dataset.upkeepDone);
  const toggle = target.closest('[data-upkeep-toggle]');
  if (toggle) { upkeepOpenId = upkeepOpenId === toggle.dataset.upkeepToggle ? null : toggle.dataset.upkeepToggle; renderUpkeep(); return; }
  const remove = target.closest('[data-upkeep-delete]');
  if (remove) return deleteUpkeep(remove.dataset.upkeepDelete);
  const preset = target.closest('[data-upkeep-preset]');
  if (preset) {
    const [title, icon, every] = UPKEEP_PRESETS.find(([name]) => name === preset.dataset.upkeepPreset) || [];
    if (title) addUpkeep({ title, icon, every_days: every });
  }
});
document.querySelector('#upkeepSection')?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.target;
  const values = Object.fromEntries(new FormData(form));
  if (form.matches('[data-upkeep-new]')) return addUpkeep(values);
  if (form.matches('[data-upkeep-edit]')) {
    const ok = await updateUpkeep(form.dataset.upkeepEdit, { every_days: Number(values.every_days) || 90, last_done: values.last_done || null });
    if (ok) { upkeepOpenId = null; renderUpkeep(); showToast('Guardado'); }
  }
});

document.addEventListener('umbral:ready', () => {
  loadUpkeep();
  let reloadTimer;
  upkeepStore.subscribe(() => { clearTimeout(reloadTimer); reloadTimer = setTimeout(loadUpkeep, 300); });
  // Lo que falta depende del día: se repinta cada hora por si la app queda abierta.
  setInterval(() => { renderUpkeep(); window.renderHouseSummary?.(); }, 60 * 60 * 1000);
});
