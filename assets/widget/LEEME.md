# Widget de Umbral para iPhone

El widget enseña lo de hoy en casa: vuestros muñecos, la cuenta atrás de lo próximo (viajes,
cumpleaños, aniversario), la agenda, las tareas, la compra, lo que se come y las plantas con sed.
El color cambia con la hora: verde de día, coral al atardecer y azul de noche.

Funciona con [Scriptable](https://apps.apple.com/app/scriptable/id1405459188), una app gratuita
que permite hacer widgets con JavaScript. Un widget nativo de iOS necesitaría un Mac con Xcode.

## Tamaños

- **Pequeño:** vosotros dos, la cuenta atrás y tres contadores (tareas, compra y plantas).
- **Mediano:** vosotros dos y la cuenta atrás a la izquierda; a la derecha, lo próximo de la
  agenda, la primera tarea, la compra y la cena.
- **Grande:** saludo, el tiempo en Turín, el último mensaje de tu pareja, agenda, tareas,
  compra, comida y cena.
- **Pantalla de bloqueo:** rectangular (lo próximo y los contadores), redondo (los días que
  faltan) y en línea.

Tocar el widget abre Umbral en la sección correspondiente.

## Puesta en marcha (una vez)

1. En Supabase, crea un token solo para el widget y despliega la función:

   ```
   supabase secrets set WIDGET_TOKEN=<una contraseña larga inventada>
   supabase functions deploy widget-summary --no-verify-jwt
   ```

   La función usa `IPHONE_OWNER_IDS`, que ya está configurado para el calendario del iPhone.
   Si no hay `WIDGET_TOKEN`, acepta `SYNC_TOKEN`, pero es mejor uno propio: el widget solo
   puede leer este resumen, no escribir nada.

2. En el iPhone, instala Scriptable y crea un script nuevo llamado **Umbral**.
3. Pega dentro el contenido de `assets/widget/Umbral.scriptable.js`, pon tu nombre en `owner`
   (Ines o Matteo) y el token entre las comillas de `token`.
4. Toca ▶︎ para ver cómo queda. Sin token enseña datos de ejemplo.
5. En la pantalla de inicio, mantén pulsado, toca **+**, busca Scriptable, elige el tamaño y,
   al editar el widget, en **Script** elige **Umbral**.

En **Parameter** puedes escribir otro nombre (por ejemplo, Matteo) para ver su resumen.

## Cómo se actualiza

- Los datos se refrescan cada 15 minutos (iOS decide el momento exacto).
- El dibujo del widget se descarga de vuestra web como mucho una vez por hora, así que las
  mejoras llegan solas. Sin conexión, el widget enseña lo último que cargó.
