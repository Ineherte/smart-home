// Asistente de Umbral: escribes (o dictas) lo que quieres en una frase normal y lo hace.
// «Apunta leche y 2 kilos de patatas», «recuérdame pagar la luz el viernes», «cena con Clara el
// sábado a las 21», «he regado la monstera», «he pagado 24,50 de cena a medias»…
// No usa ningún servicio de fuera: entiende las frases aquí mismo, gratis y sin conexión, y hace
// lo mismo que los botones de la app (con sus avisos a tu pareja y su «Deshacer»).
// Usa las funciones de shopping.js, tasks.js, pending.js, notes.js, plants.js, personal.js y app.js.
(function () {
  // ---------- Texto ----------
  // Minúsculas y sin tildes, letra a letra (así las posiciones coinciden con el original).
  const fold = (text) => [...text].map((ch) => ch.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()).join('');
  const phrase = (text) => {
    const orig = String(text || '').normalize('NFC').replace(/\s+/g, ' ').trim().replace(/[.!¡¿?]+$/, '').replace(/^[¡¿]+/, '');
    const low = fold(orig);
    return { orig, low, src: low.length === orig.length ? orig : low };
  };
  // El texto original sin lo que casa con los patrones (que se buscan en minúsculas sin tildes).
  function strip(p, ...patterns) {
    const removed = new Array(p.low.length).fill(false);
    patterns.forEach((pattern) => {
      const re = new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`);
      for (const match of p.low.matchAll(re)) for (let i = match.index; i < match.index + match[0].length; i += 1) removed[i] = true;
    });
    return [...p.src].filter((_, i) => !removed[i]).join('').replace(/\s+/g, ' ').replace(/^[\s,:;.-]+|[\s,:;.-]+$/g, '').trim();
  }
  // Un trozo del original a partir de una coincidencia en minúsculas.
  const piece = (p, match, group) => {
    const start = match.index + match[0].indexOf(match[group]);
    return p.src.slice(start, start + match[group].length).trim();
  };
  const STOP = new Set(['el', 'la', 'los', 'las', 'de', 'del', 'a', 'al', 'y', 'e', 'en', 'para', 'por', 'con', 'un', 'una', 'unos', 'unas', 'que', 'mi', 'mis', 'tu', 'su', 'lo', 'le', 'ya', 'he', 'hemos', 'ha', 'me', 'nos', 'se']);
  const stem = (word) => word.slice(0, Math.max(4, word.length - 3));
  const tokens = (text) => fold(text).split(/[^a-z0-9ñ]+/).filter((word) => word.length > 2 && !STOP.has(word)).map(stem);
  // Qué parte de las palabras de «target» aparece en «text» (0 a 1).
  function overlap(text, target) {
    const want = tokens(target);
    if (!want.length) return 0;
    const have = new Set(tokens(text));
    return want.filter((word) => have.has(word)).length / want.length;
  }
  const listText = (items) => (items.length > 1 ? `${items.slice(0, -1).join(', ')} y ${items.at(-1)}` : items[0] || '');
  const splitItems = (text) => text.split(/\s*,\s*|\s+y\s+|\s+e\s+/i).map((item) => item.trim()).filter(Boolean);
  const today = () => dateToISO(new Date());
  // «hoy», «mañana», «el viernes 16», «el martes 3 de noviembre».
  function dayText(iso) {
    if (iso === today()) return 'hoy';
    if (iso === addDaysToISO(today(), 1)) return 'mañana';
    if (iso === addDaysToISO(today(), 2)) return 'pasado mañana';
    const date = new Date(`${iso}T12:00:00`);
    const sameMonth = iso.slice(0, 7) === today().slice(0, 7);
    return `el ${date.toLocaleDateString('es-ES', { weekday: 'long' })} ${date.getDate()}${sameMonth ? '' : ` de ${date.toLocaleDateString('es-ES', { month: 'long' })}`}`;
  }
  // «2 kilos de patatas», «2 limones», «leche».
  const itemLabel = (item) => `${item.quantity ? `${item.quantity}${/^[\d½.,/]+$/.test(item.quantity) || /^\d+(?:kg|g|gr|l|ml|cl)$/i.test(item.quantity) ? ' ' : ' de '}` : ''}${item.name.toLowerCase()}`;
  const euros = (value) => (typeof financeMoney === 'function' ? financeMoney(value) : `${value.toFixed(2)} €`);

  // Los avisos de la app (toasts) se recogen mientras actúa el asistente: salen en la
  // conversación, y su «Deshacer» (si lo traen) es el del asistente.
  async function quietly(fn) {
    const original = window.showToast;
    const toasts = [];
    window.showToast = (message, options = {}) => { toasts.push({ message, ...options }); };
    try {
      const value = await fn();
      return { value, toasts };
    } finally {
      window.showToast = original;
    }
  }

  // ---------- Dividir en órdenes ----------
  // «Apunta leche y recuérdame pagar la luz» son dos cosas; «apunta leche y pan», una.
  const COMMAND_START = /^(?:apunta|anota|anade|agrega|pon|mete|incluye|guarda|recuerda|tengo que|tenemos que|hay que|crea|haz|he |hemos |ya |quita|borra|elimina|tacha|enciende|apaga|abre|compra|nota|que |cuanto|marca|riega|regue)/;
  function splitCommands(text) {
    const out = [];
    String(text || '').split(/(?<=[.!?;])\s+|\n+/).forEach((sentence) => {
      let rest = sentence.trim();
      for (;;) {
        const low = fold(rest);
        const cut = [...low.matchAll(/,?\s+(?:y|e)\s+(?:luego\s+|despues\s+|ademas\s+|tambien\s+)?/g)].find((match) => COMMAND_START.test(low.slice(match.index + match[0].length)));
        if (!cut) break;
        out.push(rest.slice(0, cut.index));
        rest = rest.slice(cut.index + cut[0].length);
      }
      if (rest.trim()) out.push(rest);
    });
    return out.map((part) => part.trim()).filter(Boolean);
  }

  // ---------- Entender ----------
  // Cada intérprete mira la frase y, si es suya, devuelve qué hacer: { run } (async, devuelve
  // la respuesta) y algo de texto para mostrar mientras.
  const VIEW_WORDS = [
    [/compra|lista de la compra|super/, 'compra', 'la compra'], [/tareas?|pendientes?|por hacer/, 'pendientes', 'Por hacer'], [/notas?/, 'notes', 'las notas'],
    [/plantas?|jardin/, 'plantas', 'las plantas'], [/luces|luz/, 'luces', 'las luces'], [/cuentas|gastos|finanzas|dinero/, 'finance', 'las cuentas'],
    [/calendario|agenda|eventos?/, 'calendar', 'el calendario'], [/menu/, 'menu', 'el menú'], [/recetas?/, 'recetas', 'las recetas'], [/nosotros/, 'nosotros', 'Nosotros'],
    [/vida|noticias/, 'personal', 'Vida'], [/inicio|hoy/, 'home', 'Inicio'], [/sims|juego|casa del juego/, 'sims', 'el juego']
  ];

  const handlers = [
    // Preguntas: qué falta en la compra, qué tengo hoy, qué plantas tienen sed, cómo van las cuentas.
    (p) => {
      const { low } = p;
      if (/^(?:que|cuales|cuantas?)\b.*\b(?:compra|comprar)\b|^(?:lista de la compra|que falta|que nos falta)$/.test(low)) {
        return { run: async () => {
          const pending = shoppingItems.filter((item) => item.status !== 'in_cart');
          return pending.length ? { icon: 'shopping-basket', text: `En la compra hay ${pending.length === 1 ? 'una cosa' : `${pending.length} cosas`}: ${listText(pending.slice(0, 12).map(itemLabel))}${pending.length > 12 ? '…' : ''}.`, open: 'compra' } : { icon: 'shopping-basket', text: 'La lista de la compra está vacía.' };
        } };
      }
      if (/^(?:que|cuales)\b.*\bplantas?\b|^(?:hay\s+)?(?:alguna\s+)?plantas?\s+(?:con\s+sed|que\s+regar)/.test(low)) {
        return { run: async () => {
          const thirsty = householdPlants.filter((plant) => plant.active !== false && plant.next_water_on && plant.next_water_on <= today());
          return thirsty.length ? { icon: 'droplets', text: `Toca regar ${listText(thirsty.map((plant) => plant.name))}.`, open: 'plantas' } : { icon: 'sprout', text: householdPlants.length ? 'Ninguna planta pide agua hoy.' : 'Aún no tenéis plantas en Umbral.' };
        } };
      }
      if (/\b(?:cuanto|quien)\b.*\b(?:debe|debo|deber)|como (?:van|estan) las cuentas/.test(low)) {
        return { run: async () => {
          if (!financeCache?.loaded && typeof refreshFinance === 'function') await refreshFinance();
          const result = settlementWithReset(financeCache);
          if (result.amount < 0.01) return { icon: 'wallet', text: 'Estáis en paz: nadie debe nada.', open: 'finance' };
          const who = result.debtor === currentUser ? `Le debes ${euros(result.amount)} a ${result.creditor}` : result.creditor === currentUser ? `${result.debtor} te debe ${euros(result.amount)}` : `${result.debtor} debe ${euros(result.amount)} a ${result.creditor}`;
          return { icon: 'wallet', text: `${who}.`, open: 'finance' };
        } };
      }
      const day = low.match(/^(?:que|cual)\b.*\b(hoy|manana)\b|^(?:mi\s+)?agenda(?: de (hoy|manana))?$/);
      if (day || /^que (?:tengo|tenemos|hay) que hacer|^que (?:me|nos) (?:queda|falta) por hacer/.test(low)) {
        return { run: async () => {
          const iso = day && (day[1] || day[2]) === 'manana' ? addDaysToISO(today(), 1) : today();
          const events = (typeof cachedEvents !== 'undefined' ? cachedEvents : []).filter((event) => normalizeEventDate(event.event_date) === iso).sort((a, b) => String(a.event_time || '').localeCompare(String(b.event_time || '')));
          const tasks = householdTasks.filter((task) => isPendingNow(task) && (iso === today() ? !hasDeadline(task) || task.due_date <= iso : task.due_date === iso) && (iso !== today() || hasDeadline(task) || isRoutine(task)));
          const parts = [];
          if (events.length) parts.push(`${events.length === 1 ? 'tienes' : 'tienes estos planes:'} ${listText(events.slice(0, 5).map((event) => `${event.title}${event.event_time && event.event_time !== '00:00' ? ` a las ${String(event.event_time).slice(0, 5)}` : ''}`))}`);
          if (tasks.length) parts.push(`${events.length ? 'y por hacer' : 'por hacer tienes'} ${listText(tasks.slice(0, 5).map((task) => task.title.toLowerCase()))}${tasks.length > 5 ? ` (y ${tasks.length - 5} más)` : ''}`);
          return { icon: 'calendar-days', text: parts.length ? `${capitalizeFirst(dayText(iso))} ${parts.join(', ')}.` : `${capitalizeFirst(dayText(iso))} no tienes nada apuntado.`, open: events.length ? 'calendar' : 'pendientes' };
        } };
      }
      return null;
    },

    // Ir a una sección: «abre la compra», «llévame a las cuentas».
    (p) => {
      const match = p.low.match(/^(?:abre(?:me)?|ve a|vete a|llevame a|ensename|muestrame|ir a|ver)\s+(?:la |el |las |los |mis |mi )?(.+)$/);
      if (!match) return null;
      const view = VIEW_WORDS.find(([pattern]) => pattern.test(match[1]));
      if (!view) return null;
      return { run: async () => {
        close();
        if (view[1] === 'sims') { if (typeof openSims === 'function') openSims(); } else openLinkTarget(view[1]);
        return { icon: 'arrow-up-right', text: `Abriendo ${view[2]}.` };
      } };
    },

    // Luces: «enciende la luz del salón», «apaga todas las luces».
    (p) => {
      const match = p.low.match(/\b(enciende|prende|apaga)\b/);
      if (!match || !/\b(luz|luces|lampara|lamparas)\b/.test(p.low)) return null;
      const on = match[1] !== 'apaga';
      return { run: async () => {
        if (!smartLights.length) return { icon: 'lightbulb-off', text: 'No hay luces conectadas a Umbral todavía.', tone: 'warn', open: 'luces' };
        const named = smartLights.filter((light) => [light.room, light.name].some((word) => word && p.low.includes(fold(word))));
        const targets = named.length && !/\btodas\b/.test(p.low) ? named : smartLights;
        await quietly(() => runLightRoutine(targets, on, ''));
        const what = targets.length === smartLights.length && targets.length > 1 ? 'todas las luces' : `${targets.length > 1 ? 'las luces' : 'la luz'} ${listText(targets.map((light) => `«${light.name}»`))}`;
        return { icon: on ? 'lightbulb' : 'lightbulb-off', text: `${on ? 'Encendida' : 'Apagada'}${targets.length > 1 ? 's' : ''} ${what}.`, open: 'luces' };
      } };
    },

    // Añadir a una nota con lista: «añade cargador a la nota de la maleta».
    (p) => {
      const match = p.low.match(/^(?:apunta|anota|anade|agrega|pon|mete|incluye)\s+(.+?)\s+(?:a|en)\s+(?:la\s+)?(?:nota|lista)\s+(?:de\s+(?:la\s+|el\s+|los\s+|las\s+)?|del\s+|para\s+(?:el\s+|la\s+)?)?(.+)$/);
      if (!match || /^(?:la\s+)?compra$/.test(match[2])) return null;
      const items = splitItems(piece(p, match, 1)).map(capitalizeFirst);
      const name = piece(p, match, 2);
      return { run: async () => {
        const notes = householdNotes.filter((note) => !note.archived);
        const scored = notes.map((note) => ({ note, score: overlap(note.content, name) })).sort((a, b) => b.score - a.score);
        const found = scored[0]?.score >= 0.5 ? scored[0].note : null;
        const lines = items.map((item) => `☐ ${item}`).join('\n');
        if (found) {
          const before = found.details || '';
          // Lo que ya está en la lista (marcado o no) no se repite.
          const existing = new Set(before.split('\n').map((line) => fold(line.replace(/^[☐☑]\s*/, '').trim())));
          const fresh = items.filter((item) => !existing.has(fold(item)));
          const repeated = items.filter((item) => existing.has(fold(item)));
          if (!fresh.length) return { icon: 'list-checks', text: `${listText(repeated)} ya ${repeated.length > 1 ? 'estaban' : 'estaba'} en «${found.content}».`, open: 'notes' };
          await saveNote({ ...found, details: `${before.replace(/\s+$/, '')}${before ? '\n' : ''}${fresh.map((item) => `☐ ${item}`).join('\n')}` });
          renderNotes();
          return { icon: 'list-checks', text: `Añadido a «${found.content}»: ${listText(fresh.map((item) => item.toLowerCase()))}${repeated.length ? ` (${listText(repeated.map((item) => item.toLowerCase()))} ya ${repeated.length > 1 ? 'estaban' : 'estaba'})` : ''}.`, open: 'notes', undo: async () => { await saveNote({ ...found, details: before }); renderNotes(); } };
        }
        const id = await saveNote({ content: capitalizeFirst(name), details: lines, scope: 'shared' });
        renderNotes();
        return { icon: 'notebook-pen', text: `No había ninguna nota «${name}», así que la he creado con ${listText(items.map((item) => item.toLowerCase()))}.`, open: 'notes', undo: async () => { await removeNote(id); renderNotes(); } };
      } };
    },

    // Nota nueva: «nota: la clave del wifi es castillo», «apunta que el fontanero viene el lunes».
    (p) => {
      const match = p.low.match(/^(?:nota|apunte)\s*[:,-]?\s+(.+)$/) || p.low.match(/^(?:crea|haz|apunta|anota|guarda|escribe)(?:me)?\s+(?:una\s+)?nota\s*(?::|que|con|de|sobre|diciendo)?\s*(.+)$/) || p.low.match(/^(?:apunta|anota|guarda|recuerda)\s+que\s+(.+)$/);
      if (!match) return null;
      const text = capitalizeFirst(piece(p, match, 1));
      const [title, ...more] = text.includes(':') ? text.split(/:\s*/) : text.length > 80 ? [text.split(/(?<=[.,])\s/)[0], text.slice(text.split(/(?<=[.,])\s/)[0].length).trim()] : [text];
      return { run: async () => {
        const id = await saveNote({ content: title.slice(0, 120), details: more.join(': ').trim() || null, scope: /\b(?:privad[ao]|solo para mi|personal)\b/.test(p.low) ? 'private' : 'shared' });
        renderNotes();
        return { icon: 'notebook-pen', text: `Nota guardada: «${title}».`, open: 'notes', undo: async () => { await removeNote(id); renderNotes(); } };
      } };
    },

    // Quitar de la compra: «quita el pan de la compra».
    (p) => {
      const match = p.low.match(/^(?:quita|borra|elimina|saca|tacha)\s+(.+?)\s+de\s+(?:la\s+)?(?:lista\s+(?:de\s+(?:la\s+)?)?)?compra$/);
      if (!match) return null;
      const names = parseShoppingInput(piece(p, match, 1)).map((item) => item.name);
      return { run: async () => {
        const found = names.map((name) => shoppingItems.find((item) => fold(item.name) === fold(name)) || shoppingItems.find((item) => overlap(item.name, name) >= 1)).filter(Boolean);
        if (!found.length) return { icon: 'shopping-basket', text: `${listText(names)} no ${names.length > 1 ? 'estaban' : 'estaba'} en la compra.`, tone: 'warn' };
        const copies = found.map((item) => ({ ...item }));
        await quietly(async () => { for (const item of found) await removeShoppingItem(item.id); });
        return { icon: 'shopping-basket', text: `Quitado de la compra: ${listText(found.map((item) => item.name.toLowerCase()))}.`, open: 'compra', undo: async () => {
          const created = await shoppingStore.insert(copies.map(({ id, created_at, ...item }) => item));
          shoppingItems.push(...created);
          renderShopping();
        } };
      } };
    },

    // Ya comprado: «he comprado los huevos y la leche».
    (p) => {
      const match = p.low.match(/^(?:ya\s+)?(?:he|hemos)\s+comprado\s+(.+)$/) || p.low.match(/^(?:ya\s+)?(?:compre|compramos)\s+(.+)$/);
      if (!match || /\d+(?:[.,]\d+)?\s*(?:€|euros?)/.test(p.low)) return null;
      const names = parseShoppingInput(piece(p, match, 1)).map((item) => item.name);
      return { run: async () => {
        const pending = shoppingItems.filter((item) => item.status !== 'in_cart');
        const found = names.map((name) => pending.find((item) => fold(item.name) === fold(name)) || pending.find((item) => overlap(item.name, name) >= 1)).filter(Boolean);
        if (!found.length) return { icon: 'shopping-basket', text: `${listText(names)} no ${names.length > 1 ? 'estaban' : 'estaba'} en la lista de la compra.`, tone: 'warn' };
        await quietly(async () => { for (const item of found) await toggleShoppingItem(item.id); });
        return { icon: 'shopping-cart', text: `Marcado como comprado: ${listText(found.map((item) => item.name.toLowerCase()))}.`, open: 'compra', undo: async () => { await quietly(async () => { for (const item of found) await toggleShoppingItem(item.id); }); } };
      } };
    },

    // Regar: «he regado la monstera», «he regado todas las plantas».
    (p) => {
      const match = p.low.match(/\b(?:regado|regue|regamos|riega|riego)\b(.*)$/);
      if (!match || /\b(?:recuerda|tengo que|hay que|tenemos que)\b/.test(p.low)) return null;
      return { run: async () => {
        const plants = householdPlants.filter((plant) => plant.active !== false);
        if (!plants.length) return { icon: 'sprout', text: 'Aún no tenéis plantas en Umbral. Añádelas en Casa → Plantas.', open: 'plantas', tone: 'warn' };
        const target = match[1];
        let chosen = plants.filter((plant) => [plant.name, plantSpecies(plant).label].some((word) => word && fold(target).includes(fold(word))));
        if (!chosen.length && /\b(?:todas|las plantas|todo)\b/.test(target)) {
          // Las que no se han regado hoy (primero las que tienen sed).
          chosen = plants.filter((plant) => !plant.last_watered_at || dateToISO(new Date(plant.last_watered_at)) !== today());
          if (!chosen.length) return { icon: 'sprout', text: 'Ya estaban todas regadas hoy.', open: 'plantas' };
        }
        if (!chosen.length) return { icon: 'sprout', text: `No sé qué planta es. Tenéis ${listText(plants.map((plant) => plant.name))}.`, tone: 'warn' };
        await quietly(async () => { for (const plant of chosen) await waterPlant(plant.id); });
        return { icon: 'droplets', text: `${listText(chosen.map((plant) => plant.name))} ${chosen.length > 1 ? 'regadas' : 'regada'}. Próximo riego: ${dayText(chosen[0].next_water_on)}.`, open: 'plantas' };
      } };
    },

    // Gastos: «he pagado 24,50 de cena a medias», «gasto personal 12 € farmacia».
    (p) => {
      const amountMatch = p.low.match(/(\d+(?:[.,]\d{1,2})?)\s*(€|euros?|eur\b|pavos)?/);
      const cue = /\b(?:gastado|gastamos|gaste|pagado|pague|pagamos|gasto|gastos|costado|cuesta|ha costado)\b/.test(p.low);
      if (!amountMatch || !(cue || amountMatch[2]) || /\b(?:recuerda|a las|tengo que)\b/.test(p.low)) return null;
      const amount = Number(amountMatch[1].replace(',', '.'));
      if (!(amount > 0)) return null;
      const other = otherPerson(currentUser);
      const otherLow = fold(other);
      const personal = /\b(?:personal|mio|mia|para mi|solo yo|mis gastos)\b/.test(p.low);
      const forOther = new RegExp(`\\b(?:de|para|solo)\\s+${otherLow}\\b|\\b${otherLow}\\s+me\\s+(?:lo\\s+)?debe`).test(p.low);
      const otherPaid = new RegExp(`\\b${otherLow}\\s+(?:ha\\s+)?(?:pagado|pago)\\b|\\bpago\\s+${otherLow}\\b|lo ha pagado ${otherLow}`).test(p.low);
      const description = capitalizeFirst(strip(p,
        /(\d+(?:[.,]\d{1,2})?)\s*(€|euros?|eur\b|pavos)?/,
        /\b(?:yo\s+)?(?:he|hemos|ha)?\s*(?:gastado|gastamos|gaste|pagado|pague|pagamos|costado|cuesta)\b/, /^(?:apunta|anota|anade|pon|mete)(?:me)?\s+(?:un\s+)?(?:gasto)?/, /\b(?:un\s+)?gastos?\b/,
        /\b(?:a medias|entre los dos|compartido|de la casa|personal|mio|mia|para mi|solo yo|mis gastos|con la tarjeta|con apple pay|con satispay)\b/,
        new RegExp(`(?:,?\\s*(?:y\\s+)?(?:es|son|que es|era)\\s+)?\\b(?:de|para|solo)\\s+${otherLow}\\b|\\b${otherLow}\\s+(?:ha\\s+)?(?:pagado|pago)\\b|\\bpago\\s+${otherLow}\\b|${otherLow}\\s+me\\s+(?:lo\\s+)?debe`),
        /^(?:en|de|por|para)\s+/, /\s+(?:en|de|por|para)$/
      ).replace(/^(?:en|de|del|por|para|el|la|los|las|un|una)\s+/i, '').replace(/[\s,]+(?:es|son)$/i, '')) || 'Gasto';
      if (personal) {
        return { run: async () => {
          const row = { description, merchant: description.slice(0, 80), amount, category: typeof guessBankCategory === 'function' ? guessBankCategory({ merchant: description, description, kind: 'other', direction: 'out' }) : 'Otros', expense_date: today(), source: 'manual', direction: 'out', kind: 'other' };
          const created = await personalStore.insert([row]);
          personalExpenses.unshift(...created.map((item) => ({ ...item, direction: item.direction || 'out' })));
          renderPersonal();
          return { icon: 'receipt', text: `Apuntado en tus gastos: ${description}, ${euros(amount)} (${row.category}).`, open: 'finance', undo: async () => {
            for (const item of created) await personalStore.remove(item.id);
            personalExpenses = personalExpenses.filter((entry) => !created.some((item) => item.id === entry.id));
            renderPersonal();
          } };
        } };
      }
      const payer = otherPaid ? other : currentUser;
      const payerShare = forOther ? 0 : 50;
      const shareInesValue = payer === 'Ines' ? payerShare : 100 - payerShare;
      return { run: async () => {
        const before = new Set((financeCache.expenses || []).map((entry) => entry.id));
        await quietly(() => saveFinanceEntity('expense', { description, amount, paid_by: payer, category: financeCategory('', description), share_ines: forOther ? (other === 'Ines' ? 100 : 0) : shareInesValue, expense_date: today(), source: 'manual', settled: false }));
        const created = (financeCache.expenses || []).filter((entry) => !before.has(entry.id));
        const split = forOther ? `todo de ${other}` : 'a medias';
        return { icon: 'receipt-euro', text: `Gasto de la casa: ${description}, ${euros(amount)}, pagado por ${payer === currentUser ? 'ti' : payer}, ${split}.`, open: 'finance', undo: async () => { for (const entry of created) await deleteFinanceEntity('expense', entry.id, { confirmed: true }); } };
      } };
    },

    // Calendario: «cena con Clara el sábado a las 21», «cita en el dentista el 3 de noviembre a las 10:30».
    (p) => {
      const time = p.low.match(/\b(?:a las|a la|sobre las|hacia las|para las)\s+(\d{1,2})(?:[:.h](\d{2}))?(?:\s+y\s+(media|cuarto)|\s+menos\s+(cuarto))?(?:\s*h(?:oras)?)?(?:\s+de\s+la\s+(manana|tarde|noche)|\s+(?:del|al)\s+(mediodia))?\b/) || p.low.match(/\b(\d{1,2})[:h](\d{2})\b/);
      const noon = /\bal mediodia\b/.test(p.low);
      const calendarCue = /\b(?:evento|calendario|agenda|cita)\b/.test(p.low);
      if (!time && !noon && !calendarCue) return null;
      // Sin hora, solo si lo pide («en el calendario») o es una cita con fecha.
      if (!time && !noon && !/\b(?:evento|calendario|agenda)\b/.test(p.low) && !(/\bcita\b/.test(p.low) && parseQuickAdd(p.orig).dueDate)) return null;
      let hour = null;
      let minute = 0;
      if (time) {
        hour = Number(time[1]);
        minute = time[2] ? Number(time[2]) : time[3] === 'media' ? 30 : time[3] === 'cuarto' ? 15 : 0;
        if (time[4]) { hour -= 1; minute = 45; }
        if ((time[5] === 'tarde' || time[5] === 'noche') && hour < 12) hour += 12;
        else if (!time[5] && hour >= 1 && hour <= 7) hour += 12;
        if (time[6]) hour = 13;
      } else if (noon) hour = 14;
      const rest = strip(p,
        /\b(?:a las|a la|sobre las|hacia las|para las)\s+\d{1,2}(?:[:.h]\d{2})?(?:\s+y\s+(?:media|cuarto)|\s+menos\s+cuarto)?(?:\s*h(?:oras)?)?(?:\s+de\s+la\s+(?:manana|tarde|noche)|\s+(?:del|al)\s+mediodia)?\b/, /\b\d{1,2}[:h]\d{2}\b/, /\bal mediodia\b/,
        /^(?:anade|apunta|pon|crea|mete|guarda|programa|agenda)(?:me)?\s+(?:un\s+|una\s+)?(?:evento|cita|plan)?\s*(?:de|para|:)?/, /\b(?:en|al|a)\s+(?:el\s+|la\s+|mi\s+)?(?:calendario|agenda)\b/, /^(?:tengo|tenemos)\s+/,
        /\b(?:solo para mi|personal|privad[ao]|para los dos|compartid[ao])\b/
      );
      const parsed = parseQuickAdd(rest);
      let date = parsed.dueDate && parsed.dueDate !== NO_DEADLINE ? parsed.dueDate : today();
      const at = hour === null ? null : `${String(Math.min(23, hour)).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
      // Solo con la hora y ya ha pasado: es mañana.
      if (!parsed.dueDate && at && at < new Date().toTimeString().slice(0, 5)) date = addDaysToISO(today(), 1);
      const title = capitalizeFirst(parsed.title.replace(/^(?:un|una|el|la)\s+(?=evento|cita|plan)/i, '').replace(/^(?:evento|plan)\s*(?:de|:)?\s*/i, '').trim()) || 'Plan';
      const scope = /\b(?:solo para mi|personal|privad[ao])\b/.test(p.low) ? 'private' : 'shared';
      return { run: async () => {
        const id = await saveCalendarEvent({ title, event_date: date, event_time: at, duration: '', location: '', scope });
        return { icon: 'calendar-plus', text: `En el calendario: ${title}, ${dayText(date)}${at ? ` a las ${at}` : ''}${scope === 'private' ? ' (solo para ti)' : ''}.`, open: 'calendar', undo: id ? () => deleteCalendarEvent(id) : null };
      } };
    },

    // Hecho: «he sacado la basura», «marca pagar la luz como hecha».
    (p) => {
      const match = p.low.match(/^(?:marca|tacha)\s+(.+?)\s+como\s+(?:hech|complet|termin)[ao]s?$/) || p.low.match(/^(?:ya\s+)?(?:he|hemos)\s+(?:hecho|terminado|acabado)\s+(.+)$/) || p.low.match(/^(?:ya\s+)?(?:he|hemos)\s+([a-z]+(?:ado|ido|to|cho)\s+.+)$/) || p.low.match(/^(?:ya\s+)?(?:esta|estan)\s+hech[ao]s?\s+(.+)$/);
      if (!match) return null;
      const what = match[1];
      return { run: async () => {
        const candidates = householdTasks.filter((task) => task.active !== false).map((task) => ({ task, score: overlap(what, task.title) })).filter((entry) => entry.score >= 0.6).sort((a, b) => b.score - a.score || (isPendingNow(b.task) - isPendingNow(a.task)));
        const task = candidates[0]?.task;
        if (!task) return { icon: 'list-checks', text: `No encuentro ninguna tarea pendiente que se parezca a «${piece(p, match, 1)}».`, tone: 'warn', open: 'pendientes' };
        const { toasts } = await quietly(() => completeTask(task.id));
        const undo = toasts.find((toast) => toast.onAction)?.onAction;
        return { icon: 'circle-check', text: isRoutine(task) ? `Hecho: ${task.title}. Próxima vez: ${dayText(task.due_date)}.` : `Hecho: ${task.title}. ¡Una menos!`, open: 'pendientes', undo };
      } };
    },

    // Tareas: «recuérdame pagar la luz el viernes», «Matteo tiene que llamar al casero».
    (p) => {
      const other = fold(otherPerson(currentUser));
      const forOther = p.low.match(new RegExp(`^(?:que\\s+)?(${other}|${fold(currentUser)})\\s+(?:tiene que|debe|que)\\s+(.+)$`));
      const match = forOther || p.low.match(/^(?:recuerdame|recuerda(?:me)?|recordatorio|tengo que|tenemos que|hay que|debo|debemos|no (?:me |nos )?olvide(?:mos)? (?:de )?|(?:apunta|anota|anade|crea|pon)(?:me)?\s+(?:una\s+)?tarea\s*(?:de|:|para)?|tarea\s*:|pendiente\s*:)\s*(.+)$/);
      if (!match) return null;
      const text = piece(p, match, forOther ? 2 : 1);
      // Lo de la compra con «hay que comprar leche» va a la compra (si no tiene plazo).
      const parsed = parseQuickAdd(text);
      if (/^compra(?:r)?\s/.test(fold(text)) && !parsed.dueDate && !/\bpara\b/.test(fold(text))) return null;
      const assignee = forOther ? (fold(forOther[1]) === fold(currentUser) ? currentUser : otherPerson(currentUser)) : parsed.assignee || (/^(?:tengo que|recuerdame|debo|recuerda)/.test(p.low) ? currentUser : 'both');
      return { run: async () => {
        const { value: task } = await quietly(() => createTask({ title: parsed.title || capitalizeFirst(text), dueDate: parsed.noDeadline ? NO_DEADLINE : parsed.dueDate, recurrence: parsed.recurrence, assignee, priority: parsed.priority, minutes: parsed.minutes, list: parsed.list }));
        if (!task) return { icon: 'circle-alert', text: 'No he podido guardar la tarea.', tone: 'warn' };
        const when = isRoutine(task) ? `cada ${{ daily: 'día', weekly: 'semana', biweekly: 'dos semanas', monthly: 'mes', yearly: 'año' }[task.recurrence] || 'cierto tiempo'}` : hasDeadline(task) ? `para ${dayText(task.due_date)}` : 'sin plazo';
        const who = task.assignee === 'both' ? '' : task.assignee === currentUser ? ', para ti' : `, para ${task.assignee}`;
        return { icon: 'list-checks', text: `Apuntado en Por hacer: ${task.title}, ${when}${task.list ? ` (#${task.list})` : ''}${who}.`, open: 'pendientes', undo: () => quietly(() => deleteTask(task.id)) };
      } };
    },

    // Compra: «apunta leche», «añade 2 kilos de patatas a la compra», «se ha acabado el café».
    (p) => {
      const target = /\b(?:a|en|para)\s+(?:la\s+)?(?:lista\s+(?:de\s+(?:la\s+)?)?)?compra\b|\bal super\b|\bpara el super\b/;
      const verb = /^(?:compra|comprar|(?:hay|tengo|tenemos) que comprar|necesitamos|nos falta|nos faltan|falta|faltan|se (?:nos )?(?:ha|han) acabado|se acabo|se acabaron|no queda|no quedan|no hay)\s+/;
      const add = /^(?:apunta|anota|anade|agrega|pon|mete|incluye)(?:me)?\s+/;
      if (!target.test(p.low) && !verb.test(p.low)) return null;
      const items = strip(p, target, verb, add, /^(?:en\s+)?la\s+compra\s*:?/, /^lista de la compra\s*:?/);
      if (!items) return null;
      return { run: () => addToShopping(items) };
    },

    // Último intento: «apunta X» → si suena a acción («llamar al fontanero») es una tarea; si
    // no («leche»), va a la compra.
    (p) => {
      const match = p.low.match(/^(?:apunta|anota|anade|agrega|pon|mete)(?:me)?\s+(.+)$/);
      const parsed = parseQuickAdd(p.orig);
      const firstWord = (match ? match[1] : p.low).split(' ')[0];
      const looksLikeAction = /^[a-z]{3,}(?:ar|er|ir)$/.test(firstWord) && !/^(?:azucar|ajoar|alfiler|mujer|elixir)$/.test(firstWord);
      if (match && !looksLikeAction && !parsed.dueDate) return { run: () => addToShopping(piece(p, match, 1)) };
      if (match || looksLikeAction || (parsed.dueDate && parsed.title)) {
        const text = match ? piece(p, match, 1) : p.orig;
        const task = parseQuickAdd(text);
        return { run: async () => {
          const { value: created } = await quietly(() => createTask({ title: task.title || capitalizeFirst(text), dueDate: task.noDeadline ? NO_DEADLINE : task.dueDate, recurrence: task.recurrence, assignee: task.assignee || 'both', priority: task.priority, minutes: task.minutes, list: task.list }));
          if (!created) return { icon: 'circle-alert', text: 'No he podido guardar la tarea.', tone: 'warn' };
          return { icon: 'list-checks', text: `Apuntado en Por hacer: ${created.title}${hasDeadline(created) && !isRoutine(created) ? `, para ${dayText(created.due_date)}` : ''}.`, open: 'pendientes', undo: () => quietly(() => deleteTask(created.id)) };
        } };
      }
      return null;
    }
  ];

  async function addToShopping(text) {
    const before = new Set(shoppingItems.map((item) => item.id));
    const parsed = parseShoppingInput(text);
    if (!parsed.length) return { icon: 'shopping-basket', text: '¿Qué apunto en la compra?', tone: 'warn' };
    const { toasts } = await quietly(() => addShoppingItems(text));
    const created = shoppingItems.filter((item) => !before.has(item.id));
    if (!created.length) {
      const already = toasts[0]?.message;
      return { icon: 'shopping-basket', text: already ? `${already}.` : 'No he podido añadirlo a la compra.', tone: already ? 'info' : 'warn', open: 'compra' };
    }
    const repeated = parsed.length - created.length;
    return {
      icon: 'shopping-basket',
      text: `Añadido a la compra: ${listText(created.map(itemLabel))}${repeated > 0 ? ` (lo demás ya estaba)` : ''}.`,
      open: 'compra',
      undo: async () => { await quietly(async () => { for (const item of created) await removeShoppingItem(item.id); }); }
    };
  }

  function understand(text) {
    return splitCommands(text).map((command) => {
      const p = phrase(command);
      for (const handler of handlers) {
        const plan = handler(p);
        if (plan) return { command, ...plan };
      }
      return { command, run: async () => ({ icon: 'help-circle', tone: 'warn', text: `No sé qué hacer con «${command}». Prueba con «apunta leche», «recuérdame pagar la luz el viernes», «cena con Clara el sábado a las 21» o «he regado la monstera».` }) };
    });
  }

  // ---------- Pantalla ----------
  const sheet = document.querySelector('#assistantSheet');
  const log = document.querySelector('#assistantLog');
  const form = document.querySelector('#assistantForm');
  const input = document.querySelector('#assistantInput');
  const micButton = document.querySelector('#assistantMic');
  if (!sheet || !form) return;

  // listen: empieza a dictar al abrir (el micro de la barra de Inicio), si el navegador puede.
  function open(prefill = '', { listen = false } = {}) {
    sheet.classList.add('visible');
    if (history.state?.page !== 'assistant') history.pushState({ page: 'assistant' }, '', '#asistente');
    renderSuggestions();
    if (prefill) input.value = prefill;
    if (listen && micButton && !micButton.hidden) setTimeout(() => micButton.click(), 200);
    else setTimeout(() => input.focus(), 250);
  }
  function close() {
    if (!sheet.classList.contains('visible')) return;
    stopListening();
    if (history.state?.page === 'assistant') history.back();
    else sheet.classList.remove('visible');
  }
  window.addEventListener('popstate', () => { if (history.state?.page !== 'assistant') { sheet.classList.remove('visible'); stopListening(); } });

  function bubble(html, who, extra = '') {
    log.querySelector('.assistant-hello')?.remove();
    const el = document.createElement('div');
    el.className = `assistant-msg is-${who} ${extra}`.trim();
    el.innerHTML = html;
    log.appendChild(el);
    lucide.createIcons();
    el.scrollIntoView({ behavior: 'smooth', block: 'end' });
    return el;
  }

  function renderSuggestions() {
    const host = document.querySelector('#assistantSuggestions');
    const thirsty = (typeof householdPlants !== 'undefined' ? householdPlants : []).find((plant) => plant.next_water_on && plant.next_water_on <= today());
    const ideas = [
      thirsty ? `He regado ${thirsty.name}` : 'Apunta leche y pan',
      '¿Qué tengo hoy?',
      'Recuérdame pagar la luz el viernes',
      'Cena con Clara el sábado a las 21',
      'He pagado 24,50 de cena a medias',
      '¿Qué falta en la compra?'
    ];
    host.innerHTML = ideas.map((idea) => `<button type="button" class="suggestion-chip" data-assistant-idea="${escapeHtml(idea)}">${escapeHtml(idea)}</button>`).join('');
  }

  let busy = false;
  async function handle(text) {
    const clean = String(text || '').trim();
    if (!clean || busy) return;
    busy = true;
    input.value = '';
    bubble(escapeHtml(clean), 'me');
    const typing = bubble('<span class="assistant-typing"><i></i><i></i><i></i></span>', 'bot');
    try {
      for (const plan of understand(clean)) {
        let reply;
        try {
          reply = await plan.run();
        } catch (error) {
          console.error('[Umbral] Asistente:', error);
          reply = { icon: 'circle-alert', tone: 'warn', text: `No he podido hacerlo: ${error.message || 'error desconocido'}.` };
        }
        const el = bubble(`<span class="assistant-icon"><i data-lucide="${reply.icon || 'sparkles'}"></i></span><span class="assistant-copy"><span>${escapeHtml(reply.text)}</span>${reply.undo || reply.open ? `<span class="assistant-actions">${reply.open ? `<button type="button" data-assistant-open="${escapeHtml(reply.open)}">Ver</button>` : ''}${reply.undo ? '<button type="button" data-assistant-undo>Deshacer</button>' : ''}</span>` : ''}</span>`, 'bot', reply.tone ? `is-${reply.tone}` : '');
        if (reply.undo) el.querySelector('[data-assistant-undo]').addEventListener('click', async (event) => {
          const button = event.currentTarget;
          button.disabled = true;
          try {
            await reply.undo();
            el.classList.add('is-undone');
            button.textContent = 'Deshecho';
          } catch (error) {
            button.disabled = false;
            showToast('No se pudo deshacer');
          }
        }, { once: true });
        typing.before(el);
      }
      window.umbralMobile?.tap?.();
    } finally {
      typing.remove();
      busy = false;
    }
  }

  form.addEventListener('submit', (event) => { event.preventDefault(); stopListening(); handle(input.value); });
  sheet.addEventListener('click', (event) => {
    const idea = event.target.closest('[data-assistant-idea]');
    if (idea) return handle(idea.dataset.assistantIdea);
    const target = event.target.closest('[data-assistant-open]');
    if (target) {
      const where = target.dataset.assistantOpen;
      close();
      setTimeout(() => openLinkTarget(where), 260);
      return;
    }
    if (event.target.closest('[data-close-assistant]')) close();
  });

  // ---------- Voz ----------
  // Si el navegador lo permite, el micrófono dicta directamente; si no, el del teclado del
  // iPhone (el micro junto a la barra espaciadora) funciona igual en el campo de texto.
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  let recognition = null;
  function stopListening() {
    if (recognition) { try { recognition.stop(); } catch {} }
    micButton?.classList.remove('is-listening');
  }
  if (micButton) {
    micButton.hidden = !Recognition;
    micButton.addEventListener('click', () => {
      if (recognition && micButton.classList.contains('is-listening')) return stopListening();
      recognition = new Recognition();
      recognition.lang = 'es-ES';
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;
      let finalText = '';
      recognition.onresult = (event) => {
        const text = [...event.results].map((result) => result[0].transcript).join('');
        input.value = text;
        if ([...event.results].every((result) => result.isFinal)) finalText = text;
      };
      recognition.onerror = (event) => {
        micButton.classList.remove('is-listening');
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') showToast('Sin permiso para el micrófono: usa el micro del teclado');
      };
      recognition.onend = () => {
        micButton.classList.remove('is-listening');
        if (finalText.trim()) handle(finalText);
      };
      micButton.classList.add('is-listening');
      try { recognition.start(); } catch { micButton.classList.remove('is-listening'); }
    });
  }

  window.umbralAssistant = { open, close, understand, handle, splitCommands };
})();
