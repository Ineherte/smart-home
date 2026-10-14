// Cuentas → Luz: vuestras facturas de Octopus (y TIM) leídas del PDF, para entender el
// consumo y ver dónde se puede ahorrar. Consumo por franjas F1/F2/F3, a dónde va cada euro,
// el precio de mercado (PUN), la potencia y consejos con vuestros números.
// También dice en qué franja estamos ahora (la lavadora lo usa: «mejor desde las 23:00»).
// Las facturas las guarda la función «bills» (del Gmail o subidas aquí); ver bills/LEEME.md.
(function () {
  const store = createHouseholdStore({ table: 'utility_bills', localKey: 'umbral-utility-bills' });
  let bills = [];
  let loaded = false;
  const money = (value) => (typeof financeMoney === 'function' ? financeMoney(value) : `${Number(value).toFixed(2)} €`);
  const cents = (value) => `${(value * 100).toFixed(1).replace('.', ',')} cént.`;
  const pct = (value) => `${Math.round(value * 100)} %`;
  const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  const monthShort = (iso) => (iso ? `${MONTHS[Number(iso.slice(5, 7)) - 1]} ${iso.slice(2, 4)}` : '');
  const monthLong = (iso) => (iso ? new Date(`${iso.slice(0, 7)}-15T12:00:00`).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }) : '');
  const luz = () => bills.filter((bill) => bill.provider === 'Octopus' && bill.kwh).sort((a, b) => String(a.period_start).localeCompare(String(b.period_start)));
  const latest = () => luz().at(-1) || null;
  const n = (value) => (value == null ? null : Number(value));

  // ---------- Franjas horarias (ARERA) ----------
  // F1: lunes a viernes de 8 a 19. F2: lunes a viernes de 7 a 8 y de 19 a 23, sábado de 7 a 23.
  // F3: noches (23-7), domingos y festivos.
  function easterMonday(year) {
    const a = year % 19, b = Math.floor(year / 100), c = year % 100, d = Math.floor(b / 4), e = b % 4;
    const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
    return dateToISO(new Date(year, month - 1, day + 1));
  }
  const isHoliday = (date) => {
    const md = `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    return ['01-01', '01-06', '04-25', '05-01', '06-02', '08-15', '11-01', '12-08', '12-25', '12-26'].includes(md) || dateToISO(date) === easterMonday(date.getFullYear());
  };
  function bandAt(date = new Date()) {
    const day = date.getDay();
    const hour = date.getHours();
    if (day === 0 || isHoliday(date) || hour >= 23 || hour < 7) return 'F3';
    if (day === 6) return 'F2';
    return hour >= 8 && hour < 19 ? 'F1' : 'F2';
  }
  // Precios de la última factura (si no hay: el orden de siempre, F3 la más barata).
  function prices() {
    const bill = latest();
    if (bill?.price_f1 && bill?.price_f2 && bill?.price_f3) return { F1: n(bill.price_f1), F2: n(bill.price_f2), F3: n(bill.price_f3), month: bill.period_start };
    return null;
  }
  const cheapestBand = () => { const p = prices(); return p ? ['F1', 'F2', 'F3'].sort((a, b) => p[a] - p[b])[0] : 'F3'; };
  // Cuándo empieza la siguiente franja más barata.
  function nextCheaper(from = new Date()) {
    const p = prices();
    const target = cheapestBand();
    const now = bandAt(from);
    if (now === target) return null;
    const probe = new Date(from);
    probe.setMinutes(0, 0, 0);
    for (let i = 0; i < 7 * 24; i += 1) {
      probe.setHours(probe.getHours() + 1);
      if (bandAt(probe) === target) return { band: target, at: new Date(probe), saving: p ? p[now] - p[target] : null };
    }
    return null;
  }
  function bandSummary(from = new Date()) {
    const p = prices();
    const now = bandAt(from);
    const next = nextCheaper(from);
    const rank = p ? ['F1', 'F2', 'F3'].sort((a, b) => p[a] - p[b]) : ['F3', 'F1', 'F2'];
    const label = rank[0] === now ? 'la más barata' : rank[2] === now ? 'la más cara' : 'precio medio';
    const when = next ? (dateToISO(next.at) === dateToISO(from) ? `a las ${next.at.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}` : `${next.at.toLocaleDateString('es-ES', { weekday: 'long' })} a las ${next.at.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`) : '';
    return { now, label, cheap: rank[0] === now, expensive: rank[2] === now, next, when, price: p?.[now] ?? null };
  }

  // ---------- Datos ----------
  async function load() {
    try {
      bills = (await store.list({ build: (query) => query.order('period_start', { ascending: true }) })) || [];
    } catch (error) {
      if (!/relation|does not exist|schema cache/i.test(error.message || '')) console.error('[Umbral] Luz:', error);
      bills = [];
    }
    loaded = true;
    render();
    window.dispatchEvent(new CustomEvent('umbral:energy'));
  }

  // Consumo mes a mes: el gráfico de 18 meses que trae cada factura (la más reciente manda) y,
  // encima, los datos de cada factura (que además tienen el importe).
  const prevMonth = (month) => { const d = new Date(`${month}-15T12:00:00`); d.setMonth(d.getMonth() - 1); return dateToISO(d).slice(0, 7); };
  function monthlySeries() {
    const months = new Map();
    luz().forEach((bill) => (bill.details?.history || []).forEach((entry) => months.set(entry.month, { month: entry.month, kwh: n(entry.kwh), f1: n(entry.f1), f2: n(entry.f2), f3: n(entry.f3), total: null })));
    luz().forEach((bill) => {
      const month = String(bill.period_start || '').slice(0, 7);
      if (!month) return;
      const before = months.get(month);
      months.set(month, { month, kwh: n(bill.kwh), f1: n(bill.kwh_f1) ?? before?.f1 ?? null, f2: n(bill.kwh_f2) ?? before?.f2 ?? null, f3: n(bill.kwh_f3) ?? before?.f3 ?? null, total: n(bill.total_amount) });
    });
    return [...months.values()].filter((entry) => entry.kwh).sort((a, b) => a.month.localeCompare(b.month));
  }

  // ---------- Consejos con vuestros números ----------
  function insights(bill, list) {
    const out = [];
    const kwh = n(bill.kwh);
    // Lo que no depende del consumo.
    const fixed = (n(bill.fixed_fee) || 0) + (n(bill.power_fee) || 0) + (n(bill.tv_fee) || 0);
    if (fixed && n(bill.total_amount)) out.push({ icon: 'lock', title: `${pct(fixed / n(bill.total_amount))} de la factura es fijo`, text: `${money(fixed)} al mes no dependen de lo que gastáis (cuota fija, potencia${n(bill.tv_fee) ? ' y canon RAI' : ''}). Con ${kwh} kWh, cada kWh os sale en realidad a ${money(n(bill.total_amount) / kwh)}.` });
    // Franjas: cuánto se ahorraría pasando la franja cara a la barata.
    const p = prices();
    if (p) {
      const rank = ['F1', 'F2', 'F3'].sort((a, b) => p[a] - p[b]);
      const dear = rank[2], cheap = rank[0];
      const dearKwh = n(bill[`kwh_${dear.toLowerCase()}`]) || 0;
      const save = dearKwh * (p[dear] - p[cheap]) * 0.5;
      out.push({ icon: 'clock', title: `${cheap} es la franja más barata, ${dear} la más cara`, text: `La diferencia es de ${cents(p[dear] - p[cheap])} por kWh. Pasando la mitad de lo de ${dear} (${Math.round(dearKwh)} kWh) a ${cheap} ahorraríais unos ${money(save)} al mes: poco, pero suma con lavadora, lavavajillas y horno.` });
    }
    // Potencia contratada frente a la máxima usada.
    const powers = (bill.details?.max_power || []).slice(-12).map((entry) => Number(entry.kw)).filter(Number.isFinite);
    if (n(bill.committed_kw) && powers.length >= 6) {
      const max = Math.max(...powers);
      const committed = n(bill.committed_kw);
      const perKw = n(bill.power_fee) && committed ? n(bill.power_fee) / committed : 1.98;
      if (committed - max >= 1) out.push({ icon: 'gauge', tone: 'good', title: `Podríais bajar la potencia a ${(max + 0.5).toFixed(1).replace('.', ',')} kW`, text: `En un año nunca habéis pasado de ${max} kW y pagáis ${committed.toString().replace('.', ',')} kW. Bajarla ahorraría unos ${money((committed - max - 0.5) * perKw * 12)} al año (se pide a Octopus).` });
      else out.push({ icon: 'gauge', title: 'La potencia está bien ajustada', text: `Contratados ${committed.toString().replace('.', ',')} kW y como mucho habéis usado ${max} kW en un año: bajarla haría saltar el contador.` });
    }
    // Canon RAI.
    if (n(bill.tv_fee)) out.push({ icon: 'tv', title: `Canon RAI: ${money(n(bill.tv_fee))} al mes`, text: 'Va en las facturas de enero a octubre (90 € al año). Si en casa no hay televisor, se puede pedir la exención a la Agenzia delle Entrate con la «dichiarazione sostitutiva» antes del 31 de enero.' });
    // Consumo frente a un hogar medio (unos 2.700 kWh al año en Italia).
    const annual = n(bill.annual_kwh);
    if (annual) {
      const diff = annual / 2700 - 1;
      out.push({ icon: diff < 0 ? 'leaf' : 'zap', tone: diff < 0 ? 'good' : 'warn', title: diff < 0 ? `Gastáis un ${pct(-diff)} menos que un hogar medio` : `Gastáis un ${pct(diff)} más que un hogar medio`, text: `${Math.round(annual)} kWh en el último año${n(bill.annual_cost) ? ` (${money(n(bill.annual_cost))})` : ''}; un hogar medio en Italia gasta unos 2.700 kWh.` });
    }
    // Precio de mercado (la tarifa Flex lo sigue cada mes).
    const pun = bill.details?.pun || [];
    if (pun.length >= 6) {
      const avg = (entry) => (entry.f1 + entry.f2 + entry.f3) / 3;
      const change = avg(pun.at(-1)) / avg(pun[0]) - 1;
      if (Math.abs(change) > 0.15) out.push({ icon: change > 0 ? 'trending-up' : 'trending-down', tone: change > 0 ? 'warn' : 'good', title: `El precio de mercado ha ${change > 0 ? 'subido' : 'bajado'} un ${pct(Math.abs(change))} en un año`, text: `${/flex/i.test(bill.offer || '') ? 'Vuestra tarifa (Flex) sigue ese precio cada mes' : 'Vuestra tarifa es variable'}. ${change > 0 ? 'Si sigue subiendo, comparad con una tarifa de precio fijo: con la variable cada subida llega a la factura.' : 'Con precio variable, os estáis beneficiando de la bajada.'}` });
    }
    // Frente al mismo mes del año pasado (del historial de las facturas).
    const series = monthlySeries();
    const thisMonth = String(bill.period_start || '').slice(0, 7);
    const lastYear = series.find((entry) => entry.month === `${Number(thisMonth.slice(0, 4)) - 1}${thisMonth.slice(4)}`);
    if (lastYear?.kwh && kwh) {
      const change = kwh / lastYear.kwh - 1;
      out.push({ icon: 'calendar-range', tone: change > 0.1 ? 'warn' : change < -0.1 ? 'good' : '', title: `${Math.abs(change) < 0.05 ? 'Igual que' : `${pct(Math.abs(change))} ${change > 0 ? 'más' : 'menos'} que`} hace un año`, text: `${Math.round(kwh)} kWh este ${monthLong(bill.period_start).split(' ')[0]} frente a ${Math.round(lastYear.kwh)} kWh el año pasado.` });
    }
    // Este mes frente al anterior.
    const previous = series.find((entry) => entry.month === prevMonth(thisMonth));
    if (previous?.kwh) {
      const change = kwh / previous.kwh - 1;
      if (Math.abs(change) >= 0.15) out.push({ icon: change > 0 ? 'arrow-up-right' : 'arrow-down-right', tone: change > 0 ? 'warn' : 'good', title: `${pct(Math.abs(change))} ${change > 0 ? 'más' : 'menos'} que el mes anterior`, text: `${Math.round(kwh)} kWh frente a ${Math.round(previous.kwh)} kWh en ${monthLong(previous.month)}.` });
    }
    return out;
  }

  // ---------- Pantalla ----------
  const pane = document.querySelector('#energyPane');
  function render() {
    if (!pane || !loaded) return;
    const list = luz();
    const bill = latest();
    const tim = bills.filter((entry) => entry.provider === 'TIM').sort((a, b) => String(b.issue_date || b.period_start).localeCompare(String(a.issue_date || a.period_start)));
    const band = bandSummary();
    const p = prices();
    const bandCard = `<section class="money-card energy-band is-${band.now.toLowerCase()}${band.cheap ? ' is-cheap' : band.expensive ? ' is-dear' : ''}">
      <div class="energy-band-now"><span class="energy-band-badge">${band.now}</span><div><strong>Ahora: ${band.label}</strong><small>${band.price ? `${cents(band.price)} el kWh` : 'Sube una factura para ver tus precios'}${band.next ? ` · ${band.next.band} ${band.when}` : ''}</small></div></div>
      ${dayStrip(p)}
      <p class="energy-band-tip">${band.cheap ? '👍 Buen momento para la lavadora, el horno o el lavavajillas.' : band.next ? `Si puede esperar, pon la lavadora ${band.when}${band.next.saving ? ` (${cents(band.next.saving)} menos por kWh)` : ''}.` : ''}</p>
    </section>`;
    if (!bill) {
      pane.innerHTML = `${bandCard}<section class="money-card energy-empty"><span class="energy-empty-icon"><i data-lucide="zap"></i></span><strong>Aquí verás vuestra luz mes a mes</strong><p>Las facturas de Octopus que lleguen a tu Gmail se guardan solas (ver <code>supabase/functions/bills/LEEME.md</code>). También puedes subir un PDF:</p>${uploadButton()}</section>${timSection(tim)}`;
      lucide.createIcons();
      return;
    }
    const total = n(bill.total_amount) || 0;
    // Frente al mes anterior: en euros si hay su factura; si no, en kWh (del historial).
    const before = monthlySeries().find((entry) => entry.month === prevMonth(String(bill.period_start || '').slice(0, 7)));
    const delta = before?.total ? total / before.total - 1 : null;
    const deltaKwh = !before?.total && before?.kwh ? n(bill.kwh) / before.kwh - 1 : null;
    const parts = [
      ['Energía', n(bill.energy_cost), 'var(--cat-1)'],
      ['Red y contador', n(bill.network_cost), 'var(--cat-3)'],
      ['Cargos del sistema', n(bill.system_charges), 'var(--cat-4)'],
      ['Impuestos e IVA', n(bill.taxes), 'var(--cat-7)'],
      ['Canon RAI', n(bill.tv_fee), 'var(--cat-5)']
    ].filter(([, value]) => value);
    const series = monthlySeries().slice(-12);
    const maxKwh = Math.max(...series.map((entry) => entry.kwh || 0), 1);
    const currentMonth = String(bill.period_start || '').slice(0, 7);
    pane.innerHTML = `
      <div class="energy-hero">
        <div><span>Última factura · ${escapeHtml(monthLong(bill.period_start))}</span><strong>${money(total)}</strong>
          <small>${Math.round(n(bill.kwh))} kWh${delta != null ? ` · <b class="${delta > 0 ? 'is-up' : 'is-down'}">${delta > 0 ? '↑' : '↓'} ${pct(Math.abs(delta))}</b> que el mes anterior` : deltaKwh != null ? ` · <b class="${deltaKwh > 0 ? 'is-up' : 'is-down'}">${deltaKwh > 0 ? '↑' : '↓'} ${pct(Math.abs(deltaKwh))}</b> de consumo que el mes anterior` : ''}${bill.due_date ? ` · se cobra el ${new Date(`${bill.due_date}T12:00:00`).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}` : ''}</small></div>
        <div class="energy-hero-side"><span>Al año</span><b>${n(bill.annual_cost) ? money(n(bill.annual_cost)) : '—'}</b><small>${n(bill.annual_kwh) ? `${Math.round(n(bill.annual_kwh))} kWh` : ''}</small></div>
      </div>
      ${bandCard}
      <section class="money-card"><div class="finance-subheading"><strong>Consumo por mes</strong><span>${series.length > 1 ? `${monthShort(series[0].month)} – ${monthShort(series.at(-1).month)}` : 'kWh por franja'}</span></div>
        <div class="energy-bars">${series.map((entry) => {
          const height = (entry.kwh / maxKwh) * 100;
          const split = entry.f1 != null && entry.f2 != null && entry.f3 != null;
          const stack = split ? ['f3', 'f2', 'f1'].map((key) => (entry[key] ? `<i class="is-${key}" style="flex:${entry[key]}"></i>` : '')).join('') : '<i class="is-total" style="flex:1"></i>';
          const detail = `${capitalizeFirst(monthLong(entry.month))}: ${Math.round(entry.kwh)} kWh${split ? ` (F1 ${entry.f1}, F2 ${entry.f2}, F3 ${entry.f3})` : ''}${entry.total ? `, ${money(entry.total)}` : ''}`;
          return `<div class="energy-bar${entry.month === currentMonth ? ' is-current' : ''}" title="${escapeHtml(detail)}" aria-label="${escapeHtml(detail)}"><b>${Math.round(entry.kwh)}</b><span class="energy-bar-stack" style="height:${Math.max(4, height)}%">${stack}</span><small>${MONTHS[Number(entry.month.slice(5, 7)) - 1] || ''}</small></div>`;
        }).join('')}</div>
        <div class="energy-legend"><span><i class="is-f1"></i>F1 · día laborable</span><span><i class="is-f2"></i>F2 · tardes y sábado</span><span><i class="is-f3"></i>F3 · noche y domingo</span></div>
        ${series.length < 3 ? '<p class="energy-note">Con más facturas verás la evolución: el script de Gmail puede traer las de los últimos 2 años («importarHistorial»).</p>' : series.some((entry) => entry.f1 == null) ? '<p class="energy-note">Las barras grises son meses sin el reparto por franjas.</p>' : ''}
      </section>
      <section class="money-card"><div class="finance-subheading"><strong>A dónde va cada euro</strong><span>${escapeHtml(monthLong(bill.period_start))}</span></div>
        <div class="category-stack" aria-hidden="true">${parts.map(([name, value, color]) => `<span style="flex:${value};background:${color}" title="${escapeHtml(name)}"></span>`).join('')}</div>
        <div class="category-rows">${parts.map(([name, value, color]) => `<div class="category-row"><i class="category-dot" style="background:${color}"></i><span class="category-name">${escapeHtml(name)}</span><span class="category-share">${pct(value / total)}</span><b>${money(value)}</b></div>`).join('')}</div>
        ${p ? `<div class="energy-prices">${['F1', 'F2', 'F3'].map((key) => `<div class="is-${key.toLowerCase()}"><small>${key}</small><b>${cents(p[key])}</b><span>${Math.round(n(bill[`kwh_${key.toLowerCase()}`]) || 0)} kWh</span></div>`).join('')}</div>` : ''}
      </section>
      ${punChart(bill)}
      <section class="money-card"><div class="finance-subheading"><strong>Cómo mejorar</strong><span>con vuestros números</span></div>
        <div class="insight-list">${insights(bill, list).map((item) => `<div class="insight${item.tone ? ` is-${item.tone}` : ''}"><span class="insight-icon"><i data-lucide="${item.icon}"></i></span><span><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.text)}</small></span></div>`).join('')}</div>
      </section>
      <section class="money-card"><div class="finance-subheading"><strong>Facturas de la luz</strong><span>${list.length}</span></div>
        ${[...list].reverse().map((entry) => billRow(entry)).join('')}
        <div class="energy-actions">${uploadButton()}${supabaseClient && authUserId ? '<button type="button" class="link-button" data-energy-reparse><i data-lucide="refresh-cw"></i> Volver a leer las facturas</button>' : ''}</div>
      </section>
      ${timSection(tim)}
      <p class="notes-local-warning"><i data-lucide="info"></i> ${escapeHtml(bill.offer || 'Octopus')} · ${escapeHtml(bill.tariff_type || '')} · potencia ${String(n(bill.committed_kw) || '').replace('.', ',')} kW. Los PDF están en Documentos → Facturas.</p>`;
    lucide.createIcons();
  }

  // La barra de hoy, hora a hora, coloreada por franja.
  function dayStrip(p) {
    const today = new Date();
    const hours = Array.from({ length: 24 }, (_, hour) => { const d = new Date(today); d.setHours(hour, 0, 0, 0); return bandAt(d); });
    const nowPct = ((today.getHours() * 60 + today.getMinutes()) / 1440) * 100;
    return `<div class="energy-day" aria-hidden="true">${hours.map((band) => `<i class="is-${band.toLowerCase()}"></i>`).join('')}<span class="energy-day-now" style="left:${nowPct}%"></span></div><div class="energy-day-labels"><span>0 h</span><span>7</span><span>12</span><span>19</span><span>23</span></div>`;
  }

  function punChart(bill) {
    const pun = bill.details?.pun || [];
    if (pun.length < 3) return '';
    const values = pun.flatMap((entry) => [entry.f1, entry.f2, entry.f3]);
    const max = Math.max(...values);
    const min = Math.min(...values) * 0.85;
    const x = (i) => (i / (pun.length - 1)) * 100;
    const y = (value) => 100 - ((value - min) / (max - min)) * 100;
    const path = (key) => pun.map((entry, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(entry[key]).toFixed(1)}`).join(' ');
    return `<section class="money-card"><div class="finance-subheading"><strong>Precio de mercado (PUN)</strong><span>céntimos por kWh</span></div>
      <svg class="energy-pun" viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label="PUN de los últimos ${pun.length} meses">${['f3', 'f1', 'f2'].map((key) => `<path class="is-${key}" d="${path(key)}" vector-effect="non-scaling-stroke" />`).join('')}</svg>
      <div class="energy-pun-labels"><span>${monthShort(pun[0].month)} · ${pun[0].f1.toFixed(1).replace('.', ',')}</span><span>${monthShort(pun.at(-1).month)} · ${pun.at(-1).f1.toFixed(1).replace('.', ',')}</span></div>
      <p class="energy-note">Es el precio al que se compra la luz en el mercado; vuestra tarifa ${/flex/i.test(bill.offer || '') ? 'lo sigue cada mes (más un pequeño margen)' : 'depende de él'}.</p>
    </section>`;
  }

  const billRow = (entry) => `<button type="button" class="move-row" data-energy-doc="${escapeHtml(entry.document_id || '')}">
      <span class="pcat-icon is-tinted" style="--tint:var(--cat-4)"><i data-lucide="${entry.provider === 'TIM' ? 'wifi' : 'zap'}"></i></span>
      <span class="move-copy"><strong>${escapeHtml(capitalizeFirst(monthLong(entry.period_start || entry.issue_date)))}</strong><small>${escapeHtml([entry.kwh ? `${Math.round(n(entry.kwh))} kWh` : '', entry.due_date ? `cobro ${new Date(`${entry.due_date}T12:00:00`).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}` : '', entry.source === 'email' ? 'del correo' : ''].filter(Boolean).join(' · '))}</small></span>
      <b>${entry.total_amount ? money(n(entry.total_amount)) : '—'}</b>
    </button>`;
  const timSection = (tim) => (tim.length ? `<section class="money-card"><div class="finance-subheading"><strong>Teléfono e internet (TIM)</strong><span>${tim.length}</span></div>${tim.slice(0, 12).map(billRow).join('')}</section>` : '');
  const uploadButton = () => `<label class="pill-button energy-upload"><i data-lucide="upload"></i> Añadir factura (PDF)<input type="file" accept="application/pdf" data-energy-upload hidden /></label>`;

  // ---------- Subir una factura ----------
  async function uploadBill(file) {
    if (!(supabaseClient && authUserId)) return showToast('Para leer facturas hace falta tener la sesión iniciada');
    if (!window.umbralDocuments?.upload) return showToast('Documentos no está listo');
    showToast('Leyendo la factura…', { duration: 10000 });
    try {
      const doc = await window.umbralDocuments.upload(file, { title: file.name.replace(/\.pdf$/i, ''), category: 'Facturas', person: 'both', scope: 'shared' });
      const { data, error } = await supabaseClient.functions.invoke('bills', { body: { document_id: doc.id } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      await load();
      window.umbralDocuments.reload?.();
      showToast(data?.skipped ? data.reason : `Factura leída: ${data.title}${data.missing?.length ? ' (faltan algunos datos)' : ''}`);
    } catch (error) {
      showSupabaseError('No se pudo leer la factura', error);
    }
  }

  pane?.addEventListener('change', (event) => {
    const input = event.target.closest('[data-energy-upload]');
    if (input?.files[0]) uploadBill(input.files[0]);
    if (input) input.value = '';
  });
  async function reparse(button) {
    button.disabled = true;
    button.textContent = 'Leyendo…';
    try {
      const { data, error } = await supabaseClient.functions.invoke('bills', { body: { reparse: true } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      await load();
      showToast(`${data.updated} ${data.updated === 1 ? 'factura leída' : 'facturas leídas'} de nuevo${data.failed?.length ? ` · ${data.failed.length} no se pudieron` : ''}`);
    } catch (error) {
      button.disabled = false;
      showSupabaseError('No se pudieron volver a leer', error);
    }
  }

  pane?.addEventListener('click', (event) => {
    const again = event.target.closest('[data-energy-reparse]');
    if (again) return reparse(again);
    const row = event.target.closest('[data-energy-doc]');
    if (row?.dataset.energyDoc) window.umbralDocuments?.openById?.(row.dataset.energyDoc);
  });

  document.addEventListener('umbral:ready', () => {
    load();
    store.subscribe(() => load());
  });
  // La franja cambia con la hora.
  setInterval(() => { if (!document.hidden) { render(); window.dispatchEvent(new CustomEvent('umbral:energy')); } }, 5 * 60 * 1000);

  window.umbralEnergy = { bandAt, bandSummary, prices, nextCheaper, render, reload: load, bills: () => bills };
})();
