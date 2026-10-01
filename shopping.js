// Lista de la compra compartida: se sincroniza en tiempo real, agrupa por pasillo
// del súper, sugiere "lo de siempre" a partir de lo que ya habéis comprado y, al
// terminar, puede registrar el gasto en Cuentas de casa.
const shoppingStore = createHouseholdStore({ table: 'shopping_items', localKey: 'umbral-shopping' });

// Orden de los pasillos al recorrer el súper.
const SHOPPING_CATEGORIES = [
  { name: 'Fruta y verdura', icon: 'apple' },
  { name: 'Panadería', icon: 'croissant' },
  { name: 'Carne y pescado', icon: 'beef' },
  { name: 'Lácteos y huevos', icon: 'milk' },
  { name: 'Despensa', icon: 'package' },
  { name: 'Bebidas', icon: 'wine' },
  { name: 'Congelados', icon: 'snowflake' },
  { name: 'Limpieza', icon: 'spray-can' },
  { name: 'Higiene', icon: 'bath' },
  { name: 'Otros', icon: 'shopping-basket' }
];

// Palabras en español e italiano, sin tildes. Se comprueban en este orden
// ("pasta de dientes" es Higiene antes que Despensa).
const SHOPPING_MATCHERS = [
  ['Higiene', /champu|shampoo|gel de|jabon|sapone|pasta de dient|dentifric|cepillo|desodorant|deodorant|papel higien|carta igien|compresa|tampon|maquinill|rasoio|crema|colutorio|algodon/],
  ['Limpieza', /detergent|detersiv|lejia|candeggin|suavizant|ammorbid|lavavajill|friegasuel|bayeta|estropajo|spugn|bolsas de basura|sacchett|papel de cocina|scottex|limpia|ambientador|pastillas lavav/],
  ['Congelados', /congelad|surgelat|helado|gelato|hielo/],
  ['Bebidas', /\bagua\b|acqua|zumo|succo|refresco|cerveza|birra|\bvino\b|prosecco|spritz|aperol|\bcola\b|tonica|bibit/],
  ['Carne y pescado', /pollo|carne|ternera|cerdo|jamon|chorizo|salchich|pavo|hamburgues|pescado|salmon|atun|merluz|gamba|marisco|manzo|maiale|prosciutto|salame|salsicc|tacchino|pesce|tonno|gamber|bresaola|pancett|bacon/],
  ['Lácteos y huevos', /leche|latte|yogur|queso|formagg|mantequill|burro|\bnata\b|panna|huevo|uova|mozzarell|parmigian|grana|ricotta|mascarpone|stracchino/],
  ['Panadería', /^pan\b|\bpan de|pane\b|barra de pan|bollo|croissant|cornett|brioche|galleta|biscott|grissin|focaccia|tostad|pan de molde|piadin/],
  ['Fruta y verdura', /manzan|mela|mele|platan|banan|naranj|arancia|limon|fresa|fragol|\buva\b|pera|melon|sandia|anguria|tomat|pomodor|lechug|insalat|ensalad|cebol|cipoll|\bajo\b|aglio|patata|zanahor|carot|pimient|peperon|calabac|zucchin|berenjen|melanzan|espinac|spinac|brocol|aguacat|avocado|fruta|frutta|verdur|basilic|perejil|prezzemol|funghi|champin|seta/],
  ['Despensa', /arroz|riso|pasta|espagueti|spaghetti|macarr|harina|farina|azucar|zucchero|\bsal\b|aceite|olio|vinagre|aceto|legumbr|lentej|lenticch|garbanz|ceci|judia|fagiol|conserva|\bcafe\b|caffe|\bte\b|cereal|miel|mermelad|marmellat|chocolat|cioccolat|nutella|salsa|sugo|passata|galletas|frutos secos|nueces|especias|caldo/]
];

const SHOPPING_STAPLES = ['Leche', 'Pan', 'Huevos', 'Fruta', 'Café', 'Papel higiénico', 'Tomates', 'Pasta'];

let shoppingItems = [];
let shoppingHistory = [];
let shoppingReloadTimer;


function shoppingCategory(name) {
  const text = normalizeText(name);
  return SHOPPING_MATCHERS.find(([, pattern]) => pattern.test(text))?.[0] || 'Otros';
}

// "leche, pan y 6 huevos" → tres artículos; "2 kg de patatas" → cantidad "2kg".
function parseShoppingInput(text) {
  const unit = '(?:kg|gr?|l|ml|cl|uds?|unidades|paquetes?|botellas?|latas?|bricks?)';
  return text.split(/[,;\n]+|\s+y\s+|\s+e\s+/).map((part) => part.trim()).filter(Boolean).map((part) => {
    let match = part.match(new RegExp(`^(\\d+(?:[.,]\\d+)?\\s*${unit}?)\\s+(?:de\\s+|di\\s+)?(.+)$`, 'i'));
    if (match) return { quantity: match[1].replace(/\s+/g, ''), name: capitalizeFirst(match[2].trim()) };
    match = part.match(new RegExp(`^(.+?)\\s+x?\\s*(\\d+(?:[.,]\\d+)?\\s*${unit}?)$`, 'i'));
    if (match) return { quantity: match[2].replace(/\s+/g, ''), name: capitalizeFirst(match[1].trim()) };
    return { quantity: '', name: capitalizeFirst(part) };
  }).filter((item) => item.name.length <= 80);
}

async function loadShopping() {
  try {
    const [items, history] = await Promise.all([
      shoppingStore.list({ build: (query) => query.in('status', ['pending', 'in_cart']).order('created_at'), filter: (row) => row.status !== 'done' }),
      shoppingStore.list({ build: (query) => query.eq('status', 'done').order('done_at', { ascending: false }).limit(200), filter: (row) => row.status === 'done' })
    ]);
    shoppingItems = items.sort((first, second) => String(first.created_at).localeCompare(String(second.created_at)));
    shoppingHistory = history;
  } catch (error) {
    console.error('[Umbral] Compra:', error);
    showToast(`No se pudo cargar la compra: ${error.message || 'error desconocido'}`);
  }
  renderShopping();
}

function shoppingItemRow(item) {
  const checked = item.status === 'in_cart';
  return `<div class="list-item shop-item ${checked ? 'is-checked' : ''}">
    <button type="button" class="check-button" data-shop-toggle="${item.id}" aria-label="${checked ? 'Devolver a la lista' : 'Marcar como en el carro'}" aria-pressed="${checked}"><i data-lucide="check"></i></button>
    <span class="list-item-copy"><strong>${escapeHtml(item.name)}</strong>${item.quantity ? `<span class="qty-badge">${escapeHtml(item.quantity)}</span>` : ''}</span>
    ${item.added_by ? `<span class="person-chip" title="Lo añadió ${escapeHtml(item.added_by)}">${escapeHtml(initialsOf(item.added_by))}</span>` : ''}
    <button type="button" class="icon-ghost" data-shop-delete="${item.id}" aria-label="Quitar ${escapeHtml(item.name)}" title="Quitar"><i data-lucide="x"></i></button>
  </div>`;
}

function shoppingSuggestions() {
  const onList = new Set(shoppingItems.map((item) => normalizeText(item.name)));
  const counts = new Map();
  shoppingHistory.forEach((item) => {
    const key = normalizeText(item.name);
    if (onList.has(key)) return;
    const entry = counts.get(key) || { name: item.name, count: 0 };
    entry.count += 1;
    counts.set(key, entry);
  });
  const frequent = [...counts.values()].sort((first, second) => second.count - first.count).slice(0, 10).map((entry) => entry.name);
  if (frequent.length) return { label: 'Lo de siempre', names: frequent };
  return { label: 'Ideas para empezar', names: SHOPPING_STAPLES.filter((name) => !onList.has(normalizeText(name))) };
}

function renderShopping() {
  const pending = shoppingItems.filter((item) => item.status === 'pending');
  const inCart = shoppingItems.filter((item) => item.status === 'in_cart');
  const list = document.querySelector('#shoppingList');
  if (!list) return;

  document.querySelector('#shoppingCount').textContent = pending.length ? `${pending.length} por comprar` : inCart.length ? 'Todo en el carro' : 'Lista vacía';
  // Una categoría que ya no existe va a «Otros» para que el artículo no desaparezca.
  const known = new Set(SHOPPING_CATEGORIES.map((category) => category.name));
  const categoryOf = (item) => (known.has(item.category) ? item.category : 'Otros');
  const groups = SHOPPING_CATEGORIES.map((category) => ({ category, items: pending.filter((item) => categoryOf(item) === category.name) })).filter((group) => group.items.length);
  list.innerHTML = groups.length
    ? groups.map(({ category, items }) => `<section class="list-group"><p class="list-group-title"><i data-lucide="${category.icon}"></i>${category.name}<span>${items.length}</span></p>${items.map(shoppingItemRow).join('')}</section>`).join('')
    : `<div class="empty-state"><span class="empty-state-icon"><i data-lucide="${inCart.length ? 'party-popper' : 'shopping-basket'}"></i></span><strong>${inCart.length ? '¡Todo en el carro!' : 'La lista está vacía'}</strong><span>${inCart.length ? 'Cuando paguéis, pulsa «Terminar compra».' : 'Escribe «leche, pan y 6 huevos» para añadir varias cosas a la vez.'}</span></div>`;

  const cart = document.querySelector('#shoppingCart');
  cart.hidden = !inCart.length;
  document.querySelector('#shoppingCartCount').textContent = `${inCart.length} ${inCart.length === 1 ? 'artículo' : 'artículos'}`;
  document.querySelector('#shoppingCartList').innerHTML = inCart.map(shoppingItemRow).join('');
  if (!inCart.length) document.querySelector('#shoppingFinishForm').hidden = true;

  const suggestions = shoppingSuggestions();
  document.querySelector('#shoppingSuggestionsLabel').textContent = suggestions.label;
  document.querySelector('#shoppingSuggestions').innerHTML = suggestions.names.map((name) => `<button type="button" class="suggestion-chip" data-shop-suggest="${escapeHtml(name)}"><i data-lucide="plus"></i>${escapeHtml(name)}</button>`).join('');
  document.querySelector('#shoppingSuggestionsBlock').hidden = !suggestions.names.length;

  // Resumen en Inicio y en la navegación.
  document.querySelector('#shoppingTileValue').textContent = pending.length ? `${pending.length} ${pending.length === 1 ? 'cosa' : 'cosas'}` : 'Lista vacía';
  document.querySelector('#shoppingTileDetail').textContent = pending.length ? pending.slice(0, 3).map((item) => item.name).join(', ') : inCart.length ? 'Todo en el carro' : 'Toca para añadir';
  setNavBadge('compra', pending.length);
  updateDaySummary({ shopping: pending.length });
  lucide.createIcons();
}

async function addShoppingItems(text) {
  const parsed = parseShoppingInput(text);
  const known = new Set(shoppingItems.map((item) => normalizeText(item.name)));
  const fresh = parsed.filter((item) => !known.has(normalizeText(item.name)));
  if (!fresh.length) {
    if (parsed.length) showToast(parsed.length === 1 ? `${parsed[0].name} ya estaba en la lista` : 'Ya estaba todo en la lista');
    return false;
  }
  try {
    const created = await shoppingStore.insert(fresh.map((item) => ({ ...item, category: shoppingCategory(item.name), status: 'pending', added_by: currentUser })));
    shoppingItems.push(...created);
    renderShopping();
    showToast(fresh.length === 1 ? `${fresh[0].name} añadido` : `${fresh.length} cosas añadidas`);
    notifyHousehold(`${currentUser} añadió a la compra`, capitalizeFirst(summarizeList(fresh.map((item) => item.name))), { open: 'compra', tag: 'shopping' });
    return true;
  } catch (error) {
    showSupabaseError('No se pudo añadir a la compra', error);
    return false;
  }
}

async function toggleShoppingItem(id) {
  const item = shoppingItems.find((entry) => entry.id === id);
  if (!item) return;
  const previous = item.status;
  item.status = previous === 'in_cart' ? 'pending' : 'in_cart';
  renderShopping();
  try {
    await shoppingStore.update(id, { status: item.status });
  } catch (error) {
    item.status = previous;
    renderShopping();
    showSupabaseError('No se pudo actualizar la compra', error);
  }
}

async function removeShoppingItem(id) {
  const index = shoppingItems.findIndex((entry) => entry.id === id);
  if (index < 0) return;
  const [removed] = shoppingItems.splice(index, 1);
  renderShopping();
  try {
    await shoppingStore.remove(id);
  } catch (error) {
    shoppingItems.splice(index, 0, removed);
    renderShopping();
    showSupabaseError('No se pudo quitar de la compra', error);
  }
}

async function finishShopping({ amount, paidBy }) {
  const inCart = shoppingItems.filter((item) => item.status === 'in_cart');
  if (!inCart.length) return;
  try {
    if (amount > 0) {
      financeEditing = null;
      await saveFinanceEntity('expense', { description: `Compra (${inCart.length} ${inCart.length === 1 ? 'artículo' : 'artículos'})`, amount, paid_by: paidBy, category: 'Alimentación', expense_date: dateToISO(new Date()), source: 'manual', settled: false }, { notify: false });
    }
    const doneAt = new Date().toISOString();
    await shoppingStore.update(inCart.map((item) => item.id), { status: 'done', done_at: doneAt });
    const doneIds = new Set(inCart.map((item) => item.id));
    shoppingItems = shoppingItems.filter((item) => !doneIds.has(item.id));
    shoppingHistory = [...inCart.map((item) => ({ ...item, status: 'done', done_at: doneAt })), ...shoppingHistory];
    renderShopping();
    showToast(amount > 0 ? `Compra terminada · gasto de ${financeMoney(amount)} registrado` : 'Compra terminada');
    notifyHousehold(`${currentUser} hizo la compra`, `${inCart.length} ${inCart.length === 1 ? 'artículo' : 'artículos'}${amount > 0 ? ` · ${financeMoney(amount)} pagados por ${paidBy}` : ''}`, { open: 'compra', tag: 'shopping' });
  } catch (error) {
    showSupabaseError('No se pudo terminar la compra', error);
  }
}

document.querySelector('#shoppingForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const input = event.currentTarget.querySelector('input');
  const text = input.value.trim();
  if (!text) return input.focus();
  if (await addShoppingItems(text)) input.value = '';
  input.focus();
});

document.querySelector('#shoppingView').addEventListener('click', (event) => {
  const toggle = event.target.closest('[data-shop-toggle]');
  if (toggle) return toggleShoppingItem(toggle.dataset.shopToggle);
  const remove = event.target.closest('[data-shop-delete]');
  if (remove) return removeShoppingItem(remove.dataset.shopDelete);
  const suggestion = event.target.closest('[data-shop-suggest]');
  if (suggestion) return addShoppingItems(suggestion.dataset.shopSuggest);
  if (event.target.closest('#shoppingFinishButton')) {
    const form = document.querySelector('#shoppingFinishForm');
    form.hidden = !form.hidden;
    if (!form.hidden) {
      form.paidBy.value = householdPeople.includes(currentUser) ? currentUser : householdPeople[0];
      form.amount.focus();
    }
  }
  if (event.target.closest('#shoppingFinishWithoutExpense')) finishShopping({ amount: 0 });
});

document.querySelector('#shoppingFinishForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  await finishShopping({ amount: Number(form.amount.value) || 0, paidBy: form.paidBy.value });
  form.reset();
  form.hidden = true;
});

function focusShoppingInput() {
  showView('compra');
  setTimeout(() => document.querySelector('#shoppingInput')?.focus({ preventScroll: true }), 350);
}

document.addEventListener('umbral:ready', () => {
  loadShopping();
  shoppingStore.subscribe(() => {
    clearTimeout(shoppingReloadTimer);
    shoppingReloadTimer = setTimeout(loadShopping, 300);
  });
});
