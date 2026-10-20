// ============================================================================
// Formulario de aplicación (sección 11). Dos pasos, validación en "usted",
// calificación, envío JSON al webhook de GoHighLevel y redirección.
// ============================================================================
import { CONFIG } from "../../config.js";
import { $, $$, linkWhatsApp, esDebug } from "./utils.js";
import { track, obtenerAtribucion, varianteTitular } from "./analytics.js";
import { categoriasAceptadas } from "./consent.js";

const CAMPOS_PASO_1 = ["nombre", "whatsapp", "tienda", "instagram", "ciudad"];
const GRUPOS_PASO_2 = ["iphone_principal", "pauta_actual", "suma_1000", "utilidad", "graba", "decisor"];
const UTILIDAD_NO_CALIFICA = ["Menos de USD 60", "USD 60 a 80"];
const TIMEOUT_MS = 10000;

/** Lógica de calificación. "No sé" y "Nadie todavía" NO descalifican. */
export function calificar(r) {
  const motivos = [];
  if (r.iphone_principal === "No") motivos.push("iphone_no_es_principal");
  if (r.suma_1000 === "No") motivos.push("no_suma_1000");
  if (UTILIDAD_NO_CALIFICA.includes(r.utilidad)) motivos.push("utilidad_menor_81");
  return { califica: motivos.length === 0, motivos };
}

/** Normaliza el WhatsApp a +<indicativo><número>. Devuelve null si no es válido. */
export function normalizarWhatsApp(indicativo, numero) {
  const ind = String(indicativo || "").replace(/\D/g, "");
  const num = String(numero || "").replace(/\D/g, "");
  if (!ind || ind.length > 4) return { ok: false, motivo: "indicativo" };
  if (ind === "57") {
    if (!/^3\d{9}$/.test(num)) return { ok: false, motivo: "co" };
  } else if (!/^\d{6,14}$/.test(num)) {
    return { ok: false, motivo: "otro" };
  }
  return { ok: true, valor: `+${ind}${num}` };
}

export function iniciarFormulario() {
  const form = $("[data-form]");
  if (!form) return;
  const pasos = $$(".form__paso", form);
  const barra = $("[data-barra]", form);
  const pasoTxt = $("[data-paso-actual]", form);
  const estado = $("[data-estado]", form);
  const fallo = $("[data-fallo]", form);
  const btnEnviar = $("[data-enviar]", form);
  let pasoActual = 1;
  let iniciado = false;
  let enviando = false;
  let paso2Visto = false;

  form.addEventListener("focusin", () => {
    if (iniciado) return;
    iniciado = true;
    track("formulario_inicio", {});
  });

  // ---------- Errores accesibles ----------
  function mostrarError(id, mensaje, invalidos) {
    const p = document.getElementById(id);
    if (!p) return;
    p.textContent = mensaje;
    p.hidden = !mensaje;
    invalidos.forEach((el) => el.setAttribute("aria-invalid", mensaje ? "true" : "false"));
  }

  function validarPaso1() {
    const errores = [];
    const v = (n) => String(form.elements[n].value || "").trim();

    const nombre = v("nombre");
    const eNombre = nombre.length < 2 ? "Escriba su nombre (al menos 2 caracteres)." : "";
    mostrarError("f-nombre-error", eNombre, [form.elements.nombre]);
    if (eNombre) errores.push(form.elements.nombre);

    const tel = normalizarWhatsApp(form.elements.indicativo.value, form.elements.whatsapp.value);
    let eTel = "";
    if (!tel.ok) {
      eTel = tel.motivo === "indicativo" ? "Revise el indicativo de país, por ejemplo +57."
        : tel.motivo === "co" ? "Escriba los 10 dígitos de su celular. En Colombia empieza por 3."
        : "Revise el número: escriba solo los dígitos, sin el indicativo.";
    }
    mostrarError("f-whatsapp-error", eTel, [form.elements.indicativo, form.elements.whatsapp]);
    if (eTel) errores.push(tel.motivo === "indicativo" ? form.elements.indicativo : form.elements.whatsapp);

    const eTienda = v("tienda") ? "" : "Escriba el nombre de su tienda.";
    mostrarError("f-tienda-error", eTienda, [form.elements.tienda]);
    if (eTienda) errores.push(form.elements.tienda);

    const ig = v("instagram").replace(/^@+/, "");
    const eIg = !ig ? "Escriba el usuario de Instagram de la tienda."
      : !/^[A-Za-z0-9._]{1,30}$/.test(ig) ? "Revise el usuario: solo letras, números, puntos y guiones bajos." : "";
    mostrarError("f-instagram-error", eIg, [form.elements.instagram]);
    if (eIg) errores.push(form.elements.instagram);

    const eCiudad = v("ciudad") ? "" : "Escriba la ciudad de la tienda.";
    mostrarError("f-ciudad-error", eCiudad, [form.elements.ciudad]);
    if (eCiudad) errores.push(form.elements.ciudad);

    return errores;
  }

  function validarPaso2() {
    const errores = [];
    GRUPOS_PASO_2.forEach((g) => {
      const radios = $$(`input[name="${g}"]`, form);
      const elegido = radios.some((r) => r.checked);
      mostrarError(`e-${g}`, elegido ? "" : "Elija una opción.", radios);
      if (!elegido) errores.push(radios[0]);
    });
    const chk = form.elements.privacidad;
    const ePriv = chk.checked ? "" : "Para enviar su aplicación, acepte la política de privacidad.";
    mostrarError("e-privacidad", ePriv, [chk]);
    if (ePriv) errores.push(chk);
    return errores;
  }

  // Al corregir un campo, se limpia su error.
  form.addEventListener("input", (e) => {
    const el = e.target;
    if (el.getAttribute("aria-invalid") !== "true") return;
    const id = (el.getAttribute("aria-describedby") || "").split(" ").find((x) => /error|^e-/.test(x));
    if (el.type === "radio" || el.type === "checkbox") {
      const grupo = el.type === "radio" ? $$(`input[name="${el.name}"]`, form) : [el];
      mostrarError(el.type === "radio" ? `e-${el.name}` : "e-privacidad", "", grupo);
    } else if (id) {
      mostrarError(id, "", id === "f-whatsapp-error" ? [form.elements.indicativo, form.elements.whatsapp] : [el]);
    }
  });
  form.addEventListener("change", (e) => {
    const el = e.target;
    if (el.type === "radio") mostrarError(`e-${el.name}`, "", $$(`input[name="${el.name}"]`, form));
    if (el.type === "checkbox" && el.checked) mostrarError("e-privacidad", "", [el]);
  });

  function irAPaso(n) {
    pasoActual = n;
    pasos.forEach((p) => { p.hidden = Number(p.dataset.paso) !== n; });
    pasoTxt.textContent = String(n);
    barra.style.width = n === 1 ? "50%" : "100%";
    const activo = pasos.find((p) => Number(p.dataset.paso) === n);
    form.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
    const primero = activo && activo.querySelector("input:not([type=hidden])");
    if (primero) primero.focus({ preventScroll: true });
    if (n === 2 && !paso2Visto) { paso2Visto = true; track("formulario_paso_2", {}); }
  }

  $("[data-siguiente]", form).addEventListener("click", () => {
    const errores = validarPaso1();
    if (errores.length) { errores[0].focus(); return; }
    irAPaso(2);
  });
  $("[data-volver]", form).addEventListener("click", () => irAPaso(1));
  // Enter en el paso 1 avanza en vez de enviar.
  form.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && pasoActual === 1 && e.target.tagName === "INPUT") { e.preventDefault(); $("[data-siguiente]", form).click(); }
  });

  function respuestas() {
    const v = (n) => String(form.elements[n].value || "").trim();
    const r = {};
    r.nombre = v("nombre");
    r.whatsapp = normalizarWhatsApp(form.elements.indicativo.value, form.elements.whatsapp.value).valor || "";
    r.tienda = v("tienda");
    r.instagram = v("instagram").replace(/^@+/, "");
    r.ciudad = v("ciudad");
    GRUPOS_PASO_2.forEach((g) => { const el = form.querySelector(`input[name="${g}"]:checked`); r[g] = el ? el.value : ""; });
    r.privacidad = !!form.elements.privacidad.checked;
    return r;
  }

  function resumenWhatsApp(r) {
    return [
      "Hola, quiero aplicar a un cupo de I.C.T.",
      `Nombre: ${r.nombre}`,
      `WhatsApp: ${r.whatsapp}`,
      `Tienda: ${r.tienda}`,
      `Instagram: @${r.instagram}`,
      `Ciudad: ${r.ciudad}`,
      `¿El iPhone es lo que más venden?: ${r.iphone_principal}`,
      `Pauta actual al mes: ${r.pauta_actual}`,
      `¿Pueden sumar USD 1.000 al mes?: ${r.suma_1000}`,
      `Utilidad por iPhone: ${r.utilidad}`,
      `Quién grabaría: ${r.graba}`,
      `Quién decide: ${r.decisor}`
    ].join("\n");
  }

  async function enviarPayload(payload) {
    if (!CONFIG.webhookUrl) {
      // Desarrollo: no se envía nada.
      console.info(payload);
      avisoDev("Webhook no configurado");
      await new Promise((ok) => setTimeout(ok, 1200));
      return true;
    }
    if (esDebug()) console.info(payload);
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(CONFIG.webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: ctrl.signal
      });
      return res.ok;
    } catch {
      return false;
    } finally {
      clearTimeout(t);
    }
  }

  function avisoDev(texto) {
    const d = document.createElement("div");
    d.className = "aviso-dev";
    d.setAttribute("role", "status");
    d.textContent = texto;
    document.body.appendChild(d);
    setTimeout(() => d.remove(), 4000);
  }

  function bloquear(si) {
    enviando = si;
    btnEnviar.disabled = si;
    btnEnviar.textContent = si ? "Enviando…" : "Enviar mi aplicación";
    form.setAttribute("aria-busy", si ? "true" : "false");
  }

  async function procesar() {
    if (enviando) return;
    const errores = validarPaso2();
    if (errores.length) { errores[0].focus(); return; }
    const e1 = validarPaso1();
    if (e1.length) { irAPaso(1); e1[0].focus(); return; }

    const r = respuestas();
    const { califica, motivos } = calificar(r);
    const atrib = obtenerAtribucion();
    const payload = {
      ...r,
      califica,
      motivo_no_califica: motivos,
      variante_titular: varianteTitular(),
      ...atrib,
      pagina: location.origin + location.pathname,
      enviado_en: new Date().toISOString(),
      consentimiento: categoriasAceptadas(),
      user_agent: navigator.userAgent
    };

    fallo.hidden = true;
    estado.textContent = "";
    bloquear(true);

    // Antispam: si el campo trampa tiene texto, no se envía nada.
    const trampa = String(form.elements.sitio_web?.value || "").trim();
    const ok = trampa ? true : await enviarPayload(payload);

    if (!ok) {
      bloquear(false);
      const wa = $("[data-fallo-wa]", form);
      const link = linkWhatsApp(CONFIG.whatsappAgencia, resumenWhatsApp(r));
      if (link) { wa.href = link; wa.hidden = false; } else { wa.hidden = true; }
      fallo.hidden = false;
      fallo.setAttribute("tabindex", "-1");
      fallo.focus();
      return;
    }

    estado.textContent = "Aplicación enviada. Un momento…";
    track("aplicacion_enviada", { califica, motivo: motivos.length ? motivos.join(",") : "ninguno" });
    if (califica) track("lead_calificado", { variante_titular: varianteTitular() });

    // Pausa breve para que los píxeles alcancen a salir antes de cambiar de página.
    await new Promise((ok2) => setTimeout(ok2, 400));

    if (califica) {
      const q = new URLSearchParams();
      q.set("nombre", r.nombre);
      q.set("whatsapp", r.whatsapp);
      Object.entries(atrib).forEach(([k, v]) => q.set(k, v));
      location.href = "agenda.html?" + q.toString();
    } else {
      location.href = "no-califica.html";
    }
  }

  form.addEventListener("submit", (e) => { e.preventDefault(); procesar(); });
  $("[data-reintentar]", form).addEventListener("click", () => { fallo.hidden = true; procesar(); });
}
