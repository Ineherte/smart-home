# Librerías incluidas

Copias exactas de dos librerías que antes se cargaban de un CDN. Están aquí para que la app de
iPhone funcione sin conexión (en ella no hay service worker) y para que la web cargue antes.

- `lucide-1.49.0.js`: iconos [Lucide](https://lucide.dev), licencia ISC.
- `supabase-2.117.3.js`: [supabase-js](https://github.com/supabase/supabase-js) (UMD), licencia MIT.

Para actualizarlas, descarga la nueva versión al mismo sitio y cambia el nombre en `index.html` y `sw.js`.
