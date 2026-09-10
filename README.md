# Umbral Smart Home

Umbral es una app de hogar compartido para controlar luz, clima, agenda, notas y finanzas domésticas.

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
3. Añade estas variables de entorno en Supabase Edge Functions:

   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`

4. Haz deploy de las funciones:

   - `supabase functions deploy tricount-sync`
   - `supabase functions deploy invoice-ingest`

5. Conecta tu flujo de automatización (n8n, Make, Zapier, OAuth con Gmail / Outlook, o una app de backend) para llamar a estas endpoints y autenticar con el usuario real.

## Uso recomendado

- Tricount: exporta el CSV, envíalo a tu backend o a una automatización que llame a `tricount-sync`.
- Octopus / TIM: usa Gmail o Outlook con OAuth para detectar el correo, extraer importe y mandar el payload a `invoice-ingest`.
- El navegador nunca debe leer directamente tu bandeja de entrada ni tus credenciales de terceros.

## Ejecutar la app

```bash
python3 -m http.server 8000
```

Luego abre la URL de la carpeta en el navegador.
