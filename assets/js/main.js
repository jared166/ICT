// ============================================================================
// I.C.T. · Entrada principal. Cada bloque corre dentro de safe(): un error no
// rompe el resto. Los elementos que dependen de config.js llevan `hidden` en el
// HTML y se revelan aquí solo si hay dato.
// ============================================================================
import { CONFIG } from "../../config.js";
import { safe, $, $$, alVer, formatoNumero, movimientoReducido, pendiente, linkWhatsApp, parametro } from "./utils.js";
import { track, varianteTitular } from "./analytics.js";
import { iniciarConsentimiento } from "./consent.js";

const pagina = document.body.dataset.pagina || "";
document.documentElement.classList.add("anim");

// 1) Antes que nada: en agenda.html se leen nombre y WhatsApp a memoria y se
//    quitan de la URL, para que ningún proveedor de medición los vea.
const datosAgenda = {};
safe("agenda-url", () => {
  if (pagina !== "agenda") return;
  const url = new URL(location.href);
  ["nombre", "whatsapp"].forEach((k) => {
    if (url.searchParams.has(k)) { datosAgenda[k] = url.searchParams.get(k) || ""; url.searchParams.delete(k); }
  });
  history.replaceState(null, "", url.pathname + (url.searchParams.toString() ? "?" + url.searchParams : "") + url.hash);
});

// 2) Variante del titular
safe("variante", () => {
  document.documentElement.setAttribute("data-h", varianteTitular());
});

// 3) Consentimiento (carga la medición solo si ya hay una elección válida)
safe("consentimiento", iniciarConsentimiento);

// ---------- Encabezado: transparente sobre el hero oscuro, sólido al hacer scroll ----------
safe("cabecera", () => {
  const cab = $("[data-cabecera]");
  const hero = $(".hero");
  if (!cab) return;
  if (!hero || !("IntersectionObserver" in window)) { cab.classList.remove("cabecera--transparente"); return; }
  const marca = document.createElement("div");
  marca.style.cssText = "position:absolute;top:0;left:0;width:1px;height:24px;pointer-events:none";
  marca.setAttribute("aria-hidden", "true");
  document.body.prepend(marca);
  new IntersectionObserver(([e]) => {
    cab.classList.toggle("cabecera--transparente", e.isIntersecting);
    cab.classList.toggle("cabecera--solida", !e.isIntersecting);
  }).observe(marca);
});

// ---------- Barra fija inferior en móvil ----------
safe("barra-fija", () => {
  const barra = $("[data-barra-fija]");
  const hero = $(".hero");
  const aplicar = $("#aplicar");
  if (!barra || !hero || !("IntersectionObserver" in window)) return;
  let pasoHero = false, enAplicar = false, cookies = document.documentElement.classList.contains("cookies-abierto");
  const link = barra.querySelector("a");
  const actualizar = () => {
    const ver = pasoHero && !enAplicar && !cookies;
    barra.classList.toggle("visible", ver);
    barra.setAttribute("aria-hidden", ver ? "false" : "true");
    if (link) link.tabIndex = ver ? 0 : -1;
  };
  new IntersectionObserver(([e]) => { pasoHero = !e.isIntersecting && e.boundingClientRect.top < 0; actualizar(); }).observe(hero);
  if (aplicar) new IntersectionObserver(([e]) => { enAplicar = e.isIntersecting; actualizar(); }, { threshold: 0.08 }).observe(aplicar);
  document.addEventListener("ict:cookies", (e) => { cookies = e.detail.abierto; actualizar(); });
});

// ---------- Clics en "Aplicar a un cupo" ----------
safe("cta", () => {
  document.addEventListener("click", (e) => {
    const a = e.target.closest("[data-cta]");
    if (a) track("cta_click", { ubicacion: a.dataset.cta });
  });
});

// ---------- Secciones vistas (50% en pantalla, una vez) ----------
safe("secciones", () => {
  const secciones = $$("[data-seccion]");
  if (!secciones.length || !("IntersectionObserver" in window)) return;
  const umbrales = Array.from({ length: 21 }, (_, i) => i / 20);
  const io = new IntersectionObserver((entradas) => {
    entradas.forEach((e) => {
      if (!e.isIntersecting) return;
      // 50% de la sección, o la mitad de la pantalla si la sección es más alta que dos pantallas
      const alto = Math.min(e.boundingClientRect.height, window.innerHeight);
      if (e.intersectionRect.height >= alto * 0.5) {
        io.unobserve(e.target);
        track("seccion_vista", { seccion: e.target.dataset.seccion });
      }
    });
  }, { threshold: umbrales });
  secciones.forEach((s) => io.observe(s));
});

// ---------- Profundidad de scroll (25/50/75/90) con marcadores, sin listeners de scroll ----------
safe("scroll", () => {
  if (!("IntersectionObserver" in window) || pagina !== "inicio") return;
  document.body.style.position = "relative";
  const io = new IntersectionObserver((entradas) => {
    entradas.forEach((e) => {
      if (e.isIntersecting) { io.unobserve(e.target); track("scroll_profundidad", { porcentaje: Number(e.target.dataset.pct) }); }
    });
  });
  [25, 50, 75, 90].forEach((pct) => {
    const m = document.createElement("div");
    m.dataset.pct = pct;
    m.setAttribute("aria-hidden", "true");
    m.style.cssText = `position:absolute;left:0;top:${pct}%;width:1px;height:1px;pointer-events:none`;
    document.body.appendChild(m);
    io.observe(m);
  });
});

// ---------- Apariciones suaves ----------
safe("apariciones", () => {
  const els = $$(".aparece");
  if (movimientoReducido() || !("IntersectionObserver" in window)) { els.forEach((el) => el.classList.add("visible")); return; }
  const io = new IntersectionObserver((entradas) => {
    entradas.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("visible"); io.unobserve(e.target); } });
  }, { rootMargin: "0px 0px -8% 0px", threshold: 0.05 });
  els.forEach((el) => io.observe(el));
});

// ---------- Números que cuentan al entrar en pantalla ----------
safe("conteos", () => {
  const els = $$("[data-contar]");
  if (movimientoReducido()) return; // se muestran directamente los valores finales
  els.forEach((el) => {
    const fin = Number(el.dataset.contar);
    const dec = Number(el.dataset.decimales || 0);
    const rect = el.getBoundingClientRect();
    if (rect.top < window.innerHeight && rect.bottom > 0) return; // ya visible al cargar: no se anima
    el.textContent = formatoNumero(0, dec);
    alVer(el, () => {
      const dur = 1400, t0 = performance.now();
      const paso = (t) => {
        const k = Math.min(1, (t - t0) / dur);
        const e = 1 - Math.pow(1 - k, 3);
        el.textContent = formatoNumero(fin * e, dec);
        if (k < 1) requestAnimationFrame(paso); else el.textContent = formatoNumero(fin, dec);
      };
      requestAnimationFrame(paso);
    }, { threshold: 0.6 });
  });
});

// ---------- Mapa I · C · T: hexágonos que aparecen uno por uno ----------
safe("ict-mapa", () => {
  const mapa = $("[data-ict-mapa]");
  if (!mapa) return;
  if (movimientoReducido()) { mapa.classList.add("visible"); return; }
  alVer(mapa, () => mapa.classList.add("visible"), { threshold: 0.25 });
});

// ---------- Preguntas frecuentes ----------
safe("faq", () => {
  $$("[data-faq]").forEach((d) => {
    d.addEventListener("toggle", () => { if (d.open) track("faq_abierta", { pregunta: d.dataset.faq }); });
  });
});

// ---------- Bloques que dependen de config.js ----------
safe("cupos", () => {
  const cupos = Array.isArray(CONFIG.cupos) ? CONFIG.cupos.filter((c) => c && c.ciudad && Number.isFinite(Number(c.disponibles))) : [];
  if (!cupos.length) return;
  $$("[data-cupos]").forEach((ul) => {
    ul.innerHTML = "";
    cupos.forEach((c) => {
      const n = Math.max(0, Math.floor(Number(c.disponibles)));
      const li = document.createElement("li");
      li.textContent = n === 0 ? `${c.ciudad}: completo` : `${c.ciudad}: ${n} ${n === 1 ? "cupo disponible" : "cupos disponibles"}`;
      if (n === 0) li.className = "completo";
      ul.appendChild(li);
    });
    ul.hidden = false;
  });
});

safe("precio-continuidad", () => {
  const v = Number(CONFIG.precioContinuidad);
  $$("[data-cfg-precio-continuidad]").forEach((el) => {
    if (Number.isFinite(v) && v > 0) el.textContent = formatoNumero(v);
  });
});

safe("captura-caso", () => {
  const fig = $("[data-captura-caso]");
  if (!fig || !CONFIG.capturaCaso) return;
  const img = fig.querySelector("img");
  img.addEventListener("load", () => { fig.hidden = false; }, { once: true });
  img.src = CONFIG.capturaCaso;
});

// Video del hero: portada propia y botón de play; el iframe se carga solo al hacer clic.
safe("video", () => {
  const caja = $("[data-video]");
  const url = String(CONFIG.videoHero || "").trim();
  if (!caja || !url) return;
  const demo = $("[data-demo]");
  const slot = $("[data-demo-slot]");
  if (demo && slot) { slot.appendChild(demo); slot.hidden = false; }
  caja.hidden = false;
  const embed = urlEmbed(url);
  $("[data-video-play]", caja).addEventListener("click", () => {
    if (embed.tipo === "mp4") {
      caja.innerHTML = `<video src="${embed.src}" controls autoplay playsinline></video>`;
    } else {
      caja.innerHTML = `<iframe src="${embed.src}" title="Video de I.C.T." allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen loading="lazy"></iframe>`;
    }
  }, { once: true });
});

function urlEmbed(url) {
  try {
    const u = new URL(url, location.href);
    if (/\.mp4($|\?)/i.test(u.pathname)) return { tipo: "mp4", src: u.href };
    if (/youtu\.be$/.test(u.hostname)) return { tipo: "yt", src: `https://www.youtube-nocookie.com/embed/${u.pathname.slice(1)}?autoplay=1&rel=0` };
    if (/youtube\.com$/.test(u.hostname)) {
      const id = u.searchParams.get("v") || u.pathname.split("/").pop();
      return { tipo: "yt", src: `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0` };
    }
    if (/vimeo\.com$/.test(u.hostname)) {
      const id = u.pathname.split("/").filter(Boolean).pop();
      return { tipo: "vimeo", src: `https://player.vimeo.com/video/${id}?autoplay=1&dnt=1` };
    }
    return { tipo: "otro", src: u.href };
  } catch { return { tipo: "otro", src: url }; }
}

// ---------- Pie: contacto, prestador y año ----------
safe("pie", () => {
  const wa = linkWhatsApp(CONFIG.whatsappAgencia);
  const email = String(CONFIG.emailContacto || "").trim();
  const contacto = $("[data-contacto]");
  if (contacto && (wa || email)) {
    if (wa) {
      const a = $("[data-wa-link]", contacto);
      a.href = wa; a.hidden = false;
      $("[data-wa-num]", contacto).textContent = "+" + String(CONFIG.whatsappAgencia).replace(/\D/g, "");
    }
    if (email) {
      const a = $("[data-email-link]", contacto);
      a.href = "mailto:" + email; a.textContent = email; a.hidden = false;
    }
    if (wa && email) $("[data-contacto-sep]", contacto).hidden = false;
    contacto.hidden = false;
  }
  const p = CONFIG.prestador || {};
  const txt = $("[data-prestador-texto]");
  if (txt && !pendiente(p.nombre) && !pendiente(p.nif) && !pendiente(p.domicilio)) {
    txt.textContent = `${p.nombre}, NIF ${p.nif}, ${p.domicilio}`;
  }
  $$("[data-anio]").forEach((el) => { el.textContent = String(new Date().getFullYear()); });
});

// ---------- Páginas legales: aviso de borrador, datos del prestador y versión ----------
safe("legal", () => {
  if (CONFIG.legalRevisado) $$("[data-borrador]").forEach((el) => { el.hidden = true; });
  const p = CONFIG.prestador || {};
  $$("[data-cfg-prestador]").forEach((el) => {
    const v = p[el.dataset.cfgPrestador];
    if (v != null && String(v).trim() !== "") {
      el.textContent = v;
      el.classList.toggle("pendiente", pendiente(v));
    }
  });
  $$("[data-cfg-version]").forEach((el) => { if (CONFIG.versionPoliticas) el.textContent = fechaLegible(CONFIG.versionPoliticas); });
});

function fechaLegible(iso) {
  const meses = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? `${Number(m[3])} de ${meses[Number(m[2]) - 1]} de ${m[1]}` : iso;
}

// ---------- WhatsApp en páginas simples (no califica, agenda sin calendario) ----------
safe("wa-simple", () => {
  $$("[data-wa-agencia]").forEach((a) => {
    let texto = a.dataset.waTexto || "";
    const nombre = (datosAgenda.nombre || "").trim().slice(0, 60);
    if (texto && nombre) texto = texto.replace(/^Hola\./, `Hola, soy ${nombre}.`);
    const link = linkWhatsApp(CONFIG.whatsappAgencia, texto);
    if (link) { a.href = link; a.hidden = false; }
  });
});

// ---------- agenda.html ----------
safe("agenda", () => {
  if (pagina !== "agenda") return;
  const caja = $("[data-calendario]");
  const placeholder = $("[data-calendario-pendiente]");
  const url = String(CONFIG.calendarioUrl || "").trim();
  if (caja && url && /^https:\/\//i.test(url)) {
    // Sin prellenado de nombre y teléfono: GoHighLevel no documenta parámetros
    // de prellenado para el embed del calendario [VERIFICAR].
    const iframe = document.createElement("iframe");
    iframe.className = "calendario-embed";
    iframe.src = url;
    iframe.title = "Calendario para agendar la videollamada de 30 minutos";
    iframe.loading = "eager";
    iframe.setAttribute("scrolling", "yes");
    caja.appendChild(iframe);
    caja.hidden = false;
    if (placeholder) placeholder.hidden = true;
  }
  track("agenda_vista", {});
});

// ---------- Módulos interactivos (se cargan solo si la página los usa) ----------
safe("modulos", () => {
  if ($("[data-demo]")) import("./demo.js").then((m) => safe("demo", m.iniciarDemo)).catch(() => {});
  if ($("[data-scrolly]")) import("./scrolly.js").then((m) => safe("scrolly", m.iniciarScrolly)).catch(() => {});
  if ($("[data-calc]")) import("./calculator.js").then((m) => safe("calculadora", m.iniciarCalculadora)).catch(() => {});
  if ($("[data-form]")) import("./form.js").then((m) => safe("formulario", m.iniciarFormulario)).catch(() => {});
});

if (parametro("debug") === "1") console.info("[ict] variante", varianteTitular(), "· página", pagina);
