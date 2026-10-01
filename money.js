// Cuentas, segunda parte:
// - Gráficos (evolución por meses y reparto por categoría), compartidos por Casa y Mis gastos.
// - «Poner a cero» las deudas: el balance solo cuenta lo posterior al último reinicio.
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

// ---------- Eventos ----------

document.querySelector('.money-switch').addEventListener('click', (event) => {
  const tab = event.target.closest('[data-money-tab]');
  if (!tab) return;
  document.querySelectorAll('[data-money-tab]').forEach((button) => button.setAttribute('aria-pressed', String(button === tab)));
  document.querySelectorAll('[data-money-pane]').forEach((pane) => { pane.hidden = pane.dataset.moneyPane !== tab.dataset.moneyTab; });
  if (tab.dataset.moneyTab === 'personal') openPersonalPane();
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

document.addEventListener('umbral:ready', () => {
  loadResets();
  resetsStore.subscribe(() => loadResets());
});
