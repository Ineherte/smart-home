// Cuentas, segunda parte:
// - Gráficos (evolución por meses y reparto por categoría), compartidos por Casa y Mis gastos.
// - «Poner a cero» las deudas: el balance solo cuenta lo posterior al último reinicio.
// - Gastos personales: privados, con alta manual, Apple Pay (función wallet-ingest) o extracto del banco.
// Usa financeMonth, financeCache, financeMoney, monthLabel, shortMonthLabel, shiftMonth,
// monthFinanceEntries, parseFinanceDate y renderFinance de app.js.

// ---------- Colores de categoría ----------
// La categoría manda el color (no su posición): mismo color en Casa y en Mis gastos.
// Paleta validada para daltonismo en claro y oscuro (variables --cat-* en styles.css).
const CATEGORY_SLOTS = {
  Hogar: 1, 'Casa (tu parte)': 1,
  'Alimentación': 2, Supermercado: 2,
  Transporte: 3,
  Viajes: 4, 'Comer fuera': 4,
  Ocio: 5, 'Ocio y viajes': 5,
  Compras: 6,
  Salud: 7, 'Salud y cuidado': 7
};
const categoryColor = (name) => (CATEGORY_SLOTS[name] ? `var(--cat-${CATEGORY_SLOTS[name]})` : 'var(--cat-other)');

const PERSONAL_CATEGORIES = [
  ['Supermercado', 'shopping-cart'],
  ['Comer fuera', 'utensils'],
  ['Transporte', 'bus'],
  ['Ocio y viajes', 'ticket'],
  ['Compras', 'shopping-bag'],
  ['Salud y cuidado', 'heart-pulse'],
  ['Otros', 'circle-ellipsis']
];

// Mismas reglas que la función wallet-ingest.
const PERSONAL_CATEGORY_RULES = [
  [/esselunga|carrefour|coop|conad|lidl|eurospin|\bpam\b|aldi|penny|mercadona|\bdia\b|supermerc|naturasi|bennet|despar|crai/, 'Supermercado'],
  [/bar\b|caff|cafe|ristorante|pizzeri|trattoria|osteria|restaurante|mcdonald|burger|kebab|sushi|glovo|deliveroo|just ?eat|uber ?eats|gelateria|pasticceria|panetteria|starbucks/, 'Comer fuera'],
  [/\bgtt\b|trenitalia|italo|\buber\b|taxi|\beni\b|\bq8\b|tamoil|\bip\b|esso|autostrad|telepass|parcheggi|parking|bird|lime|bolt|renfe|metro/, 'Transporte'],
  [/netflix|spotify|disney|prime video|cinema|teatro|museo|ticket|steam|playstation|apple\.com|icloud|ryanair|vueling|easyjet|booking|airbnb|hotel/, 'Ocio y viajes'],
  [/amazon|zara|h&m|\bhm\b|ikea|decathlon|mediaworld|unieuro|primark|uniqlo|zalando|leroy|tiger/, 'Compras'],
  [/farmac|pharm|parafarm|ospedal|clinic|dentist|ottica|optic|douglas|sephora|parrucch|barbier/, 'Salud y cuidado']
];
const guessPersonalCategory = (text) => PERSONAL_CATEGORY_RULES.find(([pattern]) => pattern.test(normalizeText(text)))?.[1] || 'Otros';

// Categorías de Casa para el gráfico: facturas y fijos (alquiler, luz, TIM…) cuentan como Hogar.
function householdChartCategory(entry) {
  if (financeCategories.includes(entry.category)) return entry.category;
  return entry.kind === 'expense' ? 'Otros' : 'Hogar';
}

// ---------- Gráficos ----------

// Últimos 6 meses en columnas; el mes elegido resaltado. Tocar una columna elige ese mes.
function monthBarsMarkup(points, selected) {
  const max = Math.max(...points.map((point) => point.total), 1);
  return points.map(({ month, total }) => {
    const height = total ? Math.max(4, (total / max) * 100) : 0;
    const isSelected = month === selected;
    return `<button type="button" class="month-bar${isSelected ? ' is-selected' : ''}" data-select-month="${month}" aria-pressed="${isSelected}" aria-label="${escapeHtml(`${monthLabel(month)}: ${financeMoney(total)}`)}" title="${escapeHtml(`${monthLabel(month)}: ${financeMoney(total)}`)}">
      <span class="month-bar-value">${isSelected ? financeMoney(total).replace(/,\d\d\s/, ' ') : ''}</span>
      <span class="month-bar-track"><span class="month-bar-fill" style="height:${height}%"></span></span>
      <span class="month-bar-label">${shortMonthLabel(month).slice(0, 3)}</span>
    </button>`;
  }).join('');
}

// Ventana de 6 meses que termina en el mes actual (o incluye el elegido si es anterior).
function trendMonths(selected) {
  const current = dateToISO(new Date()).slice(0, 7);
  let end = current;
  if (selected < shiftMonth(current, -5)) end = shiftMonth(selected, 2);
  return Array.from({ length: 6 }, (_, index) => shiftMonth(end, index - 5));
}

// Reparto por categoría: una barra apilada (todo) y debajo cada categoría con su importe.
// Las filas son también la leyenda y la vista en tabla; tocarlas filtra la lista.
function categoryChartMarkup(rows, total, emptyText) {
  if (!rows.length || !total) return `<p class="empty-note">${emptyText}</p>`;
  const stack = rows.map(({ name, amount }) => `<span style="flex:${amount};background:${categoryColor(name)}" title="${escapeHtml(`${name}: ${financeMoney(amount)}`)}"></span>`).join('');
  const list = rows.map(({ name, amount }) => `<button type="button" class="category-row" data-category-filter="${escapeHtml(name)}">
      <i class="category-dot" style="background:${categoryColor(name)}"></i>
      <span class="category-name">${escapeHtml(name)}</span>
      <span class="category-share">${Math.round((amount / total) * 100)} %</span>
      <b>${financeMoney(amount)}</b>
    </button>`).join('');
  return `<div class="category-stack" aria-hidden="true">${stack}</div><div class="category-rows">${list}</div>`;
}

function groupByCategory(entries, categoryOf) {
  const totals = new Map();
  entries.forEach((entry) => {
    const name = categoryOf(entry);
    totals.set(name, (totals.get(name) || 0) + Number(entry.amount || 0));
  });
  // «Otros» siempre al final, el resto de mayor a menor.
  return [...totals].map(([name, amount]) => ({ name, amount })).filter((row) => row.amount > 0)
    .sort((first, second) => (first.name === 'Otros') - (second.name === 'Otros') || second.amount - first.amount);
}

// Gráficos de Casa; los llama renderFinance en app.js.
function renderHouseholdCharts(data, monthEntries) {
  const points = trendMonths(financeMonth).map((month) => ({ month, total: monthFinanceEntries(data, month).reduce((sum, entry) => sum + Number(entry.amount || 0), 0) }));
  document.querySelector('#financeTrend').innerHTML = monthBarsMarkup(points, financeMonth);
  const rows = groupByCategory(monthEntries, householdChartCategory);
  const total = rows.reduce((sum, row) => sum + row.amount, 0);
  document.querySelector('#financeBreakdownTotal').textContent = financeMoney(total);
  document.querySelector('#financeCategoryBreakdown').innerHTML = categoryChartMarkup(rows, total, 'Aún no hay gastos este mes.');
}

// ---------- Poner a cero ----------

const resetsStore = createHouseholdStore({ table: 'finance_resets', localKey: 'umbral-finance-resets' });
let financeResets = [];

const latestReset = () => financeResets.reduce((latest, reset) => (!latest || String(reset.created_at) > String(latest.created_at) ? reset : latest), null);

// ¿Cuenta este movimiento en el balance? Solo lo posterior al último reinicio
// (lo del mismo día, si se añadió después de reiniciar).
function countsAfterReset(date, createdAt, reset = latestReset()) {
  if (!reset) return true;
  const day = String(date || '').slice(0, 10);
  if (day !== reset.until_date) return day > reset.until_date;
  return Boolean(createdAt) && String(createdAt) > String(reset.created_at);
}

function lastDayOfPreviousMonth() {
  const date = new Date();
  date.setDate(0);
  return dateToISO(date);
}

async function loadResets() {
  try {
    financeResets = await resetsStore.list({ build: (query) => query.order('created_at', { ascending: false }).limit(20) });
  } catch (error) {
    console.error('[Umbral] Reinicios de cuentas:', error);
    financeResets = [];
  }
  renderFinance(financeCache);
}

function renderResetNote() {
  const note = document.querySelector('#financeResetNote');
  const reset = latestReset();
  note.hidden = !reset;
  if (!reset) return;
  const until = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'long' }).format(new Date(`${reset.until_date}T12:00:00`));
  note.innerHTML = `<i data-lucide="flag"></i><span>Saldado hasta el ${escapeHtml(until)}${reset.created_by_name ? ` por ${escapeHtml(reset.created_by_name)}` : ''}.</span><button type="button" class="link-button" id="undoReset">Deshacer</button>`;
}

// Panel con las dos opciones y lo que quedaría pendiente en cada caso.
function renderResetPanel() {
  const panel = document.querySelector('#financeResetPanel');
  const now = new Date();
  const preview = (reset) => {
    const result = settlementWithReset(financeCache, reset);
    return result.amount < 0.01 ? 'Quedaríais en paz.' : `Quedaría: ${result.debtor} debe ${financeMoney(result.amount)} a ${result.creditor}.`;
  };
  const previousUntil = lastDayOfPreviousMonth();
  const previousLabel = new Intl.DateTimeFormat('es-ES', { month: 'long' }).format(new Date(`${previousUntil}T12:00:00`));
  const thisMonth = new Intl.DateTimeFormat('es-ES', { month: 'long' }).format(now);
  panel.innerHTML = `
    <p class="reset-intro">Úsalo cuando ya os hayáis hecho el bizum o la transferencia y queráis empezar de cero.</p>
    <button type="button" class="reset-option" data-reset-mode="previous">
      <span class="reset-option-icon"><i data-lucide="calendar-check"></i></span>
      <span><strong>Saldar hasta ${escapeHtml(previousLabel)}</strong><small>Se borra la deuda de los meses anteriores y solo cuenta ${escapeHtml(thisMonth)}. ${escapeHtml(preview({ until_date: previousUntil, created_at: new Date().toISOString() }))}</small></span>
    </button>
    <button type="button" class="reset-option" data-reset-mode="all">
      <span class="reset-option-icon is-all"><i data-lucide="circle-check-big"></i></span>
      <span><strong>Saldar todo hasta hoy</strong><small>Todo queda a cero. Lo que añadáis a partir de ahora empieza de nuevo.</small></span>
    </button>
    <button type="button" class="link-button" data-reset-cancel>Cancelar</button>`;
  lucide.createIcons();
}

async function applyReset(mode) {
  const until = mode === 'previous' ? lastDayOfPreviousMonth() : dateToISO(new Date());
  try {
    const [created] = await resetsStore.insert({ until_date: until, mode, created_by_name: currentUser });
    financeResets.unshift(created);
    document.querySelector('#financeResetPanel').hidden = true;
    document.querySelector('#openResetPanel').setAttribute('aria-expanded', 'false');
    renderFinance(financeCache);
    showToast(mode === 'previous' ? 'Meses anteriores saldados' : 'Cuentas a cero');
    notifyHousehold(`${currentUser} puso las cuentas a cero`, mode === 'previous' ? 'Los meses anteriores quedan saldados; solo cuenta este mes.' : 'Todo saldado hasta hoy.', { open: 'finance', tag: 'finance' });
  } catch (error) {
    showSupabaseError('No se pudo poner a cero', error);
  }
}

async function undoReset() {
  const reset = latestReset();
  if (!reset || !window.confirm('¿Deshacer la última puesta a cero? Volverán a contar los movimientos anteriores.')) return;
  try {
    await resetsStore.remove(reset.id);
    financeResets = financeResets.filter((entry) => entry.id !== reset.id);
    renderFinance(financeCache);
    showToast('Puesta a cero deshecha');
  } catch (error) {
    showSupabaseError('No se pudo deshacer', error);
  }
}

// ---------- Gastos personales ----------

// Como createHouseholdStore, pero de cada persona (no del hogar).
const personalStore = {
  localKey: () => `umbral-personal-expenses-${currentUser.toLowerCase()}`,
  inCloud: () => Boolean(supabaseClient && authUserId),
  readLocal() {
    try { return JSON.parse(localStorage.getItem(this.localKey()) || '[]'); } catch { return []; }
  },
  writeLocal(rows) { localStorage.setItem(this.localKey(), JSON.stringify(rows)); },
  async list(since) {
    if (this.inCloud()) {
      const { data, error } = await supabaseClient.from('personal_expenses').select('*').eq('user_id', authUserId).gte('expense_date', since).order('expense_date', { ascending: false });
      if (error) throw error;
      return data;
    }
    return this.readLocal().filter((row) => row.expense_date >= since);
  },
  // Inserta ignorando los que ya existían (misma source_reference). Devuelve los nuevos.
  async insert(rows) {
    if (this.inCloud()) {
      const { data, error } = await supabaseClient.from('personal_expenses')
        .upsert(rows.map((row) => ({ ...row, user_id: authUserId })), { onConflict: 'user_id,source_reference', ignoreDuplicates: true })
        .select('*');
      if (error) throw error;
      return data;
    }
    const current = this.readLocal();
    const known = new Set(current.map((row) => row.source_reference).filter(Boolean));
    const fresh = rows.filter((row) => !row.source_reference || !known.has(row.source_reference)).map((row) => ({ id: createLocalId(), created_at: new Date().toISOString(), ...row }));
    this.writeLocal([...fresh, ...current]);
    return fresh;
  },
  async remove(id) {
    if (this.inCloud()) {
      const { error } = await supabaseClient.from('personal_expenses').delete().eq('id', id);
      if (error) throw error;
      return;
    }
    this.writeLocal(this.readLocal().filter((row) => row.id !== id));
  }
};

let personalExpenses = [];
let personalLoaded = false;
let personalCategoryFilter = null;
const personalShareKey = 'umbral-personal-include-share';

async function loadPersonal() {
  // Un año de historial basta para la evolución y los análisis.
  const since = `${shiftMonth(dateToISO(new Date()).slice(0, 7), -12)}-01`;
  try {
    personalExpenses = await personalStore.list(since);
    personalLoaded = true;
  } catch (error) {
    console.error('[Umbral] Gastos personales:', error);
    document.querySelector('#personalList').innerHTML = `<p class="empty-note">No se pudieron cargar tus gastos: ${escapeHtml(error.message || 'error desconocido')}. ¿Has ejecutado finance-personal.sql en Supabase?</p>`;
    return;
  }
  renderPersonal();
}

const includeShare = () => document.querySelector('#personalIncludeShare')?.checked;

// Tu parte de la casa en un mes: la mitad del total de Casa.
const householdShare = (month) => monthFinanceEntries(financeCache, month).reduce((sum, entry) => sum + Number(entry.amount || 0), 0) / 2;

function personalMonthEntries(month) {
  const own = personalExpenses.filter((entry) => String(entry.expense_date).slice(0, 7) === month);
  if (!includeShare()) return own;
  const share = householdShare(month);
  return share > 0 ? [...own, { id: `share-${month}`, description: 'Tu parte de la casa', amount: share, category: 'Casa (tu parte)', expense_date: `${month}-01`, source: 'share' }] : own;
}

const personalTotal = (month) => personalMonthEntries(month).reduce((sum, entry) => sum + Number(entry.amount || 0), 0);

const SOURCE_BADGES = { apple_pay: 'Apple Pay', bank: 'Banco', share: 'Casa' };

function renderPersonal() {
  if (!personalLoaded || !document.querySelector('#personalPane')) return;
  const month = financeMonth;
  const monthName = shortMonthLabel(month);
  const entries = personalMonthEntries(month);
  const total = personalTotal(month);
  const previous = personalTotal(shiftMonth(month, -1));

  document.querySelector('#personalTotalLabel').textContent = `Tus gastos en ${monthName}`;
  document.querySelector('#personalTotal').textContent = financeMoney(total);
  const delta = document.querySelector('#personalDelta');
  if (previous > 0) {
    const change = Math.round(((total - previous) / previous) * 100);
    delta.textContent = change === 0 ? 'Igual' : `${change > 0 ? '↑' : '↓'} ${Math.abs(change)} %`;
    delta.className = change > 0 ? 'is-up' : change < 0 ? 'is-down' : '';
  } else {
    delta.textContent = '—';
    delta.className = '';
  }
  document.querySelector('#personalShareAmount').textContent = financeMoney(householdShare(month));
  const points = trendMonths(month).map((point) => ({ month: point, total: personalTotal(point) }));
  document.querySelector('#personalTrend').innerHTML = monthBarsMarkup(points, month);

  const rows = groupByCategory(entries, (entry) => entry.category || 'Otros');
  document.querySelector('#personalCategoryMonth').textContent = `en ${monthName}`;
  document.querySelector('#personalCategoryTotal').textContent = financeMoney(total);
  document.querySelector('#personalCategories').innerHTML = categoryChartMarkup(rows, total, 'Añade tu primer gasto del mes y verás aquí en qué se te va.');

  // Dónde más gastas: por descripción (comercio), sin contar tu parte de la casa.
  const byPlace = new Map();
  entries.filter((entry) => entry.source !== 'share').forEach((entry) => {
    const key = normalizeText(entry.description);
    const current = byPlace.get(key) || { name: entry.description, amount: 0, count: 0, category: entry.category };
    current.amount += Number(entry.amount || 0);
    current.count += 1;
    byPlace.set(key, current);
  });
  const top = [...byPlace.values()].sort((first, second) => second.amount - first.amount).slice(0, 5);
  const topMax = top[0]?.amount || 1;
  document.querySelector('#personalTop').innerHTML = top.length
    ? top.map((place) => `<div class="top-row"><span class="top-name">${escapeHtml(place.name)}<small>${place.count} ${place.count === 1 ? 'vez' : 'veces'}</small></span><span class="top-track"><span style="width:${Math.max(4, (place.amount / topMax) * 100)}%;background:${categoryColor(place.category)}"></span></span><b>${financeMoney(place.amount)}</b></div>`).join('')
    : '<p class="empty-note">Aquí verás los sitios donde más gastas.</p>';

  const listed = entries.filter((entry) => entry.source !== 'share' && (!personalCategoryFilter || entry.category === personalCategoryFilter))
    .sort((first, second) => String(second.expense_date).localeCompare(String(first.expense_date)) || String(second.created_at).localeCompare(String(first.created_at)));
  document.querySelector('#personalListTitle').innerHTML = personalCategoryFilter
    ? `${escapeHtml(personalCategoryFilter)} <button type="button" class="filter-chip" data-clear-personal-filter>Quitar filtro <i data-lucide="x"></i></button>`
    : `Movimientos de ${escapeHtml(monthName)}`;
  document.querySelector('#personalCount').textContent = listed.length ? `${listed.length}` : '';
  document.querySelector('#personalList').innerHTML = listed.length
    ? listed.map((entry) => `<div class="finance-item personal-item"><span class="finance-item-icon" style="color:${categoryColor(entry.category)}"><i data-lucide="${(PERSONAL_CATEGORIES.find(([name]) => name === entry.category) || [null, 'circle-ellipsis'])[1]}"></i></span><span><strong>${escapeHtml(entry.description)}${SOURCE_BADGES[entry.source] ? ` <em class="finance-item-source">${SOURCE_BADGES[entry.source]}</em>` : ''}</strong><small>${escapeHtml(entry.category || 'Otros')} · ${financeDate(entry.expense_date)}</small></span><b>${financeMoney(entry.amount)}</b><span class="finance-item-actions"><button type="button" data-personal-delete="${escapeHtml(entry.id)}" aria-label="Eliminar gasto" title="Eliminar"><i data-lucide="trash-2"></i></button></span></div>`).join('')
    : `<p class="empty-note">${personalCategoryFilter ? 'Nada en esta categoría este mes.' : 'Aún no hay gastos este mes.'}</p>`;

  document.querySelector('#personalPrivacyNote').innerHTML = `<i data-lucide="lock"></i> Tus gastos personales son privados: ${escapeHtml(otherPerson(currentUser))} no los ve.`;
  lucide.createIcons();
}

function renderPersonalChips() {
  const chips = document.querySelector('#personalCategoryChips');
  chips.innerHTML = PERSONAL_CATEGORIES.map(([name, icon], index) => `<label class="category-chip"><input type="radio" name="category" value="${escapeHtml(name)}" ${index === 0 ? 'checked' : ''} /><span><i data-lucide="${icon}"></i>${escapeHtml(name)}</span></label>`).join('');
}

async function addPersonalExpense(form) {
  const values = new FormData(form);
  const row = {
    description: String(values.get('description')).trim().slice(0, 160),
    amount: Math.round(Number(values.get('amount')) * 100) / 100,
    category: values.get('category') || 'Otros',
    expense_date: values.get('date') || dateToISO(new Date()),
    source: 'manual'
  };
  if (!row.description || !(row.amount > 0)) return;
  try {
    const created = await personalStore.insert([row]);
    personalExpenses.unshift(...created);
    form.description.value = '';
    form.amount.value = '';
    personalCategoryTouched = false;
    renderPersonal();
    showToast('Gasto guardado');
  } catch (error) {
    showSupabaseError('No se pudo guardar el gasto', error);
  }
}

async function deletePersonalExpense(id) {
  if (!window.confirm('¿Eliminar este gasto?')) return;
  try {
    await personalStore.remove(id);
    personalExpenses = personalExpenses.filter((entry) => entry.id !== id);
    renderPersonal();
  } catch (error) {
    showSupabaseError('No se pudo eliminar', error);
  }
}

// ---------- Extracto del banco ----------

// «-1.234,56», «12.50», «(8,00)», «8,00-»… → número con signo (negativo = cargo).
function parseBankAmount(value) {
  if (typeof value === 'number') return value;
  let text = String(value ?? '').trim();
  if (!text) return NaN;
  const negative = /^-|-$|^\(.*\)$|^−/.test(text);
  text = text.replace(/[^\d,.]/g, '');
  if (text.includes(',') && text.includes('.')) text = text.lastIndexOf(',') > text.lastIndexOf('.') ? text.replace(/\./g, '').replace(',', '.') : text.replace(/,/g, '');
  else if (text.includes(',')) text = text.replace(',', '.');
  const number = Number(text);
  return negative ? -number : number;
}

// «PAGAMENTO POS ESSELUNGA TORINO 02/09 CARTA *1234» → «Esselunga Torino».
const BANK_NOISE = /\b(pagamento|pagam\.?|pag\.?|pos|addebito|addebiti|acquisto|compra( en)?|pago( en)?|con tarjeta|tarjeta|carta|card|contactless|apple pay|google pay|sdd|bonifico a favore di|bonifico|transferencia a|operazione|op\.?)\b/gi;
function cleanBankDescription(text) {
  const cleaned = String(text)
    .replace(/\*+\s?\d{3,}|\b\d{2}[/.-]\d{2}([/.-]\d{2,4})?\b|\b\d{2}:\d{2}\b|\b\d{6,}\b/g, ' ')
    .replace(BANK_NOISE, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const base = cleaned || String(text).trim();
  return base === base.toUpperCase() ? base.toLowerCase().replace(/(^|\s)\S/g, (letter) => letter.toUpperCase()) : base;
}

const BANK_HEADERS = {
  date: /^(data|fecha|date|booking ?date|data ?(operazione|contabile|valuta)|fecha ?(operaci[oó]n|valor)|f\. ?(operaci[oó]n|valor))/,
  description: /(descri|concepto|causale|movimento|dettagli|details|beneficiario|merchant|comercio|operaci[oó]n$)/,
  amount: /^(importo|importe|amount|cantidad|valor|monto)/,
  debit: /(dare|addebit|uscit|cargo|debe|debit|gasto)/,
  credit: /(avere|accredit|entrat|abono|haber|credit|ingreso)/
};

// Busca la fila de cabecera (los bancos suelen poner antes varias líneas de datos de la cuenta).
function findBankColumns(rows) {
  for (let index = 0; index < Math.min(rows.length, 30); index += 1) {
    const headers = rows[index].map((cell) => normalizeText(cell));
    const find = (pattern, skip = []) => headers.findIndex((header, column) => header && pattern.test(header) && !skip.includes(column));
    const date = find(BANK_HEADERS.date);
    const amount = find(BANK_HEADERS.amount);
    const debit = find(BANK_HEADERS.debit, [date]);
    const credit = find(BANK_HEADERS.credit, [date, debit]);
    const description = find(BANK_HEADERS.description, [date, amount, debit, credit]);
    if (date >= 0 && description >= 0 && (amount >= 0 || debit >= 0)) return { header: index, date, description, amount, debit, credit };
  }
  return null;
}

async function importBankFile(file) {
  const output = document.querySelector('#bankImportResult');
  output.innerHTML = '<p class="empty-note">Leyendo el extracto…</p>';
  try {
    if (!window.XLSX) throw new Error('No se pudo cargar el lector de Excel. Comprueba la conexión.');
    // Los CSV se leen como texto: si no, «02/09/2026» se tomaría como fecha americana y «-54,30» como 5430.
    const isText = /\.(csv|txt)$/i.test(file.name);
    const workbook = isText
      ? XLSX.read(await file.text(), { type: 'string', raw: true })
      : XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true });
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { header: 1, raw: true, defval: '' });
    const columns = findBankColumns(rows);
    if (!columns) throw new Error('No encuentro las columnas de fecha, concepto e importe. Prueba con el Excel en vez del CSV, o al revés.');
    const occurrences = {};
    const charges = rows.slice(columns.header + 1).map((row) => {
      const debit = columns.debit >= 0 ? parseBankAmount(row[columns.debit]) : NaN;
      const amount = columns.amount >= 0 ? parseBankAmount(row[columns.amount]) : NaN;
      // Con columna de cargos, cualquier valor ahí es un gasto; con una sola columna, solo los negativos.
      const charge = Number.isFinite(debit) && debit !== 0 ? Math.abs(debit) : Number.isFinite(amount) && amount < 0 ? Math.abs(amount) : 0;
      const description = cleanBankDescription(String(row[columns.description] || '').replace(/\s+/g, ' ')).slice(0, 160);
      const rawDate = row[columns.date];
      if (!charge || !description || rawDate === '' || rawDate == null) return null;
      const date = parseFinanceDate(rawDate);
      const base = `bank:${date}|${normalizeText(description)}|${charge.toFixed(2)}`;
      occurrences[base] = (occurrences[base] || 0) + 1;
      return { description, amount: Math.round(charge * 100) / 100, category: guessPersonalCategory(description), expense_date: date, source: 'bank', source_reference: `${base}|${occurrences[base]}`.slice(0, 300) };
    }).filter(Boolean);
    if (!charges.length) throw new Error('No hay cargos en este archivo.');
    const created = await personalStore.insert(charges);
    personalExpenses.unshift(...created);
    const dates = charges.map((charge) => charge.expense_date).sort();
    const total = created.reduce((sum, charge) => sum + charge.amount, 0);
    const repeated = charges.length - created.length;
    output.innerHTML = created.length
      ? `<div class="import-summary"><i data-lucide="circle-check-big"></i><span><strong>${created.length} ${created.length === 1 ? 'gasto importado' : 'gastos importados'} · ${financeMoney(total)}</strong><small>Del ${financeDate(dates[0])} al ${financeDate(dates.at(-1))}${repeated ? ` · ${repeated} ya estaban` : ''}. La categoría se adivina por el comercio; puedes borrar los que no quieras contar.</small></span></div>`
      : `<div class="import-summary"><i data-lucide="circle-check-big"></i><span><strong>Nada nuevo</strong><small>Los ${charges.length} cargos de este extracto ya estaban importados.</small></span></div>`;
    renderPersonal();
  } catch (error) {
    output.innerHTML = `<p class="empty-note">${escapeHtml(error.message || 'No se pudo leer el archivo')}</p>`;
  }
  lucide.createIcons();
}

// ---------- Atajo de Apple Pay ----------

function renderWalletSteps() {
  const url = `${(window.SUPABASE_CONFIG?.url || 'https://TU-PROYECTO.supabase.co').replace(/\/$/, '')}/functions/v1/wallet-ingest`;
  document.querySelector('#walletSteps').innerHTML = `
    <p>Con un Atajo del iPhone, cada vez que pagues con Apple Pay el gasto aparece aquí solo. Se configura una vez y no cuesta nada.</p>
    <ol>
      <li>Abre <b>Atajos</b> → <b>Automatización</b> → <b>+</b> → <b>Wallet</b> (o «Transacción»).</li>
      <li>Elige tus tarjetas, marca <b>Ejecutar inmediatamente</b> y pulsa Siguiente.</li>
      <li>Crea un atajo nuevo con la acción <b>Obtener contenido de URL</b>:
        <div class="copy-field"><code>${escapeHtml(url)}</code><button type="button" class="link-button" data-copy="${escapeHtml(url)}">Copiar</button></div>
      </li>
      <li>Toca «Mostrar más»: método <b>POST</b>. En <b>Cabeceras</b> añade <code>x-sync-token</code> con vuestro SYNC_TOKEN.</li>
      <li>En <b>Cuerpo de la solicitud</b> elige <b>JSON</b> y añade tres campos de texto:
        <code>owner</code> = <b>${escapeHtml(currentUser)}</b>, <code>amount</code> = la variable <b>Importe</b> y <code>merchant</code> = la variable <b>Comerciante</b>.</li>
      <li>Paga algo con el iPhone y mira aquí: aparecerá con la etiqueta «Apple Pay».</li>
    </ol>
    <p class="connect-note">Solo recoge pagos con Apple Pay (no compras online con la tarjeta). Para lo demás, sube el extracto del banco.</p>`;
}

// ---------- Eventos ----------

document.querySelector('.money-switch').addEventListener('click', (event) => {
  const tab = event.target.closest('[data-money-tab]');
  if (!tab) return;
  document.querySelectorAll('[data-money-tab]').forEach((button) => button.setAttribute('aria-pressed', String(button === tab)));
  document.querySelectorAll('[data-money-pane]').forEach((pane) => { pane.hidden = pane.dataset.moneyPane !== tab.dataset.moneyTab; });
  if (tab.dataset.moneyTab === 'personal' && !personalLoaded) loadPersonal();
  document.querySelector('.finance-panel').scrollTo({ top: 0, behavior: 'smooth' });
});

// Las columnas de los dos gráficos de evolución cambian el mes de toda la sección.
document.querySelector('#financeModal').addEventListener('click', (event) => {
  const bar = event.target.closest('[data-select-month]');
  if (bar) {
    financeMonth = bar.dataset.selectMonth;
    renderFinance(financeCache);
    return;
  }
  const copy = event.target.closest('[data-copy]');
  if (copy) {
    navigator.clipboard?.writeText(copy.dataset.copy).then(() => showToast('Copiado'), () => showToast('No se pudo copiar'));
  }
});

document.querySelector('#financeCategoryBreakdown').addEventListener('click', (event) => {
  const row = event.target.closest('[data-category-filter]');
  if (!row) return;
  const select = document.querySelector('#financeCategoryFilter');
  select.value = [...select.options].some((option) => option.value === row.dataset.categoryFilter) ? row.dataset.categoryFilter : 'all';
  document.querySelector('#financePeriod').value = 'month';
  document.querySelector('[data-finance-view="expenses"]').click();
  renderFinance(financeCache);
  document.querySelector('.movements-card').scrollIntoView({ behavior: 'smooth', block: 'start' });
});

document.querySelector('#openResetPanel').addEventListener('click', (event) => {
  const panel = document.querySelector('#financeResetPanel');
  panel.hidden = !panel.hidden;
  event.currentTarget.setAttribute('aria-expanded', String(!panel.hidden));
  if (!panel.hidden) renderResetPanel();
});

document.querySelector('#financeResetPanel').addEventListener('click', (event) => {
  const option = event.target.closest('[data-reset-mode]');
  if (option) return applyReset(option.dataset.resetMode);
  if (event.target.closest('[data-reset-cancel]')) {
    event.currentTarget.hidden = true;
    document.querySelector('#openResetPanel').setAttribute('aria-expanded', 'false');
  }
});

document.querySelector('#financeResetNote').addEventListener('click', (event) => {
  if (event.target.closest('#undoReset')) undoReset();
});

document.querySelector('#personalForm').addEventListener('submit', (event) => {
  event.preventDefault();
  addPersonalExpense(event.currentTarget);
});

// Al escribir el concepto se propone la categoría (sin pisar una elegida a mano).
let personalCategoryTouched = false;
document.querySelector('#personalForm').addEventListener('input', (event) => {
  if (event.target.name === 'category') personalCategoryTouched = true;
  if (event.target.name !== 'description' || personalCategoryTouched) return;
  const guess = guessPersonalCategory(event.target.value);
  if (guess === 'Otros') return;
  const radio = event.currentTarget.querySelector(`input[name="category"][value="${CSS.escape(guess)}"]`);
  if (radio) radio.checked = true;
});
document.querySelector('#personalForm').addEventListener('reset', () => { personalCategoryTouched = false; });

document.querySelector('#personalPane').addEventListener('click', (event) => {
  const remove = event.target.closest('[data-personal-delete]');
  if (remove) return deletePersonalExpense(remove.dataset.personalDelete);
  const row = event.target.closest('#personalCategories [data-category-filter]');
  if (row) {
    personalCategoryFilter = row.dataset.categoryFilter === 'Casa (tu parte)' ? null : row.dataset.categoryFilter;
    renderPersonal();
    document.querySelector('#personalList').scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }
  if (event.target.closest('[data-clear-personal-filter]')) {
    personalCategoryFilter = null;
    renderPersonal();
  }
});

document.querySelector('#personalIncludeShare').addEventListener('change', (event) => {
  try { localStorage.setItem(personalShareKey, String(event.target.checked)); } catch {}
  renderPersonal();
});

document.querySelector('#bankImport').addEventListener('change', (event) => {
  const file = event.target.files?.[0];
  if (file) importBankFile(file);
  event.target.value = '';
});

document.addEventListener('DOMContentLoaded', () => {
  renderPersonalChips();
  document.querySelector('#personalForm').date.value = dateToISO(new Date());
  try { document.querySelector('#personalIncludeShare').checked = localStorage.getItem(personalShareKey) === 'true'; } catch {}
});

document.addEventListener('umbral:ready', () => {
  renderWalletSteps();
  loadResets();
  resetsStore.subscribe(() => loadResets());
});
