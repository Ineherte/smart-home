# Umbral Smart Home

Umbral es una app de hogar compartido para controlar luz, clima, agenda, notas y finanzas domésticas.

## Seguridad y datos compartidos

La base recomendada es autenticada y por hogar. Ejecuta `supabase/sql/supabase-foundation.sql` después de los esquemas existentes para crear perfiles, hogares, membresías y políticas RLS por `household_id`. No asignes automáticamente filas antiguas creadas de forma anónima: revísalas y migra solo las que puedas atribuir con seguridad.

La aplicación ya muestra acceso por correo y contraseña, crea el primer hogar para el usuario autenticado y añade el ámbito del hogar a las nuevas escrituras. El selector de nombre local no es un mecanismo de seguridad.

Orden de puesta en producción:

1. Ejecuta `supabase/sql/supabase-foundation.sql`, `supabase/sql/supabase-access-hardening.sql`, `supabase/sql/supabase-members.sql`, `supabase/sql/schema-sync.sql`, `supabase/sql/household-policies-fix.sql`, `supabase/sql/security-fixes.sql`, `supabase/sql/household-scoping.sql`, `supabase/sql/shopping-and-tasks.sql`, `supabase/sql/push-notifications.sql`, `supabase/sql/plants.sql`, `supabase/sql/finance-personal.sql`, `supabase/sql/tasks-notes-v2.sql`, `supabase/sql/finance-personal-v2.sql`, `supabase/sql/life.sql`, `supabase/sql/avatars.sql`, `supabase/sql/places.sql`, `supabase/sql/home-care.sql`, `supabase/sql/tasks-notes-v3.sql`, `supabase/sql/finance-split.sql`, `supabase/sql/documents.sql`, `supabase/sql/appliances.sql`, `supabase/sql/utility-bills.sql` y `supabase/sql/trips.sql` en el editor SQL (en ese orden). `trips.sql` crea el organizador de viajes (Nosotros → Viajes): itinerario por días y sitios con su tipo y su mapa; lo que hay que hacer antes de ir, la maleta y las precauciones se guardan como tareas y notas normales, así que salen también en Casa → Pendientes. `utility-bills.sql` guarda los datos de las facturas de Octopus y TIM para Cuentas → Luz. `appliances.sql` guarda los lavados para el aviso de la lavadora (y hay que volver a ejecutar `plant-reminders-cron.sql`, que ahora también mira cada minuto si ha terminado). `documents.sql` crea Documentos (Vida): la tabla y un bucket privado para los PDF y fotos, donde cada documento lo ven los dos o solo quien lo subió. `finance-split.sql` permite que cada gasto de la casa sea a medias, solo de uno o con otro reparto. `tasks-notes-v3.sql` añade las listas de Por hacer y más espacio y colores para las notas. Vuelve a ejecutar `avatars.sql` si ya lo tenías: sube a 16 KB el espacio para la vida en el modo Sims. `places.sql` crea el mapa de los sitios en los que habéis estado juntos y de los que queréis visitar (Nosotros → Viajes, y el mapa del salón en el modo Sims); si ya lo ejecutaste, vuelve a ejecutarlo para activar «Queremos ir». `home-care.sql` crea Casa al día (Vida), el mantenimiento que se repite cada cierto tiempo. `life.sql` crea las tablas de Cocina y Nosotros y el bucket privado `household-media` para las fotos; `avatars.sql`, los muñecos personalizables y el modo Sims de la casa por dentro (cada uno solo puede cambiar su muñeco). Si ya lo ejecutaste antes, vuelve a ejecutarlo: añade las necesidades, la actividad, los toques nuevos (ataque de tiburón, selfie en el espejo y los viajes) y el sitio donde está cada uno, que usa el modo Sims para que el muñeco del otro os siga en tiempo real. Para los avisos programados (riego, resumen de la mañana y foto del día), ejecuta además `supabase/sql/plant-reminders-cron.sql` (lee las instrucciones del principio del archivo).
2. Crea una cuenta para cada persona desde Umbral.
3. Añade el segundo usuario a `household_members` con el mismo `household_id` y rol `member`.
4. Comprueba las tablas y políticas con usuarios reales antes de importar datos financieros.
5. No pongas claves secretas, service role keys ni tokens de correo en el frontend.

## Arquitectura real para finanzas

La parte de Tricount y facturas por correo no se puede conectar directamente desde el navegador a Gmail, Outlook o Tricount sin OAuth y backend.

Por eso el proyecto incluye dos Edge Functions de Supabase preparadas para una integración real:

- `supabase/functions/tricount-sync/index.ts`
- `supabase/functions/invoice-ingest/index.ts`

Estas funciones:

- validan un JWT de usuario autenticado,
- aceptan datos reales desde un backend o una automatización externa,
- insertan gastos y facturas en las tablas `shared_expenses` y `shared_bills` de Supabase,
- evitan exponer credenciales o tokens en el frontend.

## Configuración

1. Crea tu proyecto en Supabase.
2. Ejecuta el SQL de `supabase/sql/finance-schema.sql`.
3. Si ya habías ejecutado una versión anterior del esquema, ejecuta también `supabase/sql/finance-settlement.sql` para añadir quién pagó cada factura.
4. Ejecuta `supabase/sql/finance-fixed-costs.sql` para crear y compartir alquiler e internet como gastos fijos mensuales.
5. Añade estas variables de entorno en Supabase Edge Functions:

   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`

6. Haz deploy de las funciones:

   - `supabase functions deploy tricount-sync`
   - `supabase functions deploy invoice-ingest`
   - `supabase functions deploy sync-iphone-calendar` (necesita `SYNC_TOKEN` e `IPHONE_OWNER_IDS`, un JSON como `{"Ines":"<user_id>","Matteo":"<user_id>"}` con los id de Authentication → Users)
   - `supabase functions deploy tuya-lights` (necesita `TUYA_ACCESS_ID`, `TUYA_ACCESS_SECRET` y, opcionalmente, `TUYA_DEVICE_IDS` con los IDs permitidos separados por comas)
   - `supabase functions deploy news --no-verify-jwt` (las noticias de Vida: en Italia, el Inter y la política italiana; en España, la portada y la política. Junta varias fuentes y quita las repetidas; sin ella, la app usa los canales de ANSA y El País).
   - `supabase functions deploy bills --no-verify-jwt` (facturas de Octopus y TIM en PDF: las que llegan a tu Gmail con el script `scripts/gmail-facturas.gs` o las que subes en Cuentas → Luz; las guarda en Documentos y lee sus datos. Pasos en `supabase/functions/bills/LEEME.md`).
   - `supabase functions deploy wallet-ingest --no-verify-jwt` (pagos de Apple Pay y Satispay desde un Atajo del iPhone, que pregunta si el gasto es tuyo, a medias o de tu pareja y lo apunta en Mis gastos o en las cuentas de la casa). Usa los mismos `SYNC_TOKEN` e `IPHONE_OWNER_IDS` que `sync-iphone-calendar`. Los pasos de los Atajos están en `supabase/functions/wallet-ingest/LEEME.md` y en la app: Cuentas → Mis gastos → Apple Pay.
   - `supabase functions deploy quick-add --no-verify-jwt` (Siri y Atajos: «Oye Siri, añadir a la compra»). Usa `SYNC_TOKEN` e `IPHONE_OWNER_IDS`. Cómo crear los atajos: `supabase/functions/quick-add/LEEME.md`.
   - `supabase functions deploy widget-summary --no-verify-jwt` (el resumen para el widget del iPhone). Usa `IPHONE_OWNER_IDS` y un `WIDGET_TOKEN` propio (si no hay, vale `SYNC_TOKEN`). Los pasos para instalar el widget con Scriptable están en `assets/widget/LEEME.md`.
   - `supabase functions deploy notify-household --no-verify-jwt` (avisos push; la función comprueba la sesión por su cuenta). Necesita `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` y `VAPID_SUBJECT` (`mailto:tu@correo`). Genera las claves una vez con `npx web-push generate-vapid-keys` y guárdalas con `supabase secrets set`. Cada teléfono activa los avisos en Cuenta → Avisos en este teléfono; en iPhone solo funciona con Umbral instalada en la pantalla de inicio (iOS 16.4 o posterior). Para el recordatorio diario de riego necesita también `CRON_SECRET`.

7. Conecta tu flujo de automatización (n8n, Make, Zapier, OAuth con Gmail / Outlook, o una app de backend) para llamar a estas endpoints y autenticar con el usuario real.

## Uso recomendado

- Tricount: exporta el CSV, envíalo a tu backend o a una automatización que llame a `tricount-sync`.
- Octopus / TIM: usa Gmail o Outlook con OAuth para detectar el correo, extraer importe y mandar el payload a `invoice-ingest`.
- El navegador nunca debe leer directamente tu bandeja de entrada ni tus credenciales de terceros.
- La vista financiera calcula el reparto de cada gasto (a medias por defecto; también solo de Ines, solo de Matteo o en porcentaje, columna `share_ines`), muestra quién debe a quién y permite exportar cuatro hojas Excel: gastos, facturas, categorías y liquidación.
- Con sesión iniciada, Supabase es la única fuente de verdad de las finanzas: si algo no se puede guardar, la app lo avisa en vez de guardarlo solo en el teléfono. `localStorage` solo se usa en modo local (sin Supabase configurado).
- Las importaciones (enlace de Tricount o archivo CSV/Excel) no duplican gastos: cada fila lleva una `source_reference` única.
- Los gastos fijos se guardan aparte de las facturas variables para no confundir alquiler e internet con importaciones mensuales.

## Estructura

- Raíz (`index.html`, `app.js`, `styles.css`, …): la app web. Es la única fuente de verdad.
- `www/`: copia generada con `npm run build:www` para Capacitor. No se versiona; no la edites.
- `sims-world.js`, `sims-places.js` y `sims.js`: el modo Sims (el piso en pixel art; Turín, Chieti y la casa de campo en España; y la lógica del juego, conectada con la compra, las tareas, la agenda, las plantas y el tiempo, sincronizada en directo entre los dos móviles con Supabase Realtime y jugable a pantalla completa en horizontal). Dentro del juego: monedas, habilidades, relación y estados de ánimo como en los Sims, cola de acciones, tienda de muebles (guitarra, puf, caballete, telescopio, acuario y recreativa), sala de juegos (Tiburón hambriento, Sudoku, Binairo y crucigrama), mapa de vuestros viajes en el salón, deseos de hoy (tres objetivos diarios, dos en casa y uno de la vida real, con premio), chat en directo, armario con disfraces, decoración de la casa con temáticas, fotos que se guardan en Nosotros, el minijuego Tiburón hambriento y un ciclo de día y noche con la hora real. La ropa elegida, la decoración, los récords, las monedas, las habilidades, la relación y los deseos se guardan en el campo `look` de cada muñeco, sin tablas nuevas.
- `energy.js`: Cuentas → Luz. Vuestras facturas de Octopus leídas del PDF: consumo por mes y por franja (F1/F2/F3), a dónde va cada euro, precio de cada franja, precio de mercado (PUN) de los últimos 12 meses, consejos con vuestros números (lo que es fijo, potencia, canon RAI, consumo frente a un hogar medio, tarifa variable) y la franja de ahora con la barra del día. La lavadora usa la franja para decir cuándo es más barato ponerla.
- `appliances.js`: la lavadora. En Inicio, «Poner la lavadora» (o al asistente: «he puesto la lavadora de una hora y avisa a Matteo»): eliges programa y a quién avisar, y una tarjeta muestra la cuenta atrás. Al terminar llega un aviso push (aunque la app esté cerrada; lo manda `notify-household` con pg_cron) con un consejo para secar la ropa dentro de casa según el tiempo de Turín (lluvia, humedad, frío) y cuánto tardará; si 45 minutos después sigue dentro, otro aviso.
- `documents.js`: Vida → Documentos, una carpeta para los papeles importantes (DNI escaneado, contrato del piso, tarjeta sanitaria, garantías…) en PDF o foto, ordenados en carpetas por tipo. Cada uno es tuyo, de tu pareja o de los dos, y lo veis los dos o solo tú (la base de datos lo hace cumplir; los archivos se abren con enlaces temporales). Con fecha de caducidad opcional, que avisa cuando se acerca. Se pueden abrir, compartir (por WhatsApp, por ejemplo), editar y borrar.
- `assistant.js`: el asistente («Pídele algo a Umbral…» en Inicio, o el botón de la varita arriba). Entiende frases normales escritas o dictadas y hace lo mismo que los botones: la compra («apunta leche y 2 kilos de patatas», «quita el pan», «ya he comprado los huevos»), tareas con plazo («recuérdame pagar la luz el viernes», «Matteo tiene que llamar al casero mañana», «he sacado la basura»), el calendario («cena con Clara el sábado a las 21»), notas («nota: …», «añade cargador a la nota de la maleta»), el riego («he regado la monstera»), gastos de la casa o personales («he pagado 24,50 de cena a medias», «gasto personal 12 € farmacia»), luces y preguntas («¿qué tengo hoy?», «¿qué falta en la compra?», «¿cuánto me debe Matteo?»). Varias cosas en una frase, con «Deshacer» en cada una. No usa servicios externos: funciona gratis y sin conexión.
- `sims-life.js`: la vida en la casa del modo Sims. Sucesos que llegan cada pocos minutos de juego (paquete, visita de la vecina, apagón con velas, grifo que gotea, gato en la ventana, pizza, fiesta arriba, lluvia, carta de la familia) con opciones que cambian necesidades, monedas, habilidades y relación; aspiraciones con niveles de bronce, plata y oro y títulos; las visitas de Mari Cruz y Giuliana, y el diario de lo que os pasa. Si jugáis a la vez, los sucesos os llegan a los dos y decide quien elige primero. Se abre con 🏆 Metas y se guarda en `look` (stats, aspire y diary).
- `sims-build.js`: el modo construcción (🎨 Decorar → Mover muebles). Se toca un mueble con borde y luego dónde va; la posición se guarda en la decoración (`decor.place`) y la ve también tu pareja.
- `sims-mind.js`: la personalidad de los muñecos. Dos rasgos por persona (creativa, romántico, cocinillas, dormilón, deportista…), emociones con efecto (inspirada pinta mejor, concentrado rinde más, enfadada rechaza besos, con energía anda más rápido), carrera profesional con ascensos al trabajar en el portátil y recuerdos que os decís en casa. Se ve en 🏆 Metas → Tú y Recuerdos, y se guarda en `look` (traits, career y memories).
- `sims-music.js`: la música de fondo, generada en el navegador: cambia con la hora (día, atardecer y noche) y con el sitio (aire italiano en Turín y Chieti, andaluz en la casa de campo). El altavoz alterna entre sonido y música, solo sonido y silencio.
- `garden.js`: la casa con jardín de la pantalla de inicio, en el mismo pixel art y con los mismos muñecos.
- `upkeep.js`: Casa al día, en Vida. El mantenimiento periódico de la casa (caldera, filtros, cortinas…) con su frecuencia, cuándo se hizo por última vez y cuánto falta; lo atrasado sale en el estado de la casa de Inicio y cumplirlo da monedas en el modo Sims.
- `tasks.js` y `pending.js`: Casa → Por hacer. Lo de una vez («pagar la luz en 5 días #papeles») sale cada día con su cuenta atrás hasta que se marca; sin plazo se guarda con fecha 2099-12-31. Las rutinas («basura cada semana por turnos») solo salen cuando toca. Listas (Casa, Papeles, Recados y las que creéis) y vistas Lista, Semana y Personas.
- `notes.js`: Casa → Notas. Apuntes libres, no tareas: título, texto y una lista para marcar (☐/☑ dentro de `details`), con colores, fijadas, archivo, plantillas (maleta, regalos, datos de casa…) y guardado automático.
- `ux.js`: detalles de fluidez de toda la app. Las fichas se cierran deslizando hacia abajo, el fondo no se mueve con una ficha abierta, cada pestaña recuerda por dónde ibas (tocarla otra vez sube arriba) y las vistas entran desde el lado hacia el que vas. Marcar algo como hecho o borrar una tarea o nota se puede deshacer desde el aviso de abajo.
- `summary.js`: el estado de la casa en Inicio, un resumen de los puntos abiertos (tareas, notas urgentes, plantas, compra, cuentas) y de lo de hoy (comidas, agenda y lo próximo).
- `assets/sims/house-floors.png`: los suelos de la casa, baldosas de [LPC] Floors (CC-BY-SA 4.0; créditos en `assets/sims/CREDITS.md`).
- `assets/sims/`: los muñecos LPC de Ines y Matteo (con su ropa de dormir, de abrigo y de verano), sus familias, el JSON para el generador y los créditos obligatorios.
- `assets/widget/`: el widget del iPhone (Scriptable): `Umbral.scriptable.js` es lo que se pega en la app, `umbral-widget.js` el dibujo que se descarga solo, los retratos de los muñecos y `LEEME.md` con los pasos.
- `supabase/sql/`: esquemas y migraciones SQL.
- `supabase/functions/`: Edge Functions.
- `ios/`: la app de iPhone (Capacitor, sin Mac: la compila GitHub y la sube a TestFlight). Pasos en `ios/LEEME.md`.
- `native.js`: lo que solo hace la app nativa (avisos de plazos con botones, enlaces umbral://, barra de estado).
- `vendor/`: librerías incluidas (iconos Lucide y Supabase) para funcionar sin conexión.
- `android/`: proyecto nativo de Capacitor.

## Ejecutar la app

```bash
python3 -m http.server 8000
```

Luego abre la URL de la carpeta en el navegador.
