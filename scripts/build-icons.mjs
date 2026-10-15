// Genera vendor/icons.js: solo los iconos de Lucide que usa Umbral y un createIcons rápido.
//   node scripts/build-icons.mjs
// Busca en el código (raíz *.js e index.html) cualquier texto que sea el nombre de un icono
// («shopping-cart», 'zap'…), así que también entran los que se eligen con variables. Si aun así
// falta alguno, vendor/icons.js descarga la librería completa (vendor/lucide-*.js) en ese momento.
import fs from 'fs';
import path from 'path';
import vm from 'vm';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const full = fs.readdirSync(path.join(root, 'vendor')).find((name) => /^lucide-[\d.]+\.js$/.test(name));
const sandbox = { self: {}, globalThis: {} };
sandbox.globalThis = sandbox;
vm.runInNewContext(fs.readFileSync(path.join(root, 'vendor', full), 'utf8'), sandbox);
const lucide = sandbox.lucide;
const pascal = (name) => name.split(/[-_]/).filter(Boolean).map((part) => part[0].toUpperCase() + part.slice(1)).join('');

const sources = [
  ...fs.readdirSync(root).filter((name) => name.endsWith('.js') || name === 'index.html').map((name) => path.join(root, name))
];
const tokens = new Set();
for (const file of sources) {
  const text = fs.readFileSync(file, 'utf8');
  for (const match of text.matchAll(/['"`=\s>]([a-z][a-z0-9]*(?:-[a-z0-9]+)*)['"`\s<]/g)) tokens.add(match[1]);
}
const used = {};
for (const token of tokens) {
  const icon = lucide.icons[pascal(token)];
  if (icon) used[token] = icon;
}
const names = Object.keys(used).sort();

const out = `// Iconos de Lucide que usa Umbral (generado con scripts/build-icons.mjs; no editar a mano).
// ${names.length} iconos de ${Object.keys(lucide.icons).length}. Lucide (https://lucide.dev), licencia ISC.
// createIcons solo convierte los <i data-lucide> que aún no son iconos y copia cada SVG de una
// plantilla. Si falta algún icono, descarga la librería completa (${full}) y lo dibuja.
(function () {
  const ICONS = ${JSON.stringify(used)};
  const SVG = 'http://www.w3.org/2000/svg';
  const BASE = { xmlns: SVG, width: 24, height: 24, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' };
  const templates = new Map();
  const build = ([tag, attrs, children]) => {
    const el = document.createElementNS(SVG, tag);
    Object.keys(attrs).forEach((key) => el.setAttribute(key, String(attrs[key])));
    (children || []).forEach((child) => el.appendChild(build(child)));
    return el;
  };
  function template(name) {
    if (templates.has(name)) return templates.get(name);
    const node = ICONS[name] || (window.__lucideFull && window.__lucideFull.icons[name.split(/[-_]/).filter(Boolean).map((p) => p[0].toUpperCase() + p.slice(1)).join('')]);
    if (!node) return null;
    const svg = build(['svg', BASE, node]);
    templates.set(name, svg);
    return svg;
  }
  let loadingFull = null;
  function loadFull() {
    if (!loadingFull) {
      loadingFull = new Promise((resolve) => {
        const script = document.createElement('script');
        script.src = 'vendor/${full}';
        script.onload = () => { window.__lucideFull = window.lucide; window.lucide = api; resolve(); };
        script.onerror = () => resolve();
        document.head.appendChild(script);
      });
    }
    return loadingFull;
  }
  function createIcons({ root = document, attrs = {} } = {}) {
    const pending = root.querySelectorAll('i[data-lucide], span[data-lucide]:not(svg)');
    let missing = false;
    pending.forEach((el) => {
      const name = el.getAttribute('data-lucide');
      const base = template(name);
      if (!base) { missing = true; return; }
      const svg = base.cloneNode(true);
      for (const attr of el.attributes) if (attr.name !== 'class') svg.setAttribute(attr.name, attr.value);
      Object.keys(attrs).forEach((key) => svg.setAttribute(key, attrs[key]));
      const hasLabel = [...el.attributes].some((attr) => attr.name.startsWith('aria-') || attr.name === 'role' || attr.name === 'title');
      if (!hasLabel) svg.setAttribute('aria-hidden', 'true');
      svg.setAttribute('class', ['lucide', \`lucide-\${name}\`, el.getAttribute('class') || ''].join(' ').trim());
      el.replaceWith(svg);
    });
    if (missing && !window.__lucideFull) loadFull().then(() => createIcons({ root, attrs }));
  }
  const api = { icons: ICONS, createIcons, createElement: (node) => build(['svg', BASE, node]) };
  window.lucide = api;
})();
`;
fs.writeFileSync(path.join(root, 'vendor', 'icons.js'), out);
console.log(`vendor/icons.js: ${names.length} iconos, ${(out.length / 1024).toFixed(1)} KB (antes ${(fs.statSync(path.join(root, 'vendor', full)).size / 1024).toFixed(0)} KB)`);
