// Capturas de página completa en 360×800, 390×844, 768×1024 y 1440×900.
// Uso: node tools/screenshots.mjs [filtro]   → tools/out/
//   MOTION=1 node tools/screenshots.mjs  → con animaciones (por defecto, movimiento reducido = estados finales)
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
import { startServer } from "./serve.mjs";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH || "playwright");

const OUT = new URL("./out/", import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
const PORT = 4801;
const BASE = "/ICT/";
const server = await startServer(PORT, BASE);
// La 404 se prueba en la raíz (dominio propio): en localhost no hay "usuario.github.io" para deducir la subruta.
const raiz = await startServer(PORT + 1, "/");
const browser = await chromium.launch();

const sizes = [[360, 800], [390, 844], [768, 1024], [1440, 900]];
const pages = [["inicio", ""], ["agenda", "agenda.html"], ["no-califica", "no-califica.html"], ["cookies", "cookies.html"], ["terminos", "terminos.html"], ["404", "404.html"]];
const only = process.argv[2];
const motion = process.env.MOTION === "1";

for (const [name, path] of pages) {
  if (only && !name.startsWith(only)) continue;
  for (const [w, h] of sizes) {
    if (name !== "inicio" && w !== 390 && w !== 1440) continue;
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, reducedMotion: motion ? "no-preference" : "reduce" });
    const page = await ctx.newPage();
    const errores = [];
    page.on("pageerror", (e) => errores.push(e.message));
    page.on("console", (m) => { if (m.type() === "error") errores.push(m.text()); });
    const url = name === "404" ? `http://localhost:${PORT + 1}/404.html` : `http://localhost:${PORT}${BASE}${path}`;
    await page.goto(url, { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);
    // Captura con el banner de cookies (primera visita)
    await page.screenshot({ path: `${OUT}${name}-${w}-fold.png` });
    // Elegir "Rechazar todas" para ver la página limpia
    const rechazar = page.locator('[data-ck="rechazar"]');
    if (await rechazar.count()) await rechazar.click();
    await page.evaluate(async () => {
      for (let y = 0; y < document.body.scrollHeight; y += 300) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 40)); }
      window.scrollTo(0, 0);
    });
    await page.waitForTimeout(motion ? 1500 : 300);
    await page.screenshot({ path: `${OUT}${name}-${w}-full.png`, fullPage: true });
    const ancho = await page.evaluate(() => document.documentElement.scrollWidth);
    if (ancho > w) errores.push(`scroll horizontal: ${ancho}px > ${w}px`);
    if (errores.length) console.log(`! ${name} ${w}:`, errores.join(" | "));
    await ctx.close();
  }
}
await browser.close();
server.close();
raiz.close();
console.log("OK →", OUT);
