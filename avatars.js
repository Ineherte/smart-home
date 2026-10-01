// Muñecos de Ines y Matteo, como unos mini Sims: cada uno viste el suyo, elige su estado de
// ánimo, deja mensajes y manda toques (beso, abrazo…) al otro. Se guarda en la tabla avatars,
// una fila por persona (en modo local, en localStorage). El dibujo y el catálogo de ropa,
// accesorios y estados de ánimo están en scene.js (umbralScene.preview y umbralScene.catalog).
const AVATAR_LOCAL_KEY = 'umbral-avatars';
const AVATAR_SEEN_KEY = 'umbral-avatars-seen';
let avatarRows = {};
let avatarDraft = null;
let avatarTab = 'mood';

const avatarKey = (person) => String(person || '').toLowerCase();
const myAvatarPerson = () => (householdPeople.includes(currentUser) ? currentUser : null);
const avatarCatalog = () => window.umbralScene?.catalog;
const genderIndex = (person) => (person === 'Ines' ? 0 : 1);
const moodLabel = (mood, person) => avatarCatalog()?.MOODS[mood]?.label[genderIndex(person)] || '';
const avatarLook = (person) => ({ ...avatarCatalog()?.DEFAULT_LOOK[avatarKey(person)], ...(avatarRows[person]?.look || {}) });

function readAvatarSeen() {
  try { return JSON.parse(localStorage.getItem(AVATAR_SEEN_KEY) || '{}'); } catch { return {}; }
}
function writeAvatarSeen(seen) {
  try { localStorage.setItem(AVATAR_SEEN_KEY, JSON.stringify(seen)); } catch {}
}

async function loadAvatars() {
  if (supabaseClient && authUserId) {
    if (!householdReady()) return;
    const { data, error } = await supabaseClient.from('avatars').select('*').eq('household_id', householdId);
    // Sin avatars.sql la escena sigue con los muñecos por defecto.
    if (error) return console.warn('[Umbral] Muñecos:', error.message);
    avatarRows = Object.fromEntries((data || []).map((row) => [row.person, row]));
  } else {
    try { avatarRows = JSON.parse(localStorage.getItem(AVATAR_LOCAL_KEY) || '{}'); } catch { avatarRows = {}; }
  }
  syncAvatars();
  checkPokes();
}

async function saveAvatar(changes) {
  const person = myAvatarPerson();
  if (!person) throw new Error('Elige primero si eres Ines o Matteo');
  const row = { ...(avatarRows[person] || {}), ...changes, person, updated_at: new Date().toISOString() };
  if (supabaseClient && authUserId) {
    if (!householdReady()) throw new Error('Tu hogar aún se está conectando');
    const { data, error } = await supabaseClient.from('avatars').upsert({
      household_id: householdId,
      user_id: authUserId,
      person,
      look: row.look || {},
      mood: row.mood || null,
      mood_at: row.mood_at || null,
      message: row.message || null,
      message_at: row.message_at || null,
      poke: row.poke || null,
      poke_at: row.poke_at || null,
      updated_at: row.updated_at
    }, { onConflict: 'household_id,person' }).select().single();
    if (error) throw new Error(/relation|schema cache|does not exist/i.test(error.message) ? 'Falta ejecutar avatars.sql en Supabase' : error.message);
    avatarRows[person] = data;
  } else {
    avatarRows[person] = row;
    try { localStorage.setItem(AVATAR_LOCAL_KEY, JSON.stringify(avatarRows)); } catch {}
  }
  syncAvatars();
}

// Lleva los muñecos a la escena (con 💌 si el otro te ha dejado un mensaje sin leer).
function syncAvatars() {
  const seen = readAvatarSeen();
  const avatars = {};
  householdPeople.forEach((person) => {
    const row = avatarRows[person] || {};
    const unread = Boolean(row.message && person !== currentUser && row.message_at && row.message_at > (seen[`message-${person}`] || ''));
    avatars[avatarKey(person)] = { look: row.look || {}, mood: row.mood || null, message: row.message || '', unread };
  });
  window.umbralScene?.update({ avatars });
  if (typeof renderUsHero === 'function' && document.querySelector('#usHero')?.children.length) renderUsHero();
}

function markAvatarRead(key) {
  const person = householdPeople.find((name) => avatarKey(name) === key);
  const row = avatarRows[person];
  if (!row?.message_at || person === currentUser) return;
  const seen = readAvatarSeen();
  seen[`message-${person}`] = row.message_at;
  writeAvatarSeen(seen);
  syncAvatars();
}

// Toque recibido: los muñecos lo representan en la escena (una sola vez, y si es reciente).
function checkPokes() {
  const partner = otherPerson(currentUser);
  const row = avatarRows[partner];
  if (!row?.poke || !row.poke_at || partner === currentUser) return;
  const seen = readAvatarSeen();
  if (row.poke_at <= (seen[`poke-${partner}`] || '')) return;
  seen[`poke-${partner}`] = row.poke_at;
  writeAvatarSeen(seen);
  if (Date.now() - new Date(row.poke_at).getTime() > 24 * 3600 * 1000) return;
  const poke = avatarCatalog()?.POKES[row.poke];
  if (!poke) return;
  window.umbralScene?.play(row.poke);
  showToast(`${poke.emoji} ${partner} ${poke.text}`);
}

// Muñeco pequeño para otras pantallas (Nosotros).
function avatarPreviewFor(person) {
  const row = avatarRows[person] || {};
  return window.umbralScene?.preview(avatarKey(person), { look: row.look || {}, mood: row.mood }) || '';
}

// ---------- Editor ----------

const avatarSheet = document.querySelector('#avatarSheet');

function openAvatarEditor(tab = 'mood') {
  const person = myAvatarPerson();
  if (!person || !avatarCatalog()) return showToast('Elige primero si eres Ines o Matteo');
  avatarDraft = { look: avatarLook(person) };
  avatarTab = tab;
  renderAvatarEditor();
  avatarSheet.classList.add('visible');
  if (history.state?.page !== 'avatar-sheet') history.pushState({ page: 'avatar-sheet' }, '', '#muneco');
}

function closeAvatarEditor() {
  if (!avatarSheet.classList.contains('visible')) return;
  if (history.state?.page === 'avatar-sheet') history.back();
  else hideAvatarEditor();
}

function hideAvatarEditor() {
  avatarSheet.classList.remove('visible');
  avatarDraft = null;
}

const lookChanged = () => JSON.stringify(avatarDraft.look) !== JSON.stringify(avatarLook(myAvatarPerson()));

function choiceChips(name, options, selected) {
  return `<div class="avatar-chips">${options.map(([id, label, emoji]) => `<button type="button" class="avatar-chip" data-avatar-set="${name}" data-value="${id}" aria-pressed="${id === selected}">${emoji && emoji !== '·' ? `<span>${emoji}</span>` : ''}${escapeHtml(label)}</button>`).join('')}</div>`;
}

function swatches(name, colors, selected) {
  return `<div class="avatar-swatches">${colors.map((color) => `<button type="button" class="avatar-swatch" style="--swatch:${color}" data-avatar-set="${name}" data-value="${color}" aria-pressed="${color === selected}" aria-label="Color ${color}"></button>`).join('')}</div>`;
}

function avatarPane(person) {
  const catalog = avatarCatalog();
  const key = avatarKey(person);
  const look = avatarDraft.look;
  const row = avatarRows[person] || {};
  const partner = otherPerson(person);
  if (avatarTab === 'mood') {
    return `<p class="avatar-hint">${escapeHtml(partner)} verá tu cara y el emoji encima de tu muñeco.</p>
      <div class="mood-grid">${Object.entries(catalog.MOODS).map(([id, mood]) => `<button type="button" class="mood-option" data-avatar-mood="${id}" aria-pressed="${row.mood === id}"><span>${mood.emoji}</span>${escapeHtml(mood.label[genderIndex(person)])}</button>`).join('')}
      <button type="button" class="mood-option is-none" data-avatar-mood="" aria-pressed="${!row.mood}"><span>·</span>Sin estado</button></div>`;
  }
  if (avatarTab === 'clothes') {
    return `<div class="outfit-grid">${Object.entries(catalog.OUTFITS).map(([id, outfit]) => `<button type="button" class="outfit-option" data-avatar-set="outfit" data-value="${id}" aria-pressed="${look.outfit === id}"><span class="outfit-thumb">${window.umbralScene.preview(key, { look: { ...look, outfit: id } })}</span>${escapeHtml(outfit.label)}</button>`).join('')}</div>
      ${look.outfit === 'casual' ? `<p class="avatar-label">Arriba</p>${swatches('top', catalog.CLOTH_COLORS, look.top)}
      <p class="avatar-label">Pantalón</p>${swatches('bottom', catalog.CLOTH_COLORS, look.bottom)}
      <p class="avatar-label">Zapatillas</p>${swatches('shoes', catalog.CLOTH_COLORS, look.shoes)}
      <label class="option-toggle"><input type="checkbox" data-avatar-weather ${look.weather !== false ? 'checked' : ''} /><span><i data-lucide="cloud-snow"></i>Abrigarme cuando haga frío o llueva</span></label>` : '<p class="avatar-hint">Los disfraces se quedan puestos llueva o nieve 😄</p>'}`;
  }
  if (avatarTab === 'extras') {
    const ownHead = ['pajamas', 'dino', 'bear', 'chef'].includes(look.outfit);
    return `<p class="avatar-label">Cabeza</p>${choiceChips('head', catalog.HEAD_ACC, look.head)}
      ${ownHead ? `<p class="avatar-hint">Con el conjunto «${escapeHtml(catalog.OUTFITS[look.outfit].label)}» se ve su propio gorro.</p>` : ''}
      <p class="avatar-label">Cara</p>${choiceChips('face', catalog.FACE_ACC, look.face)}
      <p class="avatar-label">Cuello</p>${choiceChips('neck', catalog.NECK_ACC, look.neck)}`;
  }
  if (avatarTab === 'hair') {
    return `<p class="avatar-label">Peinado</p>${choiceChips('hair', catalog.HAIRSTYLES[key].map(([id, label]) => [id, label, '']), look.hair)}
      <p class="avatar-label">Color</p>${swatches('hairColor', catalog.HAIR_COLORS, look.hairColor)}`;
  }
  // Para el otro: mensaje y toques.
  const partnerRow = avatarRows[partner] || {};
  return `<div class="partner-card"><span class="partner-doll">${avatarPreviewFor(partner)}</span><div><strong>${escapeHtml(partner)}</strong><small>${partnerRow.mood ? `${catalog.MOODS[partnerRow.mood]?.emoji || ''} ${escapeHtml(moodLabel(partnerRow.mood, partner))}` : 'Sin estado de ánimo'}</small>${partnerRow.message ? `<p>💌 «${escapeHtml(partnerRow.message)}»</p>` : ''}</div></div>
    <form class="item-editor" data-avatar-message>
      <label class="plant-field"><span>Tu mensaje para ${escapeHtml(partner)}</span><textarea name="message" rows="2" maxlength="140" placeholder="Te he dejado tarta en la nevera 🍰">${escapeHtml(row.message || '')}</textarea></label>
      <div class="plant-form-actions"><button type="submit" class="primary-button"><i data-lucide="send"></i> Dejar mensaje</button>${row.message ? '<button type="button" class="link-button" data-avatar-clear-message>Quitar mensaje</button>' : ''}</div>
    </form>
    <p class="avatar-label">Mandar un toque</p>
    <div class="poke-grid">${Object.entries(catalog.POKES).map(([id, poke]) => `<button type="button" class="poke-option" data-avatar-poke="${id}"><span>${poke.emoji}</span>${escapeHtml(poke.label)}</button>`).join('')}</div>
    <p class="avatar-hint">Le llega un aviso al móvil y vuestros muñecos lo hacen en la escena.</p>`;
}

function renderAvatarEditor() {
  const person = myAvatarPerson();
  const row = avatarRows[person] || {};
  const body = document.querySelector('#avatarSheetBody');
  const scroll = body.scrollTop;
  const tabs = [['mood', 'Ánimo'], ['clothes', 'Ropa'], ['extras', 'Complementos'], ['hair', 'Pelo'], ['partner', `Para ${otherPerson(person)}`]];
  body.innerHTML = `
    <div class="avatar-editor-head">
      <div class="avatar-preview">${window.umbralScene.preview(avatarKey(person), { look: avatarDraft.look, mood: row.mood })}</div>
      <div><p class="eyebrow muted">Tu muñeco</p><h2 id="avatarSheetTitle">${escapeHtml(person)}</h2><p class="avatar-status">${row.mood ? `${avatarCatalog().MOODS[row.mood]?.emoji || ''} ${escapeHtml(moodLabel(row.mood, person))}` : 'Sin estado de ánimo'}</p></div>
    </div>
    <div class="avatar-tabs" role="tablist">${tabs.map(([id, label]) => `<button type="button" role="tab" data-avatar-tab="${id}" aria-selected="${avatarTab === id}">${escapeHtml(label)}</button>`).join('')}</div>
    <div class="avatar-pane">${avatarPane(person)}</div>
    <div class="avatar-save"${lookChanged() ? '' : ' hidden'}><button type="button" class="primary-button" data-avatar-save><i data-lucide="check"></i> Guardar mi look</button><button type="button" class="link-button" data-avatar-undo>Deshacer</button></div>`;
  body.scrollTop = scroll;
  lucide.createIcons();
}

async function runAvatarAction(action, success) {
  try {
    await action();
    if (success) showToast(success);
    if (avatarDraft) renderAvatarEditor();
  } catch (error) {
    showToast(error.message || 'No se pudo guardar');
  }
}

avatarSheet.addEventListener('click', (event) => {
  const target = event.target;
  if (target === avatarSheet || target.closest('[data-close-avatar]')) return closeAvatarEditor();
  if (!avatarDraft) return;
  const person = myAvatarPerson();
  const partner = otherPerson(person);
  const tab = target.closest('[data-avatar-tab]');
  if (tab) {
    avatarTab = tab.dataset.avatarTab;
    document.querySelector('#avatarSheetBody').scrollTop = 0;
    return renderAvatarEditor();
  }
  const set = target.closest('[data-avatar-set]');
  if (set) {
    avatarDraft.look = { ...avatarDraft.look, [set.dataset.avatarSet]: set.dataset.value };
    return renderAvatarEditor();
  }
  if (target.closest('[data-avatar-undo]')) {
    avatarDraft.look = avatarLook(person);
    return renderAvatarEditor();
  }
  if (target.closest('[data-avatar-save]')) {
    const outfit = avatarCatalog().OUTFITS[avatarDraft.look.outfit];
    return runAvatarAction(async () => {
      await saveAvatar({ look: avatarDraft.look });
      notifyHousehold(`${person} se ha cambiado de look ${outfit?.emoji || '👗'}`, avatarDraft.look.outfit === 'casual' ? 'Mira cómo va hoy su muñeco' : `Va de ${outfit.label.toLowerCase()}`, { open: 'home', tag: 'avatar' });
    }, '¡Look guardado!');
  }
  const mood = target.closest('[data-avatar-mood]');
  if (mood) {
    const value = mood.dataset.avatarMood || null;
    const info = avatarCatalog().MOODS[value];
    return runAvatarAction(async () => {
      await saveAvatar({ mood: value, mood_at: new Date().toISOString() });
      if (info) notifyHousehold(`${person} está ${moodLabel(value, person).toLowerCase()} ${info.emoji}`, 'Toca para ver su muñeco', { open: 'home', tag: 'avatar-mood' });
    }, info ? `${info.emoji} ${moodLabel(value, person)}` : 'Estado quitado');
  }
  if (target.closest('[data-avatar-clear-message]')) {
    return runAvatarAction(() => saveAvatar({ message: null, message_at: null }), 'Mensaje quitado');
  }
  const poke = target.closest('[data-avatar-poke]');
  if (poke) {
    const info = avatarCatalog().POKES[poke.dataset.avatarPoke];
    return runAvatarAction(async () => {
      await saveAvatar({ poke: poke.dataset.avatarPoke, poke_at: new Date().toISOString() });
      notifyHousehold(`${info.emoji} ${person} ${info.text}`, 'Abre Umbral para verlo', { open: 'home', tag: 'avatar-poke' });
      window.umbralScene?.play(poke.dataset.avatarPoke);
    }, `${info.emoji} Enviado a ${partner}`);
  }
});

avatarSheet.addEventListener('change', (event) => {
  if (!event.target.matches('[data-avatar-weather]') || !avatarDraft) return;
  avatarDraft.look = { ...avatarDraft.look, weather: event.target.checked };
  renderAvatarEditor();
});

avatarSheet.addEventListener('submit', (event) => {
  event.preventDefault();
  const form = event.target;
  if (!form.hasAttribute('data-avatar-message')) return;
  const message = form.message.value.trim().slice(0, 140);
  if (!message) return form.message.focus();
  const person = myAvatarPerson();
  runAvatarAction(async () => {
    await saveAvatar({ message, message_at: new Date().toISOString() });
    notifyHousehold(`💌 ${person} te ha dejado un mensaje`, message, { open: 'home', tag: 'avatar-message' });
  }, `💌 ${otherPerson(person)} lo verá al tocar tu muñeco`);
});

window.addEventListener('popstate', () => {
  if (history.state?.page !== 'avatar-sheet') hideAvatarEditor();
});

document.addEventListener('umbral:ready', () => {
  loadAvatars();
  if (supabaseClient && authUserId && householdId) {
    supabaseClient.channel('avatars-live').on('postgres_changes', { event: '*', schema: 'public', table: 'avatars', filter: `household_id=eq.${householdId}` }, () => loadAvatars()).subscribe();
  }
});
// Al volver a la app, por si llegó un toque mientras estaba en segundo plano.
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) loadAvatars();
});
