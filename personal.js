// Mis gastos: análisis privado de tus gastos, pensado para importar cada mes el Excel del banco.
// - Resumen del mes: gastado, ingresos, ahorro y comparación con tu media.
// - Lo destacado (generado), categorías con presupuesto, calendario de gasto, día de la semana,
//   fijos y suscripciones detectados solos, comercios y movimientos.
// - Importar: vista previa, sin duplicados (ni con Apple Pay) y repaso de lo que no sabe clasificar.
// - Reglas aprendidas: al cambiar la categoría de un comercio se aplica a todos sus movimientos.
// Usa financeMonth, financeCache, financeMoney, shortMonthLabel, monthLabel, shiftMonth,
// monthBarsMarkup, trendMonths, monthFinanceEntries (app.js / money.js) y bank-import.js.

const PERSONAL_V2_FIELDS = ['direction', 'merchant', 'kind', 'bank_description', 'excluded'];
let personalV2Available = true;
let personalExpenses = [];
let personalRules = [];
let personalBudgets = [];
let personalLoaded = false;
let personalLoading = null;
const personalView = { category: null, day: null, search: '', incomeOnly: false };
let pendingImport = null;
const personalShareKey = 'umbral-personal-include-share';

const categoryInfo = (name) => [...PERSONAL_CATEGORIES, ...INCOME_CATEGORIES].find((category) => category.name === name) || { name: name || 'Otros', icon: 'circle-ellipsis' };
const normalizeCategory = (name) => LEGACY_CATEGORIES[name] || name || 'Otros';
const expenseMonth = (entry) => String(entry.expense_date).slice(0, 7);
const entryMerchant = (entry) => entry.merchant || entry.description || 'Sin nombre';
const isIncome = (entry) => entry.direction === 'in' && !(entry.kind === 'card');
const isRefundEntry = (entry) => entry.direction === 'in' && entry.kind === 'card';
// Importe con signo para el gasto: un cargo suma, una devolución con tarjeta resta.
const spendValue = (entry) => (entry.excluded || isIncome(entry) ? 0 : isRefundEntry(entry) ? -Number(entry.amount) : Number(entry.amount));
const KIND_LABELS = { card: 'Tarjeta', transfer: 'Transferencia', sdd: 'Domiciliación', withdraw: 'Efectivo', fee: 'Comisión', other: 'Otro' };
const SOURCE_BADGES = { apple_pay: 'Apple Pay' };
const money0 = (value) => financeMoney(value).replace(/,\d\d(?=\s)/, '');

// ---------- Datos ----------

const stripPersonalV2 = (row) => Object.fromEntries(Object.entries(row).filter(([key]) => !PERSONAL_V2_FIELDS.includes(key)));
const isMissingColumnError = (error) => /column|schema cache|does not exist|relation/i.test(error?.message || '');

const personalStore = {
  localKey: (name = 'personal-expenses') => `umbral-${name}-${currentUser.toLowerCase()}`,
  inCloud: () => Boolean(supabaseClient && authUserId),
  readLocal(name) {
    try { return JSON.parse(localStorage.getItem(this.localKey(name)) || '[]'); } catch { return []; }
  },
  writeLocal(rows, name) { localStorage.setItem(this.localKey(name), JSON.stringify(rows)); },
  async list(since) {
    if (this.inCloud()) {
      const { data, error } = await supabaseClient.from('personal_expenses').select('*').eq('user_id', authUserId).gte('expense_date', since).order('expense_date', { ascending: false });
      if (error) throw error;
      return data;
    }
    return this.readLocal().filter((row) => row.expense_date >= since);
  },
  // Inserta ignorando los ya existentes (misma source_reference).
  async insert(rows) {
    if (!rows.length) return [];
    if (this.inCloud()) {
      const run = async (data) => {
        const result = await supabaseClient.from('personal_expenses')
          .upsert(data.map((row) => ({ ...row, user_id: authUserId })), { onConflict: 'user_id,source_reference', ignoreDuplicates: true })
          .select('*');
        if (result.error) throw result.error;
        return result.data;
      };
      if (!personalV2Available) return run(rows.map(stripPersonalV2));
      try {
        return await run(rows);
      } catch (error) {
        if (!isMissingColumnError(error)) throw error;
        personalV2Available = false;
        showToast('Falta ejecutar finance-personal-v2.sql en Supabase: se guarda lo básico');
        return run(rows.map(stripPersonalV2));
      }
    }
    const current = this.readLocal();
    const known = new Set(current.map((row) => row.source_reference).filter(Boolean));
    const fresh = rows.filter((row) => !row.source_reference || !known.has(row.source_reference)).map((row) => ({ id: createLocalId(), created_at: new Date().toISOString(), ...row }));
    this.writeLocal([...fresh, ...current]);
    return fresh;
  },
  async update(ids, changes) {
    const list = [].concat(ids);
    if (!list.length) return;
    if (this.inCloud()) {
      const data = personalV2Available ? changes : stripPersonalV2(changes);
      if (!Object.keys(data).length) return;
      const { error } = await supabaseClient.from('personal_expenses').update(data).in('id', list);
      if (error) throw error;
      return;
    }
    this.writeLocal(this.readLocal().map((row) => (list.includes(row.id) ? { ...row, ...changes } : row)));
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

// Reglas y presupuestos: en Supabase si existen las tablas; si no, en este teléfono.
function userTable(table, localName, conflict) {
  let cloud = true;
  return {
    async list() {
      if (personalStore.inCloud() && cloud) {
        const { data, error } = await supabaseClient.from(table).select('*').eq('user_id', authUserId);
        if (!error) return data;
        if (!isMissingColumnError(error)) throw error;
        cloud = false;
      }
      return personalStore.readLocal(localName);
    },
    async save(row) {
      if (personalStore.inCloud() && cloud) {
        const { error } = await supabaseClient.from(table).upsert({ ...row, user_id: authUserId }, { onConflict: `user_id,${conflict}` });
        if (!error) return;
        if (!isMissingColumnError(error)) throw error;
        cloud = false;
      }
      const rows = personalStore.readLocal(localName).filter((entry) => entry[conflict] !== row[conflict]);
      personalStore.writeLocal([...rows, row], localName);
    },
    async remove(key) {
      if (personalStore.inCloud() && cloud) {
        const { error } = await supabaseClient.from(table).delete().eq('user_id', authUserId).eq(conflict, key);
        if (!error) return;
        if (!isMissingColumnError(error)) throw error;
        cloud = false;
      }
      personalStore.writeLocal(personalStore.readLocal(localName).filter((entry) => entry[conflict] !== key), localName);
    }
  };
}
const rulesTable = userTable('personal_category_rules', 'personal-rules', 'merchant_key');
const budgetsTable = userTable('personal_budgets', 'personal-budgets', 'category');

async function loadPersonal() {
  const since = `${shiftMonth(dateToISO(new Date()).slice(0, 7), -13)}-01`;
  try {
    const [rows, rules, budgets] = await Promise.all([personalStore.list(since), rulesTable.list().catch(() => []), budgetsTable.list().catch(() => [])]);
    personalExpenses = rows.map((row) => ({ ...row, direction: row.direction || 'out', category: normalizeCategory(row.category) }));
    personalRules = rules;
    personalBudgets = budgets;
    personalLoaded = true;
  } catch (error) {
    console.error('[Umbral] Gastos personales:', error);
    document.querySelector('#personalList').innerHTML = `<p class="empty-note">No se pudieron cargar tus gastos: ${escapeHtml(error.message || 'error desconocido')}. ¿Has ejecutado finance-personal.sql en Supabase?</p>`;
    return;
  }
  renderPersonal();
}

function openPersonalPane() {
  if (!personalLoaded) personalLoading ||= loadPersonal().finally(() => { personalLoading = null; });
  renderPersonal();
}

// ---------- Cálculos ----------

const includeShare = () => document.querySelector('#personalIncludeShare')?.checked;
// Tu parte de lo de casa ese mes, con el reparto de cada gasto (a medias, solo tuyo…).
const householdShare = (month) => monthFinanceEntries(financeCache, month).reduce((sum, entry) => sum + Number(entry.amount || 0) * shareOf(entry, financeMe()), 0);
const monthEntries = (month) => personalExpenses.filter((entry) => expenseMonth(entry) === month);
const monthSpend = (month) => monthEntries(month).reduce((sum, entry) => sum + spendValue(entry), 0) + (includeShare() ? householdShare(month) : 0);
const monthIncome = (month) => monthEntries(month).filter((entry) => !entry.excluded && isIncome(entry)).reduce((sum, entry) => sum + Number(entry.amount), 0);
const monthsWithData = (month, count) => Array.from({ length: count }, (_, index) => shiftMonth(month, -(index + 1))).filter((previous) => monthEntries(previous).length);

function categoryTotals(month) {
  const totals = new Map();
  monthEntries(month).forEach((entry) => {
    const value = spendValue(entry);
    if (!value) return;
    totals.set(entry.category, (totals.get(entry.category) || 0) + value);
  });
  if (includeShare()) {
    const share = householdShare(month);
    if (share > 0) totals.set('Casa (tu parte)', share);
  }
  return totals;
}

function averageCategories(month) {
  const previous = monthsWithData(month, 3);
  const sums = new Map();
  previous.forEach((other) => categoryTotals(other).forEach((value, name) => sums.set(name, (sums.get(name) || 0) + value)));
  return { months: previous.length, average: new Map([...sums].map(([name, value]) => [name, value / Math.max(previous.length, 1)])) };
}

// Fijos y suscripciones: domiciliaciones, suscripciones y facturas que se repiten (2 de los
// últimos 4 meses), o cualquier cargo único al mes con el mismo importe durante 3 meses o más.
// Las compras del día a día (súper, restaurantes, transporte) no cuentan aunque se repitan.
const EVERYDAY_CATEGORIES = ['Supermercado', 'Comer fuera', 'Transporte', 'Efectivo', 'Ocio', 'Compras', 'Ropa'];
function recurringCharges(month) {
  const months = [month, shiftMonth(month, -1), shiftMonth(month, -2), shiftMonth(month, -3)];
  const groups = new Map();
  personalExpenses.forEach((entry) => {
    if (entry.excluded || entry.direction !== 'out' || !months.includes(expenseMonth(entry)) || entry.kind === 'withdraw' || entry.kind === 'transfer') return;
    const key = merchantKey(entryMerchant(entry));
    const group = groups.get(key) || { name: entryMerchant(entry), category: entry.category, kind: entry.kind, byMonth: new Map(), counts: new Map(), last: entry };
    group.byMonth.set(expenseMonth(entry), (group.byMonth.get(expenseMonth(entry)) || 0) + Number(entry.amount));
    group.counts.set(expenseMonth(entry), (group.counts.get(expenseMonth(entry)) || 0) + 1);
    if (entry.kind === 'sdd') group.kind = 'sdd';
    if (String(entry.expense_date) > String(group.last.expense_date)) group.last = entry;
    groups.set(key, group);
  });
  return [...groups.values()].filter((group) => {
    const values = [...group.byMonth.values()];
    if (values.length < 2 || ![...group.counts.values()].every((count) => count === 1)) return false;
    if (!group.byMonth.has(month) && !group.byMonth.has(shiftMonth(month, -1))) return false;
    const sorted = [...values].sort((first, second) => first - second);
    group.amount = sorted[Math.floor((sorted.length - 1) / 2)];
    const spread = (sorted.at(-1) - sorted[0]) / Math.max(group.amount, 1);
    const billLike = group.kind === 'sdd' || ['Suscripciones', 'Casa y facturas'].includes(group.category);
    if (billLike) return spread <= 0.35;
    return values.length >= 3 && spread <= 0.05 && !EVERYDAY_CATEGORIES.includes(group.category);
  }).sort((first, second) => second.amount - first.amount);
}

function weekdayAverages(month) {
  const months = [month, ...monthsWithData(month, 2)];
  const totals = Array(7).fill(0);
  const days = Array(7).fill(0);
  months.forEach((other) => {
    const [year, number] = other.split('-').map(Number);
    const daysInMonth = new Date(year, number, 0).getDate();
    const last = other === dateToISO(new Date()).slice(0, 7) ? new Date().getDate() : daysInMonth;
    for (let day = 1; day <= last; day += 1) days[(new Date(year, number - 1, day).getDay() + 6) % 7] += 1;
    monthEntries(other).forEach((entry) => {
      const value = spendValue(entry);
      if (!value || entry.kind === 'sdd' || entry.kind === 'transfer') return;
      totals[(new Date(`${entry.expense_date}T12:00:00`).getDay() + 6) % 7] += value;
    });
  });
  return totals.map((total, index) => (days[index] ? total / days[index] : 0));
}

// ---------- Lo destacado ----------

function buildInsights(month) {
  const insights = [];
  const spend = monthSpend(month);
  const income = monthIncome(month);
  const monthName = shortMonthLabel(month);
  const { months, average } = averageCategories(month);
  if (income > 0) {
    const saved = income - spend;
    insights.push(saved >= 0
      ? { tone: 'good', icon: 'piggy-bank', title: `Has ahorrado ${money0(saved)}`, text: `El ${Math.round((saved / income) * 100)} % de lo que entró en ${monthName}.` }
      : { tone: 'warn', icon: 'trending-down', title: `Gastaste ${money0(-saved)} más de lo que entró`, text: `Ingresos ${money0(income)} · gastos ${money0(spend)}.` });
  }
  if (months) {
    const changes = [...categoryTotals(month)].map(([name, value]) => ({ name, value, avg: average.get(name) || 0 }))
      .filter((entry) => entry.name !== 'Casa (tu parte)' && Math.abs(entry.value - entry.avg) >= 20 && (!entry.avg || Math.abs(entry.value - entry.avg) / entry.avg >= 0.25))
      .sort((first, second) => Math.abs(second.value - second.avg) - Math.abs(first.value - first.avg));
    changes.slice(0, 2).forEach((change) => {
      const up = change.value > change.avg;
      insights.push({
        tone: up ? 'warn' : 'good', icon: categoryInfo(change.name).icon, category: change.name,
        title: change.avg ? `${change.name}: ${up ? '+' : '−'}${Math.round(Math.abs(change.value - change.avg) / change.avg * 100)} %` : `${change.name}: ${money0(change.value)}`,
        text: change.avg ? `${money0(change.value)} este mes frente a ${money0(change.avg)} de media${months < 3 ? ` (${months} ${months === 1 ? 'mes' : 'meses'})` : ''}.` : 'No habías gastado en esto los meses anteriores.'
      });
    });
  }
  personalBudgets.forEach((budget) => {
    const spent = categoryTotals(month).get(budget.category) || 0;
    if (spent > Number(budget.amount)) insights.push({ tone: 'warn', icon: 'target', category: budget.category, title: `Te has pasado en ${budget.category}`, text: `${money0(spent)} de ${money0(budget.amount)} de presupuesto (+${money0(spent - budget.amount)}).` });
  });
  const entries = monthEntries(month).filter((entry) => spendValue(entry) > 0);
  const biggest = [...entries].sort((first, second) => second.amount - first.amount)[0];
  if (biggest) insights.push({ tone: 'neutral', icon: 'receipt', title: `Tu mayor gasto: ${entryMerchant(biggest)}`, text: `${financeMoney(biggest.amount)} el ${financeDate(biggest.expense_date)} · ${biggest.category}.`, entryId: biggest.id });
  const seenBefore = new Set(personalExpenses.filter((entry) => expenseMonth(entry) < month).map((entry) => merchantKey(entryMerchant(entry))));
  if (seenBefore.size) {
    const fresh = new Map();
    entries.forEach((entry) => {
      const key = merchantKey(entryMerchant(entry));
      if (!seenBefore.has(key)) fresh.set(key, { name: entryMerchant(entry), amount: (fresh.get(key)?.amount || 0) + Number(entry.amount) });
    });
    const top = [...fresh.values()].filter((entry) => entry.amount >= 30).sort((first, second) => second.amount - first.amount)[0];
    if (top) insights.push({ tone: 'neutral', icon: 'sparkles', title: `Nuevo: ${top.name}`, text: `${money0(top.amount)} en un sitio donde no habías gastado antes.` });
  }
  const weekdays = weekdayAverages(month);
  const max = Math.max(...weekdays);
  const mean = weekdays.reduce((sum, value) => sum + value, 0) / 7;
  if (max > mean * 1.6 && max >= 10) {
    const day = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábados', 'domingos'][weekdays.indexOf(max)];
    insights.push({ tone: 'neutral', icon: 'calendar-days', title: `Los ${day.endsWith('s') ? day : `${day}`} gastas más`, text: `${money0(max)} de media ese día, frente a ${money0(mean)} el resto.` });
  }
  return insights.slice(0, 6);
}

// ---------- Pintar ----------

function renderPersonal() {
  if (!document.querySelector('#personalPane')) return;
  if (!personalLoaded) {
    document.querySelector('#personalList').innerHTML = '<p class="empty-note">Cargando tus gastos…</p>';
    return;
  }
  const month = financeMonth;
  const monthName = shortMonthLabel(month);
  const spend = monthSpend(month);
  const income = monthIncome(month);
  const previous = monthsWithData(month, 3);
  const average = previous.length ? previous.reduce((sum, other) => sum + monthSpend(other), 0) / previous.length : 0;

  // Sin movimientos este mes no se enseñan gráficos vacíos: solo cómo empezar.
  const hasData = monthEntries(month).length > 0;
  ['#personalInsightsCard', '#personalCalendar', '#personalRecurring', '#personalTop', '#personalMovements'].forEach((selector) => {
    const card = document.querySelector(selector)?.closest('.money-card');
    if (card) card.hidden = !hasData;
  });
  document.querySelector('#personalTotalLabel').textContent = `Gastado en ${monthName}`;
  document.querySelector('#personalTotal').textContent = financeMoney(spend);
  const compare = document.querySelector('#personalCompare');
  if (average > 0) {
    const change = Math.round(((spend - average) / average) * 100);
    compare.innerHTML = `<b class="${change > 0 ? 'is-up' : 'is-down'}">${change > 0 ? '↑' : '↓'} ${Math.abs(change)} %</b> frente a tu media${previous.length < 3 ? ` (${previous.length} ${previous.length === 1 ? 'mes' : 'meses'})` : ''} de ${money0(average)}`;
  } else {
    compare.textContent = monthEntries(month).length ? 'Aún no hay meses anteriores para comparar' : '';
  }
  document.querySelector('#personalIncome').textContent = income ? financeMoney(income) : '—';
  const saved = income - spend;
  const savedEl = document.querySelector('#personalSaved');
  savedEl.textContent = income ? `${saved < 0 ? '−' : ''}${financeMoney(Math.abs(saved))}` : '—';
  savedEl.className = income ? (saved >= 0 ? 'is-down' : 'is-up') : '';
  const meter = document.querySelector('#personalSavingsMeter');
  meter.hidden = !income;
  if (income) {
    const spentShare = Math.min(100, (spend / income) * 100);
    meter.innerHTML = `<div class="savings-track"><span class="savings-spent" style="width:${spentShare}%"></span>${saved > 0 ? `<span class="savings-saved" style="width:${100 - spentShare}%"></span>` : ''}</div><div class="savings-legend"><span><i class="is-spent"></i>Gastado ${Math.round((spend / income) * 100)} %</span>${saved > 0 ? `<span><i class="is-saved"></i>Ahorrado ${Math.round((saved / income) * 100)} %</span>` : '<span>Sin ahorro este mes</span>'}</div>`;
  }
  document.querySelector('#personalShareAmount').textContent = financeMoney(householdShare(month));
  document.querySelector('#personalTrend').innerHTML = monthBarsMarkup(trendMonths(month).map((point) => ({ month: point, total: Math.max(0, monthSpend(point)) })), month);

  renderPersonalInsights(month);
  renderPersonalCategories(month);
  renderPersonalCalendar(month);
  renderPersonalRecurring(month);
  renderPersonalTop(month);
  renderPersonalList(month);
  document.querySelector('#personalPrivacyNote').innerHTML = `<i data-lucide="lock"></i> Tus gastos personales son privados: ${escapeHtml(otherPerson(currentUser))} no los ve.`;
  lucide.createIcons();
}

function renderPersonalInsights(month) {
  const insights = buildInsights(month);
  document.querySelector('#personalInsightsMonth').textContent = shortMonthLabel(month);
  document.querySelector('#personalInsightsCard').hidden = !insights.length;
  document.querySelector('#personalInsights').innerHTML = insights.map((insight) => `<button type="button" class="insight is-${insight.tone}" ${insight.category ? `data-filter-category="${escapeHtml(insight.category)}"` : insight.entryId ? `data-open-movement="${escapeHtml(insight.entryId)}"` : ''}>
      <span class="insight-icon"><i data-lucide="${insight.icon}"></i></span>
      <span><strong>${escapeHtml(insight.title)}</strong><small>${escapeHtml(insight.text)}</small></span>
    </button>`).join('');
}

// Barras de un solo color (son categorías sin orden): la longitud dice cuánto, el icono qué.
function renderPersonalCategories(month) {
  const totals = [...categoryTotals(month)].filter(([, value]) => value > 0).sort((first, second) => second[1] - first[1]);
  const { months, average } = averageCategories(month);
  const budgets = new Map(personalBudgets.map((budget) => [budget.category, Number(budget.amount)]));
  const max = Math.max(...totals.map(([, value]) => value), ...[...budgets.values()], 1);
  document.querySelector('#personalCategoryHint').textContent = months ? `vs tu media${months < 3 ? ` (${months} m)` : ''}` : '';
  document.querySelector('#personalCategories').innerHTML = totals.length ? totals.map(([name, value]) => {
    const avg = average.get(name);
    const delta = avg ? Math.round(((value - avg) / avg) * 100) : null;
    const budget = budgets.get(name);
    return `<button type="button" class="pcat-row${personalView.category === name ? ' is-active' : ''}" data-filter-category="${escapeHtml(name)}">
      <span class="pcat-icon"><i data-lucide="${categoryInfo(name).icon}"></i></span>
      <span class="pcat-main">
        <span class="pcat-top"><strong>${escapeHtml(name)}</strong><b>${financeMoney(value)}</b></span>
        <span class="pcat-track"><span class="pcat-fill${budget && value > budget ? ' is-over' : ''}" style="width:${(value / max) * 100}%"></span>${budget ? `<span class="pcat-budget" style="left:${Math.min(100, (budget / max) * 100)}%" title="Presupuesto ${financeMoney(budget)}"></span>` : ''}</span>
        <small>${budget ? `${value > budget ? `<em class="is-up">Te pasas ${money0(value - budget)}</em>` : `Quedan ${money0(budget - value)} de ${money0(budget)}`} · ` : ''}${delta === null ? (months ? 'Nuevo este mes' : '') : `<em class="${delta > 10 ? 'is-up' : delta < -10 ? 'is-down' : ''}">${delta > 0 ? '+' : ''}${delta} %</em> vs media`}</small>
      </span>
    </button>`;
  }).join('') : '<p class="empty-note">Importa el extracto del banco del mes y verás aquí en qué se te va.</p>';
}

// Calendario del mes: cada día coloreado según lo gastado (de claro a oscuro).
function renderPersonalCalendar(month) {
  const [year, number] = month.split('-').map(Number);
  const daysInMonth = new Date(year, number, 0).getDate();
  const offset = (new Date(year, number - 1, 1).getDay() + 6) % 7;
  const totals = Array(daysInMonth + 1).fill(0);
  monthEntries(month).forEach((entry) => {
    const value = spendValue(entry);
    if (value > 0) totals[Number(String(entry.expense_date).slice(8, 10))] += value;
  });
  const values = totals.slice(1).filter((value) => value > 0).sort((first, second) => first - second);
  const quantile = (ratio) => values[Math.min(values.length - 1, Math.floor(values.length * ratio))] || 0;
  const thresholds = [quantile(0.2), quantile(0.4), quantile(0.6), quantile(0.8)];
  const level = (value) => (!value ? 0 : 1 + thresholds.filter((threshold) => value > threshold).length);
  const today = dateToISO(new Date());
  const head = ['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((day) => `<span class="cal-head">${day}</span>`).join('');
  const blanks = Array.from({ length: offset }, () => '<span class="cal-blank"></span>').join('');
  const cells = Array.from({ length: daysInMonth }, (_, index) => {
    const day = index + 1;
    const iso = `${month}-${String(day).padStart(2, '0')}`;
    const value = totals[day];
    return `<button type="button" class="cal-day lvl-${level(value)}${iso === today ? ' is-today' : ''}${personalView.day === iso ? ' is-active' : ''}" data-filter-day="${iso}" title="${escapeHtml(`${financeDate(iso)}: ${financeMoney(value)}`)}" aria-label="${escapeHtml(`${financeDate(iso)}: ${financeMoney(value)}`)}"><span>${day}</span></button>`;
  }).join('');
  const activeDays = values.length;
  document.querySelector('#personalCalendarHint').textContent = activeDays ? `${activeDays} ${activeDays === 1 ? 'día' : 'días'} con gastos` : '';
  document.querySelector('#personalCalendar').innerHTML = `${head}${blanks}${cells}<div class="cal-legend"><span>Menos</span>${[0, 1, 2, 3, 4, 5].map((lvl) => `<i class="lvl-${lvl}"></i>`).join('')}<span>Más</span></div>`;
  const weekdays = weekdayAverages(month);
  const max = Math.max(...weekdays, 1);
  const top = weekdays.indexOf(Math.max(...weekdays));
  document.querySelector('#personalWeekdays').innerHTML = weekdays.map((value, index) => `<div class="weekday${index === top && value ? ' is-top' : ''}" title="${escapeHtml(money0(value))} de media"><span class="weekday-value">${value ? money0(value) : ''}</span><span class="weekday-bar"><span style="height:${(value / max) * 100}%"></span></span><span class="weekday-name">${['L', 'M', 'X', 'J', 'V', 'S', 'D'][index]}</span></div>`).join('');
}

function renderPersonalRecurring(month) {
  const charges = recurringCharges(month);
  const total = charges.reduce((sum, charge) => sum + charge.amount, 0);
  document.querySelector('#personalRecurringTotal').textContent = charges.length ? `${money0(total)} al mes` : '';
  document.querySelector('#personalRecurring').innerHTML = charges.length
    ? `<p class="recurring-intro">Pagos que se repiten cada mes con un importe parecido. Revisa si sigues usando todas las suscripciones.</p>${charges.map((charge) => `<div class="recurring-row"><span class="pcat-icon"><i data-lucide="${categoryInfo(charge.category).icon}"></i></span><span class="recurring-copy"><strong>${escapeHtml(charge.name)}</strong><small>${escapeHtml(charge.category)} · ${charge.byMonth.size} de 4 meses · último ${financeDate(charge.last.expense_date)}</small></span><b>${financeMoney(charge.amount)}</b></div>`).join('')}`
    : '<p class="empty-note">Con dos o más meses importados detectaré tus pagos fijos y suscripciones.</p>';
}

function renderPersonalTop(month) {
  const places = new Map();
  monthEntries(month).forEach((entry) => {
    const value = spendValue(entry);
    if (value <= 0 || entry.kind === 'withdraw') return;
    const key = merchantKey(entryMerchant(entry));
    const place = places.get(key) || { name: entryMerchant(entry), amount: 0, count: 0, category: entry.category };
    place.amount += value;
    place.count += 1;
    places.set(key, place);
  });
  const top = [...places.values()].sort((first, second) => second.amount - first.amount).slice(0, 6);
  const max = top[0]?.amount || 1;
  document.querySelector('#personalTopHint').textContent = shortMonthLabel(month);
  document.querySelector('#personalTop').innerHTML = top.length
    ? top.map((place) => `<button type="button" class="top-row" data-search-merchant="${escapeHtml(place.name)}"><span class="top-name">${escapeHtml(place.name)}<small>${place.count} ${place.count === 1 ? 'vez' : 'veces'}${place.count > 1 ? ` · ${money0(place.amount / place.count)} de media` : ''}</small></span><span class="top-track"><span style="width:${Math.max(4, (place.amount / max) * 100)}%"></span></span><b>${financeMoney(place.amount)}</b></button>`).join('')
    : '<p class="empty-note">Aquí verás los sitios donde más gastas.</p>';
}

function movementRow(entry) {
  const income = isIncome(entry);
  const refund = isRefundEntry(entry);
  const kindLabel = KIND_LABELS[entry.kind] && KIND_LABELS[entry.kind] !== entry.category ? KIND_LABELS[entry.kind] : '';
  const meta = [entry.category, kindLabel, refund ? 'Devolución' : ''].filter(Boolean).join(' · ');
  return `<button type="button" class="move-row${entry.excluded ? ' is-excluded' : ''}" data-open-movement="${escapeHtml(entry.id)}">
    <span class="pcat-icon${income ? ' is-income' : ''}"><i data-lucide="${categoryInfo(entry.category).icon}"></i></span>
    <span class="move-copy"><strong>${escapeHtml(entryMerchant(entry))}${SOURCE_BADGES[entry.source] ? ` <em class="finance-item-source">${SOURCE_BADGES[entry.source]}</em>` : ''}</strong><small>${escapeHtml(meta)}${entry.excluded ? ' · <em>no cuenta</em>' : ''}</small></span>
    <b class="${income || refund ? 'is-plus' : ''}">${income || refund ? '+' : ''}${financeMoney(entry.amount)}</b>
  </button>`;
}

function renderPersonalList(month) {
  const query = normalizeText(personalView.search);
  const entries = monthEntries(month).filter((entry) => {
    if (personalView.incomeOnly && !isIncome(entry)) return false;
    if (personalView.category && entry.category !== personalView.category) return false;
    if (personalView.day && entry.expense_date !== personalView.day) return false;
    if (query && !normalizeText(`${entryMerchant(entry)} ${entry.description} ${entry.bank_description || ''} ${entry.category}`).includes(query)) return false;
    return true;
  }).sort((first, second) => String(second.expense_date).localeCompare(String(first.expense_date)) || Number(second.amount) - Number(first.amount));

  const filters = [personalView.category, personalView.day ? financeDate(personalView.day) : null, personalView.incomeOnly ? 'Ingresos' : null].filter(Boolean);
  document.querySelector('#personalListTitle').textContent = filters.length ? filters.join(' · ') : `Movimientos de ${shortMonthLabel(month)}`;
  document.querySelector('#personalCount').textContent = entries.length ? String(entries.length) : '';
  const usedCategories = [...new Set(monthEntries(month).map((entry) => entry.category))];
  document.querySelector('#personalFilterChips').innerHTML = [
    filters.length ? '<button type="button" class="filter-chip is-clear" data-clear-filters><i data-lucide="x"></i>Quitar filtros</button>' : '',
    `<button type="button" class="filter-chip${personalView.incomeOnly ? ' is-on' : ''}" data-filter-income><i data-lucide="arrow-down-left"></i>Ingresos</button>`,
    ...usedCategories.filter((name) => !INCOME_CATEGORIES.some((category) => category.name === name)).map((name) => `<button type="button" class="filter-chip${personalView.category === name ? ' is-on' : ''}" data-filter-category="${escapeHtml(name)}"><i data-lucide="${categoryInfo(name).icon}"></i>${escapeHtml(name)}</button>`)
  ].join('');

  const byDay = new Map();
  entries.forEach((entry) => byDay.set(entry.expense_date, [...(byDay.get(entry.expense_date) || []), entry]));
  document.querySelector('#personalList').innerHTML = entries.length
    ? [...byDay].map(([day, list]) => {
      const total = list.reduce((sum, entry) => sum + spendValue(entry), 0);
      return `<div class="move-day"><header><strong>${escapeHtml(capitalizeFirst(new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', month: 'short' }).format(new Date(`${day}T12:00:00`))))}</strong>${total > 0 ? `<span>${financeMoney(total)}</span>` : ''}</header>${list.map(movementRow).join('')}</div>`;
    }).join('')
    : `<p class="empty-note">${monthEntries(month).length ? 'Nada con estos filtros.' : 'Aún no hay movimientos este mes. Importa el extracto del banco.'}</p>`;
}

// ---------- Ficha de un movimiento, alta a mano y presupuestos ----------

const moneySheet = document.querySelector('#moneySheet');
let moneySheetState = null;

function showMoneySheet(html, state) {
  moneySheetState = state;
  document.querySelector('#moneySheetBody').innerHTML = html;
  moneySheet.classList.add('visible');
  if (history.state?.page !== 'money-sheet') history.pushState({ page: 'money-sheet' }, '', '#movimiento');
  lucide.createIcons();
}

function closeMoneySheet() {
  if (!moneySheet.classList.contains('visible')) return;
  if (history.state?.page === 'money-sheet') history.back();
  else hideMoneySheet();
}

function hideMoneySheet() {
  moneySheet.classList.remove('visible');
  moneySheetState = null;
}

const categoryChoices = (selected, direction = 'out') => `<div class="category-picker">${(direction === 'in' ? INCOME_CATEGORIES : PERSONAL_CATEGORIES).map((category) => `<label class="category-chip"><input type="radio" name="category" value="${escapeHtml(category.name)}" ${category.name === selected ? 'checked' : ''} /><span><i data-lucide="${category.icon}"></i>${escapeHtml(category.name)}</span></label>`).join('')}</div>`;

function openMovement(id) {
  const entry = personalExpenses.find((item) => item.id === id);
  if (!entry) return;
  const same = personalExpenses.filter((item) => merchantKey(entryMerchant(item)) === merchantKey(entryMerchant(entry)));
  const direction = isIncome(entry) ? 'in' : 'out';
  showMoneySheet(`
    <div class="item-hero"><span class="todo-icon is-large"><i data-lucide="${categoryInfo(entry.category).icon}"></i></span><div><p class="eyebrow muted">${escapeHtml(KIND_LABELS[entry.kind] || 'Movimiento')} · ${financeDate(entry.expense_date)}</p><h2 id="moneySheetTitle">${escapeHtml(entryMerchant(entry))}</h2></div></div>
    <p class="movement-amount ${direction === 'in' || isRefundEntry(entry) ? 'is-plus' : ''}">${direction === 'in' || isRefundEntry(entry) ? '+' : ''}${financeMoney(entry.amount)}</p>
    ${entry.bank_description ? `<p class="item-details movement-raw">${escapeHtml(entry.bank_description)}</p>` : ''}
    <form class="item-editor" data-movement-form="${escapeHtml(entry.id)}">
      <fieldset class="plant-field"><legend>Categoría</legend>${categoryChoices(entry.category, direction)}</fieldset>
      ${same.length > 1 ? `<label class="option-toggle"><input type="checkbox" name="applyAll" checked /><span><i data-lucide="wand-sparkles"></i>Aplicar a los ${same.length} movimientos de ${escapeHtml(entryMerchant(entry))} y a los próximos</span></label>` : `<label class="option-toggle"><input type="checkbox" name="applyAll" checked /><span><i data-lucide="wand-sparkles"></i>Recordarlo para la próxima vez</span></label>`}
      <label class="option-toggle"><input type="checkbox" name="excluded" ${entry.excluded ? 'checked' : ''} /><span><i data-lucide="eye-off"></i>No contar como gasto (traspaso, pago a ${escapeHtml(otherPerson(currentUser))}…)</span></label>
      <div class="plant-form-actions"><button type="submit" class="primary-button"><i data-lucide="check"></i> Guardar</button><button type="button" class="link-button is-danger" data-delete-movement="${escapeHtml(entry.id)}">Eliminar</button></div>
    </form>`, { kind: 'movement', id });
}

async function saveMovement(form) {
  const entry = personalExpenses.find((item) => item.id === form.dataset.movementForm);
  if (!entry) return;
  const values = new FormData(form);
  const category = values.get('category') || entry.category;
  const excluded = values.has('excluded');
  const applyAll = values.has('applyAll');
  const key = merchantKey(entryMerchant(entry));
  const targets = applyAll ? personalExpenses.filter((item) => merchantKey(entryMerchant(item)) === key && isIncome(item) === isIncome(entry)) : [entry];
  try {
    await personalStore.update(targets.map((item) => item.id), { category, excluded });
    targets.forEach((item) => Object.assign(item, { category, excluded }));
    if (applyAll) {
      const rule = { merchant_key: key, category, excluded };
      await rulesTable.save(rule);
      personalRules = [...personalRules.filter((item) => item.merchant_key !== key), rule];
    }
    closeMoneySheet();
    renderPersonal();
    showToast(targets.length > 1 ? `${targets.length} movimientos actualizados` : 'Movimiento actualizado');
  } catch (error) {
    showSupabaseError('No se pudo guardar', error);
  }
}

function openManualAdd() {
  showMoneySheet(`
    <div class="plant-add-heading"><p class="eyebrow muted">Mis gastos</p><h2 id="moneySheetTitle">Añadir a mano</h2></div>
    <form class="item-editor" data-manual-form>
      <div class="segmented is-wide" role="group" aria-label="Tipo"><button type="button" data-manual-direction="out" aria-pressed="true">Gasto</button><button type="button" data-manual-direction="in" aria-pressed="false">Ingreso</button></div>
      <input type="hidden" name="direction" value="out" />
      <label class="plant-field"><span>Concepto</span><input name="description" type="text" maxlength="160" required placeholder="Cena con amigas" /></label>
      <div class="detail-grid"><label class="plant-field"><span>Importe (€)</span><input name="amount" type="number" inputmode="decimal" min="0.01" step="0.01" required /></label><label class="plant-field"><span>Fecha</span><input name="date" type="date" required value="${dateToISO(new Date())}" /></label></div>
      <fieldset class="plant-field"><legend>Categoría</legend><div data-manual-categories>${categoryChoices('Otros')}</div></fieldset>
      <div class="plant-form-actions"><button type="submit" class="primary-button"><i data-lucide="plus"></i> Guardar</button></div>
    </form>`, { kind: 'manual' });
}

async function saveManual(form) {
  const values = new FormData(form);
  const direction = values.get('direction');
  const description = String(values.get('description')).trim().slice(0, 160);
  const row = {
    description,
    merchant: description.slice(0, 80),
    amount: Math.round(Number(values.get('amount')) * 100) / 100,
    category: values.get('category') || (direction === 'in' ? 'Otros ingresos' : 'Otros'),
    expense_date: values.get('date') || dateToISO(new Date()),
    source: 'manual',
    direction,
    kind: 'other'
  };
  if (!row.description || !(row.amount > 0)) return;
  try {
    const created = await personalStore.insert([row]);
    personalExpenses.unshift(...created.map((item) => ({ ...item, direction: item.direction || 'out' })));
    closeMoneySheet();
    renderPersonal();
    showToast('Guardado');
  } catch (error) {
    showSupabaseError('No se pudo guardar', error);
  }
}

function openBudgets() {
  const budgets = new Map(personalBudgets.map((budget) => [budget.category, Number(budget.amount)]));
  const { average } = averageCategories(financeMonth);
  showMoneySheet(`
    <div class="plant-add-heading"><p class="eyebrow muted">Mis gastos</p><h2 id="moneySheetTitle">Presupuestos del mes</h2></div>
    <p class="recurring-intro">Pon un límite mensual a las categorías que quieras vigilar. Al lado ves tu media de los últimos meses como referencia. Déjalo vacío para no tener límite.</p>
    <form class="item-editor budget-form" data-budget-form>
      ${PERSONAL_CATEGORIES.filter((category) => !['Transferencias', 'Efectivo'].includes(category.name)).map((category) => `<label class="budget-row"><span class="pcat-icon"><i data-lucide="${category.icon}"></i></span><span class="budget-name">${escapeHtml(category.name)}<small>${average.get(category.name) ? `Media ${money0(average.get(category.name))}` : 'Sin datos aún'}</small></span><span class="budget-input"><input type="number" inputmode="decimal" min="0" step="5" name="${escapeHtml(category.name)}" value="${budgets.get(category.name) || ''}" placeholder="—" aria-label="Presupuesto de ${escapeHtml(category.name)}" />€</span></label>`).join('')}
      <div class="plant-form-actions"><button type="submit" class="primary-button"><i data-lucide="check"></i> Guardar presupuestos</button></div>
    </form>`, { kind: 'budgets' });
}

async function saveBudgets(form) {
  const values = new FormData(form);
  try {
    for (const [category, raw] of values) {
      const amount = Number(raw);
      const existing = personalBudgets.find((budget) => budget.category === category);
      if (amount > 0) await budgetsTable.save({ category, amount });
      else if (existing) await budgetsTable.remove(category);
    }
    personalBudgets = await budgetsTable.list();
    closeMoneySheet();
    renderPersonal();
    showToast('Presupuestos guardados');
  } catch (error) {
    showSupabaseError('No se pudieron guardar los presupuestos', error);
  }
}

// ---------- Importar extracto ----------

function categorizeImported(item) {
  const rule = personalRules.find((entry) => entry.merchant_key === merchantKey(item.merchant));
  return {
    category: rule ? rule.category : guessBankCategory(item),
    excluded: rule ? Boolean(rule.excluded) : defaultExcluded(item, otherPerson(currentUser)),
    ruled: Boolean(rule)
  };
}

async function readBankFile(file) {
  await loadXlsx();
  // Los CSV como texto: si no, «02/09/2026» se leería como fecha americana.
  const workbook = /\.(csv|txt)$/i.test(file.name)
    ? XLSX.read(await file.text(), { type: 'string', raw: true })
    : XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true });
  for (const name of workbook.SheetNames) {
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[name], { header: 1, raw: true, defval: '' });
    const parsed = parseBankRows(rows);
    if (parsed.layout && parsed.items.length) return parsed;
  }
  throw new Error('No encuentro las columnas de fecha, descripción e importe. ¿Es el Excel de movimientos del banco?');
}

// Duplicados: misma referencia, o mismo día/importe/sentido que algo ya importado del banco
// o pagado con Apple Pay (±3 días).
function markDuplicates(items) {
  const known = new Set(personalExpenses.map((entry) => entry.source_reference).filter(Boolean));
  const bankPool = new Map();
  personalExpenses.filter((entry) => entry.source === 'bank').forEach((entry) => {
    const key = `${entry.expense_date}|${Number(entry.amount).toFixed(2)}|${entry.direction || 'out'}`;
    bankPool.set(key, (bankPool.get(key) || 0) + 1);
  });
  const applePay = personalExpenses.filter((entry) => entry.source === 'apple_pay').map((entry) => ({ entry, used: false }));
  items.forEach((item) => {
    if (known.has(item.reference)) { item.duplicate = 'ya importado'; return; }
    for (const date of [item.date, item.booked]) {
      const key = `${date}|${item.amount.toFixed(2)}|${item.direction}`;
      if (bankPool.get(key)) { bankPool.set(key, bankPool.get(key) - 1); item.duplicate = 'ya importado'; return; }
    }
    if (item.direction === 'out' && item.kind === 'card') {
      const match = applePay.find(({ entry, used }) => !used && Math.abs(Number(entry.amount) - item.amount) < 0.01 && Math.abs(new Date(`${entry.expense_date}T12:00:00`) - new Date(`${item.date}T12:00:00`)) <= 3 * 86400000);
      if (match) { match.used = true; item.duplicate = 'ya registrado con Apple Pay'; }
    }
  });
}

async function previewBankFile(file) {
  const output = document.querySelector('#personalImport');
  output.innerHTML = '<div class="money-card import-card"><p class="empty-note">Leyendo el extracto…</p></div>';
  try {
    const { layout, items } = await readBankFile(file);
    markDuplicates(items);
    items.forEach((item) => Object.assign(item, categorizeImported(item)));
    const fresh = items.filter((item) => !item.duplicate);
    pendingImport = { items: fresh, all: items, fileName: file.name, format: layout.credit >= 0 || layout.debit >= 0 ? 'cuenta' : 'tarjeta' };
    const dates = items.map((item) => item.date).sort();
    const out = fresh.filter((item) => item.direction === 'out' && !item.excluded);
    const income = fresh.filter((item) => item.direction === 'in' && item.kind !== 'card' && !item.excluded);
    const unknown = fresh.filter((item) => item.direction === 'out' && !item.excluded && ['Otros', 'Transferencias'].includes(item.category));
    const byCategory = new Map();
    out.forEach((item) => byCategory.set(item.category, (byCategory.get(item.category) || 0) + item.amount));
    const topCategories = [...byCategory].sort((first, second) => second[1] - first[1]).slice(0, 5);
    const duplicates = items.length - fresh.length;
    output.innerHTML = `<div class="money-card import-card">
      <div class="import-head"><span class="connect-icon is-bank"><i data-lucide="landmark"></i></span><div><strong>${escapeHtml(file.name)}</strong><small>Movimientos de ${pendingImport.format} · del ${financeDate(dates[0])} al ${financeDate(dates.at(-1))}</small></div></div>
      <div class="import-stats">
        <div><b>${out.length}</b><span>${out.length === 1 ? 'gasto' : 'gastos'} · ${money0(out.reduce((sum, item) => sum + item.amount, 0))}</span></div>
        <div><b>${income.length}</b><span>${income.length === 1 ? 'ingreso' : 'ingresos'} · ${money0(income.reduce((sum, item) => sum + item.amount, 0))}</span></div>
        <div><b>${duplicates}</b><span>ya estaban</span></div>
      </div>
      ${topCategories.length ? `<div class="import-cats">${topCategories.map(([name, amount]) => `<span><i data-lucide="${categoryInfo(name).icon}"></i>${escapeHtml(name)} <b>${money0(amount)}</b></span>`).join('')}</div>` : ''}
      ${fresh.some((item) => item.excluded) ? `<p class="recurring-intro"><i data-lucide="eye-off"></i> ${fresh.filter((item) => item.excluded).length === 1 ? '1 movimiento no contará' : `${fresh.filter((item) => item.excluded).length} movimientos no contarán`} como gasto (traspasos entre tus cuentas o pagos a ${escapeHtml(otherPerson(currentUser))}). Puedes cambiarlo luego.</p>` : ''}
      ${unknown.length ? `<p class="recurring-intro"><i data-lucide="help-circle"></i> ${(() => { const count = new Set(unknown.map((item) => merchantKey(item.merchant))).size; return count === 1 ? '1 comercio sin categoría clara: te lo enseño después' : `${count} comercios sin categoría clara: te los enseño después`; })()} para clasificarlos con un toque.</p>` : ''}
      <div class="plant-form-actions">${fresh.length ? `<button type="button" class="primary-button" data-confirm-import><i data-lucide="check"></i> Importar ${fresh.length} ${fresh.length === 1 ? 'movimiento' : 'movimientos'}</button>` : '<span class="empty-note">Todo este extracto ya estaba importado.</span>'}<button type="button" class="link-button" data-cancel-import>Cancelar</button></div>
    </div>`;
  } catch (error) {
    output.innerHTML = `<div class="money-card import-card"><p class="empty-note">${escapeHtml(error.message || 'No se pudo leer el archivo')}</p><button type="button" class="link-button" data-cancel-import>Cerrar</button></div>`;
  }
  lucide.createIcons();
  output.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function confirmImport() {
  if (!pendingImport) return;
  const button = document.querySelector('[data-confirm-import]');
  if (button) button.disabled = true;
  const rows = pendingImport.items.map((item) => ({
    description: item.merchant.slice(0, 160),
    merchant: item.merchant.slice(0, 80),
    bank_description: item.description.slice(0, 500),
    amount: item.amount,
    category: item.category,
    expense_date: item.date,
    source: 'bank',
    source_reference: item.reference,
    direction: item.direction,
    kind: item.kind,
    excluded: item.excluded
  }));
  try {
    const created = [];
    for (let index = 0; index < rows.length; index += 200) created.push(...await personalStore.insert(rows.slice(index, index + 200)));
    personalExpenses.unshift(...created.map((row) => ({ ...row, direction: row.direction || 'out', category: normalizeCategory(row.category) })));
    // Se muestra el mes con más movimientos del extracto.
    const months = new Map();
    pendingImport.items.forEach((item) => months.set(item.date.slice(0, 7), (months.get(item.date.slice(0, 7)) || 0) + 1));
    const busiest = [...months].sort((first, second) => second[1] - first[1])[0]?.[0];
    if (busiest && busiest <= dateToISO(new Date()).slice(0, 7)) financeMonth = busiest;
    showToast(`${created.length} movimientos importados`);
    pendingImport = null;
    renderFinance(financeCache);
    renderImportReview();
  } catch (error) {
    if (button) button.disabled = false;
    showSupabaseError('No se pudo importar', error);
  }
}

// Repaso tras importar: comercios sin categoría clara, con las categorías a un toque.
function renderImportReview() {
  const output = document.querySelector('#personalImport');
  const groups = new Map();
  personalExpenses.filter((entry) => expenseMonth(entry) === financeMonth && entry.direction === 'out' && !entry.excluded && ['Otros', 'Transferencias'].includes(entry.category)).forEach((entry) => {
    const key = merchantKey(entryMerchant(entry));
    if (personalRules.some((rule) => rule.merchant_key === key)) return;
    const group = groups.get(key) || { key, name: entryMerchant(entry), total: 0, count: 0, sample: entry };
    group.total += Number(entry.amount);
    group.count += 1;
    groups.set(key, group);
  });
  const list = [...groups.values()].sort((first, second) => second.total - first.total).slice(0, 12);
  if (!list.length) {
    output.innerHTML = '';
    return;
  }
  const quick = ['Supermercado', 'Comer fuera', 'Compras', 'Ocio', 'Transporte', 'Casa y facturas', 'Salud y cuidado', 'Regalos', 'Transferencias'];
  output.innerHTML = `<div class="money-card import-card review-card">
    <div class="finance-subheading"><strong>¿Qué es cada uno?</strong><span>${list.length} por clasificar</span></div>
    <p class="recurring-intro">Elige una categoría y lo recordaré para siempre. Si no es un gasto (por ejemplo, un pago a ${escapeHtml(otherPerson(currentUser))}), márcalo con «No cuenta».</p>
    ${list.map((group) => `<div class="review-row" data-review-key="${escapeHtml(group.key)}">
      <div class="review-head"><strong>${escapeHtml(group.name)}</strong><span>${group.count > 1 ? `${group.count} × · ` : ''}${financeMoney(group.total)}</span></div>
      ${group.sample.bank_description ? `<small class="review-raw">${escapeHtml(group.sample.bank_description.slice(0, 110))}</small>` : ''}
      <div class="review-chips">${quick.map((name) => `<button type="button" class="filter-chip" data-review-category="${escapeHtml(name)}"><i data-lucide="${categoryInfo(name).icon}"></i>${escapeHtml(name)}</button>`).join('')}<button type="button" class="filter-chip" data-review-exclude><i data-lucide="eye-off"></i>No cuenta</button></div>
    </div>`).join('')}
    <div class="plant-form-actions"><button type="button" class="link-button" data-cancel-import>Hecho por ahora</button></div>
  </div>`;
  lucide.createIcons();
}

async function applyReview(key, { category, excluded }) {
  const targets = personalExpenses.filter((entry) => merchantKey(entryMerchant(entry)) === key && entry.direction === 'out');
  const changes = excluded ? { excluded: true } : { category, excluded: false };
  try {
    await personalStore.update(targets.map((entry) => entry.id), changes);
    targets.forEach((entry) => Object.assign(entry, changes));
    const rule = { merchant_key: key, category: category || targets[0]?.category || 'Otros', excluded: Boolean(excluded) };
    await rulesTable.save(rule);
    personalRules = [...personalRules.filter((item) => item.merchant_key !== key), rule];
    renderPersonal();
    renderImportReview();
  } catch (error) {
    showSupabaseError('No se pudo guardar', error);
  }
}

// ---------- Atajo de Apple Pay ----------

function renderWalletSteps() {
  const url = `${(window.SUPABASE_CONFIG?.url || 'https://TU-PROYECTO.supabase.co').replace(/\/$/, '')}/functions/v1/wallet-ingest`;
  document.querySelector('#walletSteps').innerHTML = `
    <p>Si además quieres ver los pagos con el iPhone al momento (sin esperar al extracto), un Atajo los envía aquí. Al importar el extracto no se duplican.</p>
    <ol>
      <li>Abre <b>Atajos</b> → <b>Automatización</b> → <b>+</b> → <b>Wallet</b> (o «Transacción»).</li>
      <li>Elige tus tarjetas, marca <b>Ejecutar inmediatamente</b> y pulsa Siguiente.</li>
      <li>Crea un atajo con la acción <b>Obtener contenido de URL</b>:<div class="copy-field"><code>${escapeHtml(url)}</code><button type="button" class="link-button" data-copy="${escapeHtml(url)}">Copiar</button></div></li>
      <li>Método <b>POST</b>. En <b>Cabeceras</b> añade <code>x-sync-token</code> con vuestro SYNC_TOKEN.</li>
      <li>En <b>Cuerpo</b> elige <b>JSON</b>: <code>owner</code> = <b>${escapeHtml(currentUser)}</b>, <code>amount</code> = <b>Importe</b>, <code>merchant</code> = <b>Comerciante</b>.</li>
    </ol>`;
}

// ---------- Eventos ----------

document.querySelector('#personalPane').addEventListener('click', (event) => {
  const target = event.target;
  const category = target.closest('[data-filter-category]');
  if (category) {
    personalView.category = personalView.category === category.dataset.filterCategory ? null : category.dataset.filterCategory;
    personalView.incomeOnly = false;
    renderPersonal();
    if (!target.closest('#personalFilterChips')) document.querySelector('#personalMovements').scrollIntoView({ behavior: 'smooth', block: 'start' });
    return;
  }
  const day = target.closest('[data-filter-day]');
  if (day) {
    personalView.day = personalView.day === day.dataset.filterDay ? null : day.dataset.filterDay;
    renderPersonal();
    if (personalView.day) document.querySelector('#personalMovements').scrollIntoView({ behavior: 'smooth', block: 'start' });
    return;
  }
  if (target.closest('[data-filter-income]')) {
    personalView.incomeOnly = !personalView.incomeOnly;
    personalView.category = null;
    return renderPersonal();
  }
  if (target.closest('[data-clear-filters]')) {
    Object.assign(personalView, { category: null, day: null, search: '', incomeOnly: false });
    document.querySelector('#personalSearch').value = '';
    return renderPersonal();
  }
  const merchant = target.closest('[data-search-merchant]');
  if (merchant) {
    personalView.search = merchant.dataset.searchMerchant;
    document.querySelector('#personalSearch').value = personalView.search;
    renderPersonal();
    document.querySelector('#personalMovements').scrollIntoView({ behavior: 'smooth', block: 'start' });
    return;
  }
  const movement = target.closest('[data-open-movement]');
  if (movement) return openMovement(movement.dataset.openMovement);
  if (target.closest('#personalAddButton')) return openManualAdd();
  if (target.closest('#personalBudgetButton')) return openBudgets();
  if (target.closest('[data-confirm-import]')) return confirmImport();
  if (target.closest('[data-cancel-import]')) {
    pendingImport = null;
    document.querySelector('#personalImport').innerHTML = '';
    return;
  }
  const review = target.closest('[data-review-key]');
  if (review) {
    const chosen = target.closest('[data-review-category]');
    if (chosen) return applyReview(review.dataset.reviewKey, { category: chosen.dataset.reviewCategory });
    if (target.closest('[data-review-exclude]')) return applyReview(review.dataset.reviewKey, { excluded: true });
  }
});

document.querySelector('#personalSearch').addEventListener('input', (event) => {
  personalView.search = event.target.value;
  renderPersonalList(financeMonth);
  lucide.createIcons();
});

document.querySelector('#personalIncludeShare').addEventListener('change', (event) => {
  try { localStorage.setItem(personalShareKey, String(event.target.checked)); } catch {}
  renderPersonal();
});

document.querySelector('#bankImport').addEventListener('change', (event) => {
  const file = event.target.files?.[0];
  if (file) previewBankFile(file);
  event.target.value = '';
});

moneySheet.addEventListener('click', async (event) => {
  const target = event.target;
  if (target === moneySheet || target.closest('[data-close-money]')) return closeMoneySheet();
  const remove = target.closest('[data-delete-movement]');
  if (remove && window.confirm('¿Eliminar este movimiento?')) {
    try {
      await personalStore.remove(remove.dataset.deleteMovement);
      personalExpenses = personalExpenses.filter((entry) => entry.id !== remove.dataset.deleteMovement);
      closeMoneySheet();
      renderPersonal();
    } catch (error) {
      showSupabaseError('No se pudo eliminar', error);
    }
    return;
  }
  const direction = target.closest('[data-manual-direction]');
  if (direction) {
    const form = direction.closest('form');
    form.direction.value = direction.dataset.manualDirection;
    form.querySelectorAll('[data-manual-direction]').forEach((button) => button.setAttribute('aria-pressed', String(button === direction)));
    form.querySelector('[data-manual-categories]').innerHTML = categoryChoices(direction.dataset.manualDirection === 'in' ? 'Otros ingresos' : 'Otros', direction.dataset.manualDirection);
    lucide.createIcons();
  }
});

moneySheet.addEventListener('submit', (event) => {
  event.preventDefault();
  const form = event.target;
  if (form.dataset.movementForm) return saveMovement(form);
  if (form.hasAttribute('data-manual-form')) return saveManual(form);
  if (form.hasAttribute('data-budget-form')) return saveBudgets(form);
});

window.addEventListener('popstate', () => {
  if (history.state?.page !== 'money-sheet') hideMoneySheet();
});

document.addEventListener('DOMContentLoaded', () => {
  try { document.querySelector('#personalIncludeShare').checked = localStorage.getItem(personalShareKey) === 'true'; } catch {}
});

document.addEventListener('umbral:ready', () => {
  renderWalletSteps();
});
