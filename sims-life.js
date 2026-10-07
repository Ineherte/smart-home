// Vida en la casa del modo Sims: lo que hace que cada vez que entráis pase algo.
// - Sucesos: un paquete en la puerta, una visita, un apagón, un grifo que gotea, el gato del
//   vecino… Llegan cada pocos minutos de juego con una tarjeta y dos o tres opciones, y lo que
//   elijáis cambia necesidades, monedas, habilidades o la relación.
// - Aspiraciones: metas largas con tres niveles (bronce, plata y oro). Al llegar a cada nivel hay
//   premio y, con el oro, un título que sale junto a vuestro nombre.
// - Diario: lo que os ha pasado (deseos, niveles, viajes, sucesos y aspiraciones).
// Usa lo de sims.js (getLife, addCoins, sims, simBubble…) y avatars.js (boostNeeds). Se guarda
// en look.stats, look.aspire y look.diary, junto con lo demás de la vida en el juego.
(function () {
  const $house = () => document.querySelector('#simsHouse');
  const day = (ms = Date.now()) => new Date(ms).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
  const hourText = (ms) => new Date(ms).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  const partnerName = () => otherPerson(myAvatarPerson()) || 'tu pareja';
  const ready = () => Boolean(myAvatarPerson() && avatarRows[myAvatarPerson()]);

  // ---------- Contadores, diario y su guardado ----------
  function lifeData() {
    const life = getLife();
    if (!life.stats) {
      const look = avatarRows[myAvatarPerson()]?.look || {};
      life.stats = { ...(look.stats || {}) };
      life.aspire = { ...(look.aspire || {}) };
      life.diary = Array.isArray(look.diary) ? [...look.diary] : [];
    }
    return life;
  }
  function stat(kind, amount = 1) {
    if (!ready()) return;
    const life = lifeData();
    life.stats[kind] = (life.stats[kind] || 0) + amount;
    saveLife();
    checkAspirations();
  }
  function diary(emoji, text) {
    if (!ready()) return;
    const life = lifeData();
    life.diary.unshift({ at: Date.now(), emoji, text: String(text).slice(0, 90) });
    life.diary = life.diary.slice(0, 30);
    saveLife();
  }

  // ---------- Aspiraciones ----------
  const TIERS = [['bronze', 'Bronce', '🥉', 50], ['silver', 'Plata', '🥈', 150], ['gold', 'Oro', '🥇', 400]];
  const ASPIRATIONS = {
    chef: { emoji: '🍳', name: 'Chef de la casa', title: 'Chef de Turín', hint: 'Sube la habilidad de cocina', goals: [2, 5, 8], unit: 'niveles', value: (life) => skillLevel(life.skills.cooking) },
    romance: { emoji: '💞', name: 'Alma gemela', title: 'Alma gemela', hint: () => `Momentos románticos con ${partnerName()}`, goals: [5, 20, 50], unit: 'momentos', value: (life) => life.stats.love || 0 },
    traveler: { emoji: '✈️', name: 'Trotamundos', title: 'Trotamundos', hint: 'Excursiones a Turín, Chieti y España', goals: [2, 6, 15], unit: 'viajes', value: (life) => life.stats.trips || 0 },
    home: { emoji: '🏡', name: 'Casa de revista', title: 'Interiorista', hint: 'Muebles de la tienda', goals: [1, 3, 6], unit: 'muebles', value: () => (simsWorld.getDecor().items || []).length },
    dreamer: { emoji: '⭐', name: 'Cumplir deseos', title: 'Soñador', hint: 'Deseos de hoy cumplidos', goals: [5, 20, 60], unit: 'deseos', value: (life) => life.stats.wants || 0 },
    real: { emoji: '✅', name: 'Vida en orden', title: 'Casa en orden', hint: 'Tareas, riego, menú y fotos de verdad', goals: [5, 25, 80], unit: 'cosas', value: (life) => life.stats.real || 0 },
    artist: { emoji: '🎨', name: 'Alma creativa', title: 'Artista', hint: 'Creatividad y música (suma de niveles)', goals: [2, 6, 12], unit: 'niveles', value: (life) => skillLevel(life.skills.creativity) + skillLevel(life.skills.music) },
    host: { emoji: '🎉', name: 'Buenos anfitriones', title: 'Anfitriones', hint: 'Sucesos de casa resueltos', goals: [3, 12, 35], unit: 'sucesos', value: (life) => life.stats.events || 0 }
  };
  const tierOf = (id, life) => TIERS.filter((tier, i) => ASPIRATIONS[id].value(life) >= ASPIRATIONS[id].goals[i]).length;
  function checkAspirations() {
    if (!ready()) return;
    const life = lifeData();
    Object.keys(ASPIRATIONS).forEach((id) => {
      const reached = tierOf(id, life);
      const claimed = life.aspire[id] || 0;
      if (reached <= claimed) return;
      life.aspire[id] = reached;
      const [, tierName, medal, coins] = TIERS[reached - 1];
      const aspiration = ASPIRATIONS[id];
      addCoins(coins, simsState.open ? sims[meKey()] : null);
      diary(medal, `${aspiration.name}: ${tierName}`);
      celebrate(`${medal} ${aspiration.emoji} ${aspiration.name}`, reached === 3 ? `¡Oro! Ahora sois «${aspiration.title}» · +§${coins}` : `Nivel ${tierName} · +§${coins}`);
      saveLife();
    });
  }
  // El mejor título conseguido (el último oro).
  function bestTitle() {
    if (!ready()) return '';
    const life = lifeData();
    const gold = Object.keys(ASPIRATIONS).filter((id) => (life.aspire[id] || 0) >= 3);
    return gold.length ? `${ASPIRATIONS[gold[gold.length - 1]].emoji} ${ASPIRATIONS[gold[gold.length - 1]].title}` : '';
  }
  function celebrate(title, text) {
    const house = $house();
    if (!simsState.open || !house) return showToast(`🏆 ${title}. ${text}`);
    house.querySelector('.sims-banner')?.remove();
    const banner = document.createElement('div');
    banner.className = 'sims-banner';
    banner.innerHTML = `<b>🏆 ¡Aspiración conseguida!</b><strong>${escapeHtml(title)}</strong><span>${escapeHtml(text)}</span>`;
    house.appendChild(banner);
    simTune([523, 659, 784, 1047, 1319, 1568], 110, 'triangle');
    const me = sims[meKey()];
    if (me) world()?.emit('sparkle', me.x, me.headY, { count: 24, spread: 40, vy: -22 });
    setTimeout(() => banner.classList.add('is-out'), 3600);
    setTimeout(() => banner.remove(), 4200);
  }

  // ---------- Tarjeta de metas: aspiraciones y diario ----------
  let goalsTab = 'aspire';
  function goalsCard() {
    if (!ready()) return showToast('Espera un momento: tu muñeco aún se está cargando');
    const life = lifeData();
    const aspire = Object.entries(ASPIRATIONS).map(([id, a]) => {
      const tier = life.aspire[id] || 0;
      const value = a.value(life);
      const next = a.goals[Math.min(tier, 2)];
      const prev = tier ? a.goals[tier - 1] : 0;
      const ratio = tier >= 3 ? 1 : Math.max(0, Math.min(1, (value - prev) / (next - prev)));
      const hint = typeof a.hint === 'function' ? a.hint() : a.hint;
      return `<li class="sims-aspire${tier >= 3 ? ' is-gold' : ''}"><span class="sims-aspire-emoji">${a.emoji}</span><div><p><strong>${escapeHtml(a.name)}</strong><em>${TIERS.map(([, name, medal], i) => `<i class="${i < tier ? 'is-on' : ''}" title="${name}">${medal}</i>`).join('')}</em></p><small>${escapeHtml(hint)}</small><span class="sims-aspire-bar"><b style="width:${Math.round(ratio * 100)}%"></b></span><small class="sims-aspire-count">${tier >= 3 ? `Título: ${escapeHtml(a.title)}` : `${Math.min(value, next)} / ${next} ${a.unit} · premio §${TIERS[tier][3]}`}</small></div></li>`;
    }).join('');
    const entries = life.diary.length ? life.diary.map((entry, i) => {
      const header = i === 0 || day(entry.at) !== day(life.diary[i - 1].at) ? `<li class="sims-diary-day">${escapeHtml(day(entry.at))}</li>` : '';
      return `${header}<li><span>${escapeHtml(entry.emoji)}</span><p>${escapeHtml(entry.text)}</p><time>${hourText(entry.at)}</time></li>`;
    }).join('') : '<li class="sims-diary-empty">Aquí irá lo que os pase en casa: deseos, niveles, viajes y sucesos.</li>';
    const card = showSimsCard('is-goals', `<h3>🏆 Vuestra vida</h3>
      <div class="sims-goals-tabs" role="tablist"><button type="button" data-goals-tab="aspire" aria-selected="${goalsTab === 'aspire'}">Aspiraciones</button><button type="button" data-goals-tab="diary" aria-selected="${goalsTab === 'diary'}">Diario</button></div>
      ${goalsTab === 'aspire' ? `<ul class="sims-aspire-list">${aspire}</ul>` : `<ul class="sims-diary">${entries}</ul>`}`);
    card.addEventListener('click', (event) => {
      const tab = event.target.closest('[data-goals-tab]');
      if (tab) { goalsTab = tab.dataset.goalsTab; goalsCard(); }
    });
  }

  // ---------- Sucesos ----------
  const DOOR = { x: 458, y: 368 };
  const event = { active: null, nextAt: 0, openedAt: 0 };
  const needsOf = () => currentNeeds(avatarRows[myAvatarPerson()]);
  const isRainy = () => { const code = Number(window.umbralWeather?.code); return (code >= 51 && code <= 67) || (code >= 80 && code <= 82) || code >= 95; };
  const hour = () => new Date().getHours();
  function setProps(list) {
    const w = world();
    if (w) w.state.eventProps = list;
  }
  function addProp(prop) {
    const w = world();
    if (w) w.state.eventProps = [...(w.state.eventProps || []), prop];
  }
  // Una visita que entra por la puerta de casa (con los muñecos de la gente de la calle).
  function visitor(sprite, name, lines, voice) {
    simsWorld.loadSheet(sprite);
    const npc = Object.assign(newSim(sprite, DOOR.x, DOOR.y), { npc: true, sprite, name, scale: 1, height: 48, def: { id: sprite, name, home: { x: 420, y: 330 }, voice, lines } });
    simsState.npcs.push(npc);
    syncActors();
    npcWalk(npc, simsWorld.nearestFree(420, 330));
    return npc;
  }
  async function sendAway(npc) {
    if (!npc || !simsState.npcs.includes(npc)) return;
    npc.def = { ...npc.def, home: DOOR, lines: [] };
    await npcWalk(npc, DOOR);
    simsState.npcs = simsState.npcs.filter((other) => other !== npc);
    syncActors();
  }
  const me = () => sims[meKey()];
  const partner = () => sims[partnerKeyOf()];
  // Quien elige (A) y el otro (B): en el móvil de quien no eligió, se ven al revés.
  const A = (ctx) => (ctx?.remoteChoice ? partner() : me());
  const B = (ctx) => (ctx?.remoteChoice ? me() : partner());
  const say = (sim, text, secs = 2.8) => { if (sim) simBubble(sim, text, { secs }); };
  // Tu muñeco va hasta donde pasa la cosa (la puerta, el fregadero, la ventana) antes del resultado.
  async function goTo(x, y, sim = me()) {
    if (!sim) return;
    hidePie();
    await npcWalk(sim, simsWorld.nearestFree(x, y));
  }
  async function needs(delta) {
    await boostNeeds(delta).catch(() => {});
    renderSimsNeeds();
  }
  // Prueba de habilidad: cuanto más nivel, más fácil que salga bien.
  const skillCheck = (skill, base = 0.35) => Math.random() < Math.min(0.95, base + skillLevel(getLife().skills[skill]) * 0.08);

  const EVENTS = {
    parcel: {
      emoji: '📦', title: 'Llaman a la puerta',
      text: () => 'Es el repartidor con un paquete para vosotros. ¿Quién lo abre?',
      start: (ctx) => { ctx.npc = visitor('ped-b', 'El repartidor', ['¡Un paquete para ustedes!', 'Firme aquí, por favor'], 'it-m'); setTimeout(() => npcSay(ctx.npc, 'Pacco per voi! 📦', { force: true }), 2600); addProp({ kind: 'parcel', x: 440, y: 352 }); },
      choices: [
        { label: '📦 Abrirlo yo', run: async (ctx) => { await goTo(436, 340, A(ctx)); setProps([]); const coins = pickOne([40, 60, 80, 120]); addCoins(coins); say(A(ctx), pickOne(['¡Unos cupones! 🎟️', '¡Un regalo de mamá! 💝', '¡Lo que pedimos! 🎉']) + ` +§${coins}`); needs({ fun: 15 }); return `Abriste un paquete: +§${coins}`; } },
        { label: () => `🎁 Que lo abra ${partnerName()}`, run: async (ctx) => { await goTo(436, 340, B(ctx)); setProps([]); say(B(ctx), pickOne(['¡Es para ti! 💕', '¡Sorpresa!'])); getLife().rel.romance = Math.min(100, getLife().rel.romance + 6); needs({ social: 15, fun: 10 }); return `${partnerName()} abrió un regalo para ti`; } }
      ],
      end: (ctx) => { sendAway(ctx.npc); setProps([]); }
    },
    neighbor: {
      emoji: '🙋‍♀️', title: 'Visita de la vecina',
      text: () => 'Giulia, la vecina del tercero, sube a saludar. Dice que huele muy bien desde la escalera.',
      start: (ctx) => { ctx.npc = visitor('ped-a', 'La vecina', ['Che bella casa!', 'Ragazzi, che piacere', 'Come state?'], 'it-f'); setTimeout(() => npcSay(ctx.npc, 'Buongiorno ragazzi! 👋', { force: true }), 2600); },
      choices: [
        { label: '☕ Invitarla a un café (§5)', run: (ctx) => { addCoins(-5); gainSkill('charisma', 30); needs({ social: 30, fun: 10 }); setTimeout(() => npcSay(ctx.npc, 'Grazie, siete un amore! ☕', { force: true }), 300); return 'Café con la vecina: +💬 y carisma'; } },
        { label: '👋 Saludar desde la puerta', run: (ctx) => { needs({ social: 10 }); setTimeout(() => npcSay(ctx.npc, 'A presto, ragazzi!', { force: true }), 300); return 'Saludasteis a la vecina'; } }
      ],
      end: (ctx) => setTimeout(() => sendAway(ctx.npc), 3500)
    },
    blackout: {
      emoji: '🕯️', title: '¡Apagón!',
      text: () => 'Se ha ido la luz en todo el edificio. ¿Qué hacéis?',
      when: () => true,
      start: (ctx) => { const w = world(); if (w) { w.state.blackout = true; w.state.lamps = false; } simTune([392, 330, 262], 160, 'sawtooth'); say(A(ctx), '¡Uy! 😱'); },
      choices: [
        { label: '🕯️ Encender velas', run: (ctx) => { const w = world(); if (w) w.state.candles = [[110, 330], [128, 334], [392, 128]]; setProps([{ kind: 'candle', x: 110, y: 330 }, { kind: 'candle', x: 128, y: 334 }, { kind: 'candle', x: 392, y: 128 }]); getLife().rel.romance = Math.min(100, getLife().rel.romance + 10); pushEvent('love'); needs({ social: 20, fun: 10 }); say(A(ctx), 'Qué romántico… 💕'); return 'Cena a la luz de las velas'; }, keep: 45000 },
        { label: '🔌 Revisar los plomos', run: async (ctx) => { await goTo(470, 330, A(ctx)); const ok = skillCheck('logic'); gainSkill('logic', 25); if (ok) { say(A(ctx), '¡Arreglado! 💡'); addCoins(20); return 'Arreglaste los plomos: +§20'; } say(A(ctx), 'Ay… ¡calambre! ⚡'); needs({ fun: -10, energy: -10 }); return 'Los plomos se resistieron (habrá que subir lógica)'; } }
      ],
      end: () => { const w = world(); if (w) { w.state.blackout = false; w.state.candles = []; } setProps([]); }
    },
    leak: {
      emoji: '💧', title: 'Gotea el grifo',
      text: () => 'Hay un charco bajo el fregadero de la cocina. Algo pierde agua.',
      start: (ctx) => { addProp({ kind: 'puddle', x: 404, y: 76, sort: 40 }); world()?.emit('drop', 404, 60, { count: 6, vy: 20, spread: 6 }); },
      choices: [
        { label: '🔧 Arreglarlo yo', run: async (ctx) => { await goTo(404, 100, A(ctx)); const ok = skillCheck('fitness', 0.45); gainSkill('logic', 20); if (ok) { addCoins(30); say(A(ctx), '¡Como nuevo! 🔧'); needs({ fun: 10 }); return 'Arreglaste el grifo: +§30'; } world()?.emit('drop', A(ctx)?.x || 400, (A(ctx)?.headY || 60) + 4, { count: 14, vy: -10, spread: 16 }); say(A(ctx), '¡Me he empapado! 💦'); needs({ hygiene: -25, fun: -5 }); return 'El grifo te dejó empapado'; } },
        { label: '📞 Llamar al fontanero (§60)', run: (ctx) => { addCoins(-60); say(A(ctx), 'Viene mañana, menos mal 😮‍💨'); return 'Llamasteis al fontanero: −§60'; } }
      ],
      end: () => setProps([])
    },
    pizza: {
      emoji: '🍕', title: 'Huele a pizza',
      text: () => 'La pizzería de abajo ha abierto el horno de leña. Tenéis hambre…',
      when: () => needsOf().hunger < 70 && hour() >= 12,
      choices: [
        { label: '🍕 Pedir una margherita (§25)', run: async (ctx) => { addCoins(-25); setProps([{ kind: 'pizza', x: 120, y: 330 }]); await goTo(150, 320, A(ctx)); needs({ hunger: 55, fun: 10 }); say(A(ctx), '¡Qué buena! 🍕'); say(B(ctx), 'Buonissima!'); return 'Pizza margherita en el sofá'; }, keep: 30000 },
        { label: '🍳 Mejor cocinamos juntos', run: (ctx) => { queueOrRun({ type: 'act', value: 'cook', emoji: '🍳' }); return 'Decidisteis cocinar en casa'; } }
      ],
      end: () => setProps([])
    },
    cat: {
      emoji: '🐱', title: 'Un gato en la ventana',
      text: () => 'El gato del vecino se ha colado por la ventana del salón y os mira muy serio.',
      start: (ctx) => { addProp({ kind: 'cat', x: 364, y: 244 }); },
      choices: [
        { label: '🐟 Darle de comer', run: async (ctx) => { await goTo(364, 268, A(ctx)); needs({ fun: 20, social: 10 }); say(A(ctx), '¡Miau! 😻'); return 'Le disteis de comer al gato del vecino'; }, keep: 20000 },
        { label: '📸 Hacerle fotos', run: async (ctx) => { await goTo(380, 280, A(ctx)); takeSimPhoto(); needs({ fun: 15 }); return 'Sesión de fotos con el gato'; }, keep: 12000 }
      ],
      end: () => setProps([])
    },
    party: {
      emoji: '🎶', title: 'Fiesta en el piso de arriba',
      text: () => 'Los vecinos de arriba tienen música a todo volumen.',
      when: () => hour() >= 19 || hour() < 2,
      start: (ctx) => { simTune([392, 494, 587, 494], 140, 'square'); },
      choices: [
        { label: '💃 Bailar en casa', run: (ctx) => { queueOrRun({ type: 'act', value: 'dance', emoji: '💃' }); needs({ fun: 25, energy: -10 }); return 'Os unisteis a la fiesta bailando en casa'; } },
        { label: '🛌 Tapones y a dormir', run: (ctx) => { needs({ energy: 15, fun: -5 }); say(A(ctx), 'Zzz… 😴'); return 'Tapones y a dormir'; } }
      ]
    },
    rain: {
      emoji: '🌧️', title: 'Tarde de lluvia',
      text: () => 'Llueve en Turín de verdad. Plan perfecto para quedarse en casa.',
      when: () => isRainy(),
      choices: [
        { label: () => `🛋️ Manta y peli con ${partnerName()}`, run: (ctx) => { queueOrRun({ type: 'social', value: 'cuddle', emoji: '🛋️' }); return 'Manta y peli mientras llovía'; } },
        { label: '📚 Leer junto a la ventana', run: (ctx) => { queueOrRun({ type: 'act', value: 'readsofa', emoji: '📚' }); return 'Lectura con lluvia'; } }
      ]
    },
    momEs: {
      emoji: '🥘', title: '¡Visita de Mari Cruz!',
      text: () => 'La madre de Ines se ha presentado en Turín con un táper de tortilla y ganas de veros.',
      when: () => hour() >= 11 && hour() < 22,
      start: (ctx) => { const def = FAMILY.spain[0]; ctx.npc = visitor(def.id, def.name, def.lines, def.voice); setTimeout(() => npcSay(ctx.npc, pickOne(def.greet), { force: true }), 2600); },
      choices: [
        { label: '🍽️ Comer todos juntos', run: async (ctx) => { await goTo(392, 140, A(ctx)); needs({ hunger: 50, social: 30 }); setProps([{ kind: 'pizza', x: 392, y: 132 }]); setTimeout(() => npcSay(ctx.npc, '¡Comed, que estáis muy delgados!', { force: true }), 400); return 'Comisteis la tortilla de Mari Cruz'; }, keep: 20000 },
        { label: '🏠 Enseñarle la casa', run: async (ctx) => { await goTo(300, 320, A(ctx)); gainSkill('charisma', 30); needs({ social: 25 }); setTimeout(() => npcSay(ctx.npc, '¡Qué bonito lo tenéis todo!', { force: true }), 400); return 'Le enseñasteis la casa a Mari Cruz'; }, keep: 12000 }
      ],
      end: (ctx) => { setProps([]); sendAway(ctx.npc); }
    },
    momIt: {
      emoji: '🍝', title: '¡Ha venido Giuliana!',
      text: () => 'La madre de Matteo ha subido de Chieti con una lasaña recién hecha.',
      when: () => hour() >= 11 && hour() < 22,
      start: (ctx) => { const def = FAMILY.chieti[0]; ctx.npc = visitor(def.id, def.name, def.lines, def.voice); setTimeout(() => npcSay(ctx.npc, pickOne(def.greet), { force: true }), 2600); },
      choices: [
        { label: '🍝 Comer la lasaña', run: async (ctx) => { await goTo(392, 140, A(ctx)); needs({ hunger: 55, social: 25 }); setProps([{ kind: 'pizza', x: 392, y: 132 }]); setTimeout(() => npcSay(ctx.npc, 'Mangiate, mangiate!', { force: true }), 400); return 'Lasaña de Giuliana para todos'; }, keep: 20000 },
        { label: '☕ Un café y a charlar', run: async (ctx) => { await goTo(300, 320, A(ctx)); gainSkill('charisma', 25); needs({ social: 30, fun: 10 }); setTimeout(() => npcSay(ctx.npc, 'Che bella coppia che siete!', { force: true }), 400); return 'Café y charla con Giuliana'; }, keep: 12000 }
      ],
      end: (ctx) => { setProps([]); sendAway(ctx.npc); }
    },
    letter: {
      emoji: '💌', title: 'Carta de la familia',
      text: () => pickOne(['Mari Cruz pregunta cuándo vais a la casa de campo.', 'Giuliana dice que en Chieti os esperan para comer.']),
      choices: [
        { label: '✈️ ¡Vamos de viaje!', run: (ctx) => { const dest = /Chieti/.test(ctx.text) ? 'chieti' : 'spain'; queueOrRun({ type: 'social', value: dest, emoji: '✈️' }); return dest === 'chieti' ? 'Os fuisteis a Chieti' : 'Os fuisteis a la casa de campo'; } },
        { label: '📱 Llamar por teléfono', run: (ctx) => { queueOrRun({ type: 'act', value: 'phone', emoji: '📱' }); needs({ social: 25 }); return 'Llamaste a la familia'; } }
      ]
    }
  };

  function eventCard(id, ctx) {
    const def = EVENTS[id];
    const house = $house();
    if (!house) return;
    house.querySelector('.sims-event')?.remove();
    const el = document.createElement('div');
    el.className = 'sims-event';
    el.innerHTML = `<div class="sims-event-head"><span>${def.emoji}</span><strong>${escapeHtml(def.title)}</strong></div><p>${escapeHtml(ctx.text)}</p><div class="sims-event-choices">${def.choices.map((choice, i) => `<button type="button" data-event-choice="${i}">${escapeHtml(typeof choice.label === 'function' ? choice.label() : choice.label)}</button>`).join('')}</div>`;
    house.appendChild(el);
    simTune([784, 988], 90, 'triangle');
  }
  // remote: llega del otro móvil, con el mismo texto. Quien lo empieza lo comparte.
  function startEvent(id, { remote = false, text = '' } = {}) {
    const def = EVENTS[id];
    if (!def || event.active || curScene() !== 'house') return false;
    const ctx = { id, text: text || def.text(), remote };
    event.active = ctx;
    if (!remote && live.partnerOnline) liveSend('event', { id, text: ctx.text });
    try { def.start?.(ctx); } catch (error) { console.warn('[Umbral] Suceso:', error); }
    eventCard(id, ctx);
    // Si nadie elige en un minuto y medio, se resuelve solo con la última opción (lo decide
    // el móvil que lo empezó, y se lo cuenta al otro).
    if (!remote) ctx.timer = setTimeout(() => choose(def.choices.length - 1, { auto: true }), 90000);
    return true;
  }
  async function choose(index, { auto = false, remote = false } = {}) {
    const ctx = event.active;
    if (!ctx || ctx.chosen) return;
    ctx.chosen = true;
    ctx.remoteChoice = remote;
    if (!remote) liveSend('event-choice', { id: ctx.id, index, auto });
    clearTimeout(ctx.timer);
    const def = EVENTS[ctx.id];
    const choice = def.choices[index];
    $house()?.querySelector('.sims-event')?.remove();
    let result = '';
    try { result = (await choice.run(ctx)) || ''; } catch (error) { console.warn('[Umbral] Suceso:', error); }
    if (!auto) stat('events');
    if (result) diary(def.emoji, result);
    if (result && !auto) setTimeout(() => showToast(remote ? `${def.emoji} ${partnerName()} eligió: ${result}` : `${def.emoji} ${result}`), 400);
    const keep = typeof choice.keep === 'number' ? choice.keep : 4000;
    setTimeout(() => finish(ctx), keep);
  }
  function finish(ctx) {
    if (event.active !== ctx) return;
    try { EVENTS[ctx.id].end?.(ctx); } catch (error) { console.warn('[Umbral] Suceso:', error); }
    event.active = null;
    scheduleNext();
  }
  function abort() {
    const ctx = event.active;
    if (!ctx) return;
    clearTimeout(ctx.timer);
    $house()?.querySelector('.sims-event')?.remove();
    try { EVENTS[ctx.id].end?.(ctx); } catch {}
    // Sin visita que se despide andando: se va al momento.
    if (ctx.npc) { simsState.npcs = simsState.npcs.filter((npc) => npc !== ctx.npc); syncActors(); }
    event.active = null;
  }
  // Entre suceso y suceso, de 3 a 6 minutos de juego (el primero, al minuto de entrar).
  function scheduleNext(first = false) {
    event.nextAt = Date.now() + (first ? 50000 + Math.random() * 40000 : 180000 + Math.random() * 180000);
  }
  function pickEvent() {
    let recentIds = [];
    try { recentIds = JSON.parse(localStorage.getItem('umbral-sims-events') || '[]'); } catch {}
    const options = Object.keys(EVENTS).filter((id) => !recentIds.includes(id) && (EVENTS[id].when ? EVENTS[id].when() : true));
    const id = pickOne(options.length ? options : Object.keys(EVENTS).filter((key) => !EVENTS[key].when || EVENTS[key].when()));
    try { localStorage.setItem('umbral-sims-events', JSON.stringify([id, ...recentIds].slice(0, 4))); } catch {}
    return id;
  }

  function tick() {
    if (!simsState.open || !ready()) return;
    if (!event.openedAt) { event.openedAt = Date.now(); scheduleNext(true); }
    if (event.active && curScene() !== 'house') return abort();
    if (event.active || curScene() !== 'house' || Date.now() < event.nextAt) return;
    const house = $house();
    // No interrumpir si estáis en un menú, una tarjeta, un minijuego o una foto.
    if (house?.querySelector('.sims-card, .sims-pie, .sims-photo-card, .sims-game')) return;
    startEvent(pickEvent());
  }
  function onClose() {
    abort();
    event.openedAt = 0;
  }

  document.addEventListener('click', (e) => {
    const choice = e.target.closest('.sims-event [data-event-choice]');
    if (choice) choose(Number(choice.dataset.eventChoice));
  });

  // Lo que llega del otro móvil (sims.js lo pasa desde onLive).
  function onRemote(msg) {
    if (msg.type === 'event') startEvent(msg.id, { remote: true, text: String(msg.text || '').slice(0, 200) });
    if (msg.type === 'event-choice' && event.active?.id === msg.id) choose(Number(msg.index) || 0, { auto: Boolean(msg.auto), remote: true });
  }

  window.simsLife = { onRemote, stat, diary, tick, onClose, goalsCard, bestTitle, checkAspirations, startEvent, EVENTS, ASPIRATIONS };
})();
