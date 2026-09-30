// Copia los archivos fuente de la raíz a www/, que es el webDir que usa Capacitor
// (ver capacitor.config.json). La raíz es la fuente única de verdad: edita ahí,
// no dentro de www/, y ejecuta este script (o `npm run build:www`) antes de
// `cap sync` para evitar que las dos copias diverjan.
const fs = require('fs');
const path = require('path');

// Todos los .js de la raíz más la página, los estilos, el manifiesto y el icono.
const FILES = [
  'index.html',
  'styles.css',
  'manifest.webmanifest',
  'icon.svg',
  ...fs.readdirSync(path.join(__dirname, '..')).filter((file) => file.endsWith('.js'))
];

const root = path.join(__dirname, '..');
const wwwDir = path.join(root, 'www');

if (!fs.existsSync(wwwDir)) fs.mkdirSync(wwwDir);

let copied = 0;
for (const file of FILES) {
  const src = path.join(root, file);
  if (!fs.existsSync(src)) continue;
  fs.copyFileSync(src, path.join(wwwDir, file));
  copied += 1;
}

console.log(`sync-www: ${copied} archivo(s) copiados de la raíz a www/`);
