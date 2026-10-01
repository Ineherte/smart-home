// Fotos del hogar (recetas y momentos). Se reducen en el teléfono antes de subirlas y se
// guardan en el bucket privado household-media de Supabase, en la carpeta del hogar.
// Para verlas se piden enlaces firmados temporales. En modo local se guarda una versión
// pequeña dentro del propio registro (data URL).
const MEDIA_BUCKET = 'household-media';
const mediaUrlCache = new Map();

function resizePhoto(file, maxSide = 1600, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(image.width * scale);
      canvas.height = Math.round(image.height * scale);
      canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('No se pudo preparar la foto'))), 'image/jpeg', quality);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('No se pudo leer la foto'));
    };
    image.src = url;
  });
}

const blobToDataUrl = (blob) => new Promise((resolve) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result);
  reader.readAsDataURL(blob);
});

// Devuelve la ruta guardada (o un data URL en modo local).
async function uploadPhoto(file, folder) {
  if (!(supabaseClient && authUserId)) return blobToDataUrl(await resizePhoto(file, 700, 0.75));
  if (!householdReady()) throw new Error('Tu hogar aún se está conectando');
  const blob = await resizePhoto(file);
  const path = `${householdId}/${folder}/${dateToISO(new Date())}-${createLocalId()}.jpg`;
  const { error } = await supabaseClient.storage.from(MEDIA_BUCKET).upload(path, blob, { contentType: 'image/jpeg', upsert: false });
  if (error) throw new Error(/bucket/i.test(error.message) ? 'Falta ejecutar life.sql en Supabase (bucket de fotos)' : error.message);
  return path;
}

async function deletePhoto(path) {
  if (!path || path.startsWith('data:') || !(supabaseClient && authUserId)) return;
  await supabaseClient.storage.from(MEDIA_BUCKET).remove([path]);
  mediaUrlCache.delete(path);
}

// Enlaces para mostrar varias fotos de una vez (válidos una hora).
async function photoUrls(paths) {
  const now = Date.now();
  const result = new Map();
  const missing = [];
  [...new Set(paths.filter(Boolean))].forEach((path) => {
    if (path.startsWith('data:') || path.startsWith('blob:') || path.startsWith('http')) result.set(path, path);
    else if (mediaUrlCache.get(path)?.expires > now) result.set(path, mediaUrlCache.get(path).url);
    else missing.push(path);
  });
  if (missing.length && supabaseClient && authUserId) {
    const { data } = await supabaseClient.storage.from(MEDIA_BUCKET).createSignedUrls(missing, 3600);
    (data || []).forEach((entry) => {
      if (!entry.signedUrl) return;
      mediaUrlCache.set(entry.path, { url: entry.signedUrl, expires: now + 50 * 60 * 1000 });
      result.set(entry.path, entry.signedUrl);
    });
  }
  return result;
}

// Rellena las <img data-photo="ruta"> de un contenedor.
async function hydratePhotos(container) {
  const images = [...container.querySelectorAll('img[data-photo]')];
  if (!images.length) return;
  const urls = await photoUrls(images.map((image) => image.dataset.photo));
  images.forEach((image) => {
    const url = urls.get(image.dataset.photo);
    if (url && image.src !== url) image.src = url;
  });
}

// Selector de foto: cámara o galería.
function pickPhoto({ camera = false } = {}) {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    if (camera) input.capture = 'environment';
    input.addEventListener('change', () => resolve(input.files?.[0] || null), { once: true });
    input.click();
  });
}
