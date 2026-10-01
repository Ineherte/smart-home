// Cocina: menú semanal (comida y cena), recetas con su galería de fotos y conexión con la compra.
// El equilibrio de la semana sigue una guía orientativa de dieta mediterránea: legumbres y
// pescado varias veces, poca carne roja, verdura a menudo y pasta o arroz con moderación.
const recipesStore = createHouseholdStore({ table: 'recipes', localKey: 'umbral-recipes' });
const recipePhotosStore = createHouseholdStore({ table: 'recipe_photos', localKey: 'umbral-recipe-photos' });
const mealPlanStore = createHouseholdStore({ table: 'meal_plan', localKey: 'umbral-meal-plan' });

const RECIPE_GROUPS = {
  legumbres: { label: 'Legumbres', icon: 'bean', tone: 'amber' },
  pescado: { label: 'Pescado', icon: 'fish', tone: 'blue' },
  aves: { label: 'Pollo y pavo', icon: 'drumstick', tone: 'amber' },
  carne: { label: 'Carne roja', icon: 'beef', tone: 'coral' },
  huevos: { label: 'Huevos', icon: 'egg', tone: 'amber' },
  verdura: { label: 'Verdura', icon: 'carrot', tone: 'green' },
  pasta: { label: 'Pasta', icon: 'wheat', tone: 'lilac' },
  arroz: { label: 'Arroz', icon: 'wheat', tone: 'lilac' },
  sopa: { label: 'Sopas y cremas', icon: 'soup', tone: 'green' },
  otros: { label: 'Otros', icon: 'utensils', tone: 'neutral' }
};
// Raciones por semana (14 comidas). min/max orientativos.
const WEEK_BALANCE = [
  { key: 'legumbres', label: 'Legumbres', groups: ['legumbres'], min: 3, max: 5 },
  { key: 'pescado', label: 'Pescado', groups: ['pescado'], min: 3, max: 5 },
  { key: 'verdura', label: 'Verdura', groups: ['verdura', 'sopa'], min: 4, max: 14 },
  { key: 'aves', label: 'Pollo', groups: ['aves'], min: 1, max: 3 },
  { key: 'huevos', label: 'Huevos', groups: ['huevos'], min: 1, max: 4 },
  { key: 'hidratos', label: 'Pasta y arroz', groups: ['pasta', 'arroz'], min: 0, max: 4 },
  { key: 'carne', label: 'Carne roja', groups: ['carne'], min: 0, max: 1 }
];
const SLOTS = { lunch: 'Comida', dinner: 'Cena' };
const PANTRY = /^(sal|pimienta|aceite|aceite de oliva|agua|vinagre|azucar|harina|especias|oregano|comino|pimenton|caldo)$/;

// Recetas de ejemplo, sencillas y equilibradas (se añaden solo si lo pedís).
const STARTER_RECIPES = [
  ['Lentejas estofadas con verduras', 'legumbres', 'lunch', 45, ['300 g lentejas', '1 zanahoria', '1 pimiento verde', '1 cebolla', '2 dientes de ajo', '1 patata', 'Pimentón', 'Aceite de oliva'], 'Sofríe cebolla, ajo, pimiento y zanahoria. Añade el pimentón, las lentejas lavadas y la patata en trozos. Cubre de agua y cuece 35 min a fuego suave.'],
  ['Garbanzos con espinacas', 'legumbres', 'any', 25, ['1 bote de garbanzos cocidos', '300 g espinacas', '2 dientes de ajo', '1 rebanada de pan', 'Comino', 'Pimentón'], 'Fríe el pan y el ajo y májalos con comino y pimentón. Saltea las espinacas, añade los garbanzos y la majada con un poco de agua. 10 min.'],
  ['Pasta e fagioli', 'legumbres', 'lunch', 35, ['200 g pasta corta', '1 bote de alubias borlotti', '1 zanahoria', '1 rama de apio', '1 cebolla', '200 g tomate triturado', 'Parmesano'], 'Sofrito de cebolla, zanahoria y apio. Añade tomate y la mitad de las alubias aplastadas, luego el resto y agua. Cuece la pasta dentro. Parmesano al servir.'],
  ['Hummus con crudités y pan de pita', 'legumbres', 'dinner', 15, ['1 bote de garbanzos', '1 cucharada de tahini', '1 limón', '1 diente de ajo', '2 zanahorias', '1 pepino', 'Pan de pita'], 'Tritura garbanzos, tahini, limón, ajo y un chorrito de su agua. Sirve con verduras en bastones y pita tostada.'],
  ['Merluza al horno con patatas', 'pescado', 'lunch', 40, ['4 lomos de merluza', '3 patatas', '1 cebolla', '1 limón', 'Perejil', 'Aceite de oliva'], 'Hornea patatas y cebolla en láminas 25 min a 200 °C. Pon la merluza encima con limón y perejil y hornea 10 min más.'],
  ['Salmón con verduras al horno', 'pescado', 'dinner', 30, ['2 lomos de salmón', '1 calabacín', '1 pimiento rojo', '1 cebolla morada', '1 limón', 'Eneldo'], 'Verduras en trozos al horno 15 min a 200 °C. Añade el salmón con limón y eneldo y hornea 12 min más.'],
  ['Bacalao con tomate', 'pescado', 'any', 30, ['400 g bacalao desalado', '400 g tomate triturado', '1 cebolla', '1 pimiento', '2 dientes de ajo'], 'Pocha cebolla, pimiento y ajo, añade el tomate y deja reducir. Pon el bacalao encima y cuece tapado 8 min.'],
  ['Pollo al curry con arroz', 'aves', 'lunch', 35, ['500 g pechuga de pollo', '1 cebolla', '200 ml leche de coco', '2 cucharadas de curry', '150 g arroz basmati', 'Cilantro'], 'Dora el pollo en dados, añade cebolla y curry, luego la leche de coco. 15 min. Sirve con el arroz cocido.'],
  ['Pechuga a la plancha con ensalada', 'aves', 'dinner', 20, ['2 pechugas de pollo', 'Lechuga', '2 tomates', '1 aguacate', '1 limón'], 'Plancha las pechugas fileteadas. Ensalada de lechuga, tomate y aguacate con limón.'],
  ['Tortilla de patatas', 'huevos', 'dinner', 40, ['6 huevos', '4 patatas', '1 cebolla', 'Aceite de oliva', 'Ensalada verde'], 'Pocha patata y cebolla en aceite, escurre, mezcla con los huevos batidos y cuaja por ambos lados. Acompaña con ensalada.'],
  ['Shakshuka', 'huevos', 'dinner', 25, ['4 huevos', '400 g tomate triturado', '1 pimiento rojo', '1 cebolla', 'Comino', 'Pan'], 'Sofríe cebolla y pimiento, añade tomate y comino y reduce. Haz huecos, casca los huevos y tapa hasta que cuajen.'],
  ['Frittata de calabacín', 'huevos', 'dinner', 25, ['6 huevos', '2 calabacines', '1 cebolleta', 'Parmesano', 'Albahaca'], 'Saltea el calabacín con la cebolleta, añade los huevos batidos con parmesano y termina 10 min al horno.'],
  ['Crema de calabaza', 'sopa', 'dinner', 35, ['800 g calabaza', '1 cebolla', '1 patata', '1 zanahoria', 'Jengibre', 'Semillas de calabaza'], 'Pocha la cebolla, añade el resto en trozos, cubre de agua y cuece 25 min. Tritura y sirve con semillas.'],
  ['Minestrone', 'sopa', 'any', 45, ['2 zanahorias', '2 ramas de apio', '1 calabacín', '1 patata', '100 g judías verdes', '1 bote de alubias', '100 g pasta pequeña'], 'Sofrito de verduras, añade agua y cuece 25 min. Añade alubias y pasta y cuece 10 min más.'],
  ['Wok de verduras con tofu', 'verdura', 'dinner', 20, ['200 g tofu firme', '1 brócoli', '1 pimiento', '1 zanahoria', 'Salsa de soja', 'Jengibre'], 'Dora el tofu en dados, saltea las verduras a fuego fuerte, junta todo con soja y jengibre.'],
  ['Ensalada de quinoa', 'verdura', 'any', 20, ['150 g quinoa', '1 pepino', '200 g tomates cherry', '100 g feta', '1 aguacate', '1 limón'], 'Cuece la quinoa 12 min, enfría y mezcla con las verduras, el feta y aliño de limón.'],
  ['Risotto de champiñones', 'arroz', 'lunch', 35, ['300 g arroz arborio', '300 g champiñones', '1 cebolla', '1 l caldo de verduras', 'Parmesano', 'Vino blanco'], 'Sofríe cebolla y champiñones, nacara el arroz, moja con vino y añade el caldo poco a poco 18 min. Termina con parmesano.'],
  ['Pasta al pesto con judías verdes', 'pasta', 'lunch', 20, ['320 g trofie o espaguetis', '150 g judías verdes', '2 patatas pequeñas', '1 bote de pesto', 'Parmesano'], 'Cuece la patata en dados, añade las judías y luego la pasta en la misma agua. Escurre y mezcla con el pesto.'],
  ['Albóndigas en salsa de tomate', 'carne', 'lunch', 45, ['500 g carne picada', '1 huevo', 'Pan rallado', '400 g tomate triturado', '1 cebolla', 'Perejil'], 'Forma albóndigas con la carne, el huevo, el pan y el perejil, dóralas y cuécelas 20 min en la salsa de tomate con cebolla.'],
  ['Pizza casera de verduras', 'otros', 'dinner', 40, ['1 masa de pizza', '200 g tomate triturado', '1 mozzarella', '1 calabacín', '1 pimiento', 'Orégano'], 'Extiende la masa, tomate, mozzarella y verduras en láminas. Horno a 230 °C unos 12 min.']
];

let recipes = [];
let recipePhotos = [];
let mealPlan = [];
// Lunes de la semana que se ve (null = la actual; dateToISO llega con app.js).
let kitchenWeekStart = null;
let kitchenView = 'menu';
let recipeFilter = { group: null, favorites: false, search: '' };
let kitchenReloadTimer;

function mondayOf(date) {
  const copy = new Date(date);
  copy.setHours(12, 0, 0, 0);
  copy.setDate(copy.getDate() - ((copy.getDay() + 6) % 7));
  return dateToISO(copy);
}
const shownWeek = () => kitchenWeekStart || mondayOf(new Date());
const weekDays = (start = shownWeek()) => Array.from({ length: 7 }, (_, index) => addDaysToISO(start, index));
const recipeById = (id) => recipes.find((recipe) => recipe.id === id);
const mealAt = (day, slot) => mealPlan.find((meal) => meal.day === day && meal.slot === slot);
const groupOf = (meal) => recipeById(meal?.recipe_id)?.category || null;
const ingredientName = (text) => normalizeText(String(text).replace(/^\s*[\d.,/½¼]+\s*(kg|g|gr|l|ml|cl|cucharadas?|cucharaditas?|tazas?|botes?|latas?|unidades?|uds?|dientes? de|ramas? de|rebanadas? de|lomos? de)?\s*(de\s+)?/i, ''));
const recipeCover = (recipe) => recipePhotos.filter((photo) => photo.recipe_id === recipe.id).sort((first, second) => String(second.taken_on).localeCompare(String(first.taken_on)))[0]?.path || recipe.photo_path || null;
const cookedCount = (recipe) => new Set([...recipePhotos.filter((photo) => photo.recipe_id === recipe.id).map((photo) => photo.taken_on), ...mealPlan.filter((meal) => meal.recipe_id === recipe.id && meal.day < todayISO()).map((meal) => meal.day)]).size;

// ---------- Datos ----------

async function loadKitchen() {
  try {
    const since = addDaysToISO(todayISO(), -120);
    const [recipeRows, photoRows, planRows] = await Promise.all([
      recipesStore.list({ build: (query) => query.eq('active', true).order('title'), filter: (row) => row.active !== false }),
      recipePhotosStore.list({ build: (query) => query.order('taken_on', { ascending: false }).limit(400) }),
      mealPlanStore.list({ build: (query) => query.gte('day', since), filter: (row) => row.day >= since })
    ]);
    recipes = recipeRows.map((recipe) => ({ ...recipe, ingredients: Array.isArray(recipe.ingredients) ? recipe.ingredients : [] }));
    recipePhotos = photoRows;
    mealPlan = planRows;
  } catch (error) {
    console.error('[Umbral] Cocina:', error);
    const panel = document.querySelector('#menuPanel');
    if (panel) panel.innerHTML = `<p class="empty-note">No se pudo cargar la cocina: ${escapeHtml(error.message || 'error')}. ¿Has ejecutado life.sql en Supabase?</p>`;
    return;
  }
  renderKitchen();
}

async function setMeal(day, slot, { recipeId = null, title }) {
  const existing = mealAt(day, slot);
  const row = { day, slot, recipe_id: recipeId, title: title.trim().slice(0, 80) };
  try {
    if (existing) {
      await mealPlanStore.update(existing.id, row);
      Object.assign(existing, row);
    } else {
      const [created] = await mealPlanStore.insert(row);
      mealPlan.push(created);
    }
    renderKitchen();
    return true;
  } catch (error) {
    showSupabaseError('No se pudo guardar el menú', error);
    return false;
  }
}

async function clearMeal(day, slot) {
  const existing = mealAt(day, slot);
  if (!existing) return;
  try {
    await mealPlanStore.remove(existing.id);
    mealPlan = mealPlan.filter((meal) => meal.id !== existing.id);
    renderKitchen();
  } catch (error) {
    showSupabaseError('No se pudo quitar', error);
  }
}

async function saveRecipe(values, id) {
  const row = {
    title: values.title.trim().slice(0, 80),
    category: RECIPE_GROUPS[values.category] ? values.category : 'otros',
    meal: ['lunch', 'dinner'].includes(values.meal) ? values.meal : 'any',
    minutes: Number(values.minutes) || null,
    servings: Number(values.servings) || null,
    ingredients: String(values.ingredients || '').split('\n').map((line) => line.trim()).filter(Boolean).slice(0, 40),
    steps: String(values.steps || '').trim().slice(0, 4000) || null,
    notes: String(values.notes || '').trim().slice(0, 600) || null
  };
  try {
    if (id) {
      await recipesStore.update(id, row);
      Object.assign(recipeById(id), row);
    } else {
      const [created] = await recipesStore.insert({ ...row, active: true, favorite: false });
      recipes.push({ ...created, ingredients: row.ingredients });
      id = created.id;
    }
    renderKitchen();
    return id;
  } catch (error) {
    showSupabaseError('No se pudo guardar la receta', error);
    return null;
  }
}

async function addStarterRecipes() {
  const existing = new Set(recipes.map((recipe) => normalizeText(recipe.title)));
  const rows = STARTER_RECIPES.filter(([title]) => !existing.has(normalizeText(title))).map(([title, category, meal, minutes, ingredients, steps]) => ({ title, category, meal, minutes, servings: 2, ingredients, steps, active: true, favorite: false }));
  try {
    const created = await recipesStore.insert(rows);
    recipes.push(...created.map((recipe) => ({ ...recipe, ingredients: Array.isArray(recipe.ingredients) ? recipe.ingredients : [] })));
    renderKitchen();
    showToast(`${created.length} recetas añadidas`);
  } catch (error) {
    showSupabaseError('No se pudieron añadir las recetas', error);
  }
}

async function addRecipePhoto(recipe) {
  const file = await pickPhoto();
  if (!file) return;
  try {
    showToast('Subiendo la foto…');
    const path = await uploadPhoto(file, 'recipes');
    const [created] = await recipePhotosStore.insert({ recipe_id: recipe.id, path, taken_on: todayISO() });
    recipePhotos.unshift(created);
    renderKitchen();
    if (kitchenSheetState?.kind === 'recipe') openRecipe(recipe.id);
    showToast('¡Foto guardada! 📸');
  } catch (error) {
    showToast(error.message || 'No se pudo subir la foto');
  }
}

// ---------- Equilibrio y sugerencias ----------

function weekBalance(start = shownWeek()) {
  const days = weekDays(start);
  const groups = mealPlan.filter((meal) => days.includes(meal.day)).map(groupOf).filter(Boolean);
  return WEEK_BALANCE.map((target) => ({ ...target, count: groups.filter((group) => target.groups.includes(group)).length }));
}

// Elige recetas para los huecos vacíos de la semana: primero lo que falta para el mínimo,
// sin pasarse de los máximos, sin repetir y con cenas más ligeras.
function suggestFor(day, slot, plannedGroups, used) {
  const counts = (groups) => plannedGroups.filter((group) => groups.includes(group)).length;
  const scored = recipes.filter((recipe) => !used.has(recipe.id) && (recipe.meal === 'any' || recipe.meal === slot)).map((recipe) => {
    const target = WEEK_BALANCE.find((entry) => entry.groups.includes(recipe.category));
    let score = Math.random() * 0.8;
    if (target) {
      const count = counts(target.groups);
      if (count >= target.max) score -= 10;
      if (count < target.min) score += 3 + (target.min - count);
    }
    if (slot === 'dinner' && ['verdura', 'sopa', 'pescado', 'huevos'].includes(recipe.category)) score += 1.2;
    if (slot === 'lunch' && ['legumbres', 'pasta', 'arroz', 'aves', 'carne'].includes(recipe.category)) score += 1;
    if (recipe.favorite) score += 0.6;
    return { recipe, score };
  }).sort((first, second) => second.score - first.score);
  return scored.map((entry) => entry.recipe);
}

async function fillWeek() {
  if (recipes.length < 4) {
    showToast('Añade algunas recetas primero (o las de ejemplo)');
    return setKitchenView('recipes');
  }
  const today = todayISO();
  const days = weekDays().filter((day) => day >= today);
  const planned = mealPlan.filter((meal) => weekDays().includes(meal.day));
  const plannedGroups = planned.map(groupOf).filter(Boolean);
  const used = new Set(planned.map((meal) => meal.recipe_id).filter(Boolean));
  const rows = [];
  days.forEach((day) => Object.keys(SLOTS).forEach((slot) => {
    if (mealAt(day, slot)) return;
    const recipe = suggestFor(day, slot, plannedGroups, used)[0];
    if (!recipe) return;
    used.add(recipe.id);
    plannedGroups.push(recipe.category);
    rows.push({ day, slot, recipe_id: recipe.id, title: recipe.title });
  }));
  if (!rows.length) return showToast('La semana ya está completa');
  try {
    const created = await mealPlanStore.insert(rows);
    mealPlan.push(...created);
    renderKitchen();
    showToast(`${created.length} comidas planificadas. Cambia las que quieras.`);
    notifyHousehold(`${currentUser} ha preparado el menú`, `${created.length} comidas para esta semana`, { open: 'cocina', tag: 'menu' });
  } catch (error) {
    showSupabaseError('No se pudo rellenar el menú', error);
  }
}

// ---------- Pintar ----------

const groupChip = (category) => `<span class="group-chip tone-${RECIPE_GROUPS[category]?.tone || 'neutral'}"><i data-lucide="${RECIPE_GROUPS[category]?.icon || 'utensils'}"></i>${escapeHtml(RECIPE_GROUPS[category]?.label || 'Otros')}</span>`;

function renderMenu() {
  const panel = document.querySelector('#menuPanel');
  const days = weekDays();
  const today = todayISO();
  const format = (iso, options) => new Intl.DateTimeFormat('es-ES', options).format(isoToDate(iso));
  const balance = weekBalance();
  const planned = mealPlan.filter((meal) => days.includes(meal.day)).length;
  const isThisWeek = days.includes(today);
  panel.innerHTML = `
    <div class="section-heading"><div><p class="eyebrow">Menú de la semana</p><h2>${isThisWeek ? 'Esta semana' : `Semana del ${format(days[0], { day: 'numeric', month: 'short' })}`}</h2></div><span class="count-pill">${planned}/14</span></div>
    <div class="finance-month menu-week"><button type="button" data-week-shift="-1" aria-label="Semana anterior"><i data-lucide="chevron-left"></i></button><strong>${format(days[0], { day: 'numeric', month: 'short' })} – ${format(days[6], { day: 'numeric', month: 'short' })}</strong><button type="button" data-week-shift="1" aria-label="Semana siguiente"><i data-lucide="chevron-right"></i></button></div>
    <div class="balance-chips" aria-label="Equilibrio de la semana">${balance.map((item) => {
      const state = item.count < item.min ? 'is-low' : item.count > item.max ? 'is-high' : 'is-ok';
      return `<span class="balance-chip ${state}" title="${escapeHtml(`${item.label}: ${item.count} (recomendado ${item.min}${item.max < 14 ? `–${item.max}` : '+'} a la semana)`)}"><b>${item.count}</b>${escapeHtml(item.label)}<i data-lucide="${state === 'is-ok' ? 'check' : state === 'is-low' ? 'arrow-up' : 'arrow-down'}"></i></span>`;
    }).join('')}</div>
    <div class="menu-actions"><button type="button" class="primary-button" data-fill-week><i data-lucide="wand-sparkles"></i> Rellenar con equilibrio</button><button type="button" class="pill-button" data-week-shopping><i data-lucide="shopping-basket"></i> Ingredientes a la compra</button></div>
    <div class="menu-days">${days.map((day) => `
      <div class="menu-day${day === today ? ' is-today' : ''}${day < today ? ' is-past' : ''}">
        <header><strong>${day === today ? 'Hoy' : capitalizeFirst(format(day, { weekday: 'long' }))}</strong><span>${format(day, { day: 'numeric', month: 'short' })}</span></header>
        <div class="menu-slots">${Object.entries(SLOTS).map(([slot, label]) => {
          const meal = mealAt(day, slot);
          const recipe = recipeById(meal?.recipe_id);
          const cover = recipe && recipeCover(recipe);
          return `<button type="button" class="menu-slot${meal ? ' is-set' : ''}" data-menu-slot="${day}|${slot}">
            <small>${label}</small>
            ${meal ? `<span class="menu-slot-main">${cover ? `<img alt="" data-photo="${escapeHtml(cover)}" />` : `<i data-lucide="${RECIPE_GROUPS[recipe?.category]?.icon || 'utensils'}"></i>`}<strong>${escapeHtml(meal.title)}</strong></span>` : '<span class="menu-slot-empty"><i data-lucide="plus"></i>Añadir</span>'}
          </button>`;
        }).join('')}</div>
      </div>`).join('')}</div>
    <p class="menu-guide"><i data-lucide="info"></i>Guía orientativa de dieta mediterránea: legumbres y pescado 3–4 veces por semana, verdura a diario, pollo o huevos algunas veces y carne roja como mucho una.</p>`;
  hydratePhotos(panel);
}

function renderRecipes() {
  const panel = document.querySelector('#recipesPanel');
  const query = normalizeText(recipeFilter.search);
  const list = recipes.filter((recipe) => (!recipeFilter.group || recipe.category === recipeFilter.group) && (!recipeFilter.favorites || recipe.favorite) && (!query || normalizeText(`${recipe.title} ${recipe.ingredients.join(' ')}`).includes(query)))
    .sort((first, second) => (second.favorite - first.favorite) || cookedCount(second) - cookedCount(first) || first.title.localeCompare(second.title));
  const groupsUsed = [...new Set(recipes.map((recipe) => recipe.category))];
  panel.innerHTML = `
    <div class="section-heading"><div><p class="eyebrow">Lo que cocinamos</p><h2>Recetas</h2></div><button type="button" class="pill-button" data-new-recipe><i data-lucide="plus"></i> Nueva</button></div>
    ${recipes.length ? `<input type="search" class="guide-search" data-recipe-search placeholder="Busca por nombre o ingrediente" value="${escapeHtml(recipeFilter.search)}" aria-label="Buscar recetas" />
    <div class="category-chips recipe-filters"><button type="button" class="filter-chip${recipeFilter.favorites ? ' is-on' : ''}" data-recipe-favorites><i data-lucide="heart"></i>Favoritas</button>${groupsUsed.map((group) => `<button type="button" class="filter-chip${recipeFilter.group === group ? ' is-on' : ''}" data-recipe-group="${group}"><i data-lucide="${RECIPE_GROUPS[group].icon}"></i>${RECIPE_GROUPS[group].label}</button>`).join('')}</div>` : ''}
    <div class="recipe-grid">${list.map((recipe) => {
      const cover = recipeCover(recipe);
      const cooked = cookedCount(recipe);
      return `<button type="button" class="recipe-card tone-${RECIPE_GROUPS[recipe.category].tone}" data-open-recipe="${escapeHtml(recipe.id)}">
        <span class="recipe-cover">${cover ? `<img alt="" data-photo="${escapeHtml(cover)}" />` : `<i data-lucide="${RECIPE_GROUPS[recipe.category].icon}"></i>`}${recipe.favorite ? '<em class="recipe-fav"><i data-lucide="heart"></i></em>' : ''}</span>
        <strong>${escapeHtml(recipe.title)}</strong>
        <small>${escapeHtml(RECIPE_GROUPS[recipe.category].label)}${recipe.minutes ? ` · ${minutesLabel(recipe.minutes)}` : ''}${cooked ? ` · ${cooked}× hecha` : ''}</small>
      </button>`;
    }).join('')}</div>
    ${!recipes.length ? `<div class="empty-state"><span class="empty-state-icon"><i data-lucide="chef-hat"></i></span><strong>Vuestro recetario</strong><span>Guardad aquí lo que cocináis, con fotos de cada vez que lo hacéis. Podéis empezar con 20 recetas sencillas y equilibradas.</span><button type="button" class="primary-button" data-starter-recipes><i data-lucide="sparkles"></i> Añadir recetas de ejemplo</button></div>` : !list.length ? '<p class="empty-note">Ninguna receta con estos filtros.</p>' : ''}`;
  hydratePhotos(panel);
}

function renderKitchen() {
  if (!document.querySelector('#kitchenView')) return;
  document.querySelectorAll('[data-kitchen-view]').forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.kitchenView === kitchenView)));
  document.querySelectorAll('[data-kitchen-pane]').forEach((pane) => { pane.hidden = pane.dataset.kitchenPane !== kitchenView; });
  if (kitchenView === 'menu') renderMenu();
  if (kitchenView === 'recipes') renderRecipes();
  // En Inicio: qué hay hoy de comer y cenar.
  const today = todayISO();
  updateDaySummary({ lunch: mealAt(today, 'lunch')?.title || null, dinner: mealAt(today, 'dinner')?.title || null });
  window.umbralScene?.update({ dinner: mealAt(today, 'dinner')?.title || '' });
  if (kitchenSheetState?.kind === 'recipe' && kitchenSheet.classList.contains('visible')) openRecipe(kitchenSheetState.id, { keep: true });
  lucide.createIcons();
}

function setKitchenView(view) {
  kitchenView = view;
  try { localStorage.setItem('umbral-kitchen-view', view); } catch {}
  renderKitchen();
  if (view === 'compra') renderShopping();
}

// ---------- Hojas ----------

const kitchenSheet = document.querySelector('#kitchenSheet');
let kitchenSheetState = null;

function showKitchenSheet(html, state) {
  kitchenSheetState = state;
  document.querySelector('#kitchenSheetBody').innerHTML = html;
  kitchenSheet.classList.add('visible');
  if (history.state?.page !== 'kitchen-sheet') history.pushState({ page: 'kitchen-sheet' }, '', '#cocina');
  hydratePhotos(kitchenSheet);
  lucide.createIcons();
}

function closeKitchenSheet() {
  if (!kitchenSheet.classList.contains('visible')) return;
  if (history.state?.page === 'kitchen-sheet') history.back();
  else hideKitchenSheet();
}

function hideKitchenSheet() {
  kitchenSheet.classList.remove('visible');
  kitchenSheetState = null;
}

function openSlot(day, slot) {
  const meal = mealAt(day, slot);
  const days = weekDays(mondayOf(isoToDate(day)));
  const plannedGroups = mealPlan.filter((entry) => days.includes(entry.day) && !(entry.day === day && entry.slot === slot)).map(groupOf).filter(Boolean);
  const used = new Set(mealPlan.filter((entry) => days.includes(entry.day)).map((entry) => entry.recipe_id).filter(Boolean));
  const suggestions = suggestFor(day, slot, plannedGroups, used).slice(0, 3);
  const label = `${SLOTS[slot]} del ${new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric' }).format(isoToDate(day))}`;
  const option = (recipe) => `<button type="button" class="recipe-option" data-pick-recipe="${escapeHtml(recipe.id)}"><span class="pcat-icon tone-${RECIPE_GROUPS[recipe.category].tone}"><i data-lucide="${RECIPE_GROUPS[recipe.category].icon}"></i></span><span><strong>${escapeHtml(recipe.title)}</strong><small>${escapeHtml(RECIPE_GROUPS[recipe.category].label)}${recipe.minutes ? ` · ${minutesLabel(recipe.minutes)}` : ''}</small></span></button>`;
  showKitchenSheet(`
    <div class="plant-add-heading"><p class="eyebrow muted">Menú</p><h2 id="kitchenSheetTitle">${escapeHtml(capitalizeFirst(label))}</h2></div>
    ${meal ? `<div class="current-meal"><strong>${escapeHtml(meal.title)}</strong><button type="button" class="link-button is-danger" data-clear-slot>Quitar</button></div>` : ''}
    <form class="quick-add slot-free" data-free-meal><div class="quick-add-row"><input name="title" type="text" maxlength="80" placeholder="Escribe algo: «sobras», «cena fuera»…" aria-label="Comida libre" /><button type="submit" aria-label="Guardar"><i data-lucide="check"></i></button></div></form>
    ${suggestions.length ? `<p class="insight-label">Para equilibrar la semana</p><div class="recipe-options">${suggestions.map(option).join('')}</div>` : ''}
    ${recipes.length ? `<p class="insight-label">Todas las recetas</p><input type="search" class="guide-search" data-slot-search placeholder="Buscar receta" aria-label="Buscar receta" /><div class="recipe-options" data-slot-list>${recipes.slice().sort((first, second) => first.title.localeCompare(second.title)).map(option).join('')}</div>` : '<p class="empty-note">Aún no tenéis recetas: añadid las vuestras o las de ejemplo en «Recetas».</p>'}`, { kind: 'slot', day, slot });
}

function openRecipe(id, { keep = false } = {}) {
  const recipe = recipeById(id);
  if (!recipe) return;
  const photos = recipePhotos.filter((photo) => photo.recipe_id === id).sort((first, second) => String(second.taken_on).localeCompare(String(first.taken_on)));
  const cooked = cookedCount(recipe);
  const lastCooked = [...photos.map((photo) => photo.taken_on), ...mealPlan.filter((meal) => meal.recipe_id === id && meal.day < todayISO()).map((meal) => meal.day)].sort().at(-1);
  const html = `
    ${photos.length || recipe.photo_path ? `<div class="recipe-gallery">${[...photos.map((photo) => ({ path: photo.path, date: photo.taken_on, id: photo.id })), ...(recipe.photo_path ? [{ path: recipe.photo_path }] : [])].map((photo) => `<figure><img alt="${escapeHtml(recipe.title)}" data-photo="${escapeHtml(photo.path)}" />${photo.date ? `<figcaption>${financeDate(photo.date)}</figcaption>` : ''}</figure>`).join('')}</div>` : `<div class="recipe-hero tone-${RECIPE_GROUPS[recipe.category].tone}"><i data-lucide="${RECIPE_GROUPS[recipe.category].icon}"></i></div>`}
    <div class="plant-add-heading"><p class="eyebrow muted">${escapeHtml(RECIPE_GROUPS[recipe.category].label)}${recipe.minutes ? ` · ${minutesLabel(recipe.minutes)}` : ''}${recipe.servings ? ` · ${recipe.servings} raciones` : ''}</p><h2 id="kitchenSheetTitle">${escapeHtml(recipe.title)}</h2>${cooked ? `<p class="recipe-history">Hecha ${cooked} ${cooked === 1 ? 'vez' : 'veces'}${lastCooked ? ` · última el ${financeDate(lastCooked)}` : ''}</p>` : ''}</div>
    <div class="item-toggles">
      <button type="button" class="option-pill" data-recipe-photo><i data-lucide="camera"></i>La hemos hecho · foto</button>
      <button type="button" class="option-pill" data-recipe-plan><i data-lucide="calendar-plus"></i>Planificar</button>
      <button type="button" class="option-pill${recipe.favorite ? ' is-on is-high' : ''}" data-recipe-favorite><i data-lucide="heart"></i>${recipe.favorite ? 'Favorita' : 'Favorita'}</button>
    </div>
    <div class="recipe-plan" hidden>${weekDays(mondayOf(new Date())).filter((day) => day >= todayISO()).map((day) => Object.entries(SLOTS).map(([slot, label]) => `<button type="button" class="filter-chip${mealAt(day, slot) ? '' : ' is-on'}" data-plan-at="${day}|${slot}">${new Intl.DateTimeFormat('es-ES', { weekday: 'short', day: 'numeric' }).format(isoToDate(day))} · ${label.toLowerCase()}</button>`).join('')).join('')}</div>
    ${recipe.ingredients.length ? `<section class="plant-section"><h3>Ingredientes</h3><div class="ingredient-list">${recipe.ingredients.map((ingredient, index) => `<label class="ingredient"><input type="checkbox" data-ingredient="${index}" ${PANTRY.test(ingredientName(ingredient)) ? '' : 'checked'} /><span>${escapeHtml(ingredient)}</span></label>`).join('')}</div><button type="button" class="pill-button" data-ingredients-to-cart><i data-lucide="shopping-basket"></i> Añadir marcados a la compra</button></section>` : ''}
    ${recipe.steps ? `<section class="plant-section"><h3>Preparación</h3><p class="item-details">${escapeHtml(recipe.steps)}</p></section>` : ''}
    ${recipe.notes ? `<section class="plant-section"><h3>Notas</h3><p class="item-details">${escapeHtml(recipe.notes)}</p></section>` : ''}
    <div class="item-footer"><button type="button" class="pill-button" data-edit-recipe><i data-lucide="pencil"></i> Editar</button><button type="button" class="link-button is-danger" data-delete-recipe>Eliminar</button></div>`;
  if (keep) {
    kitchenSheetState = { kind: 'recipe', id };
    document.querySelector('#kitchenSheetBody').innerHTML = html;
    hydratePhotos(kitchenSheet);
    lucide.createIcons();
  } else {
    showKitchenSheet(html, { kind: 'recipe', id });
  }
}

function openRecipeEditor(id = null) {
  const recipe = id ? recipeById(id) : {};
  showKitchenSheet(`
    <div class="plant-add-heading"><p class="eyebrow muted">${id ? 'Editar receta' : 'Nueva receta'}</p><h2 id="kitchenSheetTitle">${id ? escapeHtml(recipe.title) : '¿Qué cocinamos?'}</h2></div>
    <form class="item-editor" data-recipe-form ${id ? `data-recipe-id="${escapeHtml(id)}"` : ''}>
      <label class="plant-field"><span>Nombre</span><input name="title" type="text" maxlength="80" required value="${escapeHtml(recipe.title || '')}" placeholder="Lentejas de la abuela" /></label>
      <fieldset class="plant-field"><legend>Tipo</legend><div class="category-picker">${Object.entries(RECIPE_GROUPS).map(([key, info]) => `<label class="category-chip"><input type="radio" name="category" value="${key}" ${key === (recipe.category || 'verdura') ? 'checked' : ''} /><span><i data-lucide="${info.icon}"></i>${info.label}</span></label>`).join('')}</div></fieldset>
      <fieldset class="plant-field"><legend>Mejor para</legend><div class="choice-row">${[['any', 'Comida o cena'], ['lunch', 'Comida'], ['dinner', 'Cena']].map(([value, label]) => `<label class="option-toggle"><input type="radio" name="meal" value="${value}" ${value === (recipe.meal || 'any') ? 'checked' : ''} /><span>${label}</span></label>`).join('')}</div></fieldset>
      <div class="detail-grid"><label class="plant-field"><span>Minutos</span><input name="minutes" type="number" min="1" max="600" inputmode="numeric" value="${recipe.minutes || ''}" /></label><label class="plant-field"><span>Raciones</span><input name="servings" type="number" min="1" max="20" inputmode="numeric" value="${recipe.servings || 2}" /></label></div>
      <label class="plant-field"><span>Ingredientes (uno por línea)</span><textarea name="ingredients" rows="6" placeholder="300 g lentejas&#10;1 zanahoria&#10;1 cebolla">${escapeHtml((recipe.ingredients || []).join('\n'))}</textarea></label>
      <label class="plant-field"><span>Preparación</span><textarea name="steps" rows="5" maxlength="4000">${escapeHtml(recipe.steps || '')}</textarea></label>
      <label class="plant-field"><span>Notas (opcional)</span><textarea name="notes" rows="2" maxlength="600" placeholder="Truco, de quién es la receta…">${escapeHtml(recipe.notes || '')}</textarea></label>
      <div class="plant-form-actions"><button type="submit" class="primary-button"><i data-lucide="check"></i> ${id ? 'Guardar' : 'Crear receta'}</button></div>
    </form>`, { kind: 'editor', id });
}

// Ingredientes de las recetas que quedan esta semana → lista para marcar y enviar a la compra.
function openWeekShopping() {
  const today = todayISO();
  const meals = mealPlan.filter((meal) => weekDays().includes(meal.day) && meal.day >= today && recipeById(meal.recipe_id));
  const inCart = new Set(shoppingItems.map((item) => normalizeText(item.name)));
  const seen = new Map();
  meals.forEach((meal) => recipeById(meal.recipe_id).ingredients.forEach((ingredient) => {
    const key = ingredientName(ingredient);
    if (!key) return;
    const entry = seen.get(key) || { text: ingredient, recipes: new Set() };
    entry.recipes.add(meal.title);
    seen.set(key, entry);
  }));
  const items = [...seen].map(([key, entry]) => ({ key, ...entry, pantry: PANTRY.test(key), listed: [...inCart].some((name) => name.includes(key) || key.includes(name)) }));
  showKitchenSheet(`
    <div class="plant-add-heading"><p class="eyebrow muted">Menú → compra</p><h2 id="kitchenSheetTitle">Ingredientes de la semana</h2></div>
    ${items.length ? `<p class="recurring-intro">De ${meals.length} ${meals.length === 1 ? 'comida' : 'comidas'} que quedan esta semana. Desmarca lo que ya tengáis en casa.</p>
    <div class="ingredient-list">${items.map((item, index) => `<label class="ingredient"><input type="checkbox" data-week-ingredient="${index}" ${item.pantry || item.listed ? '' : 'checked'} /><span>${escapeHtml(item.text)}<small>${escapeHtml([...item.recipes].join(', '))}${item.listed ? ' · ya en la lista' : item.pantry ? ' · de despensa' : ''}</small></span></label>`).join('')}</div>
    <div class="plant-form-actions"><button type="button" class="primary-button" data-send-week-ingredients><i data-lucide="shopping-basket"></i> Añadir a la compra</button></div>` : '<p class="empty-note">No hay recetas planificadas para lo que queda de semana.</p>'}`, { kind: 'week-shopping', items });
}

async function sendIngredients(texts) {
  if (!texts.length) return showToast('No hay nada marcado');
  const added = await addShoppingItems(texts.map((text) => text.replace(/,/g, ' ')).join(', '));
  if (added) closeKitchenSheet();
}

// ---------- Eventos ----------

document.querySelector('#kitchenView').addEventListener('click', (event) => {
  const target = event.target;
  const view = target.closest('[data-kitchen-view]');
  if (view) return setKitchenView(view.dataset.kitchenView);
  const shift = target.closest('[data-week-shift]');
  if (shift) {
    kitchenWeekStart = addDaysToISO(shownWeek(), Number(shift.dataset.weekShift) * 7);
    return renderKitchen();
  }
  const slot = target.closest('[data-menu-slot]');
  if (slot) return openSlot(...slot.dataset.menuSlot.split('|'));
  if (target.closest('[data-fill-week]')) return fillWeek();
  if (target.closest('[data-week-shopping]')) return openWeekShopping();
  if (target.closest('[data-new-recipe]')) return openRecipeEditor();
  if (target.closest('[data-starter-recipes]')) return addStarterRecipes();
  const recipe = target.closest('[data-open-recipe]');
  if (recipe) return openRecipe(recipe.dataset.openRecipe);
  if (target.closest('[data-recipe-favorites]')) {
    recipeFilter.favorites = !recipeFilter.favorites;
    return renderKitchen();
  }
  const group = target.closest('[data-recipe-group]');
  if (group) {
    recipeFilter.group = recipeFilter.group === group.dataset.recipeGroup ? null : group.dataset.recipeGroup;
    return renderKitchen();
  }
});

document.querySelector('#kitchenView').addEventListener('input', (event) => {
  if (!event.target.matches('[data-recipe-search]')) return;
  recipeFilter.search = event.target.value;
  const position = event.target.selectionStart;
  renderKitchen();
  const input = document.querySelector('[data-recipe-search]');
  input.focus();
  input.setSelectionRange(position, position);
});

kitchenSheet.addEventListener('click', async (event) => {
  const target = event.target;
  const state = kitchenSheetState;
  if (target === kitchenSheet || target.closest('[data-close-kitchen]')) return closeKitchenSheet();
  if (!state) return;
  const pick = target.closest('[data-pick-recipe]');
  if (pick && state.kind === 'slot') {
    const recipe = recipeById(pick.dataset.pickRecipe);
    if (await setMeal(state.day, state.slot, { recipeId: recipe.id, title: recipe.title })) closeKitchenSheet();
    return;
  }
  if (target.closest('[data-clear-slot]')) {
    await clearMeal(state.day, state.slot);
    return closeKitchenSheet();
  }
  const recipe = recipeById(state.id);
  if (target.closest('[data-recipe-photo]')) return addRecipePhoto(recipe);
  if (target.closest('[data-recipe-plan]')) {
    const plan = kitchenSheet.querySelector('.recipe-plan');
    plan.hidden = !plan.hidden;
    return;
  }
  const planAt = target.closest('[data-plan-at]');
  if (planAt) {
    const [day, slot] = planAt.dataset.planAt.split('|');
    if (await setMeal(day, slot, { recipeId: recipe.id, title: recipe.title })) showToast('Añadida al menú');
    return;
  }
  if (target.closest('[data-recipe-favorite]')) {
    try {
      await recipesStore.update(recipe.id, { favorite: !recipe.favorite });
      recipe.favorite = !recipe.favorite;
      renderKitchen();
    } catch (error) {
      showSupabaseError('No se pudo guardar', error);
    }
    return;
  }
  if (target.closest('[data-ingredients-to-cart]')) {
    const chosen = [...kitchenSheet.querySelectorAll('[data-ingredient]:checked')].map((box) => recipe.ingredients[Number(box.dataset.ingredient)]);
    return sendIngredients(chosen);
  }
  if (target.closest('[data-send-week-ingredients]')) {
    const chosen = [...kitchenSheet.querySelectorAll('[data-week-ingredient]:checked')].map((box) => state.items[Number(box.dataset.weekIngredient)].text);
    return sendIngredients(chosen);
  }
  if (target.closest('[data-edit-recipe]')) return openRecipeEditor(recipe.id);
  if (target.closest('[data-delete-recipe]') && window.confirm(`¿Eliminar «${recipe.title}»? Sus fotos también.`)) {
    try {
      await recipesStore.update(recipe.id, { active: false });
      recipes = recipes.filter((item) => item.id !== recipe.id);
      closeKitchenSheet();
      renderKitchen();
    } catch (error) {
      showSupabaseError('No se pudo eliminar', error);
    }
  }
});

kitchenSheet.addEventListener('input', (event) => {
  if (!event.target.matches('[data-slot-search]')) return;
  const query = normalizeText(event.target.value);
  kitchenSheet.querySelectorAll('[data-slot-list] .recipe-option').forEach((option) => {
    option.hidden = Boolean(query) && !normalizeText(option.textContent).includes(query);
  });
});

kitchenSheet.addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.target;
  const state = kitchenSheetState;
  if (form.hasAttribute('data-free-meal')) {
    const title = form.title.value.trim();
    if (title && await setMeal(state.day, state.slot, { title })) closeKitchenSheet();
    return;
  }
  if (form.hasAttribute('data-recipe-form')) {
    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    const id = await saveRecipe(Object.fromEntries(new FormData(form)), form.dataset.recipeId);
    button.disabled = false;
    if (id) openRecipe(id, { keep: true });
  }
});

window.addEventListener('popstate', () => {
  if (history.state?.page !== 'kitchen-sheet') hideKitchenSheet();
});

document.addEventListener('DOMContentLoaded', () => {
  try { kitchenView = localStorage.getItem('umbral-kitchen-view') || 'menu'; } catch {}
});

document.addEventListener('umbral:ready', () => {
  loadKitchen();
  const reload = () => {
    clearTimeout(kitchenReloadTimer);
    kitchenReloadTimer = setTimeout(loadKitchen, 400);
  };
  recipesStore.subscribe(reload);
  recipePhotosStore.subscribe(reload);
  mealPlanStore.subscribe(reload);
});
