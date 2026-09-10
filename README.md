# Umbral Smart Home

Umbral es una app de hogar compartido para controlar luz, clima, agenda, notas y finanzas domésticas.

## Seguridad y datos compartidos

La base recomendada es autenticada y por hogar. Ejecuta `supabase-foundation.sql` después de los esquemas existentes para crear perfiles, hogares, membresías y políticas RLS por `household_id`. No asignes automáticamente filas antiguas creadas de forma anónima: revísalas y migra solo las que puedas atribuir con seguridad.

La aplicación ya muestra acceso por correo y contraseña, crea el primer hogar para el usuario autenticado y añade el ámbito del hogar a las nuevas escrituras. El selector de nombre local no es un mecanismo de seguridad.

Orden de puesta en producción:

1. Ejecuta `supabase-foundation.sql` en el editor SQL.
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
2. Ejecuta el SQL de `finance-schema.sql`.
3. Si ya habías ejecutado una versión anterior del esquema, ejecuta también `finance-settlement.sql` para añadir quién pagó cada factura.
4. Ejecuta `finance-fixed-costs.sql` para crear y compartir alquiler e internet como gastos fijos mensuales.
5. Añade estas variables de entorno en Supabase Edge Functions:

   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`

6. Haz deploy de las funciones:

   - `supabase functions deploy tricount-sync`
   - `supabase functions deploy invoice-ingest`

7. Conecta tu flujo de automatización (n8n, Make, Zapier, OAuth con Gmail / Outlook, o una app de backend) para llamar a estas endpoints y autenticar con el usuario real.

## Uso recomendado

- Tricount: exporta el CSV, envíalo a tu backend o a una automatización que llame a `tricount-sync`.
- Octopus / TIM: usa Gmail o Outlook con OAuth para detectar el correo, extraer importe y mandar el payload a `invoice-ingest`.
- El navegador nunca debe leer directamente tu bandeja de entrada ni tus credenciales de terceros.
- La vista financiera calcula el reparto 50/50, muestra quién debe a quién y permite exportar cuatro hojas Excel: gastos, facturas, categorías y liquidación.
- Los gastos fijos se guardan aparte de las facturas variables para no confundir alquiler e internet con importaciones mensuales.

## Ejecutar la app

```bash
python3 -m http.server 8000
```

Luego abre la URL de la carpeta en el navegador.
