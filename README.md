# Umbral Smart Home

Umbral es una app de hogar compartido para controlar luz, clima, agenda, notas y finanzas domésticas.

## Seguridad y datos compartidos

La base recomendada es autenticada y por hogar. Ejecuta `supabase/sql/supabase-foundation.sql` después de los esquemas existentes para crear perfiles, hogares, membresías y políticas RLS por `household_id`. No asignes automáticamente filas antiguas creadas de forma anónima: revísalas y migra solo las que puedas atribuir con seguridad.

La aplicación ya muestra acceso por correo y contraseña, crea el primer hogar para el usuario autenticado y añade el ámbito del hogar a las nuevas escrituras. El selector de nombre local no es un mecanismo de seguridad.

Orden de puesta en producción:

1. Ejecuta `supabase/sql/supabase-foundation.sql`, `supabase/sql/supabase-access-hardening.sql`, `supabase/sql/supabase-members.sql`, `supabase/sql/schema-sync.sql`, `supabase/sql/household-policies-fix.sql`, `supabase/sql/security-fixes.sql`, `supabase/sql/household-scoping.sql`, `supabase/sql/shopping-and-tasks.sql`, `supabase/sql/push-notifications.sql` y `supabase/sql/plants.sql` en el editor SQL (en ese orden). Para el aviso diario de riego, ejecuta además `supabase/sql/plant-reminders-cron.sql` (lee las instrucciones del principio del archivo).
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
   - `supabase functions deploy notify-household --no-verify-jwt` (avisos push; la función comprueba la sesión por su cuenta). Necesita `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` y `VAPID_SUBJECT` (`mailto:tu@correo`). Genera las claves una vez con `npx web-push generate-vapid-keys` y guárdalas con `supabase secrets set`. Cada teléfono activa los avisos en Cuenta → Avisos en este teléfono; en iPhone solo funciona con Umbral instalada en la pantalla de inicio (iOS 16.4 o posterior). Para el recordatorio diario de riego necesita también `CRON_SECRET`.

7. Conecta tu flujo de automatización (n8n, Make, Zapier, OAuth con Gmail / Outlook, o una app de backend) para llamar a estas endpoints y autenticar con el usuario real.

## Uso recomendado

- Tricount: exporta el CSV, envíalo a tu backend o a una automatización que llame a `tricount-sync`.
- Octopus / TIM: usa Gmail o Outlook con OAuth para detectar el correo, extraer importe y mandar el payload a `invoice-ingest`.
- El navegador nunca debe leer directamente tu bandeja de entrada ni tus credenciales de terceros.
- La vista financiera calcula el reparto 50/50, muestra quién debe a quién y permite exportar cuatro hojas Excel: gastos, facturas, categorías y liquidación.
- Con sesión iniciada, Supabase es la única fuente de verdad de las finanzas: si algo no se puede guardar, la app lo avisa en vez de guardarlo solo en el teléfono. `localStorage` solo se usa en modo local (sin Supabase configurado).
- Las importaciones (enlace de Tricount o archivo CSV/Excel) no duplican gastos: cada fila lleva una `source_reference` única.
- Los gastos fijos se guardan aparte de las facturas variables para no confundir alquiler e internet con importaciones mensuales.

## Estructura

- Raíz (`index.html`, `app.js`, `styles.css`, …): la app web. Es la única fuente de verdad.
- `www/`: copia generada con `npm run build:www` para Capacitor. No se versiona; no la edites.
- `supabase/sql/`: esquemas y migraciones SQL.
- `supabase/functions/`: Edge Functions.
- `android/`: proyecto nativo de Capacitor.

## Ejecutar la app

```bash
python3 -m http.server 8000
```

Luego abre la URL de la carpeta en el navegador.
