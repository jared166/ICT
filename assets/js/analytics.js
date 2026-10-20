// ============================================================================
// Medición: una sola función track(evento, params) que reparte a:
//   window.dataLayer · GA4 (gtag) · Microsoft Clarity · píxel de Meta
// Los scripts de terceros solo se cargan desde consent.js, con consentimiento.
// Nunca se envían a ningún proveedor el nombre, el teléfono, el Instagram
// ni el nombre de la tienda.
// ============================================================================
import { CONFIG } from "../../config.js";
import { esDebug, parametro } from "./utils.js";

window.dataLayer = window.dataLayer || [];

// GA4 usa su propia cola ("ictGtag", parámetro l= de gtag.js) para que los
// eventos que empujamos a window.dataLayer no se cuenten dos veces.
const COLA_GTAG = "ictGtag";

const PROHIBIDOS = ["nombre", "whatsapp", "telefono", "phone", "tienda", "instagram", "email", "correo", "indicativo"];

const cargados = { ga4: false, clarity: false, meta: false };
const historial = []; // eventos de esta página, para reenviarlos si el consentimiento llega después

// ---------- Atribución en memoria (sin cookies ni almacenamiento) ----------
const CLAVES_ATRIBUCION = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "fbclid", "ref"];
const atribucion = {};
CLAVES_ATRIBUCION.forEach((k) => { const v = parametro(k); if (v) atribucion[k] = v.slice(0, 200); });
export const obtenerAtribucion = () => ({ ...atribucion });

// ---------- Variante del titular ----------
let variante = (parametro("h") || "").toUpperCase();
if (variante !== "A" && variante !== "B") variante = CONFIG.titularPorDefecto === "B" ? "B" : "A";
export const varianteTitular = () => variante;

// ---------- Mapa a Meta ----------
function aMeta(evento, params) {
  if (evento === "seccion_vista" && params.seccion === "inversion") return ["track", "ViewContent", { content_name: "inversion" }];
  if (evento === "aplicacion_enviada") return params.califica ? ["track", "Lead", {}] : ["trackCustom", "AplicacionNoCalifica", {}];
  if (evento === "agenda_vista") return ["trackCustom", "AgendaVista", {}];
  if (evento === "agendado") return ["track", "Schedule", {}];
  return null;
}

const CLARITY_SET = ["variante_titular", "califica", "rango_utilidad", "seccion"];

function limpiar(params) {
  const out = {};
  Object.entries(params || {}).forEach(([k, v]) => {
    if (PROHIBIDOS.includes(k.toLowerCase())) return;
    if (v === undefined || v === null) return;
    out[k] = Array.isArray(v) ? v.join(",") : v;
  });
  return out;
}

function enviarAProveedores(evento, p, solo) {
  if ((!solo || solo === "ga4") && cargados.ga4 && typeof window.gtag === "function") {
    window.gtag("event", evento, p);
  }
  if ((!solo || solo === "clarity") && cargados.clarity && typeof window.clarity === "function") {
    window.clarity("event", evento);
    CLARITY_SET.forEach((k) => { if (k in p) window.clarity("set", k, String(p[k])); });
  }
  if ((!solo || solo === "meta") && cargados.meta && typeof window.fbq === "function") {
    const m = aMeta(evento, p);
    if (m) window.fbq(m[0], m[1], m[2]);
  }
}

/** Única puerta de entrada de la medición. */
export function track(evento, params = {}) {
  const p = limpiar(params);
  window.dataLayer.push({ event: evento, ...p });
  historial.push([evento, p]);
  enviarAProveedores(evento, p);
  if (esDebug()) console.info("[track]", evento, p);
}

// ---------- Carga de proveedores (la llama consent.js) ----------
function inyectar(src) {
  const s = document.createElement("script");
  s.async = true;
  s.src = src;
  document.head.appendChild(s);
}

function cargarGA4(cats) {
  if (cargados.ga4 || !CONFIG.ga4Id) return;
  window[COLA_GTAG] = window[COLA_GTAG] || [];
  window.gtag = function () { window[COLA_GTAG].push(arguments); };
  // Consent Mode v2: todo denegado por defecto, antes de cargar gtag.js.
  window.gtag("consent", "default", { ad_storage: "denied", analytics_storage: "denied", ad_user_data: "denied", ad_personalization: "denied" });
  window.gtag("consent", "update", senalesGoogle(cats));
  window.gtag("js", new Date());
  window.gtag("config", CONFIG.ga4Id, { page_location: location.href, page_title: document.title });
  inyectar(`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(CONFIG.ga4Id)}&l=${COLA_GTAG}`);
  cargados.ga4 = true;
  historial.forEach(([e, p]) => enviarAProveedores(e, p, "ga4"));
}

function cargarClarity(cats) {
  if (cargados.clarity || !CONFIG.clarityId) return;
  (function (c, l, a, r, i, t, y) {
    c[a] = c[a] || function () { (c[a].q = c[a].q || []).push(arguments); };
    t = l.createElement(r); t.async = 1; t.src = "https://www.clarity.ms/tag/" + i;
    y = l.getElementsByTagName(r)[0]; y.parentNode.insertBefore(t, y);
  })(window, document, "clarity", "script", encodeURIComponent(CONFIG.clarityId));
  // API de consentimiento v2 de Clarity (no la vieja clarity('consent', true)).
  window.clarity("consentv2", senalesClarity(cats));
  window.clarity("set", "variante_titular", variante);
  cargados.clarity = true;
  historial.forEach(([e, p]) => enviarAProveedores(e, p, "clarity"));
}

function cargarMeta() {
  if (cargados.meta || !CONFIG.metaPixelId) return;
  /* eslint-disable */
  !function (f, b, e, v, n, t, s) { if (f.fbq) return; n = f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments); }; if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = "2.0"; n.queue = []; t = b.createElement(e); t.async = !0; t.src = v; s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s); }(window, document, "script", "https://connect.facebook.net/en_US/fbevents.js");
  /* eslint-enable */
  window.fbq("consent", "revoke");   // siempre antes de init
  window.fbq("consent", "grant");    // solo llegamos aquí con la publicidad aceptada
  window.fbq("init", CONFIG.metaPixelId);
  window.fbq("track", "PageView");
  cargados.meta = true;
  historial.forEach(([e, p]) => enviarAProveedores(e, p, "meta"));
}

const g = (b) => (b ? "granted" : "denied");
function senalesGoogle(cats) {
  return { analytics_storage: g(cats.analiticas), ad_storage: g(cats.publicidad), ad_user_data: g(cats.publicidad), ad_personalization: g(cats.publicidad) };
}
function senalesClarity(cats) {
  return { ad_Storage: g(cats.publicidad), analytics_Storage: g(cats.analiticas) };
}

/** Aplica una elección de consentimiento: carga lo aceptado y actualiza señales de lo ya cargado. */
export function aplicarConsentimiento(cats) {
  actualizarSenales(cats);
  if (cats.analiticas) { cargarGA4(cats); cargarClarity(cats); }
  if (cats.publicidad) cargarMeta();
}

/** Actualiza las señales de los proveedores ya cargados (también al retirar el consentimiento). */
export function actualizarSenales(cats) {
  if (cargados.ga4 && typeof window.gtag === "function") window.gtag("consent", "update", senalesGoogle(cats));
  if (cargados.clarity && typeof window.clarity === "function") window.clarity("consentv2", senalesClarity(cats));
  if (cargados.meta && typeof window.fbq === "function") window.fbq("consent", cats.publicidad ? "grant" : "revoke");
}

export const proveedoresCargados = () => ({ ...cargados });
