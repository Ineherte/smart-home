// Lectura de extractos bancarios (pensado para Intesa Sanpaolo, sirve para la mayoría).
// Intesa exporta dos formatos en Excel:
//   - Movimientos de la cuenta: Data contabile · Data valuta · Descrizione · Accrediti · Addebiti
//   - Movimientos de la tarjeta: Data · Operazione/Dettagli · Importo (negativo = cargo)
// Antes de la tabla suele haber filas con los datos de la cuenta. En la descripción, el comercio
// va tras «PRESSO» y la fecha real del pago aparece como «EFFETTUATO IL dd/mm/aaaa».
// Funciones puras (sin DOM): las usa personal.js.

const PERSONAL_CATEGORIES = [
  { name: 'Supermercado', icon: 'shopping-cart' },
  { name: 'Comer fuera', icon: 'utensils' },
  { name: 'Transporte', icon: 'bus' },
  { name: 'Casa y facturas', icon: 'house' },
  { name: 'Suscripciones', icon: 'repeat' },
  { name: 'Ocio', icon: 'ticket' },
  { name: 'Viajes', icon: 'plane' },
  { name: 'Compras', icon: 'shopping-bag' },
  { name: 'Ropa', icon: 'shirt' },
  { name: 'Salud y cuidado', icon: 'heart-pulse' },
  { name: 'Regalos', icon: 'gift' },
  { name: 'Efectivo', icon: 'banknote' },
  { name: 'Transferencias', icon: 'arrow-right-left' },
  { name: 'Otros', icon: 'circle-ellipsis' }
];
const INCOME_CATEGORIES = [
  { name: 'Nómina', icon: 'briefcase' },
  { name: 'Transferencias recibidas', icon: 'arrow-down-left' },
  { name: 'Otros ingresos', icon: 'plus-circle' }
];
// Categorías antiguas → actuales.
const LEGACY_CATEGORIES = { 'Ocio y viajes': 'Ocio' };

const bankNorm = (value) => String(value ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim();
const merchantKey = (name) => bankNorm(name).toLowerCase().slice(0, 80);

// ---------- Cabecera ----------

const BANK_COLUMNS = {
  date: /^(DATA|DATA (CONTABILE|OPERAZIONE|REGISTRAZIONE|MOVIMENTO|ACQUISTO|TRANSAZIONE)|FECHA( (OPERACION|CONTABLE))?|DATE|BOOKING DATE)$/,
  valueDate: /^(DATA VALUTA|FECHA VALOR|VALUE DATE)$/,
  description: /(DESCRIZIONE|DETTAGLI|OPERAZIONE|CAUSALE|CONCEPTO|DESCRIPCION|DESCRIPTION|MOVIMENTO)/,
  amount: /^(IMPORTO|IMPORTO EUR|IMPORTO EURO|IMPORTE|AMOUNT|CANTIDAD)$/,
  credit: /^(ACCREDITI|ACCREDITO|ENTRATE|AVERE|INGRESOS|ABONOS|HABER|CREDIT)( EUR| EURO)?$/,
  debit: /^(ADDEBITI|ADDEBITO|USCITE|DARE|GASTOS|CARGOS|DEBE|DEBIT)( EUR| EURO)?$/,
  category: /^(CATEGORIA|CATEGORY)$/
};

function findBankLayout(rows) {
  for (let index = 0; index < Math.min(rows.length, 80); index += 1) {
    const headers = (rows[index] || []).map(bankNorm);
    const layout = { header: index, date: -1, valueDate: -1, description: [], amount: -1, credit: -1, debit: -1, category: -1 };
    headers.forEach((header, column) => {
      if (!header) return;
      if (layout.date < 0 && BANK_COLUMNS.date.test(header)) layout.date = column;
      else if (layout.valueDate < 0 && BANK_COLUMNS.valueDate.test(header)) layout.valueDate = column;
      else if (layout.amount < 0 && BANK_COLUMNS.amount.test(header)) layout.amount = column;
      else if (layout.credit < 0 && BANK_COLUMNS.credit.test(header)) layout.credit = column;
      else if (layout.debit < 0 && BANK_COLUMNS.debit.test(header)) layout.debit = column;
      else if (layout.category < 0 && BANK_COLUMNS.category.test(header)) layout.category = column;
      else if (BANK_COLUMNS.description.test(header) && !/DATA|VALUTA/.test(header)) layout.description.push(column);
    });
    if (layout.date < 0 && layout.valueDate >= 0) layout.date = layout.valueDate;
    if (layout.date >= 0 && layout.description.length && (layout.amount >= 0 || layout.debit >= 0)) return layout;
  }
  return null;
}

// ---------- Valores ----------

function bankDate(value) {
  if (value == null || value === '') return null;
  const pad = (number) => String(number).padStart(2, '0');
  if (value instanceof Date && !Number.isNaN(value.getTime())) return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
  if (typeof value === 'number' && value > 20000 && value < 80000) {
    const date = new Date(Date.UTC(1899, 11, 30) + value * 86400000);
    return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
  }
  const text = String(value).trim();
  let match = text.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/);
  if (match) {
    const year = match[3].length === 2 ? 2000 + Number(match[3]) : Number(match[3]);
    return `${year}-${pad(match[2])}-${pad(match[1])}`;
  }
  match = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  return match ? `${match[1]}-${pad(match[2])}-${pad(match[3])}` : null;
}

// «-1.234,56», «1,234.56», «(8,00)», «8,00-» → número con signo.
function bankAmount(value) {
  if (typeof value === 'number') return value;
  let text = String(value ?? '').trim();
  if (!text) return null;
  const negative = /^[-−]|[-−]$|^\(.*\)$/.test(text);
  text = text.replace(/[^\d,.]/g, '');
  if (!text) return null;
  if (text.includes(',') && text.includes('.')) text = text.lastIndexOf(',') > text.lastIndexOf('.') ? text.replace(/\./g, '').replace(',', '.') : text.replace(/,/g, '');
  else if (text.includes(',')) text = text.replace(',', '.');
  else if (/^\d{1,3}(\.\d{3})+$/.test(text)) text = text.replace(/\./g, '');
  const number = Number(text);
  return Number.isFinite(number) ? (negative ? -number : number) : null;
}

// Fecha real del pago dentro de la descripción (el cargo puede contabilizarse días después).
function purchaseDate(description, booked) {
  if (!booked) return null;
  const within = (iso) => {
    const days = (new Date(`${booked}T12:00:00`) - new Date(`${iso}T12:00:00`)) / 86400000;
    return days >= -2 && days <= 45 ? iso : null;
  };
  let match = description.match(/EFFETTUAT[OA]\s+IL\s+(\d{1,2})\/(\d{1,2})\/(\d{2,4})/i)
    || description.match(/\b(?:DEL|IL)\s+(\d{1,2})\/(\d{1,2})\/(\d{2,4})\s+(?:ALLE\s+)?(?:ORE\s+)?\d{1,2}[:.]\d{2}/i);
  if (match) return within(bankDate(`${match[1]}/${match[2]}/${match[3]}`));
  match = description.match(/\b(\d{2})\/(\d{2})\s*-\s*\d{1,2}[:.]\d{2}/);
  if (match) {
    let year = Number(booked.slice(0, 4));
    if (Number(match[2]) > Number(booked.slice(5, 7)) + 1) year -= 1;
    return within(`${year}-${match[2]}-${match[1]}`);
  }
  return null;
}

// ---------- Tipo de movimiento y comercio ----------

function movementKind(description, direction) {
  const text = ` ${bankNorm(description)} `;
  if (direction === 'out' && /\bPRELIEV|\bPREL\b|\bATM\b|CASH WITHDRAW|\bRETIRADA\b/.test(text)) return 'withdraw';
  if (/\bCOMMISSION|\bCANONE\b|IMPOSTA DI BOLLO|\bSPESE (TENUTA|INVIO|BONIFICO)|\bCOMISION/.test(text)) return 'fee';
  if (/\bADDEBITO (DIRETTO|SDD)|\bSDD\b|\bRID\b|\bDOMICILIA/.test(text)) return 'sdd';
  if (/\bBONIFIC|\bGIROCONTO|\bGIROFONDI|\bSTIPENDI|\bEMOLUMENT|\bA FAVORE DI\b|\bDISPOSTO DA\b|\bTRANSFERENCIA|\bBIZUM|\bSATISPAY\b(?! \*)/.test(text)) return 'transfer';
  return 'card';
}

const PAYMENT_PROCESSORS = /^(SUMUP|SUM UP|SQ|SQUP|PAYPAL|PP|ZETTLE|IZ|IZETTLE|STRIPE|NEXI|SATISPAY|GOOGLE|GPAY|MOLLIE|WORLDLINE)\s*\*+\s*/i;
const KNOWN_BRANDS = [
  [/\bAMZN\b|\bAMAZON\b/, 'Amazon'], [/\bAPPLE COM\b|\bITUNES\b/, 'Apple'], [/\bNETFLIX\b/, 'Netflix'], [/\bSPOTIFY\b/, 'Spotify'],
  [/\bDISNEY ?PLUS\b/, 'Disney+'], [/\bMC ?DONALD/, "McDonald's"], [/\bYOUTUBE\b/, 'YouTube'], [/\bUBER ?EATS\b/, 'Uber Eats'],
  [/\bJUST ?EAT\b/, 'Just Eat'], [/\bDELIVEROO\b/, 'Deliveroo'], [/\bGLOVO\b/, 'Glovo'], [/\bTRENITALIA\b/, 'Trenitalia'],
  [/\bITALO\b/, 'Italo'], [/\bRYANAIR\b/, 'Ryanair'], [/\bVUELING\b/, 'Vueling'], [/\bEASYJET\b/, 'easyJet'], [/\bESSELUNGA\b/, 'Esselunga'],
  [/\bCARREFOUR\b/, 'Carrefour'], [/\bLIDL\b/, 'Lidl'], [/\bCONAD\b/, 'Conad'], [/\bEUROSPIN\b/, 'Eurospin'], [/\bIKEA\b/, 'IKEA'],
  [/\bZARA\b/, 'Zara'], [/\bZALANDO\b/, 'Zalando'], [/\bSHEIN\b/, 'SHEIN'], [/\bVINTED\b/, 'Vinted'], [/\bDECATHLON\b/, 'Decathlon'], [/\bGTT\b/, 'GTT'], [/\bUBER\b/, 'Uber'], [/\bAIRBNB\b/, 'Airbnb'], [/\bBOOKING\b/, 'Booking']
];
const TRAILING_CITIES = new Set(['TORINO', 'TO', 'MILANO', 'MI', 'ROMA', 'RM', 'GENOVA', 'BOLOGNA', 'FIRENZE', 'NAPOLI', 'VENEZIA', 'MONCALIERI', 'COLLEGNO', 'RIVOLI', 'GRUGLIASCO', 'NICHELINO', 'ORBASSANO', 'SETTIMO TORINESE', 'CHIERI', 'IT', 'ITA', 'ITALIA', 'ITALY', 'MADRID', 'BARCELONA', 'ES', 'ESP', 'IE', 'LU', 'NL', 'GB']);

function titleCase(text) {
  const small = new Set(['DI', 'DA', 'DEL', 'DELLA', 'LA', 'IL', 'LO', 'E', 'AL', 'DE', 'Y', 'EL', 'EN']);
  return text.split(' ').filter(Boolean).map((word, index) => {
    if (/\d/.test(word) && /[A-Z]/i.test(word)) return word.toUpperCase();
    if (index > 0 && small.has(word.toUpperCase())) return word.toLowerCase();
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  }).join(' ');
}

// Nombre corto del comercio a partir de la descripción del banco.
function cleanMerchant(description, kind) {
  if (kind === 'withdraw') return 'Retirada de efectivo';
  if (kind === 'fee') return /BOLLO/i.test(description) ? 'Impuesto de timbre' : 'Comisiones del banco';
  if (/GIROCONTO|GIROFONDI|TRASFERIMENTO TRA CONTI|TRASPASO/i.test(description)) return 'Traspaso entre cuentas';
  let text = String(description).replace(/\s+/g, ' ').trim();
  if (kind === 'sdd') {
    text = text
      .replace(/^.*?\b(ADDEBITO( DIRETTO)?( SEPA)?( SDD| RID| CORE)?|SDD|RID)\b\s*/i, '')
      .replace(/\b(MANDATO|ID MANDATO|CID|RIF|COD|CREDITOR ID|ADDEBITO N)\b.*$/i, '')
      .trim() || text;
  }
  if (kind === 'transfer') {
    const party = text.match(/(?:A FAVORE DI|BENEF(?:ICIARIO)?\.?:?|DISPOSTO DA|ORDINANTE:?|MITT(?:ENTE)?\.?:?|CREDITORE:?|DA)\s+([A-Z][A-Z .'&-]{2,60}?)(?=\s+(?:IBAN|BIC|CAUSALE|COD|RIF|INFO|NOTE|ID|MANDATO|PER|$)|[,;:]|$)/i);
    if (party) return titleCase(party[1].trim()).slice(0, 40);
  }
  const presso = [...text.matchAll(/\bPRESSO\b/gi)];
  if (presso.length) text = text.slice(presso.at(-1).index + 6);
  text = text
    .replace(/^\s*(PAGAMENTO|PAGAM\.?|PAG\.?|ACQUISTO|ACQ\.?|ADDEBITO|OPERAZIONE|TRANSAZIONE|COMPRA|PAGO)\s+((TRAMITE|SU|CON|DA|MEDIANTE|EN|CON TARJETA)\s+)?(POS|CARTA( DI (DEBITO|CREDITO))?|APPLE ?PAY|GOOGLE ?PAY|CONTACTLESS|BANCOMAT|INTERNET|ONLINE|E-?COMMERCE)?\s*/i, '')
    .replace(/^\s*(POS|CARTA|APPLE ?PAY|GOOGLE ?PAY)\s+/i, '')
    .replace(/^EFFETTUAT[OA]\s+IL\s+\S+(\s+ALLE\s+ORE\s+\S+)?\s*/i, '');
  const cuts = [/\d{1,2}\/\d{1,2}(\/\d{2,4})?\s*-\s*\d{1,2}[:.]\d{2}/, /\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/, /\s-\s*CARTA\b/i, /\bCARTA\s*(N\b|\d)/i, /\bMEDIANTE\b/i, /\bCOD\.?\s*[\d/]/i, /\bRIF\.?\s*\d/i, /\b\d{4}\s*[X*]{2,}/i, /\*{4}/, /\s(VIA|V\.LE|VIALE|PIAZZA|P\.ZZA|CORSO|C\.SO|LARGO|STRADA|CALLE|AVDA)\s/i];
  let cut = text.length;
  cuts.forEach((pattern) => {
    const match = text.match(pattern);
    if (match && match.index > 0 && match.index < cut) cut = match.index;
  });
  text = text.slice(0, cut).trim().replace(PAYMENT_PROCESSORS, '');
  const normalized = bankNorm(text) || bankNorm(description);
  const brand = KNOWN_BRANDS.find(([pattern]) => pattern.test(normalized));
  if (brand) return brand[1];
  const star = text.indexOf('*');
  if (star > 1) text = text.slice(0, star);
  let words = bankNorm(text).replace(/\b(S ?R ?L|S ?P ?A|S ?N ?C|S ?A ?S|SRLS|SL|SA|SE|GMBH|LTD|INC|BV|DAC)\b/g, ' ').split(' ').filter(Boolean);
  for (let changed = true; changed && words.length > 1;) {
    changed = false;
    for (let size = Math.min(2, words.length - 1); size >= 1; size -= 1) {
      if (TRAILING_CITIES.has(words.slice(-size).join(' '))) {
        words = words.slice(0, -size);
        changed = true;
        break;
      }
    }
  }
  const name = words.join(' ').slice(0, 40).trim();
  return name.length >= 2 ? titleCase(name) : titleCase(bankNorm(description).split(' ').slice(0, 3).join(' '));
}

// ---------- Categoría ----------

const CATEGORY_KEYWORDS = [
  ['Supermercado', /ESSELUNGA|CARREFOUR|\bCOOP\b|CONAD|LIDL|EUROSPIN|\bPAM\b|ALDI|PENNY|MERCADONA|\bDIA\b|SUPERMERC|NATURASI|BENNET|DESPAR|\bCRAI\b|IPERCOOP|MD DISCOUNT|CARNAZZA|MACELLERIA|FRUTTA|PANIFICIO/],
  ['Comer fuera', /\bBAR\b|CAFF|\bCAFE|RISTORANT|PIZZER|TRATTORIA|OSTERIA|RESTAURANTE|MCDONALD|BURGER|KEBAB|SUSHI|GLOVO|DELIVEROO|JUST ?EAT|UBER ?EATS|GELATER|PASTICCER|PANETTER|STARBUCKS|BIRRERIA|ENOTECA|POKE|PIADINER/],
  ['Transporte', /\bGTT\b|TRENITALIA|\bITALO\b|TRENORD|\bUBER\b|TAXI|\bENI\b|\bQ8\b|TAMOIL|\bIP\b|\bESSO\b|AUTOSTRAD|TELEPASS|PARCHEGG|PARKING|\bBIRD\b|\bLIME\b|\bBOLT\b|CARBURANT|\bAGIP\b|DISTRIBUTORE|TO ?MOVE|ENJOY|SHARE NOW/],
  ['Casa y facturas', /\bIREN\b|\bENEL\b|EDISON|\bA2A\b|HERA|\bTIM\b|VODAFONE|WINDTRE|WIND TRE|ILIAD|FASTWEB|\bHO MOBILE|KENA|OCTOPUS|SORGENIA|SMAT|CONDOMIN|AFFITTO|LEROY|BRICO/],
  ['Suscripciones', /NETFLIX|SPOTIFY|DISNEY|PRIME VIDEO|AMAZON PRIME|\bDAZN\b|NOW TV|YOUTUBE|ICLOUD|APPLE COM|GOOGLE ONE|CHATGPT|OPENAI|AUDIBLE|PALESTRA|\bGYM\b|MCFIT|VIRGIN ACTIVE/],
  ['Viajes', /RYANAIR|VUELING|EASYJET|WIZZ|ITA AIRWAYS|IBERIA|BOOKING|AIRBNB|HOTEL|EXPEDIA|FLIXBUS|HOSTEL|B ?& ?B/],
  ['Ocio', /CINEMA|\bCINE\b|TEATRO|MUSEO|TICKETONE|TICKETMASTER|STEAM|PLAYSTATION|NINTENDO|CONCERT|LIBRERIA|FELTRINELLI|MONDADORI|BOWLING/],
  ['Ropa', /\bZARA\b|\bH ?& ?M\b|PRIMARK|UNIQLO|PULL ?& ?BEAR|BERSHKA|STRADIVARIUS|MANGO|OVS|ZALANDO|DECATHLON|FOOT ?LOCKER|NIKE|ADIDAS|VINTED/],
  ['Compras', /AMAZON|AMZN|IKEA|MEDIAWORLD|UNIEURO|TIGER|ACTION|\bEBAY\b|ALIEXPRESS|SHEIN|TEMU/],
  ['Regalos', /\bREGAL[OI]\b|COMPLEANNO|CUMPLEAN|\bGIFT\b|INTERFLORA|FIORAI/],
  ['Salud y cuidado', /FARMAC|PHARM|PARAFARM|OSPEDAL|CLINIC|DENTIST|OTTICA|DOUGLAS|SEPHORA|PARRUCCH|BARBIER|ESTETIC|ACQUA DI PARMA|KIKO/]
];

// Categorías propias del banco (Intesa las incluye en el Excel de la tarjeta).
const BANK_CATEGORY_MAP = [
  [/ABBIGLIAMENTO|CALZATURE|MODA/, 'Ropa'], [/ALIMENTARI|SUPERMERCAT|SPESA/, 'Supermercado'], [/RISTORA|RISTORANT|BAR\b|CAFFE/, 'Comer fuera'],
  [/TRASPORT|CARBURANT|TAXI|PARCHEGG|MOBILITA|AUTO|PEDAGG/, 'Transporte'], [/UTENZE|CASA|AFFITTO|TELEFON|BOLLETT/, 'Casa y facturas'],
  [/ABBONAMENT|STREAMING|SERVIZI DIGITALI/, 'Suscripciones'], [/VIAGG|VACANZ|HOTEL|ALBERG/, 'Viajes'], [/TEMPO LIBERO|SVAGO|CULTURA|SPETTACOL|SPORT|HOBBY/, 'Ocio'],
  [/SHOPPING|ACQUISTI|ELETTRONICA|ARREDAMENT/, 'Compras'], [/SALUTE|BENESSERE|FARMAC|CURA DELLA PERSONA|MEDIC/, 'Salud y cuidado'], [/REGAL/, 'Regalos'], [/PRELIEV|CONTANT/, 'Efectivo']
];

// Una devolución con tarjeta (entra dinero de un comercio) resta de su categoría de gasto.
const isRefund = ({ direction, kind }) => direction === 'in' && kind === 'card';

function guessBankCategory({ merchant, description, kind, direction, bankCategory = '' }) {
  const text = ` ${bankNorm(`${merchant} ${description}`)} `;
  if (direction === 'in' && !isRefund({ direction, kind })) {
    if (/STIPENDI|EMOLUMENT|SALARIO|NOMINA|PAYROLL|RETRIBUZ/.test(text)) return 'Nómina';
    if (kind === 'transfer') return 'Transferencias recibidas';
    return 'Otros ingresos';
  }
  if (kind === 'withdraw') return 'Efectivo';
  const byMerchant = CATEGORY_KEYWORDS.find(([, pattern]) => pattern.test(` ${bankNorm(merchant)} `));
  if (byMerchant) return byMerchant[0];
  const details = ` ${bankNorm(description).replace(/\b(PAGAMENTO|EFFETTUATO|ALLE|ORE|PRESSO|MEDIANTE|LA|CARTA|XXXX|TRAMITE|POS|IL|DEL|APPLE|PAY)\b/g, ' ')} `;
  const match = CATEGORY_KEYWORDS.find(([, pattern]) => pattern.test(details));
  if (match) return match[0];
  const fromBank = BANK_CATEGORY_MAP.find(([pattern]) => pattern.test(bankNorm(bankCategory)));
  if (fromBank) return fromBank[1];
  if (kind === 'fee') return 'Casa y facturas';
  if (kind === 'transfer') return 'Transferencias';
  return 'Otros';
}

// Movimientos que no son gasto real: entre cuentas propias, o a la pareja (ya cuenta en Casa).
function defaultExcluded({ description, direction, merchant }, partnerName) {
  const text = ` ${bankNorm(`${merchant} ${description}`)} `;
  if (/GIROCONTO|GIROFONDI|TRASFERIMENTO TRA CONTI|TRASPASO/.test(text)) return true;
  if (direction === 'out' && partnerName && new RegExp(`\\b${bankNorm(partnerName)}\\b`).test(text) && /BONIFIC|TRANSFER|BIZUM|SATISPAY/.test(text)) return true;
  return false;
}

// ---------- Todo junto ----------

// rows: filas del Excel (sheet_to_json con header: 1). Devuelve los movimientos ya interpretados.
function parseBankRows(rows) {
  const layout = findBankLayout(rows);
  if (!layout) return { layout: null, items: [] };
  const items = [];
  const seen = {};
  for (let index = layout.header + 1; index < rows.length; index += 1) {
    const row = rows[index] || [];
    const booked = bankDate(row[layout.date]) || bankDate(row[layout.valueDate]);
    if (!booked) continue;
    let amount = null;
    if (layout.amount >= 0) amount = bankAmount(row[layout.amount]);
    if (!amount) {
      const credit = layout.credit >= 0 ? bankAmount(row[layout.credit]) : null;
      const debit = layout.debit >= 0 ? bankAmount(row[layout.debit]) : null;
      if (credit) amount = Math.abs(credit);
      else if (debit) amount = -Math.abs(debit);
    }
    if (!amount) continue;
    // Une las columnas de texto sin repetir lo que ya está contenido en otra.
    const parts = [];
    layout.description.forEach((column) => {
      const text = String(row[column] ?? '').replace(/\s+/g, ' ').trim();
      if (!text) return;
      const normalized = bankNorm(text);
      if (parts.some((part) => bankNorm(part).includes(normalized))) return;
      for (let i = parts.length - 1; i >= 0; i -= 1) if (normalized.includes(bankNorm(parts[i]))) parts.splice(i, 1);
      parts.push(text);
    });
    const description = parts.join(' · ').slice(0, 500);
    const direction = amount < 0 ? 'out' : 'in';
    const kind = movementKind(description, direction);
    const merchant = cleanMerchant(description, kind);
    const date = purchaseDate(description, booked) || booked;
    const base = `bank:${booked}|${bankNorm(description).slice(0, 120)}|${Math.abs(amount).toFixed(2)}|${direction}`;
    seen[base] = (seen[base] || 0) + 1;
    items.push({
      date,
      booked,
      description,
      amount: Math.round(Math.abs(amount) * 100) / 100,
      direction,
      kind,
      merchant,
      bankCategory: layout.category >= 0 ? String(row[layout.category] ?? '').trim() : '',
      reference: `${base}|${seen[base]}`.slice(0, 300)
    });
  }
  return { layout, items };
}

if (typeof module !== 'undefined') module.exports = { isRefund, parseBankRows, cleanMerchant, movementKind, guessBankCategory, defaultExcluded, purchaseDate, bankAmount, bankDate, merchantKey, findBankLayout };
