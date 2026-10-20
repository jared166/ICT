# Guía para agentes y editores · Landing de I.C.T.

Referencia para cualquier sesión de trabajo en este repositorio (Claude Code, otro agente o personas).

## Contexto en 30 segundos

- **I.C.T.** es un servicio de **Marketing Masters Group** (siempre "I.C.T. by Marketing Masters Group"; la marca madre lleva S: Masters) para **dueños de tiendas de iPhone en Colombia**: Interrupción (Meta), Captura (cotizadora + WhatsApp + CRM, más guion de venta) y Tracking (cada venta atribuida a su campaña).
- Promesa: 15 ventas de iPhone atribuidas a Meta en 30 días (**objetivo, no garantía**). Garantía: hito del día 10, con condiciones; reembolsa la cuota del primer mes, no la pauta.
- Precio: USD 210/mes (USD 150 con GHL propio) + USD 1.000/mes de pauta que la tienda paga a Meta. Sin permanencia. Máximo 5 tiendas por ciudad en el año de lanzamiento.
- Un solo caso: una tienda de iPhone en Argentina, con ventas reportadas por la tienda.
- Tráfico tibio y móvil. **CTA único: "Aplicar a un cupo"** → `#aplicar` → califica → `agenda.html`.
- Sitio estático sin build (HTML + CSS + JS vanilla, ES modules) en GitHub Pages bajo subruta. **Todas las rutas internas son relativas.** Toda la configuración vive en `config.js`.

## Regla de oro del copy

**El copy se cambia solo si Jared lo pide, siempre en "usted".**
El texto de las páginas es literal del encargo (sección 9). Se pueden ajustar saltos de línea, énfasis y jerarquía visual; no se reescribe, no se resume y no se agregan frases de venta. Si algo no entra en el diseño, se avisa; no se recorta.

## Reglas de contenido que no se rompen

1. **Copy literal** (ver arriba).
2. **"Usted" y español de Colombia** en todo el texto visible. Nunca "tú" ni "vos".
3. **El caso dice "ventas"**, nunca "ventas de iPhone" (no se conoce el mix de lo que vendió).
4. **Hay un solo caso.** Nunca "nuestros clientes", "cientos de tiendas" ni nada en plural.
5. **Las 15 ventas son el objetivo, no una garantía.** La garantía siempre va con sus condiciones.
6. **Sin la manzana, sin el logo de Apple y sin imágenes oficiales de Apple.** "iPhone" solo como el producto que venden las tiendas. En los mocks, el teléfono es un rectángulo genérico de esquinas redondeadas: sin muesca ni botones reconocibles.
7. **Sin testimonios, logos de clientes, contadores falsos, temporizadores ni "solo hoy".**
8. **Números en formato colombiano:** USD 6.280; 26,17; 17,6%. (En JS: `formatoNumero()` de `utils.js`, no `Intl`.)
9. **Todo lo "ilustrativo" lleva la etiqueta visible "Ilustrativo".** Ningún número inventado se presenta como dato. Los precios de los mocks van con X ("$ X.XXX.XXX").
10. **Prohibido el lenguaje de gurú:** "revolucionario", "secreto", "explota tus ventas", "increíble", signos de exclamación en serie, emojis en el cuerpo.
11. **No inventar datos.** Lo marcado `[PENDIENTE]` queda como placeholder configurable, nunca relleno.

## Identidad visual (resumen)

### Colores

| Token | Valor | Uso |
| --- | --- | --- |
| `--mmg-azul` | `#1A73E8` | Botón principal, links |
| `--mmg-gris` | `#4A4A4A` | Cuerpo de texto sobre blanco |
| `--mmg-azul-2` | `#2D3748` | Títulos, pie |
| `--mmg-celeste` | `#37B1AB` | Acento de I.C.T. (el Tracking): íconos, bordes, números destacados sobre oscuro |
| `--mmg-fondo-suave` | `#F5F7FA` | Secciones claras alternas |
| `--mmg-noche` | `#1B2230` | Fondos de impacto (hero, revelación, aplicar, cierre) |
| Degradados | `--mmg-grad-logo`, `--mmg-grad-oscuro`, `--mmg-grad-acento` | `grad-acento` nunca como fondo de texto |

### Contraste (WCAG 2.x)

- Blanco sobre `#2D3748` (11,99:1), `#4A4A4A` (8,86:1) o `#1B2230` (15,93:1): libre.
- Blanco sobre `#1A73E8` (4,51:1): solo negrita o 18 px o más (el botón usa Lato 900).
- **Nunca texto blanco sobre `#37B1AB`** (2,61:1).
- Celeste como texto: sobre `#1B2230` (6,10:1) sí; sobre blanco no: para antetítulos en claro se usa `#237C78`.

### Tipografía

- Títulos: `--font-titulos` = `"Bahnschrift", "Barlow", "Segoe UI", Arial, sans-serif` (Barlow 600/700; display grande en Barlow Semi Condensed 700).
- Cuerpo: Lato 400/700/900. Fuentes **alojadas en el sitio** (`assets/fonts/`, OFL); no usar el CDN de Google.
- Móvil: H1 34–44 px (1,08), H2 28–34, H3 20–22, cuerpo 17–18 (1,6), números 56–96. **Nada por debajo de 14 px.**

### Sistema gráfico

- El **hexágono vertical** es el recurso propio: patrón de fondo (4–6%) en secciones oscuras, viñetas (hexágono celeste de 10 px), hitos de la línea de tiempo, marco de íconos, indicador de pasos. Variable CSS `--hex`.
- Antetítulos numerados "01)", "02)"… en celeste, `--font-titulos`, mayúsculas espaciadas pequeñas.
- Radios: 14 px tarjetas, 10 px botones, 28 px celular. Sombras frías: `0 10px 30px rgba(45,55,72,.10)`.
- Botón principal: `--mmg-azul`, Lato 900, 52 px mínimo, ancho completo en móvil; hover `--mmg-grad-oscuro` + leve subida; foco outline celeste 3 px; en oscuro, halo celeste.
- Sin fotos de stock: el visual son los mocks de producto (HTML/CSS), los hexágonos y los números.
- Ritmo: oscuras en impacto (hero, revelación, aplicar, cierre); claras para leer.

### Logos

- `logo-ict.svg` (esquinas redondeadas, por defecto) y `logo-ict-rectas.svg` [PENDIENTE: decisión de Jared]. `ict-hexagonos.svg` + `hex-i/c/t.svg`. `lockup-ict-claro.svg` (texto `#2D3748`) y `lockup-ict-oscuro.svg` (texto blanco). `logo-mmg.svg` es **provisorio** hasta el vector oficial.
- La T del sublogo: el degradado deja la letra en ≥ 3:1 contra el blanco (travesaño 3,66:1). No aclararlo.
- Referencias aprobadas en `assets/img/ref/`. Comparar con `tools/logos-compare.mjs`.

## Formulario y calificación

- Dos pasos: contacto (nombre, WhatsApp +57 con 10 dígitos que empiezan por 3, tienda, Instagram sin @, ciudad) y calificación (6 preguntas con opciones como botones) + casilla de privacidad.
- **No califica** si `iphone_principal = No`, `suma_1000 = No` o `utilidad` es "Menos de USD 60" o "USD 60 a 80". "No sé" y "Nadie todavía" **califican**.
- Califica → `agenda.html?nombre=&whatsapp=&utm…` (agenda los quita de la URL antes de medir). No califica → `no-califica.html`.
- Los `value` de las opciones son las etiquetas visibles: si se cambia una etiqueta, revisar `calificar()` en `form.js`.

## Medición (eventos)

| Evento | Cuándo | Parámetros | Meta |
| --- | --- | --- | --- |
| `cta_click` | Clic en "Aplicar a un cupo" | `ubicacion` | — |
| `seccion_vista` | Sección al 50%, una vez | `seccion` | `ViewContent` solo `inversion` |
| `scroll_profundidad` | 25/50/75/90% | `porcentaje` | — |
| `demo_cotizadora` | Interacción con la mini cotizadora | `paso` | — |
| `recorrido_paso` | Paso del recorrido visto | `paso` (1–5) | — |
| `calculadora_uso` | Primer cálculo válido | `rango_utilidad` | — |
| `faq_abierta` | Abrir una pregunta | `pregunta` | — |
| `formulario_inicio` · `formulario_paso_2` | Foco · paso 2 | — | — |
| `aplicacion_enviada` | Envío exitoso | `califica`, `motivo` | `Lead` / `AplicacionNoCalifica` |
| `lead_calificado` | Envío exitoso y califica | `variante_titular` | — |
| `agenda_vista` | Carga de agenda | — | `AgendaVista` |
| `agendado` | Reserva confirmada | — | `Schedule` · [PENDIENTE]: medir desde GHL con la API de conversiones |

- Todo pasa por `track()` de `analytics.js`. **Nunca** se envían nombre, teléfono, Instagram ni nombre de la tienda a ningún proveedor.
- GA4: eventos clave `lead_calificado` y `agendado` (se marcan en la propiedad). `?debug=1` muestra cada `track` en la consola.

## Consentimiento (reglas)

- Antes de elegir: **ningún** script de medición ni almacenamiento no técnico. Scroll ≠ consentimiento.
- Banner con 3 botones de igual jerarquía; panel con categorías desactivadas por defecto; "Configurar cookies" en el pie de todas las páginas.
- `ict_consent_v1` en localStorage (categorías, fecha, versión). Se vuelve a pedir a los 24 meses o si cambia `versionPoliticas`.
- Retirar: señales actualizadas, cookies de terceros borradas, recarga.
- GA4 Consent Mode v2 (`default` denied antes de gtag); Clarity `consentv2` (no la API vieja); Meta `revoke` antes de `init`.
- UTM, `fbclid` y `ref` solo en memoria (nunca en storage ni cookies).

## Convenciones técnicas

- Elementos que dependen de `config.js` llevan `hidden` y los revela `main.js` solo si hay dato. Cada bloque corre en `safe()`.
- El cabezal, el pie y el `<head>` se repiten en las 8 páginas: un cambio estructural se hace en todas.
- Al cambiar CSS/JS, actualizar `?v=AAAAMMDD` en las 8 páginas.
- **CSS de la portada < 50 KB** (`tokens` + `base` + `components` + `sections` ≈ 49,6 KB: no hay margen; si se suma algo, recortar). Total HTML + CSS + JS < 200 KB por página sin fuentes.
- Las reglas de una línea de `components.css`, `sections.css` y `base.css` están compactadas (sin espacios tras ":" y ";") para cumplir el peso.
- Sin frameworks, Tailwind ni npm en producción. Única dependencia externa: los scripts de medición, con consentimiento.
- El repositorio es **público**: `docs/privado/` (encargo y términos completos) está en `.gitignore`. No subir notas internas.

## Checklist de verificación (antes de cada commit)

1. `NODE_PATH=$(npm root -g) node tools/verify.mjs` → **0 fallas**. Cubre consentimiento y red (antes de elegir, rechazar, aceptar, solo analíticas, retirar, 24 meses, cambio de versión), formulario (califica, no califica por cada filtro, "No sé"/"Nadie todavía", validación, webhook vacío, falla y timeout de 10 s), UTM sin almacenamiento, calculadora contra la tabla (81→15/5 · 90→14/140 · 100→13/290 · 120→11/590 · 150→9/1.040 · 70→18/−160 + mensaje), revelación 27,4, eventos, configuración vacía y completa, barra fija, contraste AA, ≥ 14 px, sin blanco sobre celeste, un H1, scroll horizontal 320–1440, áreas táctiles, links bajo subruta, 404, peso y palabras prohibidas.
2. `node tools/screenshots.mjs` → mirar `tools/out/` en 360×800, 390×844, 768×1024 y 1440×900: hero, revelación, recorrido (móvil y escritorio), tabla del caso en móvil, calculadora, formulario, banner de cookies y pie.
3. Comparar a mano cualquier texto tocado con la sección 9 del encargo.
4. Logos: `tools/logos-compare.mjs` y contraste de la T.
5. Si cambió algo de rendimiento: Lighthouse móvil ≥ 90 en rendimiento, accesibilidad y buenas prácticas (el SEO baja por `noindex`, es esperado).
6. No hacer push a `main` ni publicar sin que Jared lo pida.
