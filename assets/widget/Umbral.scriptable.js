// Umbral · widget para iPhone (Scriptable).
// 1. Cambia owner por tu nombre (Ines o Matteo) y pega el token entre las comillas.
// 2. Toca ▶︎ para ver cómo queda. 3. Añade un widget de Scriptable y elige este script.
// El dibujo del widget se descarga de vuestra web (como mucho una vez por hora), así que las
// mejoras llegan solas; sin conexión usa la última copia.
const CONFIG = {
  owner: 'Ines',
  token: ''
};

const CODE_URL = 'https://ineherte.github.io/smart-home/assets/widget/umbral-widget.js';
const here = module.filename.replace(/[^/]+$/, '');
const fm = here.includes('Mobile Documents') ? FileManager.iCloud() : FileManager.local();
const codePath = `${here}umbral-widget-code.js`;
const stale = !fm.fileExists(codePath) || Date.now() - fm.modificationDate(codePath).getTime() > 3600000;
if (stale) {
  try {
    const request = new Request(`${CODE_URL}?v=${Math.floor(Date.now() / 3600000)}`);
    request.timeoutInterval = 10;
    const code = await request.loadString();
    if (request.response.statusCode === 200 && code.includes('module.exports')) fm.writeString(codePath, code);
  } catch (error) {
    console.log(`Sin conexión: uso la copia guardada (${error})`);
  }
}
if (fm.isFileStoredIniCloud(codePath) && !fm.isFileDownloaded(codePath)) await fm.downloadFileFromiCloud(codePath);
await importModule('umbral-widget-code').run(CONFIG);
