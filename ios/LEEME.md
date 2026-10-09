# Umbral para iPhone

> **Ahora mismo no se usa.** Instalar una app propia en el iPhone exige la cuenta de desarrollador
> de Apple (99 $/año), así que Umbral se usa como web instalada desde Safari («Compartir → Añadir a
> pantalla de inicio»), que es gratis. Este proyecto queda preparado por si algún día cambia; la
> compilación solo se lanza a mano y no gasta nada.

La app de iPhone es la misma Umbral, empaquetada con [Capacitor](https://capacitorjs.com). No hace
falta Mac: un Mac de GitHub la compila (`.github/workflows/ios.yml`, Actions → Run workflow) y, con
las claves de Apple, la sube a TestFlight para instalarla en vuestros iPhone.

## Qué tiene que no tiene la web

- Icono y pantalla de arranque propios, a pantalla completa y sin barras de Safari.
- Funciona sin conexión: la web va dentro de la app, con sus librerías (`vendor/`).
- Avisos de Por hacer con botones: el día antes y el día del plazo, a las 9:00, con «Hecho ✓» y
  «Mañana». Las rutinas avisan el día que tocan (`native.js`).
- Enlaces `umbral://abrir/compra` (o `?abrir=compra`) que abren la sección en la app.
- Vibración al marcar cosas y la barra de estado acompaña al tema claro u oscuro.

## Puesta en marcha (una vez)

1. **Cuenta de desarrollador de Apple** (99 $/año) en <https://developer.apple.com/programs/>.
   Apple tarda de unas horas a un par de días en aprobarla.
2. **La app en App Store Connect**: <https://appstoreconnect.apple.com> → Apps → **+** → Nueva app.
   Plataforma iOS, nombre «Umbral», idioma español, identificador de paquete **com.umbral.home**
   (si no aparece en la lista, regístralo en developer.apple.com → Identifiers) y SKU `umbral`.
3. **Clave de la API**: App Store Connect → Usuarios y acceso → Integraciones → Claves de la API
   de App Store Connect → **+**, con acceso **App Manager**. Descarga el archivo `.p8` (solo se
   puede descargar una vez) y apunta el **Key ID** y el **Issuer ID**.
4. **Team ID**: developer.apple.com → Account → Membership details.
5. **Secretos en GitHub**: repositorio → Settings → Secrets and variables → Actions → New
   repository secret, con estos cuatro:
   - `APPSTORE_KEY_ID`: el Key ID.
   - `APPSTORE_ISSUER_ID`: el Issuer ID.
   - `APPSTORE_KEY_P8`: el contenido completo del archivo `.p8` (abre el archivo y pégalo todo).
   - `APPLE_TEAM_ID`: el Team ID.
6. En GitHub → Actions → «App de iPhone» → **Run workflow**. En unos 15 minutos la versión
   aparece en App Store Connect → TestFlight (la primera vez, Apple la procesa un rato).
7. En TestFlight, añade a Matteo como probador interno (tiene que estar en Usuarios y acceso) e
   instalad la app **TestFlight** en el iPhone. Desde ahí se instala Umbral y se actualiza sola.

Sin los secretos, el proceso compila igualmente para el simulador: sirve para saber que la app
sigue funcionando con cada cambio.

## Para trabajar en ella

- La fuente es la web de la raíz. `npm run build:www` la copia a `www/` y `npx cap sync ios` la
  mete en el proyecto de Xcode (`ios/App`). Las librerías nativas van con Swift Package Manager.
- Los avisos push de la web (VAPID) no llegan a la app nativa: para avisos de tu pareja con la app
  cerrada hará falta APNs (siguiente paso). Los avisos de plazos ya funcionan porque son locales.
