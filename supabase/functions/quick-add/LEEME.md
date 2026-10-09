# Siri y Atajos: añadir a Umbral sin abrir la app

Con esta función podéis decir «Oye Siri, añadir a la compra» y dictar «leche, pan y 6 huevos», o
«Oye Siri, apuntar en Umbral» y dictar «pagar la luz en 5 días #papeles». Siri contesta en voz
alta con lo que ha guardado, y lo veis los dos en la app al momento.

## Puesta en marcha (una vez)

```
supabase functions deploy quick-add --no-verify-jwt
```

Usa el mismo `SYNC_TOKEN` y el mismo `IPHONE_OWNER_IDS` que el Atajo del calendario y el de Apple Pay.

## Qué entiende

| Tipo | Ejemplos de lo que dictas | Qué hace |
|---|---|---|
| `compra` | «leche, pan y 6 huevos», «2 kilos de tomates y una botella de vino» | Añade cada cosa a la lista, con su cantidad |
| `tarea` | «pagar la luz en 5 días #papeles», «llamar al dentista mañana», «devolver el paquete el viernes», «comprar regalo para Clara» | Lo apunta en Por hacer, con su plazo y su lista (sin fecha: sin plazo) |
| `gasto` | «24,50 cena en Eataly», «gasolina 40 euros» | Gasto de la casa pagado por quien lo dice, a medias, con su categoría |
| `nota` | «la clave del wifi es castillo» | Nota compartida (la primera frase es el título) |

## Crear el atajo «Añadir a la compra»

En el iPhone, app **Atajos** → **+** (arriba a la derecha):

1. **Añadir acción** → busca **Dictar texto**. Idioma: Español. Dejar de escuchar: Tras una pausa.
2. **Añadir acción** → **Obtener contenido de URL**.
   - URL: `https://lnctwcizdjaeomvkcbst.supabase.co/functions/v1/quick-add`
   - Toca **Mostrar más**. Método: **POST**.
   - Encabezados: **Añadir nuevo encabezado** → clave `x-sync-token`, valor: vuestro SYNC_TOKEN.
     Otro encabezado: clave `Content-Type`, valor `application/json`.
   - Cuerpo de la solicitud: **JSON**. Añade tres campos de tipo Texto:
     - `owner` → `Ines` (o `Matteo` en su iPhone)
     - `type` → `compra`
     - `text` → toca el campo y elige la variable **Texto dictado**
3. **Añadir acción** → **Obtener valor del diccionario**: Obtener **Valor** para la clave `message`.
4. **Añadir acción** → **Leer texto** (o **Mostrar resultado** si lo prefieres en pantalla).
5. Arriba, cambia el nombre del atajo a **Añadir a la compra**. Ese nombre es lo que le dices a Siri.

## Los otros atajos

Duplica el atajo (mantén pulsado → Duplicar) y cambia solo el nombre y el campo `type`:

| Nombre del atajo | `type` | Lo que dices |
|---|---|---|
| Apuntar en Umbral | `tarea` | «Oye Siri, apuntar en Umbral» → «pagar la luz en 5 días» |
| Apuntar un gasto | `gasto` | «Oye Siri, apuntar un gasto» → «24,50 cena» |
| Nota en Umbral | `nota` | «Oye Siri, nota en Umbral» → «la clave del wifi es castillo» |

Consejo: también podéis ponerlos en el botón de Acción del iPhone, en el Centro de control o
como icono en la pantalla de inicio (en el atajo: ⓘ → Añadir a pantalla de inicio).
