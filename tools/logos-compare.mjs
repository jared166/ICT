// Captura de comparación: referencias aprobadas vs. SVG generados.
// Uso: node tools/logos-compare.mjs  → tools/out/logos-compare.png
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH || "playwright");
const ROOT = fileURLToPath(new URL("..", import.meta.url));
const OUT = ROOT + "tools/out/";
mkdirSync(OUT, { recursive: true });
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1400, height: 1100 } });
const u = (f) => "file://" + ROOT + f;
const html = `<html><body style="margin:0;font:14px sans-serif;background:#fff">
<style>.row{display:flex;gap:30px;align-items:center;padding:20px}.row img{height:300px}.lab{width:120px}</style>
<div class="row"><div class="lab">Referencia</div><img src="${u("assets/img/ref/logo-ict-referencia.jpg")}" style="height:300px;width:300px;object-fit:cover;object-position:center"><img src="${u("assets/img/ref/ict-hexagonos-referencia.webp")}"><img src="${u("assets/img/ref/logo-mmg-isotipo-70px.png")}" style="height:140px"></div>
<div class="row"><div class="lab">SVG</div><div style="width:300px;height:300px;display:grid;place-items:center"><img src="${u("assets/img/logo-ict.svg")}" style="height:176px"></div><img src="${u("assets/img/ict-hexagonos.svg")}" style="height:210px;margin:45px"><img src="${u("assets/img/logo-mmg.svg")}" style="height:140px"><img src="${u("assets/img/logo-ict-rectas.svg")}" style="height:140px"></div>
<div class="row"><img src="${u("assets/img/lockup-ict-claro.svg")}" style="height:80px"><div style="background:#1B2230;padding:16px"><img src="${u("assets/img/lockup-ict-oscuro.svg")}" style="height:80px"></div><img src="${u("assets/img/hex-i.svg")}" style="height:60px"><img src="${u("assets/img/hex-c.svg")}" style="height:60px"><img src="${u("assets/img/hex-t.svg")}" style="height:60px"></div>
</body></html>`;
const { writeFileSync } = await import("node:fs");
writeFileSync(OUT + "logos-compare.html", html);
await p.goto("file://" + OUT + "logos-compare.html");
await p.waitForTimeout(300);
await p.screenshot({ path: OUT + "logos-compare.png" });
await b.close();
console.log("OK", OUT + "logos-compare.png");
