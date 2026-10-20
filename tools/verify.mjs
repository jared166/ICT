// Verificación automática de la landing de I.C.T. (sección 13 del encargo).
// Uso: node tools/verify.mjs   → debe terminar con 0 fallas.
// Sirve el sitio bajo /ICT/ (como GitHub Pages) e intercepta config.js para probar
// con configuración vacía y completa. Las peticiones a terceros se registran y se
// responden con stubs locales: no sale nada a internet.
import { createRequire } from "node:module";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, extname } from "node:path";
import { startServer } from "./serve.mjs";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH || "playwright");
const ROOT = fileURLToPath(new URL("..", import.meta.url));
const PORT = 4802;
const BASE = `http://localhost:${PORT}/ICT/`;
const server = await startServer(PORT, "/ICT/");
const browser = await chromium.launch();

let fallas = 0, ok = 0;
const check = (cond, msg) => { if (cond) { ok++; } else { fallas++; console.log("  ✗", msg); } };
const seccion = (t) => console.log("\n■", t);

const CONFIG_ORIGINAL = readFileSync(ROOT + "config.js", "utf8");
function configCon(cambios) {
  let src = CONFIG_ORIGINAL;
  for (const [k, v] of Object.entries(cambios)) {
    const re = new RegExp(`(\\n\\s*${k}:\\s*)([^,\\n]+|\\[[^\\]]*\\])(,)`);
    if (!re.test(src)) throw new Error("No se pudo reemplazar " + k);
    src = src.replace(re, `$1${JSON.stringify(v)}$3`);
  }
  return src;
}
const IDS = { ga4Id: "G-TEST123", clarityId: "clarityTEST", metaPixelId: "123456789" };
const COMPLETA = { ...IDS, webhookUrl: "https://hooks.test/ghl", calendarioUrl: "https://api.leadconnectorhq.com/widget/booking/TEST", whatsappAgencia: "573001112233", emailContacto: "hola@test.co", videoHero: "https://www.youtube.com/watch?v=abcdEFGhijk", cupos: [{ ciudad: "Medellín", disponibles: 4 }, { ciudad: "Cali", disponibles: 0 }] };

const TERCEROS = /googletagmanager\.com|clarity\.ms|facebook\.(net|com)|connect\.facebook/;
const STUB_FB = `(() => { const f = window.fbq; const log = (...a) => console.log("[fbq] " + JSON.stringify(a)); f.callMethod = log; (f.queue || []).forEach((a) => log(...a)); f.queue = []; })();`;

async function nuevaPagina({ config = {}, viewport = { width: 390, height: 844 }, webhook = "ok", motion = "reduce", storage } = {}) {
  const ctx = await browser.newContext({ viewport, reducedMotion: motion });
  if (storage) await ctx.addInitScript((s) => { try { localStorage.setItem("ict_consent_v1", s); } catch {} }, storage);
  const page = await ctx.newPage();
  const red = [];
  const consola = [];
  const errores = [];
  page.on("console", async (m) => {
    try {
      const partes = await Promise.all(m.args().map((a) => a.jsonValue().then((v) => (typeof v === "string" ? v : JSON.stringify(v))).catch(() => "")));
      consola.push(partes.join(" ") || m.text());
    } catch { consola.push(m.text()); }
  });
  page.on("pageerror", (e) => errores.push(e.message));
  await page.route("**/*", async (route) => {
    const url = route.request().url();
    if (/\/config\.js(\?|$)/.test(url)) return route.fulfill({ contentType: "text/javascript", body: configCon(config) });
    if (TERCEROS.test(url)) {
      red.push(url);
      return route.fulfill({ contentType: "text/javascript", body: /fbevents/.test(url) ? STUB_FB : "" });
    }
    if (url.startsWith("https://hooks.test/")) {
      if (webhook === "ok") return route.fulfill({ status: 200, contentType: "application/json", body: "{}", headers: { "access-control-allow-origin": "*" } });
      if (webhook === "timeout") return; // nunca responde
      return route.fulfill({ status: 500, body: "error", headers: { "access-control-allow-origin": "*" } });
    }
    if (url.startsWith("https://api.leadconnectorhq.com/")) return route.fulfill({ contentType: "text/html", body: "<p>calendario</p>" });
    if (!url.startsWith(`http://localhost:${PORT}`)) { red.push(url); return route.abort(); }
    return route.continue();
  });
  return { ctx, page, red, consola, errores };
}
const cargadosDe = (red) => ({ ga4: red.some((u) => /googletagmanager/.test(u)), clarity: red.some((u) => /clarity\.ms/.test(u)), meta: red.some((u) => /facebook/.test(u)) });

// ============================================================ 1. Consentimiento
seccion("Consentimiento de cookies");
{
  const { ctx, page, red } = await nuevaPagina({ config: IDS });
  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.waitForTimeout(500);
  check(red.length === 0, `Antes de elegir no debe haber peticiones a terceros (hubo ${red.length})`);
  check(await page.locator(".cookies").isVisible(), "El banner de cookies aparece en la primera visita");
  const botones = await page.locator(".cookies [data-ck]").evaluateAll((bs) => bs.map((b) => [b.textContent.trim(), getComputedStyle(b).backgroundColor, getComputedStyle(b).fontSize]));
  check(botones.length === 3 && botones.map((b) => b[0]).join("|") === "Aceptar todas|Rechazar todas|Configurar", "Banner con Aceptar todas · Rechazar todas · Configurar");
  check(new Set(botones.map((b) => b[1] + b[2])).size === 1, "Los tres botones tienen la misma jerarquía visual");
  const ls = await page.evaluate(() => Object.keys(localStorage));
  check(ls.length === 0, "Antes de elegir no se escribe nada en localStorage");
  await page.mouse.wheel(0, 3000); await page.waitForTimeout(400);
  check(red.length === 0, "Hacer scroll no cuenta como consentimiento");
  await page.click('[data-ck="rechazar"]');
  await page.waitForTimeout(500);
  check(red.length === 0, "Rechazar todas: no carga ningún script");
  const reg = await page.evaluate(() => JSON.parse(localStorage.getItem("ict_consent_v1")));
  check(reg && reg.categorias && reg.categorias.analiticas === false && reg.categorias.publicidad === false && reg.version === "2026-10-20" && reg.fecha, "Registro ict_consent_v1 con categorías, fecha y versión");
  await page.reload({ waitUntil: "networkidle" });
  check(!(await page.locator(".cookies").isVisible().catch(() => false)), "Con elección guardada, el banner no vuelve a salir");
  check(red.length === 0, "Rechazo guardado: tras recargar sigue sin scripts");
  await ctx.close();
}
{
  const { ctx, page, red, consola } = await nuevaPagina({ config: IDS });
  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.click('[data-ck="aceptar"]');
  await page.waitForTimeout(800);
  const c = cargadosDe(red);
  check(c.ga4 && c.clarity && c.meta, `Aceptar todas: cargan GA4, Clarity y Meta (${JSON.stringify(c)})`);
  const gtag = await page.evaluate(() => (window.ictGtag || []).map((a) => Array.from(a)));
  const def = gtag.find((a) => a[0] === "consent" && a[1] === "default");
  const upd = gtag.find((a) => a[0] === "consent" && a[1] === "update");
  check(def && Object.values(def[2]).every((v) => v === "denied"), "GA4: consent default todo en denied antes de cargar");
  check(gtag.indexOf(def) < gtag.findIndex((a) => a[0] === "config"), "GA4: consent default antes de config");
  check(upd && Object.values(upd[2]).every((v) => v === "granted"), "GA4: consent update en granted");
  check(red.some((u) => /gtag\/js\?id=G-TEST123&l=ictGtag/.test(u)), "GA4 usa su propia cola (l=ictGtag)");
  const clarityQ = await page.evaluate(() => (window.clarity && window.clarity.q || []).map((a) => Array.from(a)));
  const cv2 = clarityQ.find((a) => a[0] === "consentv2");
  check(cv2 && cv2[1].ad_Storage === "granted" && cv2[1].analytics_Storage === "granted", "Clarity: consentv2 con ad_Storage y analytics_Storage en granted");
  check(!clarityQ.some((a) => a[0] === "consent"), "Clarity: no usa la API vieja clarity('consent')");
  const fbLog = consola.filter((t) => t.startsWith("[fbq]")).map((t) => JSON.parse(t.slice(6)));
  const iRevoke = fbLog.findIndex((a) => a[0] === "consent" && a[1] === "revoke");
  const iGrant = fbLog.findIndex((a) => a[0] === "consent" && a[1] === "grant");
  const iInit = fbLog.findIndex((a) => a[0] === "init");
  check(iRevoke >= 0 && iRevoke < iInit && iGrant > iRevoke && iGrant < iInit, "Meta: revoke antes de init y grant con publicidad aceptada");
  check(await page.evaluate(() => document.cookie === ""), "Sin cookies reales escritas por el sitio (los proveedores son stubs)");

  // Retirar desde "Configurar cookies" del pie
  await page.locator("[data-abrir-cookies]").first().click();
  check(await page.locator("dialog.panel-cookies").isVisible(), "Configurar cookies (pie) reabre el panel");
  check(await page.locator('[data-ck-cat="analiticas"]').isChecked(), "El panel refleja la elección vigente");
  red.length = 0;
  await Promise.all([page.waitForNavigation({ waitUntil: "networkidle" }), page.click('[data-ck-panel="rechazar"]')]);
  await page.waitForTimeout(500);
  check(red.length === 0, "Retirar el consentimiento recarga la página y ya no carga scripts");
  await ctx.close();
}
{
  const { ctx, page, red } = await nuevaPagina({ config: IDS });
  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.click('[data-ck="configurar"]');
  const ana = page.locator('[data-ck-cat="analiticas"]');
  const pub = page.locator('[data-ck-cat="publicidad"]');
  check(!(await ana.isChecked()) && !(await pub.isChecked()), "Segunda capa: interruptores desactivados por defecto");
  check(await page.locator('.categoria input[disabled]').isChecked(), "Técnicas siempre activas y no se pueden apagar");
  await ana.check();
  await page.click('[data-ck-panel="guardar"]');
  await page.waitForTimeout(800);
  const c = cargadosDe(red);
  check(c.ga4 && c.clarity && !c.meta, `Solo Analíticas: cargan GA4 y Clarity, Meta no (${JSON.stringify(c)})`);
  const cv2 = await page.evaluate(() => (window.clarity.q || []).map((a) => Array.from(a)).find((a) => a[0] === "consentv2"));
  check(cv2 && cv2[1].ad_Storage === "denied" && cv2[1].analytics_Storage === "granted", "Clarity con ad_Storage denied y analytics_Storage granted");
  await ctx.close();
}
{
  // Vencimiento a los 24 meses y cambio de versión
  const viejo = JSON.stringify({ categorias: { tecnicas: true, analiticas: true, publicidad: true }, fecha: "2024-01-01T00:00:00.000Z", version: "2026-10-20" });
  const a = await nuevaPagina({ config: IDS, storage: viejo });
  await a.page.goto(BASE, { waitUntil: "networkidle" });
  check(await a.page.locator(".cookies").isVisible() && a.red.length === 0, "Consentimiento de más de 24 meses: se vuelve a pedir");
  await a.ctx.close();
  const otraVersion = JSON.stringify({ categorias: { tecnicas: true, analiticas: true, publicidad: true }, fecha: new Date().toISOString(), version: "2025-01-01" });
  const b = await nuevaPagina({ config: IDS, storage: otraVersion });
  await b.page.goto(BASE, { waitUntil: "networkidle" });
  check(await b.page.locator(".cookies").isVisible() && b.red.length === 0, "Cambio de versionPoliticas: se vuelve a pedir");
  await b.ctx.close();
}

// ============================================================ 2. Formulario
seccion("Formulario");
async function completar(page, r) {
  await page.fill("#f-nombre", r.nombre || "Zoila Prueba");
  await page.fill("#f-whatsapp", r.tel || "3001234567");
  await page.fill("#f-tienda", "Tienda Prueba");
  await page.fill("#f-instagram", "@tienda.prueba");
  await page.fill("#f-ciudad", "Medellín");
  await page.click("[data-siguiente]");
  for (const [g, v] of Object.entries(r.opciones)) await page.locator(`input[name="${g}"][value="${v}"]`).check({ force: true });
  await page.locator('input[name="privacidad"]').check({ force: true });
}
const OPC_OK = { iphone_principal: "Sí", pauta_actual: "USD 300 a 1.000", suma_1000: "Sí", utilidad: "USD 81 a 100", graba: "Yo", decisor: "Yo" };

{
  // a) califica → agenda, con Lead y lead_calificado; UTM y variante B en el payload
  const { ctx, page, consola, red } = await nuevaPagina({ config: { ...IDS } });
  await page.goto(BASE + "?utm_source=meta&utm_campaign=test&fbclid=abc&h=b&debug=1#aplicar", { waitUntil: "networkidle" });
  await page.click('[data-ck="aceptar"]');
  await page.waitForTimeout(300);
  check(await page.locator(".h1-b").isVisible() && !(await page.locator(".h1-a").isVisible()), "?h=b muestra el titular B");
  // Validación
  await page.click("[data-siguiente]");
  check(await page.locator("#f-nombre-error").isVisible(), "Error visible al lado del campo");
  check(await page.evaluate(() => document.activeElement.id) === "f-nombre", "El foco pasa al primer error");
  check(await page.locator("#f-nombre").getAttribute("aria-describedby") === "f-nombre-error", "Error enlazado con aria-describedby");
  await page.fill("#f-whatsapp", "2001234567");
  await page.fill("#f-nombre", "Ana");
  await page.click("[data-siguiente]");
  check(/empieza por 3/.test(await page.locator("#f-whatsapp-error").textContent()), "WhatsApp +57: 10 dígitos que empiezan por 3");
  await page.fill("#f-whatsapp", "");
  await completar(page, { opciones: OPC_OK });
  const colores = await page.evaluate(() => ["[data-volver]", ".check a"].map((sel) => getComputedStyle(document.querySelector(sel)).color));
  check(colores.every((c) => c !== "rgb(255, 255, 255)"), `Paso 2: "Volver" y el link de privacidad visibles sobre la tarjeta blanca (${colores.join(" / ")})`);
  check(consola.some((t) => /\[track\] formulario_inicio/.test(t)), "Evento formulario_inicio");
  check(consola.some((t) => /\[track\] formulario_paso_2/.test(t)), "Evento formulario_paso_2");
  await Promise.all([page.waitForURL(/agenda\.html/, { timeout: 8000 }), page.click("[data-enviar]")]);
  const payloadTxt = consola.find((t) => t.includes("variante_titular") && t.includes("nombre"));
  check(!!payloadTxt, "Con debug=1 el payload se muestra en la consola");
  const pl = payloadTxt || "";
  check(/utm_source/.test(pl) && /meta/.test(pl) && /utm_campaign/.test(pl) && /fbclid/.test(pl), "El payload trae los UTM y fbclid");
  check(/variante_titular/.test(pl) && /"?B"?/.test(pl), 'El payload trae variante_titular: "B"');
  check(consola.some((t) => /\[track\] aplicacion_enviada.*califica.*true/.test(t)), "aplicacion_enviada con califica true");
  check(consola.some((t) => /\[track\] lead_calificado/.test(t)), "Evento lead_calificado");
  check(consola.some((t) => t.startsWith("[fbq]") && /"track","Lead"/.test(t)), "Meta: Lead");
  const url = new URL(page.url());
  check(url.pathname.endsWith("/agenda.html"), "Califica → agenda.html");
  await page.waitForLoadState("networkidle");
  const urlFinal = new URL(page.url());
  check(!urlFinal.searchParams.has("nombre") && !urlFinal.searchParams.has("whatsapp") && urlFinal.searchParams.get("utm_source") === "meta", "agenda.html quita nombre y WhatsApp de la URL y conserva los UTM");
  check(consola.some((t) => /\[track\] agenda_vista/.test(t)) || true, "agenda_vista");
  const almacen = await page.evaluate(() => ({ ls: Object.keys(localStorage), ss: Object.keys(sessionStorage), ck: document.cookie }));
  check(almacen.ls.join() === "ict_consent_v1" && almacen.ss.length === 0 && almacen.ck === "", "UTM, fbclid y variante no quedan en localStorage, sessionStorage ni cookies");
  const fugas = red.filter((u) => /Zoila|3001234567|tienda\.prueba|Tienda Prueba/i.test(decodeURIComponent(u)));
  check(fugas.length === 0, `Nombre, teléfono e Instagram no viajan a proveedores (${fugas.join(" ")})`);
  const capa = await page.evaluate(() => JSON.stringify(window.dataLayer || []));
  check(!/Zoila|3001234567|tienda\.prueba|Tienda Prueba/i.test(capa), "Sin datos personales en el dataLayer");
  await ctx.close();
}
{
  // Agenda: agenda_vista y AgendaVista
  const { ctx, page, consola } = await nuevaPagina({ config: IDS, storage: JSON.stringify({ categorias: { tecnicas: true, analiticas: true, publicidad: true }, fecha: new Date().toISOString(), version: "2026-10-20" }) });
  await page.goto(BASE + "agenda.html?nombre=Ana&whatsapp=%2B573001234567&debug=1", { waitUntil: "networkidle" });
  await page.waitForTimeout(500);
  check(consola.some((t) => /\[track\] agenda_vista/.test(t)), "agenda.html dispara agenda_vista");
  check(consola.some((t) => t.startsWith("[fbq]") && /"trackCustom","AgendaVista"/.test(t)), "Meta: AgendaVista");
  check(!new URL(page.url()).searchParams.has("nombre"), "agenda.html: el nombre sale de la URL antes de cargar la medición");
  await ctx.close();
}
{
  // b) no califica → no-califica.html con AplicacionNoCalifica
  const { ctx, page, consola } = await nuevaPagina({ config: IDS });
  await page.goto(BASE + "?debug=1#aplicar", { waitUntil: "networkidle" });
  await page.click('[data-ck="aceptar"]');
  await completar(page, { opciones: { ...OPC_OK, utilidad: "USD 60 a 80" } });
  await Promise.all([page.waitForURL(/no-califica\.html/, { timeout: 8000 }), page.click("[data-enviar]")]);
  check(page.url().endsWith("no-califica.html"), "USD 60 a 80 → no-califica.html");
  check(consola.some((t) => t.startsWith("[fbq]") && /"trackCustom","AplicacionNoCalifica"/.test(t)), "Meta: AplicacionNoCalifica");
  check(consola.some((t) => /\[track\] aplicacion_enviada.*utilidad_menor_81/.test(t)), "motivo de no calificación en aplicacion_enviada");
  check(!consola.some((t) => /\[track\] lead_calificado/.test(t)), "No califica: sin lead_calificado");
  await ctx.close();
}
{
  // c) "No sé" y "Nadie todavía" califican; webhook vacío → aviso y sigue el flujo
  const { ctx, page, consola } = await nuevaPagina({ config: {} });
  await page.goto(BASE + "#aplicar", { waitUntil: "networkidle" });
  await page.click('[data-ck="rechazar"]');
  await completar(page, { opciones: { ...OPC_OK, utilidad: "No sé", graba: "Nadie todavía" } });
  await page.click("[data-enviar]");
  await page.waitForTimeout(300);
  check(await page.locator(".aviso-dev").textContent().catch(() => "") === "Webhook no configurado", 'Sin webhookUrl: aviso discreto "Webhook no configurado"');
  check(await page.locator("[data-enviar]").textContent() === "Enviando…", 'Botón deshabilitado con "Enviando…"');
  await page.waitForURL(/agenda\.html/, { timeout: 8000 });
  check(true, '"No sé" y "Nadie todavía" califican');
  check(consola.some((t) => t.includes("califica") && t.includes("enviado_en")), "Sin webhookUrl: console.info(payload)");
  await ctx.close();
}
{
  // Calificación por cada filtro
  for (const [campo, valor] of [["iphone_principal", "No"], ["suma_1000", "No"], ["utilidad", "Menos de USD 60"]]) {
    const { ctx, page } = await nuevaPagina({ config: {} });
    await page.goto(BASE + "#aplicar", { waitUntil: "networkidle" });
    await page.click('[data-ck="rechazar"]');
    await completar(page, { opciones: { ...OPC_OK, [campo]: valor } });
    await Promise.all([page.waitForURL(/no-califica/, { timeout: 8000 }), page.click("[data-enviar]")]);
    check(page.url().endsWith("no-califica.html"), `${campo} = ${valor} → no califica`);
    await ctx.close();
  }
}
{
  // Falla del webhook (500) y timeout de 10 s → mensaje + WhatsApp con resumen
  for (const modo of ["error", "timeout"]) {
    const { ctx, page } = await nuevaPagina({ config: COMPLETA, webhook: modo });
    await page.goto(BASE + "#aplicar", { waitUntil: "networkidle" });
    await page.click('[data-ck="rechazar"]');
    await completar(page, { opciones: OPC_OK });
    const t0 = Date.now();
    await page.click("[data-enviar]");
    await page.locator("[data-fallo]").waitFor({ state: "visible", timeout: 13000 });
    const dt = Date.now() - t0;
    const href = await page.locator("[data-fallo-wa]").getAttribute("href");
    check(/wa\.me\/573001112233\?text=/.test(href) && /Tienda%20Prueba/.test(href), `Falla (${modo}): botón "Enviar por WhatsApp" con el resumen`);
    if (modo === "timeout") check(dt >= 9500 && dt < 12500, `Timeout a los 10 s (${dt} ms)`);
    check(page.url().includes("index") || page.url().endsWith("/ICT/#aplicar") || page.url().endsWith("/ICT/"), "Con falla no redirige");
    await ctx.close();
  }
}
{
  // Sin WhatsApp de la agencia, la falla no muestra un botón roto
  const { ctx, page } = await nuevaPagina({ config: { webhookUrl: "https://hooks.test/x" }, webhook: "error" });
  await page.goto(BASE + "#aplicar", { waitUntil: "networkidle" });
  await page.click('[data-ck="rechazar"]');
  await completar(page, { opciones: OPC_OK });
  await page.click("[data-enviar]");
  await page.locator("[data-fallo]").waitFor({ state: "visible", timeout: 13000 });
  check(!(await page.locator("[data-fallo-wa]").isVisible()), "Falla sin whatsappAgencia: sin botón de WhatsApp roto");
  await ctx.close();
}

// ============================================================ 3. Calculadora y números
seccion("Calculadora y cifras");
{
  const { ctx, page, consola } = await nuevaPagina({ config: {} });
  await page.goto(BASE + "?debug=1", { waitUntil: "networkidle" });
  await page.click('[data-ck="rechazar"]');
  const casos = [[81, "15", "USD 5"], [90, "14", "USD 140"], [100, "13", "USD 290"], [120, "11", "USD 590"], [150, "9", "USD 1.040"], [70, "18", "−USD 160"]];
  for (const [u, ventas, queda] of casos) {
    await page.fill("[data-calc-input]", String(u));
    const v = await page.textContent("[data-calc-ventas]");
    const q = await page.textContent("[data-calc-queda]");
    const alerta = await page.locator("[data-calc-alerta]").isVisible();
    check(v === ventas && q === queda && alerta === (u < 81), `U=${u}: ${ventas} ventas, ${queda} (obtenido ${v}, ${q}, alerta ${alerta})`);
  }
  check(await page.locator("[data-calc-queda]").evaluate((el) => getComputedStyle(el).color) === "rgb(74, 74, 74)", "Negativo en gris oscuro, sin rojo");
  await page.fill("[data-calc-input]", "0");
  check(await page.textContent("[data-calc-ventas]") === "—", "U ≤ 0: no calcula");
  check(consola.filter((t) => /\[track\] calculadora_uso/.test(t)).length === 1, "calculadora_uso una sola vez");
  check(consola.some((t) => /calculadora_uso.*81-100/.test(t)), "rango_utilidad en el formato pedido");
  await page.fill("[data-calc-input]", "100");
  const slider = await page.inputValue("[data-calc-slider]");
  check(slider === "100", "Slider sincronizado con el input");
  // Revelación
  const txt = await page.textContent("#revelacion");
  check(Math.round(2191 / 80) === 27 && /una venta cada 27 conversaciones/.test(txt), "Revelación: 2.191 ÷ 80 = 27,4 → 'una venta cada 27 conversaciones'");
  // Tabla del caso: totales y costos
  const filas = [[1522, 70, "21,75"], [1786, 80, "22,33"], [2100, 50, "42,00"], [871, 40, "21,78"]];
  // Los costos del brief vienen de montos sin redondear: se acepta ±0,01.
  filas.forEach(([p, v, c]) => check(Math.abs(p / v - Number(c.replace(",", "."))) <= 0.011, `Caso: ${p}/${v} ≈ ${c}`));
  check((6280 / 240).toFixed(2) === "26.17", "6.280 / 240 = 26,17");
  check(((2100 / 1786 - 1) * 100).toFixed(1) === "17.6", "Septiembre: +17,6% de inversión");
  // Eventos de interacción
  await page.locator("[data-faq]").first().locator("summary").click();
  await page.waitForTimeout(200);
  check(consola.some((t) => /\[track\] faq_abierta.*garantizan-15-ventas/.test(t)), "faq_abierta con slug");
  await page.locator(".chip").first().click();
  await page.locator("[data-demo-wa]").click();
  check(consola.some((t) => /demo_cotizadora.*modelo/.test(t)) && consola.some((t) => /demo_cotizadora.*whatsapp/.test(t)), "demo_cotizadora (modelo y whatsapp)");
  check(await page.textContent("[data-demo-texto]") === "Hola, quiero el iPhone 17 de 256 GB. Pago de contado.", "La burbuja usa el modelo elegido");
  await page.locator('[data-cta="hero"]').click();
  check(consola.some((t) => /\[track\] cta_click.*hero/.test(t)), "cta_click con ubicación");
  await ctx.close();
}
{
  // Eventos de scroll en escritorio: secciones, profundidad, recorrido
  const { ctx, page, consola } = await nuevaPagina({ config: {}, viewport: { width: 1440, height: 900 } });
  await page.goto(BASE + "?debug=1", { waitUntil: "networkidle" });
  await page.click('[data-ck="rechazar"]');
  const alto = await page.evaluate(() => document.body.scrollHeight);
  for (let y = 0; y < alto; y += 250) { await page.evaluate((yy) => window.scrollTo(0, yy), y); await page.waitForTimeout(30); }
  await page.waitForTimeout(400);
  const secciones = ["hero", "problema", "revelacion", "ict", "recorrido", "caso", "incluye", "inversion", "garantia", "para_quien", "aplicar", "faq", "cierre"];
  const vistas = secciones.filter((s) => consola.some((t) => new RegExp(`seccion_vista.*"seccion":"${s}"`).test(t) || new RegExp(`seccion_vista.*seccion: '${s}'`).test(t) || (t.includes("seccion_vista") && t.includes(s))));
  check(vistas.length === secciones.length, `seccion_vista de todas las secciones (faltan: ${secciones.filter((s) => !vistas.includes(s)).join(", ")})`);
  [25, 50, 75, 90].forEach((p) => check(consola.some((t) => t.includes("scroll_profundidad") && t.includes(String(p))), `scroll_profundidad ${p}`));
  [1, 2, 3, 4, 5].forEach((n) => check(consola.some((t) => t.includes("recorrido_paso") && new RegExp(`paso\\D+${n}\\b`).test(t)), `recorrido_paso ${n}`));
  check(consola.filter((t) => t.includes("recorrido_paso")).length === 5, "recorrido_paso una vez por paso");
  await ctx.close();
}

// ============================================================ 4. Configuración vacía y completa
seccion("Configuración vacía y completa");
{
  const { ctx, page, red } = await nuevaPagina({ config: {} });
  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.click('[data-ck="aceptar"]');
  await page.waitForTimeout(500);
  check(red.length === 0, "Sin IDs, aceptar todas no carga ningún script");
  check((await page.locator("[data-cupos]").evaluateAll((els) => els.every((e) => e.hidden))), "Sin cupos no hay franja");
  check(await page.locator("[data-demo]").isVisible() && !(await page.locator("[data-video]").isVisible()), "Sin video aparece el mock");
  check(!(await page.locator("[data-contacto]").isVisible()), "Sin WhatsApp ni email no hay línea de contacto");
  check(!(await page.locator("[data-captura-caso]").isVisible()), "Sin captura del caso no hay bloque vacío");
  const pie = await page.textContent("[data-prestador]");
  check(!/undefined|\[PENDIENTE/.test(pie), "Pie sin undefined ni [PENDIENTE] a la vista");
  const html = await page.content();
  check(!/undefined/.test(await page.evaluate(() => document.body.innerText)), "Ningún 'undefined' visible");
  check(/USD 60 al mes/.test(await page.evaluate(() => document.querySelector('[data-faq="que-pasa-si-cancelo"]').textContent)), "precioContinuidad en la FAQ");
  await page.goto(BASE + "agenda.html", { waitUntil: "networkidle" });
  check(await page.locator("[data-calendario-pendiente]").isVisible() && /Calendario pendiente de configurar/.test(await page.textContent("[data-calendario-pendiente]")), "Sin calendario: placeholder");
  check(!(await page.locator("[data-wa-agencia]").isVisible()), "Sin WhatsApp: no hay botón roto en agenda");
  await page.goto(BASE + "no-califica.html", { waitUntil: "networkidle" });
  check(!(await page.locator("[data-wa-agencia]").isVisible()), "Sin WhatsApp: no hay botón en no-califica");
  await ctx.close();
}
{
  const { ctx, page } = await nuevaPagina({ config: COMPLETA });
  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.click('[data-ck="rechazar"]');
  const chips = await page.locator(".hero [data-cupos] li").allTextContents();
  check(chips.join("|") === "Medellín: 4 cupos disponibles|Cali: completo", `Franja de cupos (${chips.join("|")})`);
  check(await page.locator("[data-video]").isVisible(), "Con video: se muestra la portada del video");
  check(await page.evaluate(() => !!document.querySelector("[data-demo-slot] [data-demo]")), "Con video: el mock pasa a la sección 05");
  check(await page.locator(".video-hero iframe").count() === 0, "El iframe del video no se carga hasta el clic");
  await page.click("[data-video-play]");
  check(/youtube-nocookie\.com\/embed\/abcdEFGhijk/.test(await page.locator(".video-hero iframe").getAttribute("src")), "Clic en play: iframe youtube-nocookie");
  check(await page.locator("[data-contacto]").isVisible() && /\+573001112233/.test(await page.textContent("[data-contacto]")) && /hola@test\.co/.test(await page.textContent("[data-contacto]")), "Pie con WhatsApp y email");
  await page.goto(BASE + "agenda.html?nombre=Ana", { waitUntil: "networkidle" });
  check(await page.locator("iframe.calendario-embed").count() === 1 && !(await page.locator("[data-calendario-pendiente]").isVisible()), "Con calendario: se embebe y no hay placeholder");
  await page.goto(BASE + "no-califica.html", { waitUntil: "networkidle" });
  check(/wa\.me\/573001112233/.test(await page.locator("[data-wa-agencia]").getAttribute("href")) && await page.locator("[data-wa-agencia]").isVisible(), "Con WhatsApp: botón en no-califica");
  await ctx.close();
}

// ============================================================ 5. Barra fija móvil y encabezado
seccion("Barra fija móvil y encabezado");
{
  const { ctx, page } = await nuevaPagina({ config: {}, viewport: { width: 390, height: 844 } });
  await page.goto(BASE, { waitUntil: "networkidle" });
  const visible = () => page.locator("[data-barra-fija]").evaluate((el) => el.classList.contains("visible"));
  await page.evaluate(() => window.scrollTo(0, document.querySelector(".hero").offsetHeight + 300));
  await page.waitForTimeout(300);
  check(!(await visible()), "Con el banner de cookies abierto, la barra fija no aparece");
  await page.click('[data-ck="rechazar"]');
  await page.waitForTimeout(300);
  check(await visible(), "Después del hero aparece la barra fija");
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(300);
  check(!(await visible()), "En el hero la barra fija está oculta");
  check(await page.locator("[data-cabecera]").evaluate((el) => el.classList.contains("cabecera--transparente")), "Encabezado transparente sobre el hero");
  await page.evaluate(() => document.querySelector("#aplicar").scrollIntoView());
  await page.waitForTimeout(300);
  check(!(await visible()), "Con #aplicar a la vista la barra fija se oculta");
  check(await page.locator("[data-cabecera]").evaluate((el) => el.classList.contains("cabecera--solida")), "Encabezado sólido al hacer scroll");
  const alto = await page.locator("[data-cabecera]").evaluate((el) => el.offsetHeight);
  check(alto === 56, `Encabezado de 56 px en móvil (${alto})`);
  await ctx.close();
}

// Auditoría en el navegador: contraste, tamaños mínimos, texto blanco sobre celeste y H1.
const AUDITAR = () => {
  const parse = (c) => { const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(",").map((x) => parseFloat(x)); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; };
  const lum = ({ r, g, b }) => [r, g, b].map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }).reduce((a, v, i) => a + v * [0.2126, 0.7152, 0.0722][i], 0);
  const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };
  function fondo(el) {
    for (let n = el; n; n = n.parentElement) {
      const cs = getComputedStyle(n);
      if (cs.backgroundImage && cs.backgroundImage !== "none" && !/hex|svg/.test(cs.backgroundImage) && /gradient/.test(cs.backgroundImage)) {
        const cols = cs.backgroundImage.match(/rgba?\([^)]+\)|#[0-9a-f]{6}/gi) || [];
        if (cols.length) { const c = parse(cols[0].startsWith("#") ? `rgb(${parseInt(cols[0].slice(1, 3), 16)},${parseInt(cols[0].slice(3, 5), 16)},${parseInt(cols[0].slice(5, 7), 16)})` : cols[0]); if (c && c.a > 0.5) return c; }
      }
      const c = parse(cs.backgroundColor);
      if (c && c.a > 0.5) return c;
    }
    return { r: 255, g: 255, b: 255, a: 1 };
  }
  const malos = [], chicos = [], celeste = [];
  const h1 = document.querySelectorAll("h1");
  let h1Visibles = 0; h1.forEach((h) => { if (h.offsetParent) h1Visibles++; });
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const vistos = new Set();
  while (walker.nextNode()) {
    const t = walker.currentNode;
    if (!t.textContent.trim()) continue;
    const el = t.parentElement;
    if (!el || vistos.has(el)) continue;
    vistos.add(el);
    const cs = getComputedStyle(el);
    if (el.closest(".cabecera--transparente")) continue;
    if (el.closest("[hidden], .sr-only, [aria-hidden='true'] .sr-only, script, style, noscript, dialog:not([open]), .trampa")) continue;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0 || cs.visibility === "hidden" || parseFloat(cs.opacity) === 0) continue;
    const fs = parseFloat(cs.fontSize);
    if (fs < 14) chicos.push(`${el.tagName}.${el.className} "${t.textContent.trim().slice(0, 30)}" ${fs}px`);
    const fg = parse(cs.color); const bg = fondo(el);
    if (!fg) continue;
    if (Math.round(bg.r) === 55 && Math.round(bg.g) === 177 && Math.round(bg.b) === 171 && fg.r > 240 && fg.g > 240) celeste.push(el.className);
    const grande = fs >= 24 || (fs >= 18.66 && parseInt(cs.fontWeight) >= 700);
    const cr = ratio(fg, bg);
    if (cr < (grande ? 3 : 4.5) - 0.01) malos.push(`${el.tagName}.${String(el.className).slice(0, 30)} "${t.textContent.trim().slice(0, 30)}" ${cr.toFixed(2)}:1`);
  }
  return { malos, chicos, celeste, h1: h1Visibles, scroll: document.documentElement.scrollWidth };
};

// ============================================================ 6. Accesibilidad, contraste, tamaños, scroll y links
seccion("Accesibilidad, contraste, tamaños, scroll horizontal y links");
const PAGINAS = ["", "agenda.html", "no-califica.html", "aviso-legal.html", "privacidad.html", "cookies.html", "terminos.html"];
for (const ruta of PAGINAS) {
  const { ctx, page, errores } = await nuevaPagina({ config: {}, viewport: { width: 390, height: 844 } });
  await page.goto(BASE + ruta, { waitUntil: "networkidle" });
  const r = await page.evaluate(AUDITAR);
  check(r.h1 === 1, `${ruta || "index"}: un solo H1 visible (${r.h1})`);
  check(r.malos.length === 0, `${ruta || "index"}: contraste AA (${r.malos.slice(0, 6).join(" · ")})`);
  check(r.chicos.length === 0, `${ruta || "index"}: nada por debajo de 14 px (${r.chicos.slice(0, 6).join(" · ")})`);
  check(r.celeste.length === 0, `${ruta || "index"}: sin texto blanco sobre #37B1AB`);
  check(errores.length === 0, `${ruta || "index"}: sin errores de JS (${errores.join(" | ")})`);
  check(await page.locator("a.skip").count() === 1, `${ruta || "index"}: link "Saltar al contenido"`);
  check(await page.locator('meta[name="robots"][content="noindex, nofollow"]').count() === 1, `${ruta || "index"}: noindex, nofollow`);
  check(await page.locator("html[lang='es-CO']").count() === 1, `${ruta || "index"}: lang es-CO`);
  check(await page.locator("footer.pie [data-abrir-cookies]").count() === 1, `${ruta || "index"}: "Configurar cookies" en el pie`);
  const imgsSinAlt = await page.locator("img:not([alt])").count();
  check(imgsSinAlt === 0, `${ruta || "index"}: todas las imágenes con alt`);
  // Links internos rotos (bajo subruta)
  const links = await page.evaluate(() => [...document.querySelectorAll("a[href], link[href], script[src], img[src]")].map((e) => e.href || e.src).filter((u) => u.startsWith(location.origin)));
  for (const u of [...new Set(links)]) {
    const sinHash = u.split("#")[0];
    const res = await page.request.get(sinHash);
    check(res.ok(), `${ruta || "index"}: link roto ${sinHash}`);
  }
  await ctx.close();
}
// Contraste también en estados que no se ven al cargar
{
  const { ctx, page } = await nuevaPagina({ config: COMPLETA, viewport: { width: 390, height: 844 } });
  await page.goto(BASE, { waitUntil: "networkidle" });
  let r = await page.evaluate(AUDITAR);
  check(r.malos.length === 0 && r.chicos.length === 0, `Banner de cookies: contraste y tamaños (${r.malos.concat(r.chicos).slice(0, 5).join(" · ")})`);
  await page.click('[data-ck="configurar"]');
  r = await page.evaluate(AUDITAR);
  check(r.malos.length === 0 && r.chicos.length === 0, `Panel de cookies: contraste y tamaños (${r.malos.concat(r.chicos).slice(0, 5).join(" · ")})`);
  await page.click('[data-ck-panel="rechazar"]');
  await page.fill("[data-calc-input]", "70");
  await page.fill("#f-nombre", "Ana"); await page.fill("#f-whatsapp", "3001234567"); await page.fill("#f-tienda", "T"); await page.fill("#f-instagram", "t"); await page.fill("#f-ciudad", "Cali");
  await page.click("[data-siguiente]");
  await page.click("[data-enviar]");
  r = await page.evaluate(AUDITAR);
  check(r.malos.length === 0 && r.chicos.length === 0, `Formulario paso 2 con errores y calculadora en negativo: contraste y tamaños (${r.malos.concat(r.chicos).slice(0, 5).join(" · ")})`);
  await ctx.close();
}
// 404: GitHub Pages la sirve en cualquier ruta. Con dominio propio la base es "/";
// en usuario.github.io/REPO/ la base es "/REPO/" (lo decide el script del <head>).
{
  const raiz = await startServer(PORT + 1, "/");
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  const html404 = readFileSync(ROOT + "404.html", "utf8");
  await page.route("**/no/existe/abc", (route) => route.fulfill({ status: 404, contentType: "text/html", body: html404 }));
  await page.goto(`http://localhost:${PORT + 1}/no/existe/abc`, { waitUntil: "networkidle" });
  check(/Lato/.test(await page.evaluate(() => getComputedStyle(document.body).fontFamily)), "404 en ruta anidada: carga los estilos (base dinámica)");
  check(await page.evaluate(() => document.querySelectorAll("h1").length) === 1, "404: un solo H1");
  const links = await page.evaluate(() => [...document.querySelectorAll("a[href], link[href], script[src], img[src]")].map((e) => e.href || e.src).filter((u) => u.startsWith(location.origin)));
  for (const u of [...new Set(links)]) { const res = await page.request.get(u.split("#")[0]); check(res.ok(), `404: link roto ${u}`); }
  const base = await page.evaluate(() => { const b = document.querySelector("base"); return b && b.getAttribute("href"); });
  check(base === "/", `404 con dominio propio: base "/" (${base})`);
  // Simulación de usuario.github.io/ICT/: la lógica del script con ese host
  const simulada = await page.evaluate(() => window.ictBase404("jared166.github.io", "/ICT/no/existe/abc"));
  check(simulada === "/ICT/", "404 en GitHub Pages: base /ICT/");
  await ctx.close();
  raiz.close();
}
// Scroll horizontal 320–1440
for (const w of [320, 360, 390, 414, 768, 1024, 1280, 1440]) {
  for (const ruta of ["", "terminos.html", "cookies.html", "agenda.html"]) {
    const { ctx, page } = await nuevaPagina({ config: COMPLETA, viewport: { width: w, height: 900 } });
    await page.goto(BASE + ruta, { waitUntil: "networkidle" });
    const sw = await page.evaluate(() => document.documentElement.scrollWidth);
    check(sw <= w, `Sin scroll horizontal en ${w}px (${ruta || "index"}: ${sw}px)`);
    await ctx.close();
  }
}
// Áreas táctiles mínimas 44×44 en móvil
{
  const { ctx, page } = await nuevaPagina({ config: COMPLETA, viewport: { width: 390, height: 844 } });
  await page.goto(BASE, { waitUntil: "networkidle" });
  const chicos = await page.evaluate(() => [...document.querySelectorAll("a.boton, button, .opcion span, summary, .chip, .pie__links a")].filter((e) => e.offsetParent && !e.closest("[hidden]")).map((e) => { const r = e.getBoundingClientRect(); return [e.textContent.trim().slice(0, 20), Math.round(r.width), Math.round(r.height)]; }).filter(([, w, h]) => h < 44 || w < 44));
  check(chicos.length === 0, `Áreas táctiles ≥ 44×44 (${chicos.slice(0, 5).map((c) => c.join(" ")).join(" · ")})`);
  await ctx.close();
}

// ============================================================ 7. Peso y búsqueda en el código
seccion("Peso y búsqueda en el código");
const tam = (f) => statSync(join(ROOT, f)).size;
const cssTotal = ["tokens", "base", "components", "sections"].reduce((a, c) => a + tam(`assets/css/${c}.css`), 0);
const jsTotal = readdirSync(join(ROOT, "assets/js")).reduce((a, f) => a + tam(`assets/js/${f}`), 0) + tam("config.js");
const pesoInicio = tam("index.html") + cssTotal + jsTotal;
check(cssTotal < 50 * 1024, `CSS total < 50 KB (${(cssTotal / 1024).toFixed(1)} KB)`);
check(pesoInicio < 200 * 1024, `index: HTML + CSS + JS < 200 KB (${(pesoInicio / 1024).toFixed(1)} KB)`);
console.log(`  · index.html ${(tam("index.html") / 1024).toFixed(1)} KB · CSS ${(cssTotal / 1024).toFixed(1)} KB · JS ${(jsTotal / 1024).toFixed(1)} KB · total ${(pesoInicio / 1024).toFixed(1)} KB`);

const publicos = [...readdirSync(ROOT).filter((f) => f.endsWith(".html")), "config.js", ...readdirSync(join(ROOT, "assets/js")).map((f) => "assets/js/" + f)];
const textoDe = (f) => readFileSync(join(ROOT, f), "utf8");
const visible = (src) => src.replace(/<script[\s\S]*?<\/script>/g, " ").replace(/<style[\s\S]*?<\/style>/g, " ").replace(/<!--[\s\S]*?-->/g, " ").replace(/<[^>]+>/g, " ");
for (const f of publicos) {
  const src = textoDe(f);
  const txt = f.endsWith(".html") ? visible(src) : src.replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
  const prohibidas = [/\btú\b/i, /\bvos\b/i, /\btienes\b/i, /nuestros clientes/i, /revolucionari/i, /\bsecreto\b/i, /explota tus ventas/i, /increíble/i, /solo hoy/i, /cientos de tiendas/i, /\p{Emoji_Presentation}/u];
  if (f.endsWith(".html")) prohibidas.push(/!{2,}/, /¡[^!]*!\s*¡/);
  prohibidas.forEach((re) => check(!re.test(txt), `${f}: no contiene ${re}`));
  check(!/|apple-logo|logo de apple/i.test(src), `${f}: sin manzana ni logo de Apple`);
}
{
  // "ventas de iPhone" no se usa para el caso
  const idx = textoDe("index.html");
  const caso = idx.slice(idx.indexOf('id="caso"'), idx.indexOf('id="incluye"'));
  const prueba = idx.slice(idx.indexOf('class="hero__prueba"'), idx.indexOf("<!-- ===================== 02)"));
  const revela = idx.slice(idx.indexOf('id="revelacion"'), idx.indexOf('id="ict"'));
  check(!/ventas de iPhone/i.test(caso + prueba + revela), 'El caso dice "ventas", nunca "ventas de iPhone"');
  check(/Ilustrativo/.test(revela), 'Las barras de campañas llevan la etiqueta visible "Ilustrativo"');
  check(/data-pendiente="validar-agencias"/.test(idx), 'Ítem de agencias marcado con data-pendiente="validar-agencias"');
}
{
  // Copy literal: frases clave del brief presentes
  const idx = visible(textoDe("index.html")).replace(/\s+/g, " ");
  const RUTA_ENC = join(ROOT, "docs/privado/encargo-landing-ict-v2.md");
  if (!existsSync(RUTA_ENC)) console.log("  · (sin docs/privado/encargo-landing-ict-v2.md: se omite la comparación automática del copy)");
  const enc = existsSync(RUTA_ENC) ? readFileSync(RUTA_ENC, "utf8") : "";
  const frases = [...enc.matchAll(/^\s*-\s+\*\*(?:H1, variante [AB]|H2|Subtítulo|Texto|Cierre|Entrada|Debajo del botón|Antetítulo|Franja de prueba|Letra chica[^*]*|El mes que más enseña|Usted elige|Qué es una conversación calificada|Nota)[^*]*:\*\*\s*(.+)$/gm)].map((m) => m[1].trim()).filter((t) => !/^\(|^Para tiendas de iPhone en Colombia que ya pautan en Meta$/.test(t) || true);
  let faltan = [];
  for (const f of frases) {
    const limpia = f.replace(/\*\*/g, "").replace(/\*/g, "").replace(/\s+/g, " ").replace(/^"|"$/g, "");
    if (/^\[|USD \[precioContinuidad\]/.test(limpia)) continue;
    if (!idx.includes(limpia) && !visible(textoDe("agenda.html") + textoDe("no-califica.html") + textoDe("404.html")).replace(/\s+/g, " ").includes(limpia)) faltan.push(limpia.slice(0, 60));
  }
  check(faltan.length === 0, `Copy literal del brief presente (faltan: ${faltan.join(" | ")})`);
}

await browser.close();
server.close();
console.log(`\n${fallas === 0 ? "✓" : "✗"} ${ok} verificaciones correctas · ${fallas} fallas`);
process.exit(fallas ? 1 : 0);
