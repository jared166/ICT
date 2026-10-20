// Mini cotizadora del hero ("Demostración"). Se puede tocar; si nadie interactúa,
// se repite en bucle suave mientras está en pantalla. Con movimiento reducido se
// muestra directamente el estado final, sin bucle.
import { $, $$, movimientoReducido } from "./utils.js";
import { track } from "./analytics.js";

const TEXTO = (modelo) => `Hola, quiero el ${modelo} de 256 GB. Pago de contado.`;

export function iniciarDemo() {
  const demo = $("[data-demo]");
  if (!demo) return;
  const chips = $$(".chip", demo);
  const precio = $("[data-demo-precio]", demo);
  const wa = $("[data-demo-wa]", demo);
  const burbuja = $("[data-demo-burbuja]", demo);
  const texto = $("[data-demo-texto]", demo);
  demo.classList.add("demo--activa");

  let usuario = false;
  let timers = [];
  let visible = false;
  let enCurso = false;
  const pasosVistos = new Set();

  const limpiarTimers = () => { timers.forEach(clearTimeout); timers = []; };

  function elegir(chip) {
    chips.forEach((c) => c.setAttribute("aria-pressed", String(c === chip)));
    precio.classList.add("visible");
    wa.disabled = false;
    burbuja.classList.remove("visible");
    texto.textContent = TEXTO(chip.dataset.modelo);
  }
  function enviar() {
    burbuja.classList.add("visible");
  }
  function reiniciar() {
    chips.forEach((c) => c.setAttribute("aria-pressed", "false"));
    precio.classList.remove("visible");
    wa.disabled = true;
    burbuja.classList.remove("visible");
  }
  function pulso(el) {
    el.classList.remove("pulso"); void el.offsetWidth; el.classList.add("pulso");
  }

  function ciclo() {
    if (usuario || !visible) { enCurso = false; return; }
    enCurso = true;
    const pro = chips[1] || chips[0];
    timers.push(setTimeout(() => { pulso(pro); elegir(pro); }, 900));
    timers.push(setTimeout(() => { pulso(wa); }, 2300));
    timers.push(setTimeout(() => { enviar(); }, 2700));
    timers.push(setTimeout(() => { reiniciar(); }, 7200));
    timers.push(setTimeout(ciclo, 8000));
  }

  const tomarControl = () => {
    if (usuario) return;
    usuario = true;
    limpiarTimers();
    enCurso = false;
  };

  chips.forEach((chip) => chip.addEventListener("click", () => {
    tomarControl();
    elegir(chip);
    if (!pasosVistos.has("modelo")) { pasosVistos.add("modelo"); track("demo_cotizadora", { paso: "modelo" }); }
  }));
  wa.addEventListener("click", () => {
    tomarControl();
    enviar();
    if (!pasosVistos.has("whatsapp")) { pasosVistos.add("whatsapp"); track("demo_cotizadora", { paso: "whatsapp" }); }
  });

  if (movimientoReducido()) {
    elegir(chips[1] || chips[0]);
    enviar();
    return;
  }

  reiniciar();
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      if (visible && !usuario && !enCurso) ciclo();
      if (!visible) { limpiarTimers(); enCurso = false; if (!usuario) reiniciar(); }
    }, { threshold: 0.3 }).observe(demo);
  } else {
    visible = true; ciclo();
  }
}
