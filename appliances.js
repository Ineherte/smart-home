// Lavadora: «la he puesto» y Umbral avisa cuando termina, aunque
// la app esté cerrada (lo hace notify-household cada minuto con pg_cron), con un consejo para
// secarla dentro de casa según el tiempo de Turín. Si la ropa sigue dentro, vuelve a avisar.
// En Inicio: los botones para ponerla y, mientras lava, una tarjeta con la cuenta atrás.
// Usa createHouseholdStore (store.js), currentUser, otherPerson, showToast… de app.js.
(function () {
  const store = createHouseholdStore({ table: 'appliance_runs', localKey: 'umbral-appliances' });
  const APPLIANCES = {
    lavadora: { label: 'Lavadora', emoji: '🧺', icon: 'washing-machine', done: '¡La lavadora ha terminado!', finish: 'Ya está tendida', programs: [['Rápido', 30], ['Delicado', 60], ['Mixto', 90], ['Algodón', 150], ['Eco', 180]] }
  };
  let runs = [];
  let tick = 0;
  let forecast = null;
  let forecastAt = 0;

  const active = () => runs.filter((run) => !run.finished_at);
  const minutesLeft = (run) => Math.ceil((new Date(run.ends_at) - Date.now()) / 60000);
  const clock = (iso) => new Date(iso).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  const durationText = (minutes) => (minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)} h${minutes % 60 ? ` ${minutes % 60}` : ''}`);
  const remember = (appliance, program, minutes) => { try { localStorage.setItem(`umbral-appliance-${appliance}`, JSON.stringify({ program, minutes })); } catch {} };
  const lastProgram = (appliance) => { try { return JSON.parse(localStorage.getItem(`umbral-appliance-${appliance}`) || 'null'); } catch { return null; } };

  // ---------- Consejo para secar dentro (el mismo que manda el aviso) ----------
  async function loadForecast() {
    if (forecast && Date.now() - forecastAt < 30 * 60000) return forecast;
    try {
      const url = 'https://api.open-meteo.com/v1/forecast?latitude=45.0703&longitude=7.6869&hourly=precipitation_probability,precipitation,temperature_2m,relative_humidity_2m&forecast_days=2&timezone=Europe%2FRome';
      const data = await (await fetch(url)).json();
      forecast = (data.hourly?.time || []).map((time, i) => ({ time, rain: Number(data.hourly.precipitation_probability?.[i] ?? 0), mm: Number(data.hourly.precipitation?.[i] ?? 0), temp: Number(data.hourly.temperature_2m?.[i] ?? 15), humidity: Number(data.hourly.relative_humidity_2m?.[i] ?? 60) }));
      forecastAt = Date.now();
    } catch {
      forecast = forecast || [];
    }
    return forecast;
  }
  function indoorDryingTip(hours) {
    if (!hours?.length) return '';
    const now = hours[0];
    const next = hours.slice(0, 6);
    const humidity = next.reduce((sum, hour) => sum + hour.humidity, 0) / next.length;
    const raining = next.slice(0, 3).some((hour) => hour.rain >= 50 || hour.mm >= 0.3);
    let dry = 8;
    if (humidity >= 80) dry += 5; else if (humidity >= 70) dry += 3; else if (humidity < 60) dry -= 2;
    if (now.temp < 12) dry += 2; else if (now.temp >= 20) dry -= 2;
    const when = ` Seca en unas ${Math.max(4, dry)} horas.`;
    if (raining) return `🌧️ Llueve fuera: ventanas cerradas, tendedero cerca de un radiador y la ropa bien separada.${when}`;
    if (humidity >= 75) return `💧 Mucha humedad (${Math.round(humidity)} %): ventila un rato o pon el deshumidificador.${when}`;
    if (now.temp < 12) return `🥶 Hace ${Math.round(now.temp)}° fuera: tendedero cerca del radiador (sin tocarlo) y ventila solo 10 minutos.${when}`;
    if (humidity < 60 && now.temp >= 18) return `☀️ Aire seco y ${Math.round(now.temp)}°: abre las ventanas un rato y se secará antes de lo normal.${when}`;
    return `🧺 Buen momento para secar dentro: ventila un poco y deja espacio entre prendas.${when}`;
  }
  // El tiempo a partir de la hora en que termina.
  const tipFor = (run) => {
    if (run.appliance !== 'lavadora' || !forecast?.length) return '';
    const endHour = new Date(run.ends_at);
    const key = `${dateToISO(endHour)}T${String(endHour.getHours()).padStart(2, '0')}:00`;
    const index = Math.max(0, forecast.findIndex((hour) => hour.time === key));
    return indoorDryingTip(forecast.slice(index));
  };

  // ---------- Datos ----------
  async function load() {
    try {
      const since = new Date(Date.now() - 24 * 3600000).toISOString();
      runs = (await store.list({ build: (query) => query.gte('created_at', since).order('created_at', { ascending: false }), filter: (run) => run.created_at >= since })) || [];
    } catch (error) {
      if (!/relation|does not exist|schema cache/i.test(error.message || '')) console.error('[Umbral] Lavadora:', error);
      runs = [];
    }
    if (active().some((run) => run.appliance === 'lavadora')) await loadForecast();
    render();
  }

  async function start(appliance, { program, minutes, notify = 'me' }) {
    const info = APPLIANCES[appliance];
    const already = active().find((run) => run.appliance === appliance);
    if (already) await store.update(already.id, { finished_at: new Date().toISOString() }).catch(() => {});
    const row = { appliance, program: program || null, minutes, notify, started_by: currentUser, ends_at: new Date(Date.now() + minutes * 60000).toISOString() };
    const [created] = await store.insert(row);
    runs = [created, ...runs.filter((run) => run.id !== already?.id)];
    remember(appliance, program, minutes);
    if (appliance === 'lavadora') await loadForecast();
    render();
    if (notify !== 'me') notifyHousehold(`${info.emoji} ${currentUser} ha puesto la ${info.label.toLowerCase()}`, `Termina a las ${clock(created.ends_at)}. ${notify === 'partner' ? 'Te avisaré a ti cuando acabe.' : 'Os aviso a los dos cuando acabe.'}`, { open: 'home', tag: `appliance-${created.id}` });
    askNotificationPermission();
    return created;
  }

  async function finish(id) {
    const run = runs.find((entry) => entry.id === id);
    if (!run) return;
    run.finished_at = new Date().toISOString();
    render();
    try { await store.update(id, { finished_at: run.finished_at }); } catch (error) { showSupabaseError('No se pudo guardar', error); }
  }

  // Sin avisos activados, al menos que el iPhone pueda mostrarlo con la app abierta.
  function askNotificationPermission() {
    if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission().catch(() => {});
  }

  // ---------- Inicio ----------
  const host = document.querySelector('#applianceStrip');
  function render() {
    if (!host) return;
    const running = active().sort((a, b) => new Date(a.ends_at) - new Date(b.ends_at));
    const busy = new Set(running.map((run) => run.appliance));
    const cards = running.map((run) => {
      const info = APPLIANCES[run.appliance] || APPLIANCES.lavadora;
      const left = minutesLeft(run);
      const done = left <= 0;
      const total = run.minutes || 60;
      const progress = Math.min(100, Math.max(2, ((total - Math.max(0, left)) / total) * 100));
      const tip = tipFor(run);
      const who = run.started_by && run.started_by !== currentUser ? ` · la puso ${escapeHtml(run.started_by)}` : '';
      return `<div class="appliance-card${done ? ' is-done' : ''}" data-appliance-run="${escapeHtml(run.id)}">
        <div class="appliance-top">
          <span class="appliance-icon${done ? '' : ' is-spinning'}"><i data-lucide="${info.icon}"></i></span>
          <div class="appliance-copy"><strong>${done ? escapeHtml(info.done) : `${escapeHtml(info.label)} en marcha`}</strong>
            <small>${done ? `Terminó a las ${clock(run.ends_at)}` : `${run.program ? `${escapeHtml(run.program)} · ` : ''}termina a las ${clock(run.ends_at)}`}${who}</small></div>
          <span class="appliance-left">${done ? '✓' : left >= 60 ? `${Math.floor(left / 60)} h ${left % 60}′` : `${left}′`}</span>
        </div>
        ${done ? '' : `<div class="appliance-track" aria-hidden="true"><span style="width:${progress}%"></span></div>`}
        ${tip ? `<p class="appliance-tip">${escapeHtml(tip)}</p>` : ''}
        <div class="appliance-actions">${done ? `<button type="button" class="primary-button" data-appliance-finish="${escapeHtml(run.id)}"><i data-lucide="check"></i> ${escapeHtml(info.finish)}</button>` : `<button type="button" class="link-button" data-appliance-cancel="${escapeHtml(run.id)}">Cancelar</button>`}</div>
      </div>`;
    }).join('');
    const buttons = Object.entries(APPLIANCES).filter(([id]) => !busy.has(id)).map(([id, info]) => `<button type="button" class="appliance-start" data-appliance-start="${id}"><span>${info.emoji}</span>Poner la ${escapeHtml(info.label.toLowerCase())}<small>te aviso al terminar</small></button>`).join('');
    host.innerHTML = `${cards}${buttons ? `<div class="appliance-starts" aria-label="Poner la lavadora">${buttons}</div>` : ''}`;
    lucide.createIcons();
    // Mientras haya algo en marcha, la cuenta atrás se actualiza cada 20 segundos.
    clearInterval(tick);
    if (running.length) tick = setInterval(checkDone, 20000);
  }

  // Con la app abierta: aviso en el momento en que termina (el push llega igualmente).
  const announced = new Set();
  function checkDone() {
    active().forEach((run) => {
      if (minutesLeft(run) > 0 || announced.has(run.id)) return;
      announced.add(run.id);
      const info = APPLIANCES[run.appliance] || APPLIANCES.lavadora;
      const tip = tipFor(run);
      const forMe = run.notify === 'both' || (run.notify === 'me' ? run.started_by === currentUser : run.started_by !== currentUser);
      if (!forMe) return;
      showToast(`${info.emoji} ${info.done}`, { duration: 8000 });
      window.umbralMobile?.tap?.();
      if (document.hidden && 'Notification' in window && Notification.permission === 'granted' && !(supabaseClient && authUserId)) {
        navigator.serviceWorker?.ready.then((registration) => registration.showNotification(`${info.emoji} ${info.done}`, { body: tip || '', tag: `appliance-${run.id}` })).catch(() => {});
      }
    });
    render();
  }

  // ---------- Ficha para ponerla ----------
  const sheet = document.querySelector('#applianceSheet');
  const body = document.querySelector('#applianceSheetBody');
  function openStart(appliance = 'lavadora') {
    const info = APPLIANCES[appliance];
    const last = lastProgram(appliance);
    const programs = info.programs;
    const selected = last && programs.some(([name, minutes]) => name === last.program && minutes === last.minutes) ? last.program : last ? 'Otro' : programs[2]?.[0] || programs[0][0];
    const partner = otherPerson(currentUser);
    body.innerHTML = `<div class="plant-add-heading"><p class="eyebrow muted">${info.emoji} ${escapeHtml(info.label)}</p><h2 id="applianceSheetTitle">¿Qué programa has puesto?</h2></div>
      <form class="item-editor" data-appliance-form="${appliance}">
        <div class="appliance-programs">${programs.map(([name, minutes]) => `<label class="appliance-program"><input type="radio" name="program" value="${escapeHtml(name)}" data-minutes="${minutes}" ${name === selected ? 'checked' : ''} /><span><b>${escapeHtml(name)}</b><small>${durationText(minutes)}</small></span></label>`).join('')}
          <label class="appliance-program"><input type="radio" name="program" value="Otro" ${selected === 'Otro' ? 'checked' : ''} /><span><b>Otro</b><small>tú dices</small></span></label></div>
        <label class="plant-field appliance-custom" ${selected === 'Otro' ? '' : 'hidden'}><span>Minutos</span><input type="number" name="minutes" inputmode="numeric" min="5" max="600" step="5" value="${last?.minutes || 90}" /></label>
        <fieldset class="plant-field"><legend>¿A quién aviso cuando acabe?</legend><div class="choice-row">
          <label class="option-toggle"><input type="radio" name="notify" value="me" checked /><span>A mí</span></label>
          <label class="option-toggle"><input type="radio" name="notify" value="partner" /><span>A ${escapeHtml(partner)}</span></label>
          <label class="option-toggle"><input type="radio" name="notify" value="both" /><span>A los dos</span></label>
        </div></fieldset>
        <p class="appliance-hint" data-appliance-end></p>
        <div class="plant-form-actions"><button type="submit" class="primary-button"><i data-lucide="play"></i> Empezar</button></div>
      </form>`;
    sheet.classList.add('visible');
    if (history.state?.page !== 'appliance') history.pushState({ page: 'appliance' }, '', '#lavadora');
    lucide.createIcons();
    updateEnd(body.querySelector('form'));
  }
  const formMinutes = (form) => {
    const checked = form.querySelector('input[name="program"]:checked');
    return checked?.dataset.minutes ? Number(checked.dataset.minutes) : Math.min(600, Math.max(5, Number(form.minutes.value) || 60));
  };
  function updateEnd(form) {
    const end = new Date(Date.now() + formMinutes(form) * 60000);
    form.querySelector('[data-appliance-end]').textContent = `Terminará a las ${end.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}.`;
  }
  function closeSheet() {
    if (!sheet.classList.contains('visible')) return;
    if (history.state?.page === 'appliance') history.back();
    else sheet.classList.remove('visible');
  }
  window.addEventListener('popstate', () => { if (history.state?.page !== 'appliance') sheet?.classList.remove('visible'); });

  sheet?.addEventListener('change', (event) => {
    const form = event.target.closest('[data-appliance-form]');
    if (!form) return;
    form.querySelector('.appliance-custom').hidden = form.querySelector('input[name="program"]:checked')?.value !== 'Otro';
    updateEnd(form);
  });
  sheet?.addEventListener('input', (event) => { const form = event.target.closest('[data-appliance-form]'); if (form) updateEnd(form); });
  sheet?.addEventListener('click', (event) => { if (event.target.closest('[data-close-appliance]')) closeSheet(); });
  sheet?.addEventListener('submit', async (event) => {
    const form = event.target.closest('[data-appliance-form]');
    if (!form) return;
    event.preventDefault();
    const appliance = form.dataset.applianceForm;
    const program = form.querySelector('input[name="program"]:checked')?.value || '';
    try {
      const run = await start(appliance, { program: program === 'Otro' ? '' : program, minutes: formMinutes(form), notify: form.notify.value });
      closeSheet();
      showToast(`${APPLIANCES[appliance].emoji} En marcha: te aviso a las ${clock(run.ends_at)}`);
    } catch (error) {
      showSupabaseError(/relation|does not exist|schema cache/i.test(error.message || '') ? 'Falta ejecutar appliances.sql en Supabase' : 'No se pudo poner en marcha', error);
    }
  });

  host?.addEventListener('click', async (event) => {
    const startButton = event.target.closest('[data-appliance-start]');
    if (startButton) return openStart(startButton.dataset.applianceStart);
    const done = event.target.closest('[data-appliance-finish]');
    if (done) { await finish(done.dataset.applianceFinish); return showToast('¡Hecho! 👏'); }
    const cancel = event.target.closest('[data-appliance-cancel]');
    if (cancel && window.confirm('¿Cancelar el aviso?')) await finish(cancel.dataset.applianceCancel);
  });

  document.addEventListener('umbral:ready', () => {
    load();
    store.subscribe(() => load());
  });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) checkDone(); });

  // ---------- Para el asistente ----------
  // «he puesto la lavadora (de 1 hora / programa rápido) y avisa a Matteo»
  function parseStart(text) {
    const low = normalizeText(text);
    const match = low.match(/\b(?:puesto|pongo|poner|encendido|enciendo|empezado|arrancado|pon)\s+(?:la\s+)?(lavadora)\b/) || low.match(/^(?:la\s+)?(lavadora)\s+(?:puesta|en marcha)\b/);
    if (!match) return null;
    const appliance = match[1];
    const info = APPLIANCES[appliance];
    let minutes = null;
    let program = '';
    const hours = low.match(/(\d+(?:[.,]\d+)?)\s*(?:h|horas?)\b(?:\s*(?:y\s*)?(\d{1,2})\s*(?:min|minutos)?)?/);
    const mins = low.match(/(\d{1,3})\s*(?:min|minutos)\b/);
    if (/hora y media/.test(low)) minutes = 90;
    else if (/media hora/.test(low)) minutes = 30;
    else if (/una hora/.test(low)) minutes = 60;
    else if (/dos horas/.test(low)) minutes = 120;
    else if (hours) minutes = Math.round(Number(hours[1].replace(',', '.')) * 60) + Number(hours[2] || 0);
    else if (mins) minutes = Number(mins[1]);
    const named = info.programs.find(([name]) => low.includes(normalizeText(name)));
    if (named) { program = named[0]; minutes = minutes || named[1]; }
    if (!minutes) {
      const last = lastProgram(appliance);
      minutes = last?.minutes || info.programs[2]?.[1] || info.programs[0][1];
      program = last?.program || (info.programs[2] || info.programs[0])[0];
    }
    const partner = normalizeText(otherPerson(currentUser));
    const notify = /\b(?:a los dos|a ambos|avisanos)\b/.test(low) ? 'both' : new RegExp(`\\b(?:avisa(?:le)?|dile)\\s+a\\s+${partner}\\b|\\bque\\s+${partner}\\s+la\\s+(?:tienda|saque)`).test(low) ? 'partner' : 'me';
    return { appliance, minutes: Math.min(600, Math.max(5, minutes)), program, notify };
  }

  window.umbralAppliances = {
    APPLIANCES, parseStart, start, finish, active, minutesLeft, clock,
    open: openStart,
    // «¿cuánto le queda a la lavadora?»
    status(applianceWord = '') {
      const list = active().filter((run) => !applianceWord || run.appliance === applianceWord);
      if (!list.length) return applianceWord ? `La ${APPLIANCES[applianceWord]?.label.toLowerCase() || applianceWord} no está en marcha.` : 'No hay nada en marcha.';
      return list.map((run) => {
        const info = APPLIANCES[run.appliance];
        const left = minutesLeft(run);
        return left > 0 ? `${info.label}: le quedan ${durationText(left)} (termina a las ${clock(run.ends_at)}).` : `${info.done.replace(/^¡|!$/g, '')} (a las ${clock(run.ends_at)}).`;
      }).join(' ');
    },
    tipFor
  };
})();
