// Utilidades compartidas: ejecución segura, formato colombiano y helpers de DOM.

/** Corre un bloque aislado: si falla, no rompe el resto de la página. */
export function safe(nombre, fn) {
  try { return fn(); } catch (e) { if (esDebug()) console.warn(`[ict] ${nombre} falló`, e); }
}

export const $ = (sel, raiz = document) => raiz.querySelector(sel);
export const $$ = (sel, raiz = document) => Array.from(raiz.querySelectorAll(sel));

const params = new URLSearchParams(location.search);
export const parametro = (k) => params.get(k);
export const esDebug = () => params.get("debug") === "1";

export const movimientoReducido = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Formato colombiano: punto de miles y coma decimal (6.280; 26,17; 17,6%).
 * No se usa Intl porque "es" omite el separador en números de 4 cifras.
 */
export function formatoNumero(n, decimales = 0) {
  const neg = n < 0;
  const abs = Math.abs(n);
  const fijo = abs.toFixed(decimales);
  let [ent, dec] = fijo.split(".");
  ent = ent.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return (neg ? "−" : "") + ent + (dec ? "," + dec : "");
}

export function formatoUSD(n) {
  return (n < 0 ? "−" : "") + "USD " + formatoNumero(Math.abs(n));
}

/** Valor "pendiente": vacío o con la marca [PENDIENTE]. */
export const pendiente = (v) => v == null || String(v).trim() === "" || /\[PENDIENTE/i.test(String(v));

/** Dispara fn una sola vez cuando el elemento entra en pantalla. */
export function alVer(el, fn, opciones = { threshold: 0.35 }) {
  if (!("IntersectionObserver" in window)) { fn(el); return; }
  const io = new IntersectionObserver((entradas) => {
    entradas.forEach((e) => { if (e.isIntersecting) { io.unobserve(e.target); fn(e.target); } });
  }, opciones);
  io.observe(el);
}

/** wa.me con el número de la agencia (solo dígitos). Devuelve "" si no hay número. */
export function linkWhatsApp(numero, texto = "") {
  const n = String(numero || "").replace(/\D/g, "");
  if (!n) return "";
  return `https://wa.me/${n}` + (texto ? `?text=${encodeURIComponent(texto)}` : "");
}
