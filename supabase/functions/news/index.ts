// Noticias de Vida: junta varias fuentes RSS, quita las repetidas y las devuelve por secciones.
// Italia: el Inter (FcInterNews, FCInter1908 y Google News) y la política italiana (ANSA
// Politica y Google News). España: la portada de El País.
// GET ?country=italy|spain → { sections: [{ id, label, emoji, items: [{ title, link, source, date }] }], updated }
// Es pública (no hay datos vuestros) y gratis: supabase functions deploy news --no-verify-jwt

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

const googleNews = (query: string, lang = 'it', country = 'IT') =>
  `https://news.google.com/rss/search?q=${encodeURIComponent(query)}+when:2d&hl=${lang}&gl=${country}&ceid=${country}:${lang}`;

type Feed = { url: string; source?: string };
type Section = { id: string; label: string; emoji: string; feeds: Feed[]; max: number; keep?: RegExp; drop?: RegExp };
type Item = { title: string; link: string; source: string; date: number };

const SECTIONS: Record<string, Section[]> = {
  italy: [
    {
      id: 'inter', label: 'Inter', emoji: '⚽', max: 10,
      feeds: [
        { url: 'https://www.fcinternews.it/rss/', source: 'FcInterNews' },
        { url: 'https://www.fcinter1908.it/feed/', source: 'FCInter1908' },
        { url: googleNews('Inter nerazzurri') }
      ],
      // Fuera la publicidad y las páginas de servicio.
      // Fuera también el Inter Miami (sale al buscar «Inter»).
      drop: /\b(?:diretta tv|dove vedere|streaming gratis|biglietti|codice sconto|oroscopo|inter miami|mls)\b/i
    },
    {
      id: 'politica', label: 'Política italiana', emoji: '🏛️', max: 10,
      feeds: [
        { url: 'https://www.ansa.it/sito/notizie/politica/politica_rss.xml', source: 'ANSA' },
        { url: googleNews('governo OR parlamento OR Meloni OR Schlein OR elezioni politica italiana') }
      ],
      drop: /\b(?:papa|pontefice|oroscopo|meteo)\b/i
    }
  ],
  spain: [
    {
      id: 'portada', label: 'Lo más importante', emoji: '📰', max: 10,
      feeds: [{ url: 'https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/portada', source: 'El País' }]
    },
    {
      id: 'politica', label: 'Política española', emoji: '🏛️', max: 8,
      feeds: [{ url: googleNews('Gobierno de España OR Congreso de los Diputados OR Sánchez OR Feijóo', 'es', 'ES') }],
      drop: /\b(?:per[uú]|argentin|m[eé]xic|colombi|chile|venezuel)/i
    }
  ]
};

// ---------- RSS ----------
const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', laquo: '«', raquo: '»', rsquo: '’', lsquo: '‘', ldquo: '“', rdquo: '”', hellip: '…', egrave: 'è', eacute: 'é', agrave: 'à', ograve: 'ò', ugrave: 'ù', igrave: 'ì' };
function decode(value: string) {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&([a-z]+);/gi, (match, name) => ENTITIES[name.toLowerCase()] ?? match)
    .replace(/\s+/g, ' ')
    .trim();
}
const tag = (xml: string, name: string) => xml.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, 'i'))?.[1] ?? '';

function parseFeed(xml: string, feed: Feed): Item[] {
  return [...xml.matchAll(/<item[\s>][\s\S]*?<\/item>/gi)].map(([raw]) => {
    let title = decode(tag(raw, 'title'));
    let source = feed.source || decode(tag(raw, 'source'));
    // Google News: «Titular - Medio».
    if (!feed.source) {
      const cut = title.lastIndexOf(' - ');
      if (cut > 20) {
        source = source || title.slice(cut + 3);
        title = title.slice(0, cut);
      }
    }
    const link = decode(tag(raw, 'link')) || raw.match(/<link[^>]*href="([^"]+)"/i)?.[1] || '';
    const date = Date.parse(decode(tag(raw, 'pubDate')) || decode(tag(raw, 'dc:date'))) || 0;
    return { title, link, source: source || 'Noticias', date };
  }).filter((item) => item.title && /^https?:\/\//.test(item.link));
}

async function fetchFeed(feed: Feed): Promise<Item[]> {
  try {
    const response = await fetch(feed.url, { headers: { 'User-Agent': 'Mozilla/5.0 (Umbral; lector de noticias)', Accept: 'application/rss+xml, application/xml, text/xml' }, signal: AbortSignal.timeout(8000) });
    if (!response.ok) return [];
    return parseFeed(await response.text(), feed);
  } catch {
    return [];
  }
}

// ---------- Repetidas ----------
// Dos titulares son la misma noticia si comparten la mayoría de sus palabras importantes.
const STOP = new Set(['della', 'delle', 'degli', 'dello', 'nella', 'sulla', 'alla', 'dalla', 'con', 'per', 'che', 'non', 'una', 'uno', 'gli', 'del', 'dei', 'les', 'los', 'las', 'para', 'por', 'como', 'the']);
const words = (title: string) => new Set(title.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().split(/[^a-z0-9]+/).filter((word) => word.length > 3 && !STOP.has(word)));
function similar(a: Set<string>, b: Set<string>) {
  if (!a.size || !b.size) return false;
  let shared = 0;
  a.forEach((word) => { if (b.has(word)) shared += 1; });
  return shared / Math.min(a.size, b.size) >= 0.6;
}

async function buildSection(section: Section) {
  const lists = await Promise.all(section.feeds.map(fetchFeed));
  const recent = Date.now() - 3 * 86400000;
  const all = lists.flat()
    .filter((item) => (!item.date || item.date > recent) && !(section.drop?.test(item.title)))
    .sort((a, b) => b.date - a.date);
  const kept: (Item & { words: Set<string> })[] = [];
  for (const item of all) {
    const itemWords = words(item.title);
    if (kept.some((other) => similar(other.words, itemWords))) continue;
    kept.push({ ...item, words: itemWords });
    if (kept.length >= section.max) break;
  }
  return { id: section.id, label: section.label, emoji: section.emoji, items: kept.map(({ words: _, ...item }) => item) };
}

// Unos minutos de memoria: los dos móviles (y cada recarga) no vuelven a pedir todo.
const cache = new Map<string, { at: number; body: string }>();
const TTL = 10 * 60 * 1000;

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const country = new URL(request.url).searchParams.get('country') === 'spain' ? 'spain' : 'italy';
  const cached = cache.get(country);
  if (cached && Date.now() - cached.at < TTL) return reply(cached.body);
  const sections = await Promise.all(SECTIONS[country].map(buildSection));
  const body = JSON.stringify({ country, sections, updated: new Date().toISOString() });
  if (sections.some((section) => section.items.length)) cache.set(country, { at: Date.now(), body });
  return reply(body);
});

function reply(body: string) {
  return new Response(body, { headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=300' } });
}
