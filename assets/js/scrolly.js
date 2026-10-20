// Recorrido (sección 05). En escritorio, un celular sticky cambia de pantalla
// según el paso que está en el centro de la vista, y 5 hexágonos se van llenando.
// En móvil, cada paso muestra su propia mini pantalla (sin sticky).
import { $, $$ } from "./utils.js";
import { track } from "./analytics.js";

export function iniciarScrolly() {
  const raiz = $("[data-scrolly]");
  if (!raiz) return;
  const pasos = $$(".paso", raiz);
  const escenario = $("[data-escenario]", raiz);
  const indicador = $$("[data-indicador] li", raiz);
  if (!pasos.length || !escenario) return;

  // Clona cada mini pantalla dentro del celular grande (escritorio).
  pasos.forEach((paso, i) => {
    const pantalla = $(".pantalla", paso);
    if (!pantalla) return;
    const copia = pantalla.cloneNode(true);
    copia.dataset.i = String(i);
    // IDs únicos en la copia (los marcadores SVG se referencian por id).
    copia.querySelectorAll("[id]").forEach((n) => {
      const viejo = n.id, nuevo = `${viejo}-esc`;
      n.id = nuevo;
      copia.querySelectorAll(`[marker-end="url(#${viejo})"]`).forEach((r) => r.setAttribute("marker-end", `url(#${nuevo})`));
    });
    escenario.appendChild(copia);
  });
  raiz.classList.add("scrolly--activo");

  const vistos = new Set();
  let actual = -1;
  function activar(i, silencioso = false) {
    const n = i + 1;
    if (!silencioso && !vistos.has(n)) { vistos.add(n); track("recorrido_paso", { paso: n }); }
    if (i === actual) return;
    actual = i;
    $$(".pantalla", escenario).forEach((p) => p.classList.toggle("activa", Number(p.dataset.i) === i));
    pasos.forEach((p, k) => p.classList.toggle("activo", k === i));
    indicador.forEach((h, k) => h.classList.toggle("lleno", k <= i));
  }
  activar(0, true); // el paso 1 cuenta cuando se ve de verdad, no al iniciar

  if (!("IntersectionObserver" in window)) return;
  const io = new IntersectionObserver((entradas) => {
    entradas.forEach((e) => { if (e.isIntersecting) activar(pasos.indexOf(e.target)); });
  }, { rootMargin: "-45% 0px -45% 0px", threshold: 0 });
  pasos.forEach((p) => io.observe(p));
}
