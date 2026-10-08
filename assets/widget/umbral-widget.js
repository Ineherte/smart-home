// Widget de Umbral para iPhone (Scriptable, https://scriptable.app).
// Lo carga el script «Umbral» de Scriptable (ver assets/widget/LEEME.md), que se actualiza solo.
// Tamaños: pequeño, mediano y grande en la pantalla de inicio, y rectangular, redondo y en
// línea en la pantalla de bloqueo. Los datos vienen de la función widget-summary de Supabase;
// el tiempo, de Open-Meteo (Turín). Sin conexión, enseña lo último que guardó.

const PALETTE = {
  day: ['#24634f', '#15352c'],
  dusk: ['#e0875f', '#7a3f4f'],
  night: ['#253260', '#0f1613']
};
const INK = new Color('#fbfaf3');
const SOFT = new Color('#fbfaf3', 0.72);
const FAINT = new Color('#fbfaf3', 0.16);
const LIME = new Color('#dff486');
const CORAL = new Color('#ffb59a');
const WEATHER = {
  0: ['Despejado', 'sun.max.fill', 'moon.stars.fill'], 1: ['Casi despejado', 'sun.max.fill', 'moon.stars.fill'], 2: ['Algunas nubes', 'cloud.sun.fill', 'cloud.moon.fill'], 3: ['Nublado', 'cloud.fill', 'cloud.fill'],
  45: ['Niebla', 'cloud.fog.fill', 'cloud.fog.fill'], 48: ['Niebla', 'cloud.fog.fill', 'cloud.fog.fill'], 51: ['Llovizna', 'cloud.drizzle.fill', 'cloud.drizzle.fill'], 53: ['Llovizna', 'cloud.drizzle.fill', 'cloud.drizzle.fill'], 55: ['Llovizna', 'cloud.drizzle.fill', 'cloud.drizzle.fill'],
  61: ['Lluvia', 'cloud.rain.fill', 'cloud.rain.fill'], 63: ['Lluvia', 'cloud.rain.fill', 'cloud.rain.fill'], 65: ['Lluvia fuerte', 'cloud.heavyrain.fill', 'cloud.heavyrain.fill'], 71: ['Nieve', 'cloud.snow.fill', 'cloud.snow.fill'], 73: ['Nieve', 'cloud.snow.fill', 'cloud.snow.fill'], 75: ['Nieve', 'cloud.snow.fill', 'cloud.snow.fill'],
  80: ['Chubascos', 'cloud.sun.rain.fill', 'cloud.moon.rain.fill'], 81: ['Chubascos', 'cloud.sun.rain.fill', 'cloud.moon.rain.fill'], 82: ['Chubascos', 'cloud.heavyrain.fill', 'cloud.heavyrain.fill'], 95: ['Tormenta', 'cloud.bolt.rain.fill', 'cloud.bolt.rain.fill'], 96: ['Tormenta', 'cloud.bolt.rain.fill', 'cloud.bolt.rain.fill'], 99: ['Tormenta', 'cloud.bolt.rain.fill', 'cloud.bolt.rain.fill']
};
const MOODS = { happy: '😊', love: '🥰', excited: '🤩', relaxed: '😌', party: '🥳', sad: '😢', grumpy: '😤', sick: '🤒', tired: '😴' };
const ACTIVITY = { sleep: '😴 Durmiendo', cook: '🍳 Cocinando', work: '💻 Trabajando', shower: '🚿 En la ducha', bath: '🛁 En la bañera', tv: '📺 Viendo la tele', yoga: '🧘 Haciendo yoga', dance: '💃 Bailando', readsofa: '📖 Leyendo', games: '🎮 Jugando', goout: '🚶 De paseo', coffee: '☕ Con un café' };
const PLACES = { turin: '🏛️ En Turín', chieti: '🌄 En Chieti', spain: '🌻 En el pueblo' };

const DEMO = {
  owner: 'Ines', partner: 'Matteo', today: new Date().toISOString().slice(0, 10),
  tasks: { count: 3, overdue: 1, mine: 2, list: [{ title: 'Sacar la basura', who: 'Matteo', late: true }, { title: 'Regar el poto', who: 'both' }, { title: 'Limpiar el baño', who: 'Ines' }] },
  shopping: { count: 5, inCart: 0, list: ['Leche', 'Pan', 'Huevos (6)', 'Tomates', 'Café'] },
  meals: { lunch: 'Ensalada de garbanzos', dinner: 'Pasta al pesto' },
  agenda: [{ title: 'Cena con Luca', date: new Date().toISOString().slice(0, 10), time: '20:30' }, { title: 'Dentista', date: new Date(Date.now() + 86400000).toISOString().slice(0, 10), time: '10:00' }],
  plants: ['Monstera'], care: [], next: { title: 'Viaje a Chieti', emoji: '✈️', kind: 'trip', days: 2, ongoing: false }, dates: [],
  people: { Ines: { mood: 'happy', message: null, activity: null, place: 'house', needs: {} }, Matteo: { mood: 'love', message: '¡Te he dejado café hecho! ☕', activity: 'work', place: 'house', needs: {} } },
  updatedAt: new Date().toISOString(), demo: true
};

// ---------- Datos (con caché para cuando no hay conexión) ----------
const fm = FileManager.local();
const cachePath = (name) => fm.joinPath(fm.cacheDirectory(), `umbral-${name}`);
async function cachedJSON(name, load) {
  try {
    const data = await load();
    fm.writeString(cachePath(name), JSON.stringify(data));
    return data;
  } catch (error) {
    if (fm.fileExists(cachePath(name))) return { ...JSON.parse(fm.readString(cachePath(name))), stale: true };
    throw error;
  }
}
async function cachedImage(url) {
  const path = cachePath(`img-${url.split('/').pop()}`);
  if (fm.fileExists(path)) return fm.readImage(path);
  try {
    const image = await new Request(url).loadImage();
    fm.writeImage(path, image);
    return image;
  } catch { return null; }
}
async function loadSummary(cfg) {
  if (!cfg.token) return DEMO;
  return cachedJSON(`summary-${cfg.owner}`, async () => {
    const request = new Request(`${cfg.supabaseUrl}/functions/v1/widget-summary?owner=${encodeURIComponent(cfg.owner)}`);
    request.headers = { 'x-sync-token': cfg.token };
    request.timeoutInterval = 12;
    const data = await request.loadJSON();
    if (data.error) throw new Error(data.error);
    return data;
  });
}
async function loadWeather() {
  try {
    return await cachedJSON('weather', async () => {
      const request = new Request('https://api.open-meteo.com/v1/forecast?latitude=45.0703&longitude=7.6869&current=temperature_2m,weather_code,is_day&daily=temperature_2m_max,temperature_2m_min&timezone=Europe%2FRome&forecast_days=1');
      request.timeoutInterval = 10;
      const data = await request.loadJSON();
      return { temp: Math.round(data.current.temperature_2m), code: data.current.weather_code, day: data.current.is_day === 1, max: Math.round(data.daily.temperature_2m_max[0]), min: Math.round(data.daily.temperature_2m_min[0]) };
    });
  } catch { return null; }
}

// ---------- Ayudas de dibujo ----------
const phase = () => { const h = new Date().getHours(); return h >= 21 || h < 7 ? 'night' : h >= 18 ? 'dusk' : 'day'; };
function background(widget) {
  const [top, bottom] = PALETTE[phase()];
  const gradient = new LinearGradient();
  gradient.colors = [new Color(top), new Color(bottom)];
  gradient.locations = [0, 1];
  gradient.startPoint = new Point(0, 0);
  gradient.endPoint = new Point(1, 1);
  widget.backgroundGradient = gradient;
}
function text(stack, value, size, { weight = 'semibold', color = INK, lines = 1, scale = 0.75, opacity = 1 } = {}) {
  const t = stack.addText(String(value));
  t.font = weight === 'bold' ? Font.boldRoundedSystemFont(size) : weight === 'regular' ? Font.regularRoundedSystemFont(size) : weight === 'heavy' ? Font.heavyRoundedSystemFont(size) : Font.semiboldRoundedSystemFont(size);
  t.textColor = color;
  t.lineLimit = lines;
  t.minimumScaleFactor = scale;
  if (opacity < 1) t.textOpacity = opacity;
  return t;
}
function symbol(stack, name, size, color = LIME) {
  const sym = SFSymbol.named(name);
  if (!sym) return null;
  sym.applyFont(Font.semiboldSystemFont(size));
  const image = stack.addImage(sym.image);
  image.imageSize = new Size(size + 2, size + 2);
  image.tintColor = color;
  return image;
}
function hstack(parent, spacing = 0) { const s = parent.addStack(); s.layoutHorizontally(); s.centerAlignContent(); s.spacing = spacing; return s; }
function vstack(parent, spacing = 0) { const s = parent.addStack(); s.layoutVertically(); s.spacing = spacing; return s; }
function pill(parent, label, { color = FAINT, ink = INK, size = 11 } = {}) {
  const s = hstack(parent);
  s.backgroundColor = color;
  s.cornerRadius = 8;
  s.setPadding(3, 7, 3, 7);
  text(s, label, size, { color: ink });
  return s;
}
function countdown(next) {
  if (!next) return null;
  const place = next.title.replace(/^Viaje a /, '').replace(/^Cumpleaños de /, 'el cumple de ');
  if (next.ongoing) return { big: 'Hoy', small: `${next.title} ${next.emoji}` };
  if (next.days === 0) return { big: 'Hoy', small: `${place} ${next.emoji}` };
  if (next.days === 1) return { big: 'Mañana', small: `${place} ${next.emoji}` };
  return { big: `${next.days} días`, small: `para ${place} ${next.emoji}` };
}
const when = (event, today) => {
  if (event.date === today) return event.time || 'Hoy';
  const days = Math.round((Date.parse(`${event.date}T12:00:00`) - Date.parse(`${today}T12:00:00`)) / 86400000);
  const label = days === 1 ? 'Mañana' : new Date(`${event.date}T12:00:00`).toLocaleDateString('es-ES', { weekday: 'short' }).replace('.', '');
  return `${label}${event.time ? ` ${event.time}` : ''}`;
};
function greeting(name) {
  const h = new Date().getHours();
  return `${h < 6 ? 'Buenas noches' : h < 13 ? 'Buenos días' : h < 21 ? 'Buenas tardes' : 'Buenas noches'}, ${name}`;
}
function partnerLine(data) {
  const p = data.people?.[data.partner] || {};
  if (p.message) return `💬 ${p.message}`;
  if (p.place && PLACES[p.place]) return PLACES[p.place];
  if (p.activity && ACTIVITY[p.activity]) return ACTIVITY[p.activity];
  if (p.mood && MOODS[p.mood]) return `${MOODS[p.mood]} ${data.partner} está bien`;
  return `${data.partner} está en casa`;
}
function header(widget, data, weather, { size = 12 } = {}) {
  const row = hstack(widget, 4);
  symbol(row, 'sparkles', size - 1);
  text(row, 'umbral', size, { weight: 'heavy', color: LIME });
  row.addSpacer();
  if (weather) {
    const w = WEATHER[weather.code] || WEATHER[1];
    symbol(row, weather.day ? w[1] : w[2], size - 1, INK);
    text(row, `${weather.temp}°`, size, { weight: 'bold' });
  }
  return row;
}
async function portraits(parent, data, cfg, { head = true, size = 44 } = {}) {
  const row = hstack(parent, 2);
  const names = [data.owner, data.partner].sort((a, b) => (a === 'Ines' ? -1 : b === 'Ines' ? 1 : 0));
  for (let i = 0; i < names.length; i += 1) {
    const key = String(names[i]).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    const image = await cachedImage(`${cfg.appUrl}assets/widget/${key}${head ? '-head' : ''}.png`);
    if (image) {
      const img = row.addImage(image);
      img.imageSize = head ? new Size(size, size) : new Size(size, size * 1.75);
    }
    if (i === 0) {
      const heart = vstack(row);
      text(heart, '♥', head ? 13 : 15, { weight: 'heavy', color: CORAL });
    }
  }
  return row;
}
function row(parent, icon, label, value, { color = LIME, url } = {}) {
  const r = hstack(parent, 6);
  if (url) r.url = url;
  const box = hstack(r);
  box.size = new Size(20, 20);
  box.cornerRadius = 7;
  box.backgroundColor = FAINT;
  box.centerAlignContent();
  symbol(box, icon, 10, color);
  const copy = vstack(r);
  text(copy, label, 10, { color: SOFT, weight: 'semibold' });
  text(copy, value, 13, { weight: 'bold', scale: 0.7 });
  return r;
}
const link = (cfg, target) => `${cfg.appUrl}?abrir=${target}`;

// ---------- Tamaños ----------
async function small(widget, data, weather, cfg) {
  widget.setPadding(14, 14, 12, 14);
  widget.url = link(cfg, 'nosotros');
  header(widget, data, weather, { size: 11 });
  widget.addSpacer();
  await portraits(widget, data, cfg, { head: true, size: 42.67 });
  widget.addSpacer(6);
  const c = countdown(data.next);
  if (c) {
    text(widget, c.big, 22, { weight: 'heavy', scale: 0.6 });
    text(widget, c.small, 11, { color: SOFT, scale: 0.7 });
  } else {
    text(widget, `${data.tasks.count} ${data.tasks.count === 1 ? 'tarea' : 'tareas'}`, 20, { weight: 'heavy' });
    text(widget, `${data.shopping.count} en la compra`, 11, { color: SOFT });
  }
  widget.addSpacer(6);
  const chips = hstack(widget, 4);
  [[`✅ ${data.tasks.count}`, data.tasks.overdue], [`🛒 ${data.shopping.count}`], data.plants.length ? [`🪴 ${data.plants.length}`] : null].filter(Boolean).forEach(([label, alert]) => pill(chips, label, { size: 10, color: alert ? new Color('#ffb59a', 0.32) : FAINT }));
}

async function medium(widget, data, weather, cfg) {
  widget.setPadding(14, 14, 14, 14);
  widget.url = link(cfg, 'home');
  const body = hstack(widget, 12);
  body.topAlignContent();
  // Izquierda: vosotros dos, lo próximo y lo que dice tu pareja.
  const left = vstack(body, 4);
  left.size = new Size(128, 0);
  header(left, data, weather, { size: 11 });
  left.addSpacer(4);
  await portraits(left, data, cfg, { head: false, size: 30 });
  left.addSpacer(4);
  const c = countdown(data.next);
  if (c) {
    text(left, c.big, 15, { weight: 'heavy', scale: 0.6 });
    text(left, c.small, 10, { color: SOFT, scale: 0.7 });
  } else text(left, partnerLine(data), 10, { color: SOFT, lines: 2 });
  // Derecha: hoy.
  const right = vstack(body, 7);
  const firstEvent = data.agenda[0];
  row(right, 'calendar', firstEvent ? when(firstEvent, data.today) : 'Agenda', firstEvent ? firstEvent.title : 'Día libre', { url: link(cfg, 'calendar') });
  const task = data.tasks.list[0];
  row(right, 'checklist', `Tareas · ${data.tasks.count}`, task ? task.title : 'Todo hecho ✨', { url: link(cfg, 'pendientes'), color: data.tasks.overdue ? CORAL : LIME });
  row(right, 'cart.fill', `Compra · ${data.shopping.count}`, data.shopping.list.length ? data.shopping.list.slice(0, 3).join(', ') : 'No falta nada', { url: link(cfg, 'compra') });
  const meal = data.meals.dinner || data.meals.lunch;
  row(right, 'fork.knife', data.meals.dinner ? 'Cena' : data.meals.lunch ? 'Comida' : 'Menú', meal || 'Sin planificar', { url: link(cfg, 'menu') });
}

async function large(widget, data, weather, cfg) {
  widget.setPadding(16, 16, 14, 16);
  widget.url = link(cfg, 'home');
  header(widget, data, weather, { size: 12 });
  widget.addSpacer(8);
  const top = hstack(widget, 12);
  top.centerAlignContent();
  await portraits(top, data, cfg, { head: false, size: 34 });
  const hello = vstack(top, 2);
  text(hello, greeting(data.owner), 17, { weight: 'heavy', scale: 0.6 });
  text(hello, new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }), 11, { color: SOFT });
  if (weather) {
    const w = WEATHER[weather.code] || WEATHER[1];
    text(hello, `${w[0]} · ${weather.max}° / ${weather.min}° en Turín`, 11, { color: SOFT });
  }
  widget.addSpacer(8);
  const bubble = hstack(widget, 6);
  bubble.backgroundColor = FAINT;
  bubble.cornerRadius = 12;
  bubble.setPadding(7, 10, 7, 10);
  bubble.url = link(cfg, 'nosotros');
  text(bubble, partnerLine(data), 12, { lines: 2, scale: 0.7 });
  bubble.addSpacer();
  widget.addSpacer(10);

  const grid = hstack(widget, 12);
  grid.topAlignContent();
  const col1 = vstack(grid, 5);
  col1.size = new Size(150, 0);
  text(col1, 'AGENDA', 10, { weight: 'bold', color: LIME });
  if (data.agenda.length) data.agenda.slice(0, 3).forEach((event) => { const r = hstack(col1, 6); text(r, when(event, data.today), 11, { weight: 'bold', color: SOFT }); text(r, event.title, 12, { scale: 0.7 }); });
  else text(col1, 'Nada en 7 días', 12, { color: SOFT });
  col1.addSpacer(4);
  text(col1, 'TAREAS', 10, { weight: 'bold', color: data.tasks.overdue ? CORAL : LIME });
  if (data.tasks.list.length) data.tasks.list.slice(0, 3).forEach((task) => text(col1, `${task.late ? '⏰' : '○'} ${task.title}`, 12, { scale: 0.7 }));
  else text(col1, 'Todo hecho ✨', 12, { color: SOFT });
  col1.url = link(cfg, 'pendientes');

  const col2 = vstack(grid, 5);
  text(col2, `COMPRA · ${data.shopping.count}`, 10, { weight: 'bold', color: LIME });
  if (data.shopping.list.length) data.shopping.list.slice(0, 4).forEach((item) => text(col2, `· ${item}`, 12, { scale: 0.7 }));
  else text(col2, 'No falta nada', 12, { color: SOFT });
  col2.url = link(cfg, 'compra');
  col2.addSpacer(4);
  text(col2, 'HOY SE COME', 10, { weight: 'bold', color: LIME });
  text(col2, data.meals.lunch ? `☀️ ${data.meals.lunch}` : '☀️ —', 12, { scale: 0.7 });
  text(col2, data.meals.dinner ? `🌙 ${data.meals.dinner}` : '🌙 —', 12, { scale: 0.7 });

  widget.addSpacer();
  const foot = hstack(widget, 5);
  const c = countdown(data.next);
  if (c) pill(foot, `${c.big} ${c.small}`, { color: new Color('#dff486', 0.22) });
  if (data.plants.length) pill(foot, `🪴 ${data.plants.length === 1 ? data.plants[0] : `${data.plants.length} plantas`} con sed`);
  if (data.care?.length) pill(foot, `🛠️ ${data.care.length}`);
  foot.addSpacer();
  if (data.stale || data.demo) text(foot, data.demo ? 'Demo' : 'Sin conexión', 9, { color: SOFT });
}

// Pantalla de bloqueo: sin colores (iOS los tiñe), letra clara y lo justo.
function lockRect(widget, data) {
  const first = data.agenda[0];
  const c = countdown(data.next);
  const line1 = hstack(widget, 4);
  text(line1, first ? `📅 ${when(first, data.today)} · ${first.title}` : c ? `${data.next.emoji} ${c.big} ${c.small.replace(` ${data.next.emoji}`, '')}` : '🏡 Umbral', 13, { weight: 'bold', color: Color.white(), scale: 0.7 });
  text(widget, `✅ ${data.tasks.count}  🛒 ${data.shopping.count}${data.plants.length ? `  🪴 ${data.plants.length}` : ''}`, 12, { color: Color.white(), scale: 0.7 });
  const meal = data.meals.dinner || data.meals.lunch;
  text(widget, meal ? `🍝 ${meal}` : partnerLine(data), 11, { color: Color.white(), opacity: 0.8, scale: 0.7 });
}
async function lockCircle(widget, data, cfg) {
  widget.addAccessoryWidgetBackground = true;
  const c = data.next;
  widget.addSpacer();
  const center = hstack(widget);
  center.addSpacer();
  if (c && !c.ongoing && c.days <= 99) {
    const col = vstack(center);
    col.centerAlignContent();
    text(col, c.emoji, 12, { color: Color.white() });
    text(col, c.days === 0 ? 'hoy' : `${c.days}d`, 15, { weight: 'heavy', color: Color.white() });
  } else {
    const col = vstack(center);
    text(col, '✅', 12, { color: Color.white() });
    text(col, String(data.tasks.count), 16, { weight: 'heavy', color: Color.white() });
  }
  center.addSpacer();
  widget.addSpacer();
}
function lockInline(widget, data) {
  const c = countdown(data.next);
  text(widget, `✅ ${data.tasks.count} · 🛒 ${data.shopping.count}${c ? ` · ${data.next.emoji} ${c.big}` : ''}`, 12);
}

async function run(userConfig = {}) {
  const cfg = {
    owner: 'Ines',
    token: '',
    supabaseUrl: 'https://lnctwcizdjaeomvkcbst.supabase.co',
    appUrl: 'https://ineherte.github.io/smart-home/',
    ...userConfig
  };
  if (args.widgetParameter) cfg.owner = args.widgetParameter.trim();
  const family = config.widgetFamily || 'medium';
  const widget = new ListWidget();
  let data;
  try {
    data = await loadSummary(cfg);
  } catch (error) {
    data = null;
    background(widget);
    widget.setPadding(14, 14, 14, 14);
    text(widget, 'umbral', 13, { weight: 'heavy', color: LIME });
    widget.addSpacer(6);
    text(widget, 'No pude cargar los datos', 13, { weight: 'bold', lines: 2 });
    text(widget, String(error.message || error).slice(0, 80), 10, { color: SOFT, lines: 3 });
  }
  if (data) {
    const weather = family.startsWith('accessory') ? null : await loadWeather();
    if (!family.startsWith('accessory')) background(widget);
    if (family === 'small') await small(widget, data, weather, cfg);
    else if (family === 'large' || family === 'extraLarge') await large(widget, data, weather, cfg);
    else if (family === 'accessoryRectangular') lockRect(widget, data);
    else if (family === 'accessoryCircular') await lockCircle(widget, data, cfg);
    else if (family === 'accessoryInline') lockInline(widget, data);
    else await medium(widget, data, weather, cfg);
  }
  widget.refreshAfterDate = new Date(Date.now() + 15 * 60000);
  if (config.runsInWidget || config.runsInAccessoryWidget) Script.setWidget(widget);
  else if (family === 'small') await widget.presentSmall();
  else if (family === 'large') await widget.presentLarge();
  else await widget.presentMedium();
  Script.complete();
}

module.exports = { run };
