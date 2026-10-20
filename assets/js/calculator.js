// Calculadora de la sección 08: ventas para cubrir USD 1.210 y lo que queda con 15 ventas.
//   ventas = Math.ceil(1210 / U)      queda = 15 × U − 1210
import { $ } from "./utils.js";
import { formatoNumero, formatoUSD } from "./utils.js";
import { track } from "./analytics.js";

export const COSTO_MENSUAL = 1210;
export const VENTAS_OBJETIVO = 15;
export const UMBRAL_UTILIDAD = 81;

export const ventasParaCubrir = (u) => Math.ceil(COSTO_MENSUAL / u);
export const quedaCon15 = (u) => VENTAS_OBJETIVO * u - COSTO_MENSUAL;

export function rangoUtilidad(u) {
  if (u < 81) return "<81";
  if (u <= 100) return "81-100";
  if (u <= 150) return "101-150";
  return ">150";
}

export function iniciarCalculadora() {
  const raiz = $("[data-calc]");
  if (!raiz) return;
  const input = $("[data-calc-input]", raiz);
  const slider = $("[data-calc-slider]", raiz);
  const outVentas = $("[data-calc-ventas]", raiz);
  const outQueda = $("[data-calc-queda]", raiz);
  const alerta = $("[data-calc-alerta]", raiz);
  let usado = false;

  function pintar(u, porUsuario) {
    if (!Number.isFinite(u) || u <= 0) {
      outVentas.textContent = "—";
      outQueda.textContent = "—";
      outQueda.classList.remove("negativo");
      alerta.hidden = true;
      return;
    }
    const queda = quedaCon15(u);
    outVentas.textContent = formatoNumero(ventasParaCubrir(u));
    outQueda.textContent = formatoUSD(Math.round(queda));
    outQueda.classList.toggle("negativo", queda < 0);
    alerta.hidden = !(u < UMBRAL_UTILIDAD);
    raiz.classList.toggle("calc--bajo", u < UMBRAL_UTILIDAD);
    if (porUsuario && !usado) { usado = true; track("calculadora_uso", { rango_utilidad: rangoUtilidad(u) }); }
  }

  const leerInput = () => {
    const v = String(input.value).replace(",", ".").trim();
    return v === "" ? NaN : Number(v);
  };

  input.addEventListener("input", () => {
    const u = leerInput();
    if (Number.isFinite(u) && u > 0) slider.value = String(Math.min(300, Math.max(40, Math.round(u))));
    pintar(u, true);
  });
  slider.addEventListener("input", () => {
    input.value = slider.value;
    pintar(Number(slider.value), true);
  });
  pintar(leerInput(), false);
}
