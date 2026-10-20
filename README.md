# I.C.T. by Marketing Masters Group · Landing (beta)

Landing de **I.C.T.**, un servicio de Marketing Masters Group para **dueños de tiendas de iPhone en Colombia**: campañas en Meta (Interrupción), cotizadora + WhatsApp + CRM (Captura) y registro de cada venta con su campaña (Tracking).

- **Objetivo único:** que la tienda que califica **aplique** y **agende** una videollamada de 30 minutos. CTA: "Aplicar a un cupo".
- **Tráfico:** tibio (bio de Instagram, DMs, emails, WhatsApp), casi todo desde el celular.
- **Estado:** beta sin indexar (`noindex, nofollow` + `robots.txt` con `Disallow: /`).

## Contenido

| Archivo | Qué es |
| --- | --- |
| `index.html` | Página principal (secciones 01 a 12 + cierre) |
| `agenda.html` | "Su tienda califica": calendario de GoHighLevel |
| `no-califica.html` | "Gracias por su sinceridad" |
| `aviso-legal.html` · `privacidad.html` · `cookies.html` · `terminos.html` | Páginas legales (borradores) |
| `404.html` | Página de error de GitHub Pages |
| `config.js` | **Toda la configuración editable** |
| `assets/css/` | `tokens` · `base` · `components` · `sections` · `legal` · `paginas` |
| `assets/js/` | `main` · `consent` · `analytics` · `form` · `calculator` · `demo` · `scrolly` · `utils` |
| `assets/fonts/` | Barlow, Barlow Semi Condensed y Lato en WOFF2, alojadas en el sitio (licencia OFL) |
| `assets/img/` | Logos SVG, favicons, `og-image.png`, `ref/` (referencias aprobadas; no se publican) |
| `tools/` | Servidor local, verificación, capturas y generador de imágenes (no se publican) |

Sin frameworks, sin npm en producción y sin build: HTML + CSS + JavaScript (ES modules). Las únicas dependencias externas son los scripts de medición, y solo se cargan con consentimiento.

## Correrlo en local

```bash
python3 -m http.server 8000          # → http://localhost:8000/
# o, simulando la subruta de GitHub Pages y con gzip como en producción:
node tools/serve.mjs 8080 /ICT/      # → http://localhost:8080/ICT/
```

Abrirlo con `file://` no funciona: los módulos de JavaScript necesitan un servidor.

## Publicar en GitHub Pages

1. En GitHub: **Settings → Pages → Build and deployment → Deploy from a branch**, rama `main`, carpeta `/ (root)`.
2. Queda en `https://jared166.github.io/ICT/`. Todas las rutas internas son relativas, así que funciona bajo esa subruta.
3. `_config.yml` le indica a GitHub Pages que **no publique** `README.md`, `CLAUDE.md`, `tools/`, `docs/` ni `assets/img/ref/`.

### Conectar un dominio propio [PENDIENTE]

1. Renombrar `CNAME.ejemplo` a `CNAME` y dejar una sola línea con el dominio (por ejemplo, `ict.marketingmaster.top`). No se deja un `CNAME` vacío o comentado porque GitHub Pages lee su primera línea como dominio.
2. En el DNS del dominio, un registro `CNAME` hacia `jared166.github.io`.
3. En GitHub, **Settings → Pages → Custom domain**, y activar **Enforce HTTPS**.
4. Reemplazar `https://jared166.github.io/ICT/` por el dominio nuevo en `canonical`, `og:url`, `og:image`, `twitter:image` y el JSON-LD de todas las páginas.

### Quitar el modo beta (versión definitiva)

- Borrar `<meta name="robots" content="noindex, nofollow">` de todas las páginas.
- En `robots.txt`, cambiar `Disallow: /` por `Allow: /`.

## Qué se edita en `config.js`

| Campo | Para qué | Si está vacío |
| --- | --- | --- |
| `titularPorDefecto` | `"A"` o `"B"`. `?h=a` / `?h=b` en la URL lo fuerza | — |
| `webhookUrl` | Inbound Webhook de un workflow de GoHighLevel | No envía: `console.info(payload)` + aviso "Webhook no configurado" y sigue el flujo |
| `calendarioUrl` | URL del embed del calendario de GHL (30 min) | Bloque "Calendario pendiente de configurar" + botón de WhatsApp (si hay número) |
| `whatsappAgencia` | Número internacional sin "+" | Se ocultan todos los botones y links de WhatsApp |
| `emailContacto` | Email del pie | No se muestra |
| `videoHero` | URL de YouTube, Vimeo o `.mp4` | Se muestra la mini cotizadora. Con video: portada + play; el iframe carga solo al hacer clic, y la cotizadora pasa a la sección 05 |
| `cupos` | `[{ ciudad: "Medellín", disponibles: 4 }]`. Solo datos reales | No hay franja de cupos. Con `0`: "Ciudad: completo" |
| `precioContinuidad` | Precio del plan de continuidad (FAQ) | — |
| `capturaCaso` | Ruta de una captura del caso con los datos tapados, p. ej. `assets/img/caso-ads-manager.webp` | No se muestra el bloque |
| `ga4Id` · `clarityId` · `metaPixelId` | IDs de medición | No se carga ese proveedor |
| `legalRevisado` | `true` cuando el abogado apruebe | Las páginas legales muestran "Borrador pendiente de revisión legal" |
| `versionPoliticas` | Fecha de versión de las políticas | Si cambia, se vuelve a pedir el consentimiento de cookies |
| `prestador` | Datos del titular (LSSI) | Pie: "datos en preparación"; legales: el `[PENDIENTE]` resaltado |

Cuando cambie CSS o JS, actualizar `?v=AAAAMMDD` en los `<link>`/`<script>` de las 8 páginas.

## Formulario y webhook

Dos pasos (contacto y calificación). Se envía un `POST` JSON a `webhookUrl` con: `nombre`, `whatsapp` (+57…), `tienda`, `instagram` (sin @), `ciudad`, `iphone_principal`, `pauta_actual`, `suma_1000`, `utilidad`, `graba`, `decisor`, `privacidad`, `califica`, `motivo_no_califica` (lista), `variante_titular`, `utm_source`, `utm_medium`, `utm_campaign`, `utm_term`, `utm_content`, `fbclid`, `ref`, `pagina`, `enviado_en` (ISO 8601), `consentimiento` (categorías) y `user_agent`.

- **No califica** si el iPhone no es lo que más venden, si no pueden sumar USD 1.000 al mes, o si la utilidad es "Menos de USD 60" o "USD 60 a 80". "No sé" y "Nadie todavía" califican.
- Califica → `agenda.html?nombre=…&whatsapp=…&utm_…`. `agenda.html` lee nombre y WhatsApp a memoria y los **quita de la URL antes de cargar la medición**.
- Timeout de 10 s. Si falla: mensaje y botón "Enviar por WhatsApp" con el resumen de las respuestas.
- Antispam: campo trampa invisible (`sitio_web`).
- [VERIFICAR] al configurar el webhook: que el Inbound Webhook de GHL acepte peticiones del navegador (CORS) con `Content-Type: application/json`. Si no las acepta, el formulario cae en el plan B de WhatsApp: probarlo con un envío real antes de pautar.

## Medición

Una sola función, `track(evento, params)` (`assets/js/analytics.js`), que empuja a `window.dataLayer`, envía a GA4 (`gtag('event', …)`), marca en Clarity (`clarity('event')` y `clarity('set')` para `variante_titular`, `califica`, `rango_utilidad` y `seccion`) y mapea a Meta. **Nunca** se envían el nombre, el teléfono, el Instagram ni el nombre de la tienda. Con `?debug=1`, cada `track` se muestra en la consola.

| Evento | Cuándo | Parámetros | Meta |
| --- | --- | --- | --- |
| `cta_click` | Clic en cualquier "Aplicar a un cupo" | `ubicacion` (hero, revelacion, ict, recorrido, caso, inversion, cierre, header, sticky) | — |
| `seccion_vista` | Cada sección al 50% en pantalla, una vez | `seccion` | `ViewContent` solo para `inversion` |
| `scroll_profundidad` | 25 / 50 / 75 / 90% | `porcentaje` | — |
| `demo_cotizadora` | Interacción con la mini cotizadora | `paso` (modelo, whatsapp) | — |
| `recorrido_paso` | Cada paso del recorrido visto | `paso` (1–5) | — |
| `calculadora_uso` | Primer cálculo válido | `rango_utilidad` (<81, 81-100, 101-150, >150) | — |
| `faq_abierta` | Abrir una pregunta | `pregunta` (slug) | — |
| `formulario_inicio` | Foco en el formulario | — | — |
| `formulario_paso_2` | Pasa al paso 2 | — | — |
| `aplicacion_enviada` | Envío exitoso | `califica`, `motivo` | `Lead` si califica · `AplicacionNoCalifica` (personalizado) si no |
| `lead_calificado` | Envío exitoso y califica | `variante_titular` | — (ya va `Lead`) |
| `agenda_vista` | Carga de `agenda.html` | — | `AgendaVista` (personalizado) |
| `agendado` | Reserva confirmada | — | `Schedule` · **[PENDIENTE]**, ver abajo |

- **GA4:** crear la propiedad y el flujo web, poner el ID en `ga4Id` y, en **Administrar → Eventos**, marcar como **eventos clave** `lead_calificado` y `agendado`. Para ver los parámetros en los informes, crear dimensiones personalizadas de evento (`ubicacion`, `seccion`, `paso`, `rango_utilidad`, `pregunta`, `califica`, `motivo`, `variante_titular`). GA4 usa su propia cola (`l=ictGtag`) para no duplicar los eventos de `window.dataLayer` si después se agrega GTM.
- **Clarity:** crear el proyecto y poner el ID en `clarityId`. Recomendado: enmascaramiento **Strict** en la configuración del proyecto (el formulario además lleva `data-clarity-mask="true"`).
- **Meta:** poner el ID del píxel de Marketing Masters Group en `metaPixelId`. `AplicacionNoCalifica` y `AgendaVista` son eventos personalizados: para optimizar con ellos, crear conversiones personalizadas en el Administrador de eventos.
- **`agendado` [PENDIENTE]:** no se implementó en la página. GoHighLevel no documenta oficialmente un `postMessage` del calendario embebido que confirme la reserva (solo hay guías de terceros), así que no se inventó. **Medir la reserva desde GHL con la API de conversiones** (workflow "Appointment booked" → Meta CAPI `Schedule` y Measurement Protocol de GA4 `agendado`).

### Consentimiento de cookies

Banner propio (LSSI art. 22.2, RGPD, Guía de cookies de la AEPD; Ley 1581 de 2012 en Colombia):

- Antes de elegir no se carga ningún script de medición ni se escribe nada que no sea técnico. Scroll o seguir navegando no es consentimiento.
- Primera capa: Aceptar todas · Rechazar todas · Configurar (misma jerarquía visual). Segunda capa: Técnicas (siempre activas), Analíticas (GA4 + Clarity) y Publicidad (Meta), desactivadas por defecto.
- Registro en `localStorage` → `ict_consent_v1`: `{ categorias, fecha, version }`. Se vuelve a pedir a los 24 meses o si cambia `versionPoliticas`.
- "Configurar cookies" en el pie de todas las páginas. Al retirar un consentimiento: se actualizan las señales, se borran las cookies de terceros que se pueden borrar desde el dominio y se recarga.
- Señales: **GA4** Consent Mode v2 (`default` todo `denied` antes de cargar gtag, después `update`); **Clarity** `clarity('consentv2', { ad_Storage, analytics_Storage })`; **Meta** `fbq('consent','revoke')` antes de `init` y `fbq('consent','grant')` con publicidad aceptada.
- Atribución sin cookies: UTM, `fbclid` y `ref` se guardan en memoria (variable de JS), viajan con el formulario y pasan por query string a `agenda.html`.

**Verificación de las APIs (20 de octubre de 2026).** El entorno donde se construyó no tenía acceso directo a las páginas de documentación (la red las bloqueaba), así que la sintaxis se contrastó con búsquedas sobre la documentación oficial:

| Proveedor | Fuente | Qué se confirmó |
| --- | --- | --- |
| Microsoft Clarity | learn.microsoft.com/clarity/setup-and-installation/clarity-consent-api-v2 | `consentv2` con `ad_Storage` y `analytics_Storage` ("granted"/"denied"), reemplaza a la API vieja |
| Meta | developers.facebook.com/docs/meta-pixel/implementation/gdpr | `fbq('consent','revoke')` antes de `fbq('init')` y `grant` tras el consentimiento |
| Google | developers.google.com/tag-platform/security/guides/consent | Consent Mode v2: `ad_storage`, `analytics_storage`, `ad_user_data`, `ad_personalization` [VERIFICAR leyendo la página completa] |
| Cookies GA4 | support.google.com/analytics/answer/11397207 | `_ga` y `_ga_<ID>`: 2 años |
| Cookies Meta | developers.facebook.com/docs/marketing-api/conversions-api/parameters/fbp-and-fbc | `_fbp` y `_fbc`: 90 días |
| Cookies Clarity | learn.microsoft.com/clarity/setup-and-installation/cookie-list | Finalidades confirmadas; duraciones [VERIFICAR] |

## Verificación antes de cada commit

```bash
NODE_PATH=$(npm root -g) node tools/verify.mjs        # debe terminar con 0 fallas
NODE_PATH=$(npm root -g) node tools/screenshots.mjs   # capturas en tools/out/ (360, 390, 768, 1440)
NODE_PATH=$(npm root -g) node tools/logos-compare.mjs # logos SVG vs. referencias
NODE_PATH=$(npm root -g) node tools/assets.mjs        # regenera favicons PNG y og-image.png
```

`verify.mjs` prueba con configuración vacía y completa (intercepta `config.js`): consentimiento y peticiones de red, formulario (califica, no califica, "No sé", validación, falla, timeout), UTM sin almacenamiento, calculadora contra la tabla, eventos, barra fija, contraste AA, tamaños mínimos, scroll horizontal 320–1440, áreas táctiles, links rotos bajo subruta, 404, peso y palabras prohibidas. Necesita Playwright (`npm i -g playwright` o `PLAYWRIGHT_PATH`).

Última medición con Lighthouse móvil (servidor local con gzip): portada 97–99 en rendimiento y 100 en accesibilidad y buenas prácticas; resto de páginas 98–100. El SEO baja por el `noindex`, es esperado.

## Logos

- `logo-ict.svg` (esquinas redondeadas, como la referencia aprobada) y `logo-ict-rectas.svg` (esquinas rectas). **[PENDIENTE: decisión de Jared.]**
- `ict-hexagonos.svg` + `hex-i.svg`, `hex-c.svg`, `hex-t.svg`. El degradado de la T deja el travesaño en 3,66:1 contra el blanco (la referencia rondaba 3,6:1) y toda la letra por encima de 3:1.
- `lockup-ict-claro.svg` (texto `#2D3748`) y `lockup-ict-oscuro.svg` (texto blanco), con el texto convertido a trazos para no depender de fuentes.
- `logo-mmg.svg`: **provisorio hasta tener el vector oficial** del isotipo de Marketing Masters Group.
- Se generaron con geometría exacta a partir de `assets/img/ref/` y se compararon lado a lado (`tools/logos-compare.mjs`).

## Notas sobre los datos del caso

- La tabla del caso usa las cifras literales del brief. Los costos por venta salen de montos sin redondear: por ejemplo, 1.522 ÷ 70 = 21,74 y el brief dice 21,75; y la suma de los meses da 6.279, mientras el total del brief es 6.280. Si se quiere exactitud al centavo, pedir a la tienda los montos con decimales.
- Revelación: 2.191 ÷ 80 = 27,4 → "más o menos una venta cada 27 conversaciones".

## Lista completa de [PENDIENTE] y [VERIFICAR]

**Configuración (`config.js`):** `webhookUrl`, `calendarioUrl`, `whatsappAgencia`, `emailContacto`, `videoHero` (opcional), `cupos` (solo datos reales), `precioContinuidad` (propuesta de USD 60), `ga4Id`, `clarityId`, `metaPixelId`, `prestador` (nombre o razón social, NIF, domicilio, datos registrales, email).

**Sitio:** dominio propio y `CNAME`; reemplazar la URL provisoria en canonical/OG/JSON-LD; decisión de esquinas del logo; vector oficial de MMG; evento `agendado` (medirlo desde GHL); captura del caso (opcional); validar con Jared el ítem de agencias del problema (`data-pendiente="validar-agencias"`).

**Aviso legal:** dominio definitivo; si los precios incluyen impuestos; titularidad de las marcas I.C.T. y Marketing Masters Group; ley aplicable y jurisdicción.

**Privacidad:** garantías de las transferencias internacionales; plazos de conservación.

**Cookies [VERIFICAR]:** duración de `_clck` y `_clsk`; finalidad y duración de `CLID`, `ANONCHK`, `MR`, `MUID`, `SM` y `fr`; cookies del calendario de GoHighLevel.

**Términos (Parte 2 publicada tal cual):** datos del prestador que figuran en Stripe; versión y fecha; costos de terceros; reintentos de cobro y plazos (7/15 días); fecha del fin del año de lanzamiento; aviso de cambios de precio (30 días); plazos de la garantía (5/5/10 días hábiles) y canal; videos (3 en 7 días) y caducidad a los 30 días; portal de cliente de Stripe; plan de continuidad (USD 60); uso de los anuncios tras cancelar; acuerdo de transmisión de datos; límite de responsabilidad (3 meses); canal, horario y tiempo de respuesta del soporte; aviso de cambios (30 días); ley aplicable.

**Otros [VERIFICAR]:** CORS del webhook de GHL; parámetros documentados de prellenado del calendario de GHL (hoy no se prellena nada); sintaxis completa de Consent Mode v2 en la página de Google.

## Insumos (`docs/`)

El repositorio es **público**. El borrador completo de términos (con notas internas sobre socios, Stripe y costos) y el encargo no se suben: viven en `docs/privado/`, que está en `.gitignore`. Para trabajar en una sesión nueva, copiarlos ahí. El manual `Identidad_Visual_Marketing_Masters_Group.md` no llegó con el encargo; lo esencial está en `CLAUDE.md`.
