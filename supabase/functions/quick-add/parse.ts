// Lo que entiende quick-add de las frases de Siri (separado para poder probarlo).
const TIME_ZONE = 'Europe/Rome';
export const NO_DEADLINE = '2099-12-31';
const WEEKDAYS: Record<string, number> = { domingo: 0, lunes: 1, martes: 2, miercoles: 3, jueves: 4, viernes: 5, sabado: 6 };
const NUMBERS: Record<string, number> = { un: 1, una: 1, uno: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10, doce: 12, quince: 15 };
export const plain = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
export const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
export const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
export function addDays(iso: string, days: number) {
  const date = new Date(`${iso}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
const toNumber = (word: string) => Number(word.replace(',', '.')) || NUMBERS[plain(word)] || 0;

// «leche, pan y 6 huevos» → [{ name: 'Leche' }, { name: 'Pan' }, { name: 'Huevos', quantity: '6' }]
export function shoppingItems(text: string) {
  return text.split(/,|;|\n|\s+y\s+|\s+e\s+/i).map((part) => part.trim()).filter(Boolean).map((part) => {
    const match = /^(\d+(?:[.,]\d+)?|un|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|doce)\s+(?:(kg|kilos?|g|gramos|l|litros?|paquetes?|botellas?|latas?)\s+(?:de\s+)?)?(.+)$/i.exec(part);
    if (!match) return { name: capitalize(part).slice(0, 80), quantity: '' };
    const unit = match[2] ? ` ${match[2]}` : '';
    return { name: capitalize(match[3]).slice(0, 80), quantity: `${toNumber(match[1]) || match[1]}${unit}`.slice(0, 20) };
  }).slice(0, 20);
}

// «pagar la luz en 5 días #papeles» → título, plazo y lista.
export function taskFrom(text: string) {
  let rest = ` ${text} `;
  let due = NO_DEADLINE;
  let list: string | null = null;
  const base = today();
  const take = (pattern: RegExp, apply: (m: RegExpExecArray) => void) => {
    const match = pattern.exec(rest);
    if (match) { apply(match); rest = rest.replace(match[0], ' '); }
  };
  take(/\s#([\p{L}\d-]{1,30})/u, (m) => { list = capitalize(m[1].replace(/-/g, ' ')); });
  take(/\s(en|dentro de|antes de)\s+(\d{1,3}|un|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|quince)\s+(d[ií]as?|semanas?|mes|meses)(?=\s)/i, (m) => {
    const n = toNumber(m[2]);
    due = addDays(base, /semana/i.test(m[3]) ? n * 7 : /mes/i.test(m[3]) ? n * 30 : n);
  });
  take(/\spasado ma[ñn]ana(?=\s)/i, () => { due = addDays(base, 2); });
  take(/\sma[ñn]ana(?=\s)/i, () => { due = addDays(base, 1); });
  take(/\shoy(?=\s)/i, () => { due = base; });
  take(/\s(el |este )?(lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo)(?=\s)/i, (m) => {
    const target = WEEKDAYS[plain(m[2])];
    const now = new Date(`${base}T12:00:00Z`).getUTCDay();
    due = addDays(base, ((target - now + 7) % 7) || 7);
  });
  rest = rest.replace(/\s(antes del?|para el|para|hasta el|hasta)\s*$/i, ' ');
  return { title: capitalize(rest.replace(/\s+/g, ' ').trim()).slice(0, 80), due, list };
}

const CATEGORY_WORDS: [RegExp, string][] = [
  [/super|mercado|esselunga|carrefour|lidl|conad|coop|compra/, 'Alimentación'], [/cena|comida|restaurante|bar|cafe|pizza|eataly/, 'Ocio'],
  [/gasolina|tren|metro|taxi|uber|bus|parking/, 'Transporte'], [/farmacia|medic|dentista/, 'Salud'], [/ikea|mueble|ferreteria|casa|limpieza/, 'Hogar'],
  [/vuelo|hotel|airbnb|viaje/, 'Viajes'], [/luz|electricidad/, 'Luz'], [/gas\b/, 'Gas'], [/agua/, 'Agua'], [/internet|fibra/, 'Internet']
];
// «24,50 cena en Eataly» o «cena en Eataly 24,50 €» → importe y concepto.
export function expenseFrom(text: string) {
  const match = /(\d+(?:[.,]\d{1,2})?)\s*(€|euros?)?/i.exec(text);
  if (!match) return null;
  const amount = Math.round(Number(match[1].replace(',', '.')) * 100) / 100;
  const description = capitalize(text.replace(match[0], ' ').replace(/\s+/g, ' ').replace(/^\s*(de|en)\s+/i, '').trim()) || 'Gasto';
  const category = CATEGORY_WORDS.find(([pattern]) => pattern.test(plain(description)))?.[1] || 'Otros';
  return { amount, description: description.slice(0, 160), category };
}
