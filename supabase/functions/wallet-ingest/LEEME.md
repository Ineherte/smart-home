# Pagos con Apple Pay y Satispay → Umbral

Cada vez que pagas, el iPhone te pregunta de quién es el gasto y lo apunta solo:

| Eliges | Se guarda |
|---|---|
| A medias con Matteo | Gasto de la casa pagado por ti, a medias (Cuentas). |
| Mío | Gasto personal tuyo (Mis gastos). |
| De Matteo | Gasto de la casa pagado por ti pero todo suyo: te lo debe. |
| No apuntar | Nada. |

Si va a la casa, también queda en tus gastos personales marcado «no cuenta», para que al
importar el extracto del banco no aparezca dos veces.

## Puesta en marcha (una vez)

```
supabase functions deploy wallet-ingest --no-verify-jwt
```

Usa los mismos `SYNC_TOKEN` e `IPHONE_OWNER_IDS` que los demás atajos.

## Atajo 1: Apple Pay (automático)

En el iPhone, app **Atajos** → **Automatización** → **+**:

1. Elige **Transacción** (Wallet). Marca tus tarjetas, deja todas las categorías y elige
   **Ejecutar inmediatamente**. Pulsa **Siguiente** → **Nuevo atajo en blanco**.
2. **Añadir acción** → **Elegir de la lista**.
   - Toca **Lista** y escribe cuatro elementos: `A medias con Matteo`, `Mío`, `De Matteo`,
     `No apuntar`.
   - Toca la flecha → **Mensaje**: escribe `¿De quién es?` e inserta las variables **Importe** y
     **Comerciante** (de «Entrada del atajo»), por ejemplo «24,50 € en Esselunga: ¿de quién es?».
3. Añade **Obtener contenido de URL**:
   - URL: `https://lnctwcizdjaeomvkcbst.supabase.co/functions/v1/wallet-ingest`
   - Toca **Mostrar más**. Método: **POST**.
   - Encabezados: `x-sync-token` → vuestro SYNC_TOKEN, y `Content-Type` → `application/json`.
   - Cuerpo de la solicitud: **JSON**, con estos campos de tipo Texto:
     - `owner` → `Ines` (Matteo pone `Matteo` en su iPhone)
     - `amount` → variable **Importe**
     - `merchant` → variable **Comerciante**
     - `method` → `apple_pay`
     - `share` → variable **Elemento seleccionado** (tócalo en el campo y elígela de la lista
       de variables; no lo escribas a mano)
4. **Obtener valor del diccionario**: Valor para la clave `message`.
5. **Mostrar notificación** con el **Valor del diccionario**.

La notificación dice dónde ha ido: «Apuntado a medias con Matteo…», «Apuntado en tus gastos…»
o, si `share` no llega bien, «No he entendido de quién es». En Mis gastos el pago también
aparece, como «Esselunga · a medias con Matteo» y «no cuenta» (es para que el extracto del
banco no lo duplique).

Al pagar te sale el aviso del atajo: tócalo y elige. Si quieres que no pregunte nada para
algún comercio (por ejemplo, el súper siempre a medias), pon un **Si** antes de la lista:
«Si Comerciante contiene Esselunga» → Texto `medias`; «De lo contrario» → la lista.

## Atajo 2: Satispay (al cerrar la app)

Satispay no avisa al iPhone de los pagos como Wallet, así que el atajo salta al cerrar la app:

1. **Automatización** → **+** → **App** → Satispay → marca **Se cierra** (no «Se abre») →
   **Ejecutar inmediatamente** → **Nuevo atajo en blanco**.
2. **Elegir de la lista** con el mensaje `¿Has pagado con Satispay?` y los elementos
   `A medias con Matteo`, `Mío`, `De Matteo` y `No he pagado`.
3. **Si** «Elemento seleccionado» **es** `No he pagado` → **Detener este atajo**. **Finalizar si**.
4. **Pedir entrada** de tipo **Número**: `¿Cuánto?`. Otra **Pedir entrada** de tipo
   **Texto**: `¿Dónde?` (puedes dejarla vacía).
5. **Obtener contenido de URL** igual que en el atajo 1, pero con `amount` = la respuesta
   de «¿Cuánto?», `merchant` = la de «¿Dónde?» y `method` = `satispay` y `share` = **Elemento seleccionado**.
6. **Obtener valor del diccionario** (`message`) y **Mostrar notificación**.

## Qué acepta la función

`POST { owner, amount, merchant, method?, share? }`

- `method`: `apple_pay` (por defecto) o `satispay`.
- `share`: el texto de la opción elegida (`A medias con Matteo`, `Mío`, `De Matteo`, `No apuntar`)
  o las palabras cortas `medias`, `personal`, `otro`, `no`, o un número de 0 a 100 con tu parte en %
  (por ejemplo `70`). Sin `share` se apunta como personal; si llega algo que no entiende, no apunta
  nada y lo dice en `message`.
- Responde `{ saved, shared, amount, merchant, category, message }`; `message` es la frase para
  la notificación.
