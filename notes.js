// Notas: apuntes libres, no tareas. Una nota tiene un título, texto y, si quieres, una lista
// para ir marcando (la maleta de un viaje, ideas de regalos, la ferretería…). No se «hacen»:
// se fijan arriba, se archivan o se borran. Se guardan solas mientras escribes.
// Datos en la tabla notes: content = título, details = texto + lista (líneas «☐ …» y «☑ …»),
// color, pinned, scope (los dos o solo yo) y completed = archivada.
// Usa getNotes, readNotes, supabaseClient, authUserId, householdId, currentUser y showToast de app.js.
let householdNotes = [];
let notesSearch = '';
const notesMissing = new Set();
const NOTE_COLORS = { sand: 'Arena', sage: 'Salvia', sky: 'Cielo', rose: 'Rosa', lilac: 'Lila', lemon: 'Limón' };
const NOTE_TEMPLATES = [
  { id: 'trip', emoji: '🧳', title: 'Maleta para el viaje', color: 'sky', items: ['DNI o pasaporte', 'Cargadores', 'Auriculares', 'Cepillo de dientes', 'Neceser', 'Pijama', 'Ropa interior', 'Calcetines', 'Medicinas', 'Gafas de sol', 'Bañador', 'Adaptador de enchufe'] },
  { id: 'gifts', emoji: '🎁', title: 'Ideas de regalos', color: 'rose', text: 'Para quién y qué. Así no se nos olvida cuando llegue el cumple.', items: [] },
  { id: 'house', emoji: '🏠', title: 'Datos de casa', color: 'sage', text: 'Wifi: \nContraseña: \nCasero: \nContador de la luz: \nPortero: ' },
  { id: 'shop', emoji: '🛠️', title: 'Para la ferretería / IKEA', color: 'sand', items: [] }
];

const localNotesKey = (scope) => (scope === 'shared' ? localSharedNotesKey : localPrivateNotesKey());
const noteAuthor = (note) => (!note.owner_id || note.owner_id === authUserId ? currentUser : otherPerson(currentUser));

// ---------- Texto ⇄ lista ----------
function parseNoteBody(details) {
  const items = [];
  const text = [];
  String(details || '').split('\n').forEach((line) => {
    const match = /^([☐☑])\s?(.*)$/.exec(line);
    if (match) items.push({ text: match[2], done: match[1] === '☑' });
    else text.push(line);
  });
  return { text: text.join('\n').trim(), items };
}
function serializeNoteBody(text, items) {
  const lines = items.filter((item) => item.text.trim()).map((item) => `${item.done ? '☑' : '☐'} ${item.text.trim()}`);
  return [String(text || '').trim(), ...lines].filter(Boolean).join('\n').slice(0, 6000) || null;
}

// ---------- Datos ----------
function readLocalNotes(scope) {
  const key = localNotesKey(scope);
  const notes = readNotes(key);
  if (notes.some((note) => !note.id)) {
    notes.forEach((note) => { note.id ||= createLocalId(); });
    localStorage.setItem(key, JSON.stringify(notes));
  }
  return notes.map((note) => ({ ...note, scope }));
}
async function loadNotes() {
  if (supabaseClient && authUserId) {
    const notes = await getNotes();
    householdNotes = [...notes.shared, ...notes.private];
  } else {
    householdNotes = [...readLocalNotes('shared'), ...readLocalNotes('private')];
  }
}
const stripMissing = (row) => Object.fromEntries(Object.entries(row).filter(([key]) => !notesMissing.has(key)));
async function notesQuery(run, row) {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const { data, error } = await run(stripMissing(row));
    if (!error) return data;
    const field = ['color', 'updated_at', 'pinned', 'details'].find((key) => /column|schema cache/i.test(error.message || '') && (error.message || '').includes(key));
    if (!field || notesMissing.has(field)) {
      if (/notes_details_check/.test(error.message || '')) throw new Error('La nota es demasiado larga. Ejecutad tasks-notes-v3.sql en Supabase para tener más espacio.');
      throw error;
    }
    notesMissing.add(field);
    if (field === 'color') showToast('Falta ejecutar tasks-notes-v3.sql en Supabase: los colores no se guardarán');
  }
  throw new Error('No se pudo guardar la nota');
}
async function saveNote(note) {
  const row = { content: (note.content || '').trim().slice(0, 120) || 'Sin título', details: note.details ?? null, scope: note.scope || 'shared', pinned: Boolean(note.pinned), color: note.color || null, completed: Boolean(note.completed), priority: 'normal', updated_at: new Date().toISOString() };
  if (supabaseClient && authUserId) {
    if (!householdReady()) throw new Error('Tu hogar aún se está conectando');
    if (note.id && !String(note.id).startsWith('draft-')) {
      const previous = householdNotes.find((entry) => entry.id === note.id);
      await notesQuery((data) => supabaseClient.from('notes').update(data).eq('id', note.id), row);
      Object.assign(previous || {}, row);
      return note.id;
    }
    const created = await notesQuery((data) => supabaseClient.from('notes').insert({ ...data, owner_id: authUserId, household_id: householdId }).select('*').single(), row);
    householdNotes.unshift(created);
    if (row.scope === 'shared') notifyHousehold(`${currentUser} creó una nota`, row.content, { open: 'notes', tag: 'notes' });
    return created.id;
  }
  // Modo local: cada nota vive en la lista de su ámbito.
  const id = note.id && !String(note.id).startsWith('draft-') ? note.id : createLocalId();
  const previous = householdNotes.find((entry) => entry.id === id);
  ['shared', 'private'].forEach((scope) => localStorage.setItem(localNotesKey(scope), JSON.stringify(readLocalNotes(scope).filter((entry) => entry.id !== id))));
  const stored = { ...(previous || {}), ...row, id, created_at: previous?.created_at || new Date().toISOString() };
  localStorage.setItem(localNotesKey(row.scope), JSON.stringify([stored, ...readLocalNotes(row.scope)]));
  householdNotes = [stored, ...householdNotes.filter((entry) => entry.id !== id)];
  return id;
}
async function removeNote(id) {
  const note = householdNotes.find((entry) => entry.id === id);
  if (!note) return;
  if (supabaseClient && authUserId) {
    const { error } = await supabaseClient.from('notes').delete().eq('id', id);
    if (error) throw error;
  } else {
    localStorage.setItem(localNotesKey(note.scope), JSON.stringify(readLocalNotes(note.scope).filter((entry) => entry.id !== id)));
  }
  householdNotes = householdNotes.filter((entry) => entry.id !== id);
}

// ---------- Tablero ----------
const timeAgo = (iso) => {
  if (!iso) return '';
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return 'ahora';
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.round(hours / 24);
  if (days === 1) return 'ayer';
  if (days < 7) return `hace ${days} días`;
  return new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short' }).format(new Date(iso));
};
const noteTime = (note) => note.updated_at || note.created_at;
function noteCard(note) {
  const body = parseNoteBody(note.details);
  const done = body.items.filter((item) => item.done).length;
  const pending = body.items.filter((item) => !item.done);
  const who = note.scope === 'private' ? '🔒 Solo tú' : noteAuthor(note) === currentUser ? 'Tú' : noteAuthor(note);
  return `<article class="paper-note color-${escapeHtml(note.color || 'sand')}${note.pinned ? ' is-pinned' : ''}" data-open-note="${escapeHtml(note.id)}" tabindex="0" role="button" aria-label="Nota: ${escapeHtml(note.content)}">
    <header>${note.pinned ? '<i data-lucide="pin"></i>' : ''}<strong>${escapeHtml(note.content)}</strong></header>
    ${body.text ? `<p>${escapeHtml(body.text)}</p>` : ''}
    ${body.items.length ? `<div class="paper-check"><span class="paper-check-bar"><b style="width:${Math.round((done / body.items.length) * 100)}%"></b></span><small>${done}/${body.items.length}</small></div><ul>${pending.slice(0, 4).map((item) => `<li>☐ ${escapeHtml(item.text)}</li>`).join('')}${pending.length > 4 ? `<li class="is-more">y ${pending.length - 4} más</li>` : ''}${!pending.length ? '<li class="is-more">✓ Todo marcado</li>' : ''}</ul>` : ''}
    <footer><span>${escapeHtml(who)}</span><span>${escapeHtml(timeAgo(noteTime(note)))}</span></footer>
  </article>`;
}
function matchesSearch(note) {
  if (!notesSearch) return true;
  return normalizeText(`${note.content} ${note.details || ''}`).includes(normalizeText(notesSearch));
}
function renderNotesBoard() {
  const host = document.querySelector('#notesBoard');
  if (!host) return;
  const live = householdNotes.filter((note) => !note.completed && matchesSearch(note)).sort((a, b) => String(noteTime(b)).localeCompare(String(noteTime(a))));
  const pinned = live.filter((note) => note.pinned);
  const others = live.filter((note) => !note.pinned);
  const archived = householdNotes.filter((note) => note.completed && matchesSearch(note));
  const templates = NOTE_TEMPLATES.filter((template) => !householdNotes.some((note) => normalizeText(note.content) === normalizeText(template.title)));
  host.innerHTML = `
    ${!householdNotes.length && !notesSearch ? '<div class="empty-state"><span class="empty-state-icon"><i data-lucide="notebook-pen"></i></span><strong>Vuestros apuntes</strong><span>La maleta del próximo viaje, la clave del wifi, ideas de regalos… Las cosas que hacer van en «Por hacer».</span></div>' : ''}
    <div class="note-new-row">
      <button type="button" class="note-new" data-new-note=""><i data-lucide="plus"></i>Nota nueva</button>
      ${templates.map((template) => `<button type="button" class="note-template" data-new-note="${template.id}">${template.emoji} ${escapeHtml(template.title)}</button>`).join('')}
    </div>
    ${live.length ? `<div class="paper-grid">${[...pinned, ...others].map(noteCard).join('')}</div>` : ''}
    ${notesSearch && !live.length ? '<p class="empty-note">No hay notas con eso.</p>' : ''}
    ${archived.length ? `<details class="done-group"><summary><i data-lucide="archive"></i>Archivadas<span>${archived.length}</span></summary><div class="paper-grid is-archived">${archived.map(noteCard).join('')}</div></details>` : ''}`;
  lucide.createIcons();
}
// Lo de las notas que se ve fuera (Inicio y la pestaña).
function renderNotesSummary() {
  const live = householdNotes.filter((note) => !note.completed);
  const latest = [...live].sort((a, b) => (b.pinned === true) - (a.pinned === true) || String(noteTime(b)).localeCompare(String(noteTime(a))))[0];
  const count = document.querySelector('#notesCount');
  if (count) count.textContent = live.length ? `${live.length} ${live.length === 1 ? 'nota' : 'notas'}` : 'Sin notas';
  const preview = document.querySelector('#notesPreview');
  if (preview) preview.textContent = latest ? latest.content : 'Apuntes, listas e ideas';
  const tab = document.querySelector('#notesTabCount');
  if (tab) { tab.textContent = String(live.length); tab.hidden = !live.length; }
}
async function renderNotes() {
  try {
    await loadNotes();
  } catch {
    showToast('No se pudieron cargar las notas');
  }
  renderNotesSummary();
  renderNotesBoard();
  if (noteEditor.note && !noteEditor.dirty) refreshEditorFromData();
}

// ---------- Editor (se guarda solo) ----------
const noteSheet = document.querySelector('#noteSheet');
const noteEditor = { note: null, dirty: false, timer: 0, saving: false };
function editorState() {
  const body = noteSheet.querySelector('#noteSheetBody');
  return {
    content: body.querySelector('[name="noteTitle"]').value,
    text: body.querySelector('[name="noteText"]').value,
    items: [...body.querySelectorAll('[data-note-item]')].map((row) => ({ text: row.querySelector('input[type="text"]').value, done: row.querySelector('input[type="checkbox"]').checked }))
  };
}
function itemRow(item, index) {
  return `<li class="note-item${item.done ? ' is-done' : ''}" data-note-item="${index}">
    <label class="note-item-check"><input type="checkbox" ${item.done ? 'checked' : ''} aria-label="Marcar" /><span></span></label>
    <input type="text" value="${escapeHtml(item.text)}" maxlength="140" aria-label="Elemento de la lista" enterkeyhint="next" />
    <button type="button" class="note-item-task" data-item-task="${index}" aria-label="Convertir en algo por hacer" title="Pasar a Por hacer"><i data-lucide="list-checks"></i></button>
    <button type="button" class="note-item-remove" data-item-remove="${index}" aria-label="Quitar"><i data-lucide="x"></i></button>
  </li>`;
}
function renderEditor({ focus } = {}) {
  const note = noteEditor.note;
  const body = parseNoteBody(note.details);
  const pending = body.items.map((item, index) => [item, index]).filter(([item]) => !item.done);
  const done = body.items.map((item, index) => [item, index]).filter(([item]) => item.done);
  const mine = !note.owner_id || note.owner_id === authUserId;
  noteSheet.querySelector('#noteSheetBody').innerHTML = `
    <div class="note-editor color-${escapeHtml(note.color || 'sand')}">
      <div class="note-editor-bar">
        <div class="note-colors" role="group" aria-label="Color">${Object.entries(NOTE_COLORS).map(([id, label]) => `<button type="button" class="note-color color-${id}" data-note-color="${id}" aria-pressed="${(note.color || 'sand') === id}" aria-label="${label}" title="${label}"></button>`).join('')}</div>
        <button type="button" class="note-tool${note.pinned ? ' is-on' : ''}" data-note-pin aria-pressed="${Boolean(note.pinned)}" title="Fijar arriba"><i data-lucide="pin"></i></button>
        ${mine ? `<button type="button" class="note-tool" data-note-scope title="${note.scope === 'private' ? 'Solo tú la ves' : 'La veis los dos'}"><i data-lucide="${note.scope === 'private' ? 'lock' : 'users'}"></i></button>` : ''}
      </div>
      <input class="note-title-input" name="noteTitle" type="text" maxlength="120" value="${escapeHtml(note.content || '')}" placeholder="Título" aria-label="Título" id="noteSheetTitle" />
      <textarea class="note-text-input" name="noteText" rows="3" maxlength="4000" placeholder="Escribe lo que quieras…" aria-label="Texto">${escapeHtml(body.text)}</textarea>
      <section class="note-list">
        ${body.items.length ? `<div class="note-list-head"><span class="paper-check-bar"><b style="width:${Math.round((done.length / body.items.length) * 100)}%"></b></span><small>${done.length} de ${body.items.length}</small></div>` : ''}
        <ul>${pending.map(([item, index]) => itemRow(item, index)).join('')}</ul>
        <form class="note-add-item" data-note-add><span class="note-add-plus"><i data-lucide="plus"></i></span><input name="item" type="text" maxlength="140" placeholder="${body.items.length ? 'Añadir a la lista' : 'Añadir una lista para marcar'}" aria-label="Añadir a la lista" enterkeyhint="done" autocomplete="off" /></form>
        ${done.length ? `<div class="note-done-head"><span>Marcados · ${done.length}</span><button type="button" class="link-button" data-note-uncheck>Desmarcar todo</button></div><ul class="is-done-list">${done.map(([item, index]) => itemRow(item, index)).join('')}</ul>` : ''}
      </section>
      <footer class="note-editor-foot">
        <span class="note-save-state" id="noteSaveState">${noteEditor.dirty ? 'Guardando…' : note.id && !String(note.id).startsWith('draft-') ? `Guardada · ${escapeHtml(timeAgo(noteTime(note)))}` : 'Se guarda sola'}</span>
        <div>${note.id && !String(note.id).startsWith('draft-') ? `<button type="button" class="pill-button is-quiet" data-note-archive><i data-lucide="${note.completed ? 'archive-restore' : 'archive'}"></i> ${note.completed ? 'Recuperar' : 'Archivar'}</button><button type="button" class="link-button is-danger" data-note-delete>Eliminar</button>` : ''}</div>
      </footer>
    </div>`;
  lucide.createIcons();
  autoGrow(noteSheet.querySelector('[name="noteText"]'));
  if (focus === 'title') noteSheet.querySelector('[name="noteTitle"]').focus();
  if (focus === 'add') noteSheet.querySelector('[data-note-add] input').focus();
}
const autoGrow = (area) => { if (!area) return; area.style.height = 'auto'; area.style.height = `${Math.min(area.scrollHeight + 2, 360)}px`; };
function applyEditorState() {
  const state = editorState();
  noteEditor.note.content = state.content;
  noteEditor.note.details = serializeNoteBody(state.text, state.items);
}
function scheduleSave(delay = 700) {
  noteEditor.dirty = true;
  const label = noteSheet.querySelector('#noteSaveState');
  if (label) label.textContent = 'Guardando…';
  clearTimeout(noteEditor.timer);
  noteEditor.timer = setTimeout(flushNote, delay);
}
async function flushNote() {
  clearTimeout(noteEditor.timer);
  const note = noteEditor.note;
  if (!note || !noteEditor.dirty || noteEditor.saving) return;
  if (!String(note.content || '').trim() && !note.details) { noteEditor.dirty = false; return; }
  noteEditor.saving = true;
  try {
    const id = await saveNote(note);
    note.id = id;
    note.updated_at = new Date().toISOString();
    noteEditor.dirty = false;
    const label = noteSheet.querySelector('#noteSaveState');
    if (label) label.textContent = 'Guardada ✓';
    renderNotesSummary();
    renderNotesBoard();
  } catch (error) {
    showSupabaseError('No se pudo guardar la nota', error);
  } finally {
    noteEditor.saving = false;
    if (noteEditor.dirty) scheduleSave(400);
  }
}
function refreshEditorFromData() {
  const fresh = householdNotes.find((entry) => entry.id === noteEditor.note?.id);
  if (!fresh || noteSheet.contains(document.activeElement)) return;
  noteEditor.note = { ...fresh };
  renderEditor();
}
function openNote(id) {
  const note = householdNotes.find((entry) => entry.id === id);
  if (!note) return;
  noteEditor.note = { ...note };
  noteEditor.dirty = false;
  renderEditor();
  showNoteSheet();
}
function newNote(templateId = '') {
  const template = NOTE_TEMPLATES.find((entry) => entry.id === templateId);
  noteEditor.note = { id: `draft-${Date.now()}`, content: template?.title || '', details: template ? serializeNoteBody(template.text || '', (template.items || []).map((text) => ({ text, done: false }))) : null, scope: 'shared', pinned: false, color: template?.color || 'sand', completed: false, owner_id: authUserId || null };
  noteEditor.dirty = Boolean(template);
  renderEditor({ focus: template ? 'add' : 'title' });
  showNoteSheet();
  if (template) scheduleSave(300);
}
function showNoteSheet() {
  noteSheet.classList.add('visible');
  if (history.state?.page !== 'note') history.pushState({ page: 'note' }, '', '#nota');
}
async function closeNoteSheet() {
  if (!noteSheet.classList.contains('visible')) return;
  if (noteEditor.dirty) await flushNote();
  if (history.state?.page === 'note') history.back();
  else hideNoteSheet();
}
function hideNoteSheet() {
  noteSheet.classList.remove('visible');
  if (noteEditor.dirty) flushNote();
  noteEditor.note = null;
}

// ---------- Eventos ----------
document.querySelector('#notesPane')?.addEventListener('click', (event) => {
  const create = event.target.closest('[data-new-note]');
  if (create) return newNote(create.dataset.newNote);
  const card = event.target.closest('[data-open-note]');
  if (card) return openNote(card.dataset.openNote);
});
document.querySelector('#notesPane')?.addEventListener('keydown', (event) => {
  const card = event.target.closest('[data-open-note]');
  if (card && event.target === card && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); openNote(card.dataset.openNote); }
});
document.querySelector('#notesSearch')?.addEventListener('input', (event) => {
  notesSearch = event.target.value.trim();
  renderNotesBoard();
});
noteSheet?.addEventListener('click', async (event) => {
  const target = event.target;
  if (target === noteSheet || target.closest('[data-close-note]')) return closeNoteSheet();
  const note = noteEditor.note;
  if (!note) return;
  const color = target.closest('[data-note-color]');
  if (color) { applyEditorState(); note.color = color.dataset.noteColor; renderEditor(); return scheduleSave(200); }
  if (target.closest('[data-note-pin]')) { applyEditorState(); note.pinned = !note.pinned; renderEditor(); return scheduleSave(200); }
  if (target.closest('[data-note-scope]')) {
    applyEditorState();
    note.scope = note.scope === 'private' ? 'shared' : 'private';
    showToast(note.scope === 'private' ? '🔒 Ahora solo la ves tú' : '👥 Ahora la veis los dos');
    renderEditor();
    return scheduleSave(200);
  }
  const remove = target.closest('[data-item-remove]');
  if (remove) {
    applyEditorState();
    const body = parseNoteBody(note.details);
    body.items.splice(Number(remove.dataset.itemRemove), 1);
    note.details = serializeNoteBody(body.text, body.items);
    renderEditor();
    return scheduleSave(300);
  }
  const toTask = target.closest('[data-item-task]');
  if (toTask) {
    applyEditorState();
    const item = parseNoteBody(note.details).items[Number(toTask.dataset.itemTask)];
    if (item?.text.trim() && typeof createTask === 'function') await createTask({ title: item.text.trim(), list: null });
    return;
  }
  if (target.closest('[data-note-uncheck]')) {
    applyEditorState();
    const body = parseNoteBody(note.details);
    body.items.forEach((item) => { item.done = false; });
    note.details = serializeNoteBody(body.text, body.items);
    renderEditor();
    showToast('Lista desmarcada: lista para la próxima vez');
    return scheduleSave(200);
  }
  if (target.closest('[data-note-archive]')) {
    applyEditorState();
    note.completed = !note.completed;
    noteEditor.dirty = true;
    await flushNote();
    showToast(note.completed ? '🗄️ Nota archivada' : 'Nota recuperada');
    return closeNoteSheet();
  }
  if (target.closest('[data-note-delete]')) {
    try {
      clearTimeout(noteEditor.timer);
      applyEditorState();
      noteEditor.dirty = false;
      const copy = { ...note };
      await removeNote(note.id);
      showToast(`Nota eliminada: ${copy.content || 'sin título'}`, { action: 'Deshacer', onAction: async () => {
        try {
          await saveNote({ ...copy, id: `draft-${Date.now()}` });
          renderNotesSummary();
          renderNotesBoard();
        } catch (error) { showSupabaseError('No se pudo recuperar la nota', error); }
      } });
      renderNotesSummary();
      renderNotesBoard();
      closeNoteSheet();
    } catch (error) {
      showSupabaseError('No se pudo eliminar la nota', error);
    }
  }
});
noteSheet?.addEventListener('change', (event) => {
  if (event.target.matches('.note-item-check input')) {
    applyEditorState();
    renderEditor();
    window.umbralMobile?.tap?.();
    scheduleSave(300);
  }
});
noteSheet?.addEventListener('input', (event) => {
  if (event.target.name === 'item') return;
  if (event.target.name === 'noteText') autoGrow(event.target);
  applyEditorState();
  scheduleSave();
});
noteSheet?.addEventListener('submit', (event) => {
  event.preventDefault();
  const input = event.target.querySelector('[name="item"]');
  const text = input?.value.trim();
  if (!text) return;
  applyEditorState();
  const body = parseNoteBody(noteEditor.note.details);
  body.items.push({ text, done: false });
  noteEditor.note.details = serializeNoteBody(body.text, body.items);
  renderEditor({ focus: 'add' });
  scheduleSave(400);
});
noteSheet?.addEventListener('keydown', (event) => {
  // Intro en un elemento de la lista salta al campo de añadir.
  if (event.key === 'Enter' && event.target.closest('[data-note-item]')) {
    event.preventDefault();
    noteSheet.querySelector('[data-note-add] input')?.focus();
  }
});
window.addEventListener('popstate', () => {
  if (history.state?.page !== 'note' && noteSheet?.classList.contains('visible')) hideNoteSheet();
});
