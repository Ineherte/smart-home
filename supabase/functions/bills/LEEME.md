# Facturas de Octopus y TIM → Umbral

Cuando llega a tu Gmail una factura de Octopus (luz) o de TIM, Umbral:

- guarda el PDF en **Documentos → Facturas** (de los dos), con un nombre claro: «Luz Octopus · septiembre 2026»;
- lee sus datos (consumo por franjas F1/F2/F3, precios, desglose, potencia, PUN…) para **Cuentas → Luz**.

## Puesta en marcha (una vez)

1. En el editor SQL de Supabase, ejecuta `supabase/sql/utility-bills.sql` (después de `documents.sql`).
2. Despliega la función:
   ```
   supabase functions deploy bills --no-verify-jwt
   ```
   Usa los mismos secretos que los Atajos (`SYNC_TOKEN` e `IPHONE_OWNER_IDS`).
3. El script de Gmail:
   1. Entra en <https://script.google.com> con tu cuenta de Gmail → **Nuevo proyecto**.
      Ponle de nombre «Umbral facturas».
   2. Borra lo que haya y pega el contenido de `scripts/gmail-facturas.gs`. Guarda (⌘S / Ctrl+S).
   3. ⚙️ **Configuración del proyecto** → abajo, **Propiedades del script** → **Añadir propiedad**:
      `SYNC_TOKEN` con el valor de vuestro SYNC_TOKEN (el de los Atajos). Guarda.
   4. Vuelve al editor, elige la función **importarHistorial** arriba y pulsa **Ejecutar**.
      La primera vez Google pide permiso para leer tu Gmail y conectarse a Umbral: acepta
      («Configuración avanzada → Ir a Umbral facturas» si avisa de que la app no está verificada:
      es tu propio script). Importa las facturas de los últimos 2 años.
   5. ⏰ **Activadores** → **Añadir activador**: función `importarFacturas`, fuente «Según tiempo»,
      tipo «Temporizador por horas», «Cada hora». Guarda.

Listo: cada hora mira si ha llegado alguna factura nueva. En **Ejecuciones** ves qué ha
importado (o por qué no).

## Notas

- Solo se importan los correos que traen la factura en **PDF adjunto**. Si TIM manda solo un
  enlace a MyTIM, descárgala desde ahí y súbela en Cuentas → Luz → «Añadir factura» (o en
  Documentos).
- La misma factura nunca se guarda dos veces (por su número de factura).
- Desde la app también puedes subir facturas antiguas en PDF: Cuentas → Luz → «Añadir factura».
