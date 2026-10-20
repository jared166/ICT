// Genera favicons PNG (32, 180, 512) y og-image.png (1200×630) a partir de los SVG de marca.
// Uso: node tools/assets.mjs   (volver a correrlo si cambian los logos o el titular A)
import { createRequire } from "node:module";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH || "playwright");
const ROOT = fileURLToPath(new URL("..", import.meta.url));
const IMG = ROOT + "assets/img/";
const OUT = ROOT + "tools/out/";
mkdirSync(OUT, { recursive: true });

const b64 = (f) => readFileSync(f).toString("base64");
const svg = (f) => `data:image/svg+xml;base64,${b64(IMG + f)}`;
const font = (f) => `url(data:font/woff2;base64,${b64(ROOT + "assets/fonts/" + f)}) format("woff2")`;

const browser = await chromium.launch();

async function render(html, w, h, file, transparente = false) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  writeFileSync(OUT + "_tmp.html", html);
  await page.goto("file://" + OUT + "_tmp.html");
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(150);
  await page.screenshot({ path: IMG + file, omitBackground: transparente });
  await page.close();
  console.log("OK", file);
}

const icono = (size, pad, fondo) => `<!doctype html><html><body style="margin:0;width:${size}px;height:${size}px;display:grid;place-items:center;background:${fondo}">
  <img src="${svg("logo-ict.svg")}" style="height:${size - pad * 2}px;width:auto"></body></html>`;

await render(icono(32, 0, "transparent"), 32, 32, "favicon-32.png", true);
await render(icono(180, 18, "#FFFFFF"), 180, 180, "apple-touch-icon.png");
await render(icono(512, 40, "transparent"), 512, 512, "icon-512.png", true);

// og-image: fondo noche con patrón de hexágonos, lockup claro, titular A y escasez en celeste.
const og = `<!doctype html><html><head><style>
  @font-face { font-family: Barlow; font-weight: 700; src: ${font("barlow-latin-700-normal.woff2")}; }
  @font-face { font-family: Lato; font-weight: 400; src: ${font("lato-latin-400-normal.woff2")}; }
  @font-face { font-family: Lato; font-weight: 700; src: ${font("lato-latin-700-normal.woff2")}; }
  body { margin: 0; width: 1200px; height: 630px; overflow: hidden; position: relative;
    background-color: #1B2230;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='56' height='97' viewBox='0 0 56 97'%3E%3Cg fill='none' stroke='%23FFFFFF' stroke-opacity='.06' stroke-width='1'%3E%3Cpath d='M28 0 56 16.17V48.5L28 64.67 0 48.5V16.17zM28 64.67V97'/%3E%3C/g%3E%3C/svg%3E");
    font-family: Lato, sans-serif; color: #fff; }
  .glow { position: absolute; width: 900px; height: 900px; right: -320px; top: -220px; border-radius: 50%; background: radial-gradient(closest-side, rgba(55,177,171,.16), rgba(55,177,171,0)); }
  .wrap { position: absolute; inset: 64px 72px; display: flex; flex-direction: column; justify-content: space-between; align-items: flex-start; }
  .lockup { height: 76px; }
  h1 { font-family: Barlow, sans-serif; font-weight: 700; font-size: 62px; line-height: 1.08; margin: 0; max-width: 1000px; text-wrap: balance; letter-spacing: -.01em; }
  .cupos { font-family: Barlow, sans-serif; font-weight: 700; font-size: 30px; color: #37B1AB; letter-spacing: .02em; }
  .hex { position: absolute; right: 64px; bottom: 54px; width: 150px; opacity: .9; }
</style></head><body>
  <div class="glow"></div>
  <img class="hex" src="${svg("ict-hexagonos.svg")}" alt="">
  <div class="wrap">
    <img class="lockup" src="${svg("lockup-ict-oscuro.svg")}" alt="" style="width:auto">
    <h1>15 ventas de iPhone atribuidas a su pauta en 30 días, medidas una por una.</h1>
    <div class="cupos">Máximo 5 tiendas por ciudad</div>
  </div>
</body></html>`;
await render(og, 1200, 630, "og-image.png");

await browser.close();

// Reduce el peso del PNG con paleta (si hay Python con Pillow disponible; si no, queda como está).
import { execFileSync } from "node:child_process";
try {
  execFileSync("python3", ["-I", "-c", "import sys;from PIL import Image;p=sys.argv[1];Image.open(p).convert('RGB').quantize(colors=256,method=Image.Quantize.MEDIANCUT,dither=Image.Dither.FLOYDSTEINBERG).save(p,optimize=True)", IMG + "og-image.png"]);
  console.log("og-image.png optimizado");
} catch { console.log("og-image.png sin optimizar (falta Pillow)"); }
