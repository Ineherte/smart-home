// La cabeza de los muñecos del modo Sims: rasgos de personalidad, emociones con efecto,
// carrera profesional y recuerdos.
// - Rasgos: dos por persona (Ines empieza creativa y romántica; Matteo, cocinillas y dormilón).
//   Cambian lo rápido que aprenden, lo que les sube cada cosa, sus deseos y lo que hacen solos.
// - Emociones: salen de las necesidades y de lo que acaba de pasar, y tienen efecto (inspirada
//   aprende antes a pintar, enfadado rechaza besos, con energía anda más rápido…).
// - Carrera: trabajar en el portátil da experiencia y sueldo, y con ella llegan los ascensos.
// - Recuerdos: los momentos importantes se guardan y a veces os los recordáis en voz alta.
// Se guarda en look.traits, look.career y look.memories (sims.js lo incluye en lifeSnapshot).
(function () {
  const isMatteo = (person) => avatarKey(person) === 'matteo';
  const g = (person, f, m) => (isMatteo(person) ? m : f);
  const me = () => myAvatarPerson();
  const ready = () => Boolean(me() && avatarRows[me()]);

  const TRAITS = {
    creative: { emoji: '🎨', name: ['Creativa', 'Creativo'], text: 'Aprende mucho más rápido a pintar y a tocar', skills: { creativity: 1.6, music: 1.6 }, likes: ['paint', 'sing', 'guitar', 'dance'], wants: ['dance', 'sing'] },
    romantic: { emoji: '💞', name: ['Romántica', 'Romántico'], text: 'Los momentos de pareja suben más el romance', rel: 1.5, likes: ['wine'], wants: ['kiss', 'hug'] },
    foodie: { emoji: '🍳', name: ['Cocinillas', 'Cocinillas'], text: 'Cocina mejor y la comida le llena más', skills: { cooking: 1.6 }, needs: { hunger: 1.3 }, likes: ['cook', 'coffee', 'snack'], wants: ['cook'] },
    sleepy: { emoji: '😴', name: ['Dormilona', 'Dormilón'], text: 'Las siestas le cargan mucho más', needs: { energy: 1.5 }, likes: ['nap', 'sharknap', 'sleep', 'beannap'], wants: ['tv'] },
    active: { emoji: '💪', name: ['Deportista', 'Deportista'], text: 'Forma física más rápido y anda con más brío', skills: { fitness: 1.6 }, speed: 1.12, likes: ['yoga', 'jump', 'goout', 'dance'], wants: ['yoga'] },
    bookworm: { emoji: '🧠', name: ['Cerebrito', 'Cerebrito'], text: 'Lógica más rápida y le encanta leer', skills: { logic: 1.6 }, likes: ['readsofa', 'readbed', 'read', 'puzzle', 'beanread'], wants: ['read', 'puzzle'] },
    social: { emoji: '🎉', name: ['Sociable', 'Sociable'], text: 'La vida social le sube más con todo', needs: { social: 1.5 }, skills: { charisma: 1.4 }, likes: ['phone', 'mirror', 'wine'], wants: ['compliment', 'laugh'] },
    homebody: { emoji: '🏡', name: ['Casera', 'Casero'], text: 'Se lo pasa mejor en casa (tele, consola, puzzle)', needs: { fun: 1.3 }, likes: ['tv', 'games', 'puzzle'], wants: ['tv'] },
    gamer: { emoji: '🕹️', name: ['Gamer', 'Gamer'], text: 'Más diversión y monedas con los juegos', needs: { fun: 1.2 }, likes: ['games', 'arcade'], wants: ['game'], gameCoins: 1.5 },
    neat: { emoji: '🫧', name: ['Limpia', 'Limpio'], text: 'Higiene que dura más y le relaja ducharse', needs: { hygiene: 1.5 }, likes: ['shower', 'bath', 'teeth', 'laundry'], wants: ['bath'] }
  };
  const DEFAULT_TRAITS = { ines: ['creative', 'romantic'], matteo: ['foodie', 'sleepy'] };
  function traitsOf(person = me()) {
    const saved = person === me() && simsState.life?.mind ? simsState.life.mind.traits : avatarRows[person]?.look?.traits;
    const list = Array.isArray(saved) ? saved.filter((id) => TRAITS[id]).slice(0, 2) : null;
    return list?.length ? list : DEFAULT_TRAITS[avatarKey(person)] || ['creative', 'social'];
  }
  function mind() {
    const life = getLife();
    if (!life.mind) {
      const look = avatarRows[me()]?.look || {};
      life.mind = {
        traits: Array.isArray(look.traits) ? look.traits.filter((id) => TRAITS[id]).slice(0, 2) : [...(DEFAULT_TRAITS[avatarKey(me())] || [])],
        career: { level: 1, xp: 0, ...(look.career || {}) },
        memories: Array.isArray(look.memories) ? [...look.memories] : []
      };
    }
    return life.mind;
  }

  // ---------- Emociones ----------
  const EMOTIONS = {
    angry: { emoji: '😤', name: ['Enfadada', 'Enfadado'], text: 'No le apetecen besos y aprende peor', skill: 0.8, work: 0.8 },
    tense: { emoji: '😣', name: ['Agobiada', 'Agobiado'], text: 'Le falta algo: aprende y trabaja peor', skill: 0.7, work: 0.75 },
    sad: { emoji: '😢', name: ['Triste', 'Triste'], text: 'Necesita mimos y compañía', skill: 0.85 },
    romantic: { emoji: '💞', name: ['Enamorada', 'Enamorado'], text: 'El romance sube mucho más', rel: 1.5 },
    inspired: { emoji: '💡', name: ['Inspirada', 'Inspirado'], text: 'Pinta, canta y toca mucho mejor', skills: { creativity: 1.6, music: 1.6 } },
    focused: { emoji: '🎯', name: ['Concentrada', 'Concentrado'], text: 'Lógica y trabajo rinden más', skills: { logic: 1.5 }, work: 1.3 },
    energized: { emoji: '⚡', name: ['Con energía', 'Con energía'], text: 'Anda más rápido y entrena mejor', skills: { fitness: 1.5 }, speed: 1.15 },
    playful: { emoji: '😜', name: ['Juguetona', 'Juguetón'], text: 'Se divierte más con todo', needs: { fun: 1.3 } },
    happy: { emoji: '😊', name: ['Feliz', 'Feliz'], text: 'Aprende un poco más rápido', skill: 1.1, work: 1.1 },
    fine: { emoji: '🙂', name: ['Tranquila', 'Tranquilo'], text: 'Todo en calma' }
  };
  function emotionOf(person = me()) {
    const needs = currentNeeds(avatarRows[person]);
    const values = Object.values(needs);
    const avg = values.reduce((sum, value) => sum + value, 0) / values.length;
    const mine = person === me();
    const sim = sims[avatarKey(person)];
    if (mine && recent('fight', 3600000)) return 'angry';
    if (!mine && sim?.angryUntil > Date.now()) return 'angry';
    if (Math.min(...values) < 25) return needs.social < 25 && Math.min(needs.hunger, needs.energy, needs.hygiene, needs.fun) >= 25 ? 'sad' : 'tense';
    if (mine && recent('love', 2 * 3600000)) return 'romantic';
    if (mine && (recent('inspire', 3600000) || recent('levelup', 3600000) || (traitsOf(person).includes('creative') && needs.fun > 85))) return 'inspired';
    if (mine && recent('focus', 3600000)) return 'focused';
    if (needs.energy > 85) return 'energized';
    if (needs.fun > 80 && needs.social > 70) return 'playful';
    if (avg > 65) return 'happy';
    return 'fine';
  }
  const emotionLabel = (person, id = emotionOf(person)) => `${EMOTIONS[id].emoji} ${g(person, ...EMOTIONS[id].name)}`;

  // ---------- Efectos (los usa sims.js) ----------
  function skillMult(skill) {
    if (!ready()) return 1;
    const emotion = EMOTIONS[emotionOf()];
    let mult = (emotion.skills?.[skill] || 1) * (emotion.skill || 1);
    traitsOf().forEach((id) => { mult *= TRAITS[id].skills?.[skill] || 1; });
    return mult;
  }
  function needsDelta(delta) {
    if (!ready() || !delta) return delta;
    const out = { ...delta };
    const emotion = EMOTIONS[emotionOf()];
    Object.keys(out).forEach((key) => {
      if (out[key] <= 0) return;
      let mult = emotion.needs?.[key] || 1;
      traitsOf().forEach((id) => { mult *= TRAITS[id].needs?.[key] || 1; });
      out[key] = Math.round(out[key] * mult);
    });
    return out;
  }
  function relMult() {
    if (!ready()) return 1;
    let mult = EMOTIONS[emotionOf()].rel || 1;
    if (traitsOf().includes('romantic')) mult *= TRAITS.romantic.rel;
    return mult;
  }
  function speedMult(sim) {
    const person = simPerson(sim.key);
    if (!person || sim.npc) return 1;
    let mult = EMOTIONS[emotionOf(person)].speed || 1;
    if (traitsOf(person).includes('active')) mult *= TRAITS.active.speed;
    return mult;
  }
  // Lo que hace solo: prefiere lo que le gusta (si está en la lista de lo que necesita).
  function preferAction(list, person = me()) {
    const liked = traitsOf(person).flatMap((id) => TRAITS[id].likes || []);
    const favourites = list.filter((action) => liked.includes(action));
    return favourites.length && Math.random() < 0.7 ? pickOne(favourites) : null;
  }
  const likedWants = () => (ready() ? [...new Set(traitsOf().flatMap((id) => TRAITS[id].wants || []))] : []);
  function gameCoins(coins) {
    return ready() && traitsOf().includes('gamer') ? Math.round(coins * TRAITS.gamer.gameCoins) : coins;
  }
  // Después de cada acción: lo que deja en el ánimo (concentrarse, inspirarse).
  function afterAction(id) {
    if (['coffee', 'readsofa', 'readbed', 'read', 'beanread', 'puzzle', 'stargaze'].includes(id)) pushEvent('focus');
    if (['paint', 'guitar', 'sing', 'dance', 'pose'].includes(id)) pushEvent('inspire');
  }

  // ---------- Carrera ----------
  const LEVELS = [['En prácticas', 'En prácticas', 30], ['Junior', 'Junior', 45], ['Semisenior', 'Semisenior', 60], ['Senior', 'Senior', 80], ['Especialista', 'Especialista', 100], ['Jefa de equipo', 'Jefe de equipo', 130], ['Directora', 'Director', 170], ['Socia', 'Socio', 220]];
  const xpFor = (level) => 30 * level;
  const careerTitle = (person, level) => g(person, LEVELS[level - 1][0], LEVELS[level - 1][1]);
  function work() {
    if (!ready()) return 40;
    const career = mind().career;
    const emotion = EMOTIONS[emotionOf()];
    const level = Math.min(LEVELS.length, career.level);
    const pay = Math.round(LEVELS[level - 1][2] * (emotion.work || 1));
    career.xp += Math.round((10 + skillLevel(getLife().skills.logic) * 1.5) * (emotion.work || 1));
    if (level < LEVELS.length && career.xp >= xpFor(level)) {
      career.xp -= xpFor(level);
      career.level = level + 1;
      const title = careerTitle(me(), career.level);
      const sim = sims[meKey()];
      if (sim) {
        simBubble(sim, `📈 ¡Ascenso! Ahora: ${title}`, { secs: 3.5 });
        world()?.emit('sparkle', sim.x, sim.headY, { count: 20, spread: 30, vy: -20 });
      }
      simTune([523, 659, 784, 1047], 120, 'triangle');
      window.simsLife?.diary('📈', `Ascenso: ${title}`);
      remember('📈', `Ascenso a ${title}`, `¿Te acuerdas de cuando me ascendieron a ${title}?`);
      showToast(`📈 ¡Ascenso! Ahora eres ${title}. Cobras §${LEVELS[career.level - 1][2]} por jornada`);
    }
    saveLife();
    return pay;
  }

  // ---------- Recuerdos ----------
  function remember(emoji, text, line) {
    if (!ready()) return;
    const list = mind().memories;
    if (list.some((memory) => memory.text === text && Date.now() - memory.at < 86400000)) return;
    list.unshift({ at: Date.now(), emoji, text: String(text).slice(0, 80), line: String(line || '').slice(0, 110) });
    mind().memories = list.slice(0, 24);
    saveLife();
  }
  // De vez en cuando, si estáis cerca y sin hacer nada, uno le recuerda algo al otro.
  let lastRecall = 0;
  function tick() {
    if (!ready() || !simsState.open || Date.now() - lastRecall < 120000) return;
    const memories = mind().memories.filter((memory) => memory.line && Date.now() - memory.at > 10 * 60000);
    const a = sims[meKey()];
    const b = sims[partnerKeyOf()];
    if (!memories.length || !a || !b || a.busy || b.busy || Math.hypot(a.x - b.x, a.y - b.y) > 70 || Math.random() > 0.08) return;
    lastRecall = Date.now();
    const memory = pickOne(memories);
    simBubble(a, `💭 ${memory.line}`, { secs: 4 });
    setTimeout(() => simBubble(b, pickOne(['¡Claro que sí! 😄', '¡Cómo olvidarlo! 💕', 'Jajaja, ¡qué día! 😂', '¡Qué bonito fue! 🥹']), { secs: 2.6 }), 3000);
    relBoost(2);
  }
  function relBoost(amount) {
    const life = getLife();
    life.rel.romance = Math.min(100, life.rel.romance + amount);
    life.rel.friend = Math.min(100, life.rel.friend + amount);
  }

  // ---------- Panel «Tú» y «Recuerdos» (en la tarjeta de Metas) ----------
  function youHtml() {
    if (!ready()) return '';
    const person = me();
    const partner = otherPerson(person);
    const career = mind().career;
    const level = Math.min(LEVELS.length, career.level);
    const next = level < LEVELS.length ? xpFor(level) : 0;
    const emotion = EMOTIONS[emotionOf()];
    const chosen = traitsOf();
    return `<div class="sims-you">
      <section class="sims-you-emotion"><span>${emotion.emoji}</span><div><strong>${escapeHtml(g(person, ...emotion.name))}</strong><small>${escapeHtml(emotion.text)}</small></div></section>
      <h4>Tu personalidad <em>(elige 2)</em></h4>
      <div class="sims-traits">${Object.entries(TRAITS).map(([id, trait]) => `<button type="button" data-trait="${id}" aria-pressed="${chosen.includes(id)}"><span>${trait.emoji}</span><b>${escapeHtml(g(person, ...trait.name))}</b><small>${escapeHtml(trait.text)}</small></button>`).join('')}</div>
      <p class="sims-card-hint">${escapeHtml(partner)}: ${traitsOf(partner).map((id) => `${TRAITS[id].emoji} ${g(partner, ...TRAITS[id].name)}`).join(' · ')} · ${escapeHtml(emotionLabel(partner))}</p>
      <h4>Tu trabajo</h4>
      <section class="sims-career"><span>💼</span><div><strong>${escapeHtml(careerTitle(person, level))}</strong><small>Nivel ${level} de ${LEVELS.length} · §${LEVELS[level - 1][2]} por jornada en el portátil</small>${next ? `<span class="sims-aspire-bar"><b style="width:${Math.round(Math.min(1, career.xp / next) * 100)}%"></b></span><small>Para el ascenso: ${career.xp} / ${next} · mejor ${escapeHtml(g(person, 'concentrada', 'concentrado'))} (un café antes ayuda)</small>` : '<small>¡Lo más alto de tu carrera! 🏆</small>'}</div></section>
    </div>`;
  }
  function memoriesHtml() {
    if (!ready()) return '';
    const list = mind().memories;
    return list.length ? `<ul class="sims-memories">${list.map((memory) => `<li><span>${escapeHtml(memory.emoji)}</span><p><b>${escapeHtml(memory.text)}</b><small>${new Date(memory.at).toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })}</small></p></li>`).join('')}</ul>` : '<p class="sims-card-hint">Aquí se guardan vuestros grandes momentos: viajes, ascensos, aspiraciones, cenas a la luz de las velas… y a veces os los recordaréis en casa.</p>';
  }
  function toggleTrait(id) {
    if (!TRAITS[id] || !ready()) return;
    const list = mind().traits.length ? mind().traits : [...traitsOf()];
    const next = list.includes(id) ? list.filter((other) => other !== id) : [...list, id].slice(-2);
    if (!next.length) return showToast('Elige al menos un rasgo');
    mind().traits = next;
    saveLife();
    simBlip(1200, 0.05);
  }

  window.simsMind = { TRAITS, EMOTIONS, traitsOf, emotionOf, emotionLabel, skillMult, needsDelta, relMult, speedMult, preferAction, likedWants, gameCoins, afterAction, work, remember, tick, youHtml, memoriesHtml, toggleTrait, mind };
})();
