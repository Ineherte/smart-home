// Vida → Documentos: una carpeta para los papeles importantes (DNI escaneado, contrato del piso,
// tarjeta sanitaria, facturas, garantías…), en PDF o foto.
// Cada documento es de alguien (tuyo, de tu pareja o de los dos) y lo ven los dos o solo tú.
// Con Supabase, los archivos van al bucket privado household-documents y solo se abren con
// enlaces temporales; las reglas de acceso las pone la base de datos (documents.sql). En modo
// local se guardan en este teléfono (IndexedDB).
// Usa supabaseClient, authUserId, householdId, currentUser, showToast, escapeHtml… de app.js.
(function () {
  const BUCKET = 'household-documents';
  const MAX_BYTES = 15 * 1024 * 1024;
  const CATEGORIES = [
    ['Identidad', 'id-card'], ['Salud', 'heart-pulse'], ['Casa', 'house'], ['Coche', 'car'], ['Trabajo', 'briefcase'],
    ['Viajes', 'plane'], ['Facturas', 'receipt-text'], ['Dinero', 'landmark'], ['Garantías', 'shield-check'], ['Estudios', 'graduation-cap'], ['Otros', 'folder']
  ];
  const categoryIcon = (name) => (CATEGORIES.find(([category]) => category === name) || CATEGORIES.at(-1))[1];
  let documents = [];
  let personFilter = 'all';
  let folder = '';
  let search = '';
  let loaded = false;
  let editing = null;

  const inCloud = () => Boolean(supabaseClient && authUserId);
  const isMine = (doc) => (inCloud() ? doc.owner_id === authUserId : doc.owner_id === currentUser);
  const personLabel = (person) => (person === 'both' ? 'De los dos' : person === currentUser ? 'Tuyo' : `De ${person}`);
  const sizeLabel = (bytes) => (!bytes ? '' : bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} MB`);
  const isImage = (doc) => /^image\//.test(doc.mime || '');
  function expiryInfo(doc) {
    if (!doc.expires_on) return null;
    const days = Math.round((new Date(`${doc.expires_on}T12:00:00`) - new Date(`${dateToISO(new Date())}T12:00:00`)) / 86400000);
    if (days < 0) return { tone: 'bad', text: `Caducó hace ${-days === 1 ? '1 día' : -days < 60 ? `${-days} días` : `${Math.round(-days / 30)} meses`}` };
    if (days === 0) return { tone: 'bad', text: 'Caduca hoy' };
    if (days <= 60) return { tone: 'warn', text: `Caduca en ${days === 1 ? '1 día' : `${days} días`}` };
    return { tone: 'ok', text: `Válido hasta ${new Date(`${doc.expires_on}T12:00:00`).toLocaleDateString('es-ES', { month: 'short', year: 'numeric' })}` };
  }

  // ---------- Archivos en modo local (IndexedDB) ----------
  const localDb = () => new Promise((resolve, reject) => {
    const request = indexedDB.open('umbral-documents', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('files');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  async function localFile(action, key, value) {
    const db = await localDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('files', action === 'get' ? 'readonly' : 'readwrite');
      const store = tx.objectStore('files');
      const request = action === 'get' ? store.get(key) : action === 'put' ? store.put(value, key) : store.delete(key);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
  const LOCAL_KEY = 'umbral-documents';
  const readLocal = () => { try { return JSON.parse(localStorage.getItem(LOCAL_KEY) || '[]'); } catch { return []; } };
  const writeLocal = (rows) => localStorage.setItem(LOCAL_KEY, JSON.stringify(rows));

  // ---------- Datos ----------
  async function load() {
    try {
      if (inCloud()) {
        if (!householdId) return;
        const { data, error } = await supabaseClient.from('documents').select('*').eq('household_id', householdId).order('created_at', { ascending: false });
        if (error) throw error;
        documents = data || [];
      } else {
        documents = readLocal();
      }
      loaded = true;
    } catch (error) {
      console.error('[Umbral] Documentos:', error);
      loaded = true;
      documents = [];
      if (/relation|does not exist|schema cache/i.test(error.message || '')) {
        render('Falta preparar Documentos en Supabase: ejecuta supabase/sql/documents.sql.');
        return;
      }
    }
    render();
  }

  const pathFor = (scope, fileName) => {
    const safe = fileName.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w.-]+/g, '-').replace(/-+/g, '-').slice(-80) || 'documento';
    const id = createLocalId();
    return scope === 'shared' ? `${householdId}/shared/${id}-${safe}` : `${householdId}/private/${authUserId}/${id}-${safe}`;
  };

  async function uploadFile(file, scope) {
    if (!inCloud()) {
      const key = `local-${createLocalId()}`;
      await localFile('put', key, file);
      return key;
    }
    if (!householdReady()) throw new Error('Tu hogar aún se está conectando');
    const path = pathFor(scope, file.name);
    const { error } = await supabaseClient.storage.from(BUCKET).upload(path, file, { contentType: file.type || 'application/octet-stream', upsert: false });
    if (error) throw new Error(/bucket|not found/i.test(error.message) ? 'Falta preparar Documentos en Supabase (documents.sql)' : /size|large/i.test(error.message) ? 'El archivo es demasiado grande (máximo 15 MB)' : error.message);
    return path;
  }
  async function removeFile(path) {
    if (!path) return;
    if (!inCloud() || path.startsWith('local-')) { await localFile('delete', path).catch(() => {}); return; }
    await supabaseClient.storage.from(BUCKET).remove([path]);
  }
  // Un enlace temporal (5 minutos) o, en local, el archivo en memoria.
  async function fileUrl(doc) {
    if (!inCloud() || doc.path.startsWith('local-')) {
      const blob = await localFile('get', doc.path);
      if (!blob) throw new Error('El archivo ya no está en este teléfono');
      return URL.createObjectURL(blob);
    }
    const { data, error } = await supabaseClient.storage.from(BUCKET).createSignedUrl(doc.path, 300);
    if (error) throw error;
    return data.signedUrl;
  }
  async function fileBlob(doc) {
    if (!inCloud() || doc.path.startsWith('local-')) return localFile('get', doc.path);
    const { data, error } = await supabaseClient.storage.from(BUCKET).download(doc.path);
    if (error) throw error;
    return data;
  }

  async function saveDocument(values, file) {
    const row = {
      title: values.title.trim().slice(0, 80) || 'Documento',
      category: CATEGORIES.some(([name]) => name === values.category) ? values.category : 'Otros',
      person: values.person,
      // Solo lo tuyo puede ser privado: lo de tu pareja o de los dos lo veis ambos.
      scope: values.person === currentUser && values.scope === 'private' ? 'private' : 'shared',
      expires_on: values.expires || null,
      notes: values.notes?.trim().slice(0, 500) || null,
      updated_at: new Date().toISOString()
    };
    if (editing) {
      const doc = documents.find((entry) => entry.id === editing);
      if (!doc) return;
      // Cambia quién lo ve: el archivo se mueve a su carpeta (si no, seguiría abierto al otro).
      let newPath = null;
      if (file || (inCloud() && row.scope !== doc.scope)) {
        const source = file || new File([await fileBlob(doc)], doc.file_name || 'documento', { type: doc.mime || 'application/octet-stream' });
        newPath = await uploadFile(source, row.scope);
        if (file) Object.assign(row, { file_name: file.name.slice(0, 160), mime: file.type || null, size_bytes: file.size });
        row.path = newPath;
      }
      if (inCloud()) {
        const { error } = await supabaseClient.from('documents').update(row).eq('id', doc.id);
        if (error) { if (newPath) await removeFile(newPath); throw error; }
      } else {
        writeLocal(readLocal().map((entry) => (entry.id === doc.id ? { ...entry, ...row } : entry)));
      }
      if (newPath) await removeFile(doc.path);
      Object.assign(doc, row);
      return doc;
    }
    if (!file) throw new Error('Elige un archivo');
    if (file.size > MAX_BYTES) throw new Error('El archivo es demasiado grande (máximo 15 MB)');
    const path = await uploadFile(file, row.scope);
    Object.assign(row, { path, file_name: file.name.slice(0, 160), mime: file.type || null, size_bytes: file.size });
    if (inCloud()) {
      const { data, error } = await supabaseClient.from('documents').insert({ ...row, household_id: householdId, owner_id: authUserId }).select('*').single();
      if (error) { await removeFile(path); throw error; }
      documents.unshift(data);
      if (row.scope === 'shared') notifyHousehold(`${currentUser} guardó un documento`, `${row.title} · ${row.category}`, { open: 'personal', tag: 'documents' });
      return data;
    }
    const created = { ...row, id: createLocalId(), owner_id: currentUser, created_at: new Date().toISOString() };
    writeLocal([created, ...readLocal()]);
    documents.unshift(created);
    return created;
  }

  async function deleteDocument(doc) {
    if (inCloud()) {
      const { error } = await supabaseClient.from('documents').delete().eq('id', doc.id);
      if (error) throw error;
    } else {
      writeLocal(readLocal().filter((entry) => entry.id !== doc.id));
    }
    await removeFile(doc.path).catch(() => {});
    documents = documents.filter((entry) => entry.id !== doc.id);
  }

  // ---------- Tarjeta en Vida ----------
  const host = document.querySelector('#documentsBody');
  const visible = () => documents.filter((doc) =>
    (personFilter === 'all' || (personFilter === 'mine' ? doc.person === currentUser : personFilter === 'partner' ? doc.person === otherPerson(currentUser) : doc.person === 'both'))
    && (!search || normalizeText(`${doc.title} ${doc.category} ${doc.notes || ''} ${doc.file_name || ''}`).includes(normalizeText(search))));

  function docRow(doc) {
    const expiry = expiryInfo(doc);
    return `<button type="button" class="doc-row" data-doc-open="${escapeHtml(doc.id)}">
      <span class="doc-icon${isImage(doc) ? ' is-image' : ''}"><i data-lucide="${isImage(doc) ? 'image' : 'file-text'}"></i></span>
      <span class="doc-copy"><strong>${escapeHtml(doc.title)}${doc.scope === 'private' ? ' <i data-lucide="lock" class="doc-lock" aria-label="Solo tú lo ves"></i>' : ''}</strong>
        <small>${escapeHtml(personLabel(doc.person))} · ${escapeHtml(doc.category)}${doc.size_bytes ? ` · ${sizeLabel(doc.size_bytes)}` : ''}</small>
        ${expiry && expiry.tone !== 'ok' ? `<em class="doc-expiry is-${expiry.tone}">${escapeHtml(expiry.text)}</em>` : ''}</span>
      <i data-lucide="chevron-right" class="doc-chevron"></i>
    </button>`;
  }

  function render(message = '') {
    if (!host) return;
    const summary = document.querySelector('#documentsSummary');
    if (message) {
      host.innerHTML = `<p class="empty-note">${escapeHtml(message)}</p>`;
      summary.textContent = '';
      return;
    }
    if (!loaded) return;
    const expiring = documents.filter((doc) => ['warn', 'bad'].includes(expiryInfo(doc)?.tone));
    summary.innerHTML = documents.length
      ? `${documents.length} ${documents.length === 1 ? 'documento' : 'documentos'}${expiring.length ? ` · <b class="doc-alert">${expiring.length === 1 ? `«${escapeHtml(expiring[0].title)}» ${escapeHtml(expiryInfo(expiring[0]).text.toLowerCase())}` : `${expiring.length} caducan pronto`}</b>` : ''}`
      : 'Guarda aquí vuestros papeles importantes: DNI, contrato del piso, tarjeta sanitaria, garantías… en PDF o foto.';
    if (!documents.length) {
      host.innerHTML = `<div class="docs-empty"><div class="docs-empty-art" aria-hidden="true"><span><i data-lucide="id-card"></i></span><span><i data-lucide="house"></i></span><span><i data-lucide="shield-check"></i></span></div>
        <button type="button" class="primary-button" data-doc-add><i data-lucide="upload"></i> Subir el primero</button>
        <p class="docs-privacy"><i data-lucide="lock"></i> Cada documento lo veis los dos o solo tú; nadie más puede abrirlo.</p></div>`;
      lucide.createIcons();
      return;
    }
    const list = visible();
    const counts = new Map();
    list.forEach((doc) => counts.set(doc.category, (counts.get(doc.category) || 0) + 1));
    if (folder && !counts.has(folder)) folder = '';
    const people = [['all', 'Todos'], ['mine', 'Míos'], ['partner', `De ${otherPerson(currentUser)}`], ['both', 'De los dos']];
    const shown = list.filter((doc) => !folder || doc.category === folder);
    host.innerHTML = `
      <div class="segmented is-wide docs-people">${people.map(([id, label]) => `<button type="button" aria-pressed="${personFilter === id}" data-doc-person="${id}">${escapeHtml(label)}</button>`).join('')}</div>
      ${documents.length > 6 ? `<label class="docs-search"><i data-lucide="search"></i><input type="search" placeholder="Buscar un documento" value="${escapeHtml(search)}" data-doc-search aria-label="Buscar un documento" /></label>` : ''}
      <div class="doc-folders">${CATEGORIES.filter(([name]) => counts.has(name)).map(([name, icon]) => `<button type="button" class="doc-folder${folder === name ? ' is-open' : ''}" data-doc-folder="${escapeHtml(name)}" aria-pressed="${folder === name}">
          <span class="doc-folder-tab" aria-hidden="true"></span><span class="doc-folder-body"><i data-lucide="${icon}"></i><b>${escapeHtml(name)}</b><small>${counts.get(name)}</small></span>
        </button>`).join('')}</div>
      <div class="doc-list">${shown.length ? `${folder ? `<p class="doc-list-title"><i data-lucide="folder-open"></i> ${escapeHtml(folder)} <button type="button" class="link-button" data-doc-folder="">Ver todo</button></p>` : ''}${shown.map(docRow).join('')}` : '<p class="empty-note">Nada por aquí con este filtro.</p>'}</div>`;
    lucide.createIcons();
  }

  // ---------- Fichas ----------
  const sheet = document.querySelector('#docSheet');
  const sheetBody = document.querySelector('#docSheetBody');
  function showSheet(html) {
    sheetBody.innerHTML = html;
    sheet.classList.add('visible');
    if (history.state?.page !== 'document') history.pushState({ page: 'document' }, '', '#documento');
    lucide.createIcons();
  }
  function closeSheet() {
    if (!sheet.classList.contains('visible')) return;
    if (history.state?.page === 'document') history.back();
    else sheet.classList.remove('visible');
  }
  window.addEventListener('popstate', () => { if (history.state?.page !== 'document') sheet.classList.remove('visible'); });

  function formMarkup(doc = null) {
    const values = doc || { title: '', category: 'Identidad', person: currentUser, scope: 'shared', expires_on: '', notes: '' };
    const people = [[currentUser, 'Mío'], [otherPerson(currentUser), `De ${otherPerson(currentUser)}`], ['both', 'De los dos']];
    return `<div class="plant-add-heading"><p class="eyebrow muted">Documentos</p><h2 id="docSheetTitle">${doc ? 'Editar documento' : 'Guardar un documento'}</h2></div>
      <form class="item-editor doc-form" data-doc-form>
        <label class="doc-drop${doc ? ' is-optional' : ''}">
          <input type="file" name="file" accept="application/pdf,image/*" ${doc ? '' : 'required'} />
          <span class="doc-drop-icon"><i data-lucide="${doc ? 'replace' : 'upload'}"></i></span>
          <span class="doc-drop-copy"><strong data-doc-file-name>${doc ? `${escapeHtml(doc.file_name || 'Archivo actual')}` : 'Elige un PDF o una foto'}</strong><small>${doc ? 'Toca para cambiar el archivo' : 'En el iPhone puedes hacer una foto o escanearlo desde Archivos · máximo 15 MB'}</small></span>
        </label>
        <label class="plant-field"><span>Nombre</span><input name="title" maxlength="80" required placeholder="DNI de Ines" value="${escapeHtml(values.title)}" /></label>
        <fieldset class="plant-field"><legend>Carpeta</legend><div class="category-picker">${CATEGORIES.map(([name, icon]) => `<label class="category-chip"><input type="radio" name="category" value="${escapeHtml(name)}" ${name === values.category ? 'checked' : ''} /><span><i data-lucide="${icon}"></i>${escapeHtml(name)}</span></label>`).join('')}</div></fieldset>
        <fieldset class="plant-field"><legend>¿De quién es?</legend><div class="choice-row">${people.map(([value, label]) => `<label class="option-toggle"><input type="radio" name="person" value="${escapeHtml(value)}" ${value === values.person ? 'checked' : ''} /><span>${escapeHtml(label)}</span></label>`).join('')}</div></fieldset>
        <fieldset class="plant-field doc-scope"><legend>¿Quién lo ve?</legend><div class="choice-row">
          <label class="option-toggle"><input type="radio" name="scope" value="shared" ${values.scope !== 'private' ? 'checked' : ''} /><span><i data-lucide="users"></i> Los dos</span></label>
          <label class="option-toggle"><input type="radio" name="scope" value="private" ${values.scope === 'private' ? 'checked' : ''} /><span><i data-lucide="lock"></i> Solo yo</span></label>
        </div><small class="doc-scope-hint">Solo lo tuyo puede ser privado.</small></fieldset>
        <label class="plant-field"><span>Caduca (opcional)</span><input type="date" name="expires" value="${escapeHtml(values.expires_on || '')}" /></label>
        <label class="plant-field"><span>Nota (opcional)</span><input name="notes" maxlength="500" placeholder="Nº de documento, dónde está el original…" value="${escapeHtml(values.notes || '')}" /></label>
        <div class="plant-form-actions"><button type="submit" class="primary-button"><i data-lucide="check"></i> ${doc ? 'Guardar cambios' : 'Guardar documento'}</button></div>
      </form>`;
  }
  // «Solo yo» solo vale para lo tuyo.
  function syncScope(form) {
    const mine = form.person.value === currentUser;
    form.querySelectorAll('input[name="scope"]').forEach((input) => { input.disabled = !mine && input.value === 'private'; });
    if (!mine) form.querySelector('input[name="scope"][value="shared"]').checked = true;
    form.querySelector('.doc-scope-hint').hidden = mine;
  }

  function openAdd() {
    editing = null;
    showSheet(formMarkup());
    syncScope(sheetBody.querySelector('[data-doc-form]'));
  }
  function openEdit(doc) {
    editing = doc.id;
    showSheet(formMarkup(doc));
    syncScope(sheetBody.querySelector('[data-doc-form]'));
  }

  async function openDetail(doc) {
    editing = null;
    const expiry = expiryInfo(doc);
    const canDelete = doc.scope === 'shared' || isMine(doc);
    showSheet(`<div class="doc-hero"><span class="doc-icon is-large${isImage(doc) ? ' is-image' : ''}"><i data-lucide="${categoryIcon(doc.category)}"></i></span><div><p class="eyebrow muted">${escapeHtml(doc.category)} · ${escapeHtml(personLabel(doc.person))}</p><h2 id="docSheetTitle">${escapeHtml(doc.title)}</h2></div></div>
      <div class="doc-preview" data-doc-preview>${isImage(doc) ? '<div class="doc-preview-loading"></div>' : `<div class="doc-preview-file"><i data-lucide="file-text"></i><span>${escapeHtml(doc.file_name || 'Documento')}</span></div>`}</div>
      <div class="doc-actions">
        <a class="primary-button is-disabled" data-doc-link target="_blank" rel="noopener"><i data-lucide="external-link"></i> Abrir</a>
        ${navigator.share ? '<button type="button" class="pill-button" data-doc-share><i data-lucide="share"></i> Compartir</button>' : ''}
      </div>
      <div class="detail-grid doc-details">
        <div class="detail-cell"><i data-lucide="${doc.scope === 'private' ? 'lock' : 'users'}"></i><span><small>Lo ve</small><strong>${doc.scope === 'private' ? 'Solo tú' : 'Los dos'}</strong></span></div>
        <div class="detail-cell"><i data-lucide="calendar-clock"></i><span><small>Caducidad</small><strong class="${expiry ? `is-${expiry.tone}` : ''}">${expiry ? escapeHtml(expiry.text) : 'Sin fecha'}</strong></span></div>
        <div class="detail-cell"><i data-lucide="file"></i><span><small>Archivo</small><strong>${escapeHtml(sizeLabel(doc.size_bytes) || '—')}</strong></span></div>
        <div class="detail-cell"><i data-lucide="clock-3"></i><span><small>Guardado</small><strong>${escapeHtml(new Date(doc.created_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' }))}</strong></span></div>
      </div>
      ${doc.notes ? `<p class="doc-notes">${escapeHtml(doc.notes)}</p>` : ''}
      <div class="plant-form-actions doc-manage"><button type="button" class="pill-button" data-doc-edit="${escapeHtml(doc.id)}"><i data-lucide="pencil"></i> Editar</button>${canDelete ? `<button type="button" class="link-button is-danger" data-doc-delete="${escapeHtml(doc.id)}">Eliminar</button>` : ''}</div>`);
    sheetBody.dataset.docId = doc.id;
    try {
      const url = await fileUrl(doc);
      if (sheetBody.dataset.docId !== doc.id) return;
      const link = sheetBody.querySelector('[data-doc-link]');
      link.href = url;
      link.classList.remove('is-disabled');
      if (!inCloud()) link.download = doc.file_name || 'documento';
      if (isImage(doc)) sheetBody.querySelector('[data-doc-preview]').innerHTML = `<img src="${escapeHtml(url)}" alt="${escapeHtml(doc.title)}" />`;
    } catch (error) {
      console.error('[Umbral] Documento:', error);
      sheetBody.querySelector('[data-doc-preview]').innerHTML = '<p class="empty-note">No se pudo abrir el archivo ahora mismo.</p>';
    }
  }

  async function shareDocument(doc) {
    try {
      const blob = await fileBlob(doc);
      const file = new File([blob], doc.file_name || `${doc.title}.pdf`, { type: doc.mime || blob.type });
      if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title: doc.title });
      else showToast('Este navegador no deja compartir archivos: usa «Abrir»');
    } catch (error) {
      if (error?.name !== 'AbortError') showToast('No se pudo compartir');
    }
  }

  // ---------- Eventos ----------
  document.querySelector('#documentsSection')?.addEventListener('click', (event) => {
    if (event.target.closest('[data-doc-add]')) return openAdd();
    const person = event.target.closest('[data-doc-person]');
    if (person) { personFilter = person.dataset.docPerson; return render(); }
    const folderButton = event.target.closest('[data-doc-folder]');
    if (folderButton) { folder = folder === folderButton.dataset.docFolder ? '' : folderButton.dataset.docFolder; return render(); }
    const open = event.target.closest('[data-doc-open]');
    if (open) { const doc = documents.find((entry) => entry.id === open.dataset.docOpen); if (doc) openDetail(doc); }
  });
  document.querySelector('#documentsSection')?.addEventListener('input', (event) => {
    if (!event.target.matches('[data-doc-search]')) return;
    search = event.target.value;
    const caret = event.target.selectionStart;
    render();
    const input = host.querySelector('[data-doc-search]');
    input?.focus();
    input?.setSelectionRange(caret, caret);
  });

  sheet?.addEventListener('click', async (event) => {
    if (event.target.closest('[data-close-doc]')) return closeSheet();
    const doc = documents.find((entry) => entry.id === sheetBody.dataset.docId);
    if (event.target.closest('[data-doc-share]') && doc) return shareDocument(doc);
    const link = event.target.closest('[data-doc-link]');
    if (link?.classList.contains('is-disabled')) { event.preventDefault(); return; }
    const edit = event.target.closest('[data-doc-edit]');
    if (edit) { const target = documents.find((entry) => entry.id === edit.dataset.docEdit); if (target) openEdit(target); return; }
    const remove = event.target.closest('[data-doc-delete]');
    if (remove) {
      const target = documents.find((entry) => entry.id === remove.dataset.docDelete);
      if (!target || !window.confirm(`¿Eliminar «${target.title}»? El archivo se borra para siempre.`)) return;
      try {
        await deleteDocument(target);
        closeSheet();
        render();
        showToast('Documento eliminado');
      } catch (error) {
        showSupabaseError('No se pudo eliminar', error);
      }
    }
  });
  sheet?.addEventListener('change', (event) => {
    const form = event.target.closest('[data-doc-form]');
    if (!form) return;
    if (event.target.name === 'person') syncScope(form);
    if (event.target.name === 'file' && event.target.files[0]) {
      const file = event.target.files[0];
      form.querySelector('[data-doc-file-name]').textContent = `${file.name} · ${sizeLabel(file.size)}`;
      form.querySelector('.doc-drop').classList.add('has-file');
      // El nombre del archivo como punto de partida («dni_ines.pdf» → «Dni ines»).
      if (!form.title.value.trim()) form.title.value = capitalizeFirst(file.name.replace(/\.[a-z0-9]+$/i, '').replace(/[_-]+/g, ' ').trim()).slice(0, 80);
      if (file.size > MAX_BYTES) showToast('Ese archivo pasa de 15 MB: prueba a escanearlo en menos calidad');
    }
  });
  sheet?.addEventListener('submit', async (event) => {
    const form = event.target.closest('[data-doc-form]');
    if (!form) return;
    event.preventDefault();
    const button = form.querySelector('button[type="submit"]');
    const values = Object.fromEntries(new FormData(form));
    const file = form.file.files[0] || null;
    button.disabled = true;
    button.innerHTML = '<i data-lucide="loader-circle" class="spin"></i> Guardando…';
    lucide.createIcons();
    try {
      const wasEditing = editing;
      const doc = await saveDocument(values, file);
      render();
      closeSheet();
      showToast(wasEditing ? 'Documento actualizado' : `Guardado en ${doc.category}${doc.scope === 'private' ? ' · solo tú lo ves' : ''}`);
    } catch (error) {
      button.disabled = false;
      button.innerHTML = '<i data-lucide="check"></i> Reintentar';
      lucide.createIcons();
      showSupabaseError('No se pudo guardar el documento', error);
    }
  });

  document.addEventListener('umbral:ready', () => {
    load();
    if (inCloud() && householdId) {
      let timer = 0;
      supabaseClient.channel('documents-live').on('postgres_changes', { event: '*', schema: 'public', table: 'documents', filter: `household_id=eq.${householdId}` }, () => {
        clearTimeout(timer);
        timer = setTimeout(load, 400);
      }).subscribe();
      window.addEventListener('umbral:resync', () => load());
    }
  });

  window.umbralDocuments = {
    open: openAdd,
    list: () => documents,
    reload: load,
    // Para otras secciones (Cuentas → Luz sube aquí las facturas en PDF).
    async upload(file, { title, category = 'Otros', person = 'both', scope = 'shared', notes = '' } = {}) {
      editing = null;
      const doc = await saveDocument({ title: title || file.name, category, person, scope, expires: '', notes }, file);
      render();
      return doc;
    },
    async openById(id) {
      if (!loaded) await load();
      const doc = documents.find((entry) => entry.id === id);
      if (doc) openDetail(doc);
      else showToast('No encuentro ese documento');
    }
  };
})();
