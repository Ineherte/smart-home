// Lectura de facturas en PDF (Octopus y TIM): saca el texto del PDF y los datos que importan.
// Lo usa la función «bills» (facturas que llegan por correo o que se suben desde la app).
import { getDocumentProxy } from 'npm:unpdf@0.12.1';

export type PdfItem = { page: number; x: number; y: number; w: number; str: string };

// Texto del PDF línea a línea (cada trozo va a la línea de su altura en la página: las tablas,
// como el PUN mes a mes, se leen por filas) y los trozos con su posición (para los gráficos).
export async function pdfRead(bytes: Uint8Array): Promise<{ text: string; items: PdfItem[] }> {
  // Una copia: la librería se queda con el búfer que recibe (y luego hay que subir el PDF).
  const pdf = await getDocumentProxy(bytes.slice());
  const pages: string[] = [];
  const items: PdfItem[] = [];
  for (let n = 1; n <= pdf.numPages; n += 1) {
    const page = await pdf.getPage(n);
    const content = await page.getTextContent();
    const lines = new Map<number, { x: number; text: string }[]>();
    for (const item of content.items as { str: string; transform: number[]; width?: number }[]) {
      if (!item.str?.trim()) continue;
      items.push({ page: n, x: item.transform[4], y: item.transform[5], w: item.width || 0, str: item.str.trim() });
      const y = Math.round(item.transform[5] / 2) * 2;
      const key = [...lines.keys()].find((existing) => Math.abs(existing - y) <= 2) ?? y;
      if (!lines.has(key)) lines.set(key, []);
      lines.get(key)!.push({ x: item.transform[4], text: item.str });
    }
    pages.push([...lines.entries()].sort((a, b) => b[0] - a[0]).map(([, parts]) => parts.sort((a, b) => a.x - b.x).map((part) => part.text).join(' ').replace(/\s+/g, ' ').trim()).join('\n'));
  }
  return { text: pages.join('\n'), items };
}
export async function pdfText(bytes: Uint8Array): Promise<string> {
  return (await pdfRead(bytes)).text;
}

// El gráfico «Informazioni storiche sui consumi» (hasta 18 meses): encima de cada mes, el total
// y dentro de la barra F3, F2 y F1 (de arriba abajo). Se lee por la posición de cada número.
export function parseConsumptionHistory(items: PdfItem[]) {
  // La fila de meses del gráfico: muchos «MM/AA» a la misma altura en la misma página.
  const labels = items.filter((item) => /^\d{2}\/\d{2}$/.test(item.str));
  const rows = new Map<string, PdfItem[]>();
  labels.forEach((item) => { const key = `${item.page}:${Math.round(item.y)}`; rows.set(key, [...(rows.get(key) || []), item]); });
  const row = [...rows.values()].sort((a, b) => b.length - a.length)[0];
  if (!row || row.length < 6) return [];
  const months = row.sort((a, b) => a.x - b.x).map((item) => ({ month: `20${item.str.slice(3)}-${item.str.slice(0, 2)}`, cx: item.x + item.w / 2 }));
  const spacing = (months.at(-1)!.cx - months[0].cx) / Math.max(1, months.length - 1);
  const baseY = row[0].y;
  // Números enteros encima de la fila de meses (como mucho ~380 puntos más arriba).
  const numbers = items.filter((item) => item.page === row[0].page && /^\d{1,4}$/.test(item.str) && item.y > baseY + 2 && item.y < baseY + 380);
  type Month = { month: string; kwh: number; f1: number | null; f2: number | null; f3: number | null };
  return months.map(({ month, cx }): Month | null => {
    const column = numbers.filter((item) => Math.abs(item.x + item.w / 2 - cx) < spacing * 0.45).sort((a, b) => b.y - a.y).map((item) => Number(item.str));
    if (!column.length) return null;
    const [total, ...rest] = column;
    // Lo normal: total, F3, F2, F1. Si la suma cuadra, se guarda el reparto.
    if (rest.length >= 3 && Math.abs(rest[0] + rest[1] + rest[2] - total) <= 2) return { month, kwh: total, f1: rest[2], f2: rest[1], f3: rest[0] };
    return { month, kwh: total, f1: null, f2: null, f3: null };
  }).filter((entry): entry is Month => Boolean(entry) && entry!.kwh > 0);
}

const num = (value: string | undefined | null) => {
  if (value == null) return null;
  const clean = String(value).replace(/[^\d,.-]/g, '');
  if (!clean) return null;
  // «1.234,56» → 1234.56; «0,235786» → 0.235786; «4.50» → 4.5
  const normalized = clean.includes(',') ? clean.replace(/\.(?=\d{3}(?:\D|$))/g, '').replace(',', '.') : clean;
  const result = Number(normalized);
  return Number.isFinite(result) ? result : null;
};
const isoDate = (value: string | undefined | null) => {
  const match = String(value || '').match(/(\d{2})\/(\d{2})\/(\d{4})/);
  return match ? `${match[3]}-${match[2]}-${match[1]}` : null;
};
const one = (text: string, pattern: RegExp) => text.match(pattern)?.[1] ?? null;
const MONTHS_IT: Record<string, string> = { gen: '01', feb: '02', mar: '03', apr: '04', mag: '05', giu: '06', lug: '07', ago: '08', set: '09', ott: '10', nov: '11', dic: '12' };

export type OctopusBill = ReturnType<typeof parseOctopus>;

// Factura de la luz de Octopus Energy Italia.
export function parseOctopus(raw: string, items: PdfItem[] = []) {
  const text = raw.replace(/ /g, ' ');
  const flat = text.replace(/\s+/g, ' ');
  const period = flat.match(/PERIODO DI RIFERIMENTO:?\s*dal\s*(\d{2}\/\d{2}\/\d{4})\s*al\s*(\d{2}\/\d{2}\/\d{4})/i);
  const band = (n: 1 | 2 | 3) => flat.match(new RegExp(`Energia F${n}\\s+(\\d+(?:[.,]\\d+)?)\\s+(\\d+[.,]\\d+)\\s*€\\/kWh\\s+(\\d+[.,]\\d+)\\s*€`, 'i'));
  const f1 = band(1);
  const f2 = band(2);
  const f3 = band(3);
  // PUN de los últimos 12 meses (c€/kWh): una fila de meses y tres filas de 12 números (F1, F2, F3).
  const pun: { month: string; f1: number; f2: number; f3: number }[] = [];
  const header = text.match(/((?:[A-Z]{3}\s*'\d{2}\s*){6,12})\s*\n\s*([\d.\s]+)\n\s*([\d.\s]+)\n\s*([\d.\s]+)/);
  if (header) {
    const months = [...header[1].matchAll(/([A-Z]{3})\s*'(\d{2})/g)].map((match) => `20${match[2]}-${MONTHS_IT[match[1].toLowerCase()] || '01'}`);
    const rows = [header[2], header[3], header[4]].map((row) => row.trim().split(/\s+/).map(Number));
    months.forEach((month, i) => { if ([0, 1, 2].every((r) => Number.isFinite(rows[r][i]))) pun.push({ month, f1: rows[0][i], f2: rows[1][i], f3: rows[2][i] }); });
  }
  // Potencia máxima usada cada mes (fila «Pot. max Prel.» del histórico).
  const histMonths = flat.match(/((?:\d{2}\/\d{2}\s+){6,24})-?\s*(?:(?:Reale|Stimat[ao])\s*)+/i);
  const maxPower: { month: string; kw: number }[] = [];
  const powerRows = [...text.matchAll(/^\s*-?\s*((?:\d+(?:[.,]\d+)?\s+){5,24}\d+(?:[.,]\d+)?)\s*$/gm)].map((match) => match[1].trim().split(/\s+/).map((value) => num(value) as number));
  if (histMonths && powerRows.length >= 2) {
    const months = histMonths[1].trim().split(/\s+/).map((value) => { const [m, y] = value.split('/'); return `20${y}-${m}`; });
    const rowMax = powerRows[powerRows.length - 1];
    const offset = months.length - rowMax.length;
    rowMax.forEach((kw, i) => { if (months[i + offset] && Number.isFinite(kw)) maxPower.push({ month: months[i + offset], kw }); });
  }
  const readings = [...flat.matchAll(/(\d{2}\/\d{2}\/\d{4})\s+(\d+)\s+(\d+)\s+(\d+)\s+(Rilevata|Stimata|Autolettura)/gi)].map((match) => ({ date: isoDate(match[1]), f1: Number(match[2]), f2: Number(match[3]), f3: Number(match[4]), kind: match[5] }));
  const result = {
    provider: 'Octopus',
    kind: 'luz',
    invoice_number: one(flat, /NUMERO FATTURA[^:]*:\s*([A-Z0-9][A-Z0-9-]{5,})/i),
    supply_code: one(flat, /Codice Fornitura:\s*([A-Z0-9-]+)/i),
    issue_date: isoDate(one(flat, /DATA FATTURA:?[\s\S]{0,80}?(\d{2}\/\d{2}\/\d{4})/i)),
    due_date: isoDate(one(flat, /Entro il[\s\S]{0,80}?(\d{2}\/\d{2}\/\d{4})/i)),
    period_start: isoDate(period?.[1]),
    period_end: isoDate(period?.[2]),
    total_amount: num(one(flat, /TOTALE DA PAGARE\s*([\d.,]+)\s*€/i)) ?? num(one(flat, /dovrai pagare\s*([\d.,]+)\s*€/i)),
    bill_amount: num(one(flat, /TOTALE BOLLETTA\s*([\d.,]+)\s*€/i)),
    kwh: num(one(flat, /CONSUMO FATTURATO:?[\s\S]{0,80}?(\d[\d.,]*)\s*kWh/i)),
    kwh_f1: num(f1?.[1]), kwh_f2: num(f2?.[1]), kwh_f3: num(f3?.[1]),
    price_f1: num(f1?.[2]), price_f2: num(f2?.[2]), price_f3: num(f3?.[2]),
    energy_cost: num(one(flat, /Spesa per la materia energia.*?TOTALE\s*([\d.,]+)\s*€/i)),
    network_cost: num(one(flat, /Spesa per il trasporto e la gestione del contatore.*?TOTALE\s*([\d.,]+)\s*€/i)),
    system_charges: num(one(flat, /Spesa per oneri di sistema.*?TOTALE\s*([\d.,]+)\s*€/i)),
    fixed_fee: num(one(flat, /Quota fissa\s*[\d,.]+\s*mes[ei]\s*x\s*[\d,.]+\s*€\/mese\s*([\d.,]+)\s*€/i)),
    power_fee: num(one(flat, /Quota potenza\s*[\d,.]+\s*kW\s*x\s*[\d,.]+\s*€\/kW\s*([\d.,]+)\s*€/i)),
    taxes: num(one(flat, /Accise e IVA\s*([\d.,]+)\s*€/i)),
    vat: num(one(flat, /DI CUI IVA\s*([\d.,]+)\s*€/i)),
    tv_fee: num(one(flat, /Canone di abbonamento alla televisione per uso privato\s*([\d.,]+)\s*€/i)),
    // Algunos recuadros van uno al lado del otro y sus líneas se mezclan: se busca el primer
    // valor que encaje unos caracteres después de la etiqueta.
    committed_kw: num(one(flat, /POTENZA IMPEGNATA[\s\S]{0,220}?(\d+(?:[.,]\d+)?)\s*kW\b/i)),
    offer: one(flat, /NOME OFFERTA(?: COMMERCIALE)?:\s*(Octopus\s+[A-Za-zÀ-ÿ]+(?:\s+v\d+)?)/i) ?? one(flat, /\b(Octopus\s+(?:Flex|Fissa|Fix|Mono|Green)[A-Za-z]*(?:\s+v\d+)?)/i),
    tariff_type: one(flat, /TIPOLOGIA OFFERTA:?[\s\S]{0,80}?\b(Multioraria|Monoraria|Bioraria|Fasce|Oraria)\b/i),
    payment: one(flat, /METODO PAGAMENTO:\s*(.+?)\s+(?:PERIODO|SITUAZIONE|DATA)/i),
    pun_month: num(one(flat, /PUN \(\d{2}\/\d{2}\):\s*(?:Spread:)?\s*([\d.,]+)\s*€\/kWh/i)),
    annual_kwh: num(one(flat, /([\d.]+)\s*kWh\/anno/i)) ?? num(one(flat, /CONSUMO ANNUO[\s\S]{0,260}?(\d[\d.]*)\s*kWh\b/i)),
    annual_cost: num(one(flat, /SPESA ANNUA[\s\S]{0,260}?(\d[\d.]*,\d{2})\s*€/i)),
    details: { pun, max_power: maxPower, readings, history: items.length ? parseConsumptionHistory(items) : [] }
  };
  return result;
}

// Factura de TIM (teléfono/fibra): lo básico, con varias formas de escribirlo.
export function parseTim(raw: string) {
  const flat = raw.replace(/ /g, ' ').replace(/\s+/g, ' ');
  const period = flat.match(/(?:periodo|bimestre|competenza)[^0-9]{0,40}(\d{2}\/\d{2}\/\d{4})\s*(?:-|al|a)\s*(\d{2}\/\d{2}\/\d{4})/i);
  return {
    provider: 'TIM',
    kind: 'telefono',
    invoice_number: one(flat, /(?:Fattura|Conto)\s*(?:n\.?|numero|nr\.?)\s*[:°]?\s*([A-Z0-9][A-Z0-9/-]{4,})/i),
    issue_date: isoDate(one(flat, /(?:data (?:di )?emissione|emessa il|del)\s*:?\s*(\d{2}\/\d{2}\/\d{4})/i)),
    due_date: isoDate(one(flat, /(?:scadenza|entro il|da pagare entro)\s*:?\s*(?:il\s*)?(\d{2}\/\d{2}\/\d{4})/i)),
    period_start: isoDate(period?.[1]),
    period_end: isoDate(period?.[2]),
    total_amount: num(one(flat, /(?:totale (?:da pagare|fattura|conto)|importo (?:da pagare|totale))\s*:?\s*(?:€\s*)?([\d.,]+)\s*(?:€|euro)?/i)),
    details: {}
  };
}

export function detectProvider(text: string, hint = '') {
  const sample = `${hint} ${text.slice(0, 4000)}`;
  if (/octopus/i.test(sample)) return 'Octopus';
  if (/\bTIM\b|telecom italia/i.test(sample)) return 'TIM';
  return null;
}

const MONTH_NAMES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
// «Luz · septiembre 2026», «TIM · octubre 2026».
export function billTitle(bill: { provider: string; period_start?: string | null; issue_date?: string | null }) {
  const iso = bill.period_start || bill.issue_date;
  const when = iso ? `${MONTH_NAMES[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}` : '';
  return `${bill.provider === 'Octopus' ? 'Luz Octopus' : bill.provider}${when ? ` · ${when}` : ''}`;
}
