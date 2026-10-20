// ============================================================================
// Consentimiento de cookies propio (LSSI art. 22.2, RGPD, Guía de cookies AEPD).
// - Antes de elegir no se carga ningún script de medición ni se escribe nada
//   que no sea técnico. Hacer scroll o seguir navegando NO es consentimiento.
// - Primera capa: Aceptar todas · Rechazar todas · Configurar (misma jerarquía).
// - Segunda capa: categorías desactivadas por defecto + Guardar selección.
// - Registro técnico en localStorage "ict_consent_v1": categorías, fecha y
//   versión de políticas. Se vuelve a pedir a los 24 meses o si cambia la versión.
// ============================================================================
import { CONFIG } from "../../config.js";
import { aplicarConsentimiento, actualizarSenales } from "./analytics.js";

const CLAVE = "ict_consent_v1";
const VIGENCIA_MESES = 24;

let estado = null;      // elección vigente aplicada en esta página
let banner = null;
let panel = null;

function leer() {
  try {
    const raw = localStorage.getItem(CLAVE);
    if (!raw) return null;
    const d = JSON.parse(raw);
    if (!d || d.version !== CONFIG.versionPoliticas || !d.fecha) return null;
    const limite = new Date(d.fecha);
    limite.setMonth(limite.getMonth() + VIGENCIA_MESES);
    if (isNaN(limite) || limite < new Date()) return null;
    return { analiticas: !!d.categorias?.analiticas, publicidad: !!d.categorias?.publicidad, fecha: d.fecha };
  } catch { return null; }
}

function escribir(cats) {
  const registro = { categorias: { tecnicas: true, analiticas: !!cats.analiticas, publicidad: !!cats.publicidad }, fecha: new Date().toISOString(), version: CONFIG.versionPoliticas };
  try { localStorage.setItem(CLAVE, JSON.stringify(registro)); } catch { /* almacenamiento bloqueado: se vuelve a preguntar en la próxima página */ }
}

/** Categorías aceptadas, para el payload del formulario. */
export function categoriasAceptadas() {
  const c = ["tecnicas"];
  if (estado?.analiticas) c.push("analiticas");
  if (estado?.publicidad) c.push("publicidad");
  return c;
}

function marcarAbierto(abierto) {
  document.documentElement.classList.toggle("cookies-abierto", abierto);
  document.dispatchEvent(new CustomEvent("ict:cookies", { detail: { abierto } }));
}

// ---------- Borrado de cookies de terceros (las que se pueden desde este dominio) ----------
const PATRONES = [/^_ga/, /^_gid$/, /^_gat/, /^_gcl_/, /^_clck$/, /^_clsk$/, /^CLID$/, /^ANONCHK$/, /^MR$/, /^MUID$/, /^SM$/, /^_fbp$/, /^_fbc$/];
function borrarCookies() {
  const nombres = document.cookie.split(";").map((c) => c.split("=")[0].trim()).filter(Boolean);
  const partes = location.hostname.split(".");
  const dominios = [""];
  for (let i = 0; i < partes.length - 1; i++) dominios.push("." + partes.slice(i).join("."));
  nombres.filter((n) => PATRONES.some((p) => p.test(n))).forEach((n) => {
    dominios.forEach((d) => {
      document.cookie = `${n}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/` + (d ? `; domain=${d}` : "");
    });
  });
}

function guardar(cats) {
  const previo = estado;
  escribir(cats);
  const retira = previo && ((previo.analiticas && !cats.analiticas) || (previo.publicidad && !cats.publicidad));
  if (retira) {
    actualizarSenales(cats);
    borrarCookies();
    location.reload();
    return;
  }
  estado = { analiticas: !!cats.analiticas, publicidad: !!cats.publicidad };
  aplicarConsentimiento(estado);
  cerrarBanner();
  cerrarPanel();
}

// ---------- Primera capa ----------
function crearBanner() {
  const el = document.createElement("section");
  el.className = "cookies";
  el.setAttribute("aria-label", "Aviso de cookies");
  el.innerHTML = `
    <p>Este sitio es de I.C.T. by Marketing Masters Group (vea el <a href="aviso-legal.html">aviso legal</a>). Usamos cookies técnicas, necesarias para que funcione, y, solo si usted lo acepta, cookies analíticas y de publicidad para medir las visitas y mejorar nuestros anuncios. Más información en la <a href="cookies.html">política de cookies</a>.</p>
    <div class="cookies__botones">
      <button type="button" class="boton" data-ck="aceptar">Aceptar todas</button>
      <button type="button" class="boton" data-ck="rechazar">Rechazar todas</button>
      <button type="button" class="boton" data-ck="configurar">Configurar</button>
    </div>`;
  el.addEventListener("click", (e) => {
    const b = e.target.closest("[data-ck]");
    if (!b) return;
    const acc = b.dataset.ck;
    if (acc === "aceptar") guardar({ analiticas: true, publicidad: true });
    else if (acc === "rechazar") guardar({ analiticas: false, publicidad: false });
    else abrirPanel();
  });
  const skip = document.querySelector(".skip");
  if (skip) skip.after(el); else document.body.prepend(el);
  return el;
}

function mostrarBanner() {
  banner = banner || crearBanner();
  banner.hidden = false;
  marcarAbierto(true);
}
function cerrarBanner() {
  if (banner) banner.hidden = true;
  marcarAbierto(false);
}

// ---------- Segunda capa ----------
function crearPanel() {
  const d = document.createElement("dialog");
  d.className = "panel-cookies";
  d.setAttribute("aria-labelledby", "ck-titulo");
  d.innerHTML = `
    <button type="button" class="panel-cookies__cerrar" data-ck-cerrar aria-label="Cerrar">×</button>
    <div class="panel-cookies__cuerpo">
      <h2 id="ck-titulo">Configuración de cookies</h2>
      <p>Elija qué cookies acepta. Puede cambiar o retirar su elección cuando quiera desde "Configurar cookies", al pie de cada página. Detalle completo en la <a href="cookies.html">política de cookies</a>.</p>

      <div class="categoria">
        <div class="categoria__fila">
          <h3 id="ck-tec">Técnicas</h3>
          <span class="interruptor"><input type="checkbox" role="switch" checked disabled aria-labelledby="ck-tec" aria-describedby="ck-tec-d"><span></span></span>
        </div>
        <p id="ck-tec-d">Siempre activas. Guardan su elección sobre cookies para que el sitio funcione. <span class="prov">Proveedor: este sitio (propia).</span></p>
      </div>

      <div class="categoria">
        <div class="categoria__fila">
          <h3 id="ck-ana">Analíticas</h3>
          <span class="interruptor"><input type="checkbox" role="switch" data-ck-cat="analiticas" aria-labelledby="ck-ana" aria-describedby="ck-ana-d"><span></span></span>
        </div>
        <p id="ck-ana-d">Miden cómo se usa la página (secciones vistas, clics y profundidad de scroll, con mapas de calor y grabaciones de la navegación) para mejorarla. <span class="prov">Proveedores: Google (Google Analytics 4) y Microsoft (Clarity).</span></p>
      </div>

      <div class="categoria">
        <div class="categoria__fila">
          <h3 id="ck-pub">Publicidad</h3>
          <span class="interruptor"><input type="checkbox" role="switch" data-ck-cat="publicidad" aria-labelledby="ck-pub" aria-describedby="ck-pub-d"><span></span></span>
        </div>
        <p id="ck-pub-d">Miden qué anuncios traen aplicaciones y permiten mostrar anuncios más relevantes. <span class="prov">Proveedor: Meta Platforms (píxel de Meta).</span></p>
      </div>
    </div>
    <div class="panel-cookies__pie">
      <button type="button" class="boton" data-ck-panel="aceptar">Aceptar todas</button>
      <button type="button" class="boton" data-ck-panel="rechazar">Rechazar todas</button>
      <button type="button" class="boton boton--guardar" data-ck-panel="guardar">Guardar selección</button>
    </div>`;
  d.addEventListener("click", (e) => {
    if (e.target === d) { cerrarPanel(); return; } // clic en el fondo
    if (e.target.closest("[data-ck-cerrar]")) { cerrarPanel(); return; }
    const b = e.target.closest("[data-ck-panel]");
    if (!b) return;
    const acc = b.dataset.ckPanel;
    if (acc === "aceptar") guardar({ analiticas: true, publicidad: true });
    else if (acc === "rechazar") guardar({ analiticas: false, publicidad: false });
    else guardar({
      analiticas: d.querySelector('[data-ck-cat="analiticas"]').checked,
      publicidad: d.querySelector('[data-ck-cat="publicidad"]').checked
    });
  });
  d.addEventListener("close", () => { if (!estado) mostrarBanner(); else marcarAbierto(false); });
  document.body.appendChild(d);
  return d;
}

export function abrirPanel() {
  panel = panel || crearPanel();
  panel.querySelector('[data-ck-cat="analiticas"]').checked = !!estado?.analiticas;
  panel.querySelector('[data-ck-cat="publicidad"]').checked = !!estado?.publicidad;
  if (banner) banner.hidden = true;
  marcarAbierto(true);
  if (typeof panel.showModal === "function") { if (!panel.open) panel.showModal(); }
  else panel.setAttribute("open", "");
  const primero = panel.querySelector('[data-ck-cat="analiticas"]');
  if (primero) primero.focus();
}
function cerrarPanel() {
  if (panel && panel.open) panel.close();
}

export function iniciarConsentimiento() {
  const guardado = leer();
  if (guardado) {
    estado = { analiticas: guardado.analiticas, publicidad: guardado.publicidad };
    aplicarConsentimiento(estado);
  } else {
    mostrarBanner();
  }
  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-abrir-cookies]");
    if (b) { e.preventDefault(); abrirPanel(); }
  });
}
