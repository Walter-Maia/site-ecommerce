// Medição de fluidez da rolagem (regressão de performance) com o Chrome instalado e GPU real.
//
// Uso:
//   node scripts/qa/scroll-perf.mjs <url> [<url> ...] [opções]
//
// Opções:
//   --mobile            viewport de celular (390×844 @3x, toque, UA de celular); rola com "petelecos" de dedo
//                       (Input.dispatchTouchEvent + fling nativo)
//   --throttle <n>      CPU throttling n× (Emulation.setCPUThrottlingRate) durante a medição
//   --runs <n>          repetições por URL (imprime cada uma e a mediana). Padrão 1
//   --speed <px/s>      velocidade da rolagem. Padrão 2200 (desktop) / 2600 (celular)
//   --idle <ms>         tempo parado no fim da página (canvas fora da tela). Padrão 3000
//   --settle <ms>       espera após o load antes de medir. Padrão 2500
//   --trace [arq.json]  grava um trace CDP (categorias do painel Performance) e imprime ocupação por thread,
//                       tempo por tipo de trabalho e quadros do compositor (completos/parciais/descartados)
//   --json <arq.json>   salva os números brutos
//   --headful           abre a janela (padrão: headless, com GPU)
//   --block <regex>     aborta requisições que casam (A/B de recursos opcionais; um chunk obrigatório quebra a página)
//   --css "<regras>"    injeta CSS na página (A/B: ex. desligar uma animação para medir o custo dela)
//   --init "<js>"       roda JS antes dos scripts da página (A/B: ex. trocar o resultado de um matchMedia)
//   --no-warm           não faz a passada de aquecimento (no dev, ela compila os chunks preguiçosos antes de medir)
//
// O que mede (fases "descida" → "ocioso" no fim da página → "subida"):
//   - quadros via requestAnimationFrame: p50/p95/p99/máx do intervalo, % > 17,7 ms (perdeu o vsync, 1 ms de
//     tolerância para jitter) e % > 33,4 ms (2+ quadros perdidos), FPS médio;
//   - long-animation-frame (LoAF) e longtask: quantidade e tempo bloqueante;
//   - Performance.getMetrics: ocupação da main thread (TaskDuration), layout, estilo e script por fase;
//   - WebGL: quadros desenhados e draw calls por fase (mostra canvas desenhando fora da tela/durante a rolagem);
//   - "presos": passadas de rolagem que não andaram porque um elemento (ex.: canvas com OrbitControls) segurou a
//     roda/toque — o script então muda o ponto de contato para a borda e conta o tropeço.
// Com --trace: ocupação (%) da main thread, compositor, raster e GPU (da página) por fase, soma de Paint, Layerize,
// Layout etc. e quadros do compositor (mesma fonte da faixa "Frames" do DevTools).
// Observações: a tela desta máquina pode ser 120/240 Hz (a taxa é calibrada e impressa); ">16,7" é absoluto (60 Hz).
// O laço de rAF da própria medição mantém a main thread acordando a cada quadro (custo igual antes/depois).
// Produção: `npx next build && npx next start -p 3200` e rode este script contra http://localhost:3200.
import { chromium } from "playwright-core";
import { writeFileSync } from "node:fs";

/* ───────────────────────── argumentos ───────────────────────── */
const argv = process.argv.slice(2);
const urls = [];
const opt = { init: null, css: null, block: null, mobile: false, throttle: 1, runs: 1, speed: 0, idle: 3000, settle: 2500, trace: null, json: null, headful: false, warm: true };
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  const next = () => argv[++i];
  if (a === "--mobile") opt.mobile = true;
  else if (a === "--throttle") opt.throttle = Number(next());
  else if (a === "--runs") opt.runs = Math.max(1, Number(next()));
  else if (a === "--speed") opt.speed = Number(next());
  else if (a === "--idle") opt.idle = Number(next());
  else if (a === "--settle") opt.settle = Number(next());
  else if (a === "--trace") opt.trace = argv[i + 1] && !argv[i + 1].startsWith("--") ? next() : true;
  else if (a === "--json") opt.json = next();
  else if (a === "--headful") opt.headful = true;
  else if (a === "--no-warm") opt.warm = false;
  else if (a === "--block") opt.block = new RegExp(next());
  else if (a === "--css") opt.css = next();
  else if (a === "--init") opt.init = next();
  else if (a.startsWith("--")) {
    console.error(`opção desconhecida: ${a}`);
    process.exit(1);
  } else urls.push(a);
}
if (!urls.length) {
  console.error("uso: node scripts/qa/scroll-perf.mjs <url> [--mobile] [--throttle 4] [--runs 3] [--trace [out.json]] [--json out.json]");
  process.exit(1);
}
if (!opt.speed) opt.speed = opt.mobile ? 2600 : 2200;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let VSYNC = 1000 / 60; // recalibrado pela taxa real da tela (rAF parado) antes de medir

/* ───────────────────────── instrumentação na página ───────────────────────── */
// Roda antes de qualquer script da página (CDP addScriptToEvaluateOnNewDocument: não depende da CSP).
function instrument() {
  const P = (window.__perf = { frames: [], rec: false, gl: { draws: 0, frames: 0 }, loaf: [], lt: [], y: 0, max: 0 });
  let inFrame = false;
  const wrap = (proto) => {
    if (!proto) return;
    for (const k of ["drawElements", "drawArrays", "drawElementsInstanced", "drawArraysInstanced", "drawRangeElements"]) {
      const orig = proto[k];
      if (typeof orig !== "function") continue;
      proto[k] = function (...args) {
        P.gl.draws++;
        if (!inFrame) {
          inFrame = true;
          P.gl.frames++;
          queueMicrotask(() => (inFrame = false));
        }
        return orig.apply(this, args);
      };
    }
  };
  wrap(window.WebGLRenderingContext && WebGLRenderingContext.prototype);
  wrap(window.WebGL2RenderingContext && WebGL2RenderingContext.prototype);
  const observe = (type, list) => {
    try {
      new PerformanceObserver((l) => {
        for (const e of l.getEntries()) {
          list.push({
            start: e.startTime,
            dur: e.duration,
            blocking: e.blockingDuration ?? Math.max(0, e.duration - 50),
            scripts: (e.scripts || [])
              .slice()
              .sort((a, b) => b.duration - a.duration)
              .slice(0, 3)
              .map((s) => ({ dur: Math.round(s.duration), src: (s.sourceURL || "").split("/").slice(-2).join("/"), fn: s.sourceFunctionName || "", invoker: s.invoker || "" })),
          });
        }
      }).observe({ type, buffered: true });
    } catch {
      /* tipo não suportado */
    }
  };
  observe("long-animation-frame", P.loaf);
  observe("longtask", P.lt);
  // posição de rolagem lida dentro do evento (layout já limpo), sem forçar layout no polling do script
  addEventListener(
    "scroll",
    () => {
      P.y = scrollY;
      P.max = document.documentElement.scrollHeight - innerHeight;
    },
    { passive: true },
  );
  P.start = () => {
    P.frames = [];
    P.rec = true;
    const tick = (t) => {
      if (!P.rec) return;
      P.frames.push(t);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };
  P.stop = () => {
    P.rec = false;
    return P.frames;
  };
}

/* ───────────────────────── estatística ───────────────────────── */
function pct(arr, p) {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))];
}
function frameStats(ts) {
  const d = [];
  for (let i = 1; i < ts.length; i++) d.push(ts[i] - ts[i - 1]);
  const dur = ts.length > 1 ? ts[ts.length - 1] - ts[0] : 0;
  const dropped = d.reduce((acc, x) => acc + Math.max(0, Math.round(x / VSYNC) - 1), 0);
  return {
    frames: d.length,
    durMs: dur,
    p50: pct(d, 50),
    p95: pct(d, 95),
    p99: pct(d, 99),
    max: d.length ? Math.max(...d) : 0,
    over16: d.length ? (100 * d.filter((x) => x > VSYNC + 1).length) / d.length : 0,
    over33: d.length ? (100 * d.filter((x) => x > 2 * VSYNC + 1).length) / d.length : 0,
    fps: dur > 0 ? (1000 * d.length) / dur : 0,
    dropped,
  };
}
const median = (xs) => pct(xs, 50);

/* ───────────────────────── trace ───────────────────────── */
// Só o que o painel Performance do DevTools usa (toplevel/gpu/viz deixariam o trace com centenas de MB).
const TRACE_CATS = ["devtools.timeline", "disabled-by-default-devtools.timeline", "disabled-by-default-devtools.timeline.frame", "blink.user_timing"];
async function readStream(cdp, handle) {
  const chunks = [];
  for (;;) {
    const r = await cdp.send("IO.read", { handle, size: 4 << 20 });
    chunks.push(r.base64Encoded ? Buffer.from(r.data, "base64").toString("utf8") : r.data);
    if (r.eof) break;
  }
  await cdp.send("IO.close", { handle });
  return chunks.join("");
}
function analyzeTrace(raw, phaseNames) {
  const events = Array.isArray(raw) ? raw : raw.traceEvents;
  const threadName = new Map();
  const procName = new Map();
  for (const e of events) {
    if (e.ph !== "M") continue;
    if (e.name === "thread_name") threadName.set(`${e.pid}:${e.tid}`, e.args?.name ?? "");
    if (e.name === "process_name") procName.set(e.pid, e.args?.name ?? "");
  }
  // marcas performance.mark("perf:<fase>:start|end") → janelas em microssegundos do trace
  const marks = new Map();
  let pagePid = null;
  for (const e of events) {
    if (typeof e.name === "string" && e.name.startsWith("perf:") && e.cat?.includes("user_timing")) {
      if (!marks.has(e.name)) marks.set(e.name, e.ts);
      pagePid ??= e.pid;
    }
  }
  const windows = phaseNames
    .map((p) => ({ name: p, a: marks.get(`perf:${p}:start`), b: marks.get(`perf:${p}:end`) }))
    .filter((w) => w.a != null && w.b != null && w.b > w.a);
  const group = (e) => {
    // GPU: só as tarefas que o processo de GPU fez para o renderer desta página
    if (e.name === "GPUTask") return e.args?.data?.renderer_pid === pagePid ? "gpu" : null;
    if (e.pid !== pagePid) return null;
    const t = threadName.get(`${e.pid}:${e.tid}`) ?? "";
    if (t === "CrRendererMain") return "main";
    if (t === "Compositor") return "compositor";
    if (/CompositorTileWorker|RasterWorker/i.test(t)) return "raster";
    return null;
  };
  const intervals = new Map(); // grupo → [[a,b],...]
  const byName = new Map(); // fase → Map(nome → µs) (main + raster)
  const NAMES = new Set([
    "UpdateLayoutTree", "Layout", "PrePaint", "Paint", "Layerize", "Commit", "HitTest",
    "FunctionCall", "FireAnimationFrame", "EventDispatch", "TimerFire", "MajorGC", "MinorGC", "V8.GC_SCAVENGER", "V8.GC_MARK_COMPACTOR",
    "RasterTask", "ImageDecodeTask", "Decode Image", "Decode LazyPixelRef", "ScrollLayer", "UpdateLayer",
  ]);
  for (const e of events) {
    if (e.ph !== "X" || !e.dur) continue;
    const g = group(e);
    if (!g) continue;
    if (!intervals.has(g)) intervals.set(g, []);
    intervals.get(g).push([e.ts, e.ts + e.dur]);
    if ((g === "main" || g === "raster") && NAMES.has(e.name)) {
      for (const w of windows) {
        const ov = Math.min(e.ts + e.dur, w.b) - Math.max(e.ts, w.a);
        if (ov <= 0) continue;
        if (!byName.has(w.name)) byName.set(w.name, new Map());
        const m = byName.get(w.name);
        const key = e.name === "Decode LazyPixelRef" ? "Decode Image" : e.name;
        m.set(key, (m.get(key) ?? 0) + ov);
      }
    }
  }
  const out = {};
  for (const w of windows) {
    const busy = {};
    for (const [g, list] of intervals) {
      // une os intervalos (eventos aninhados contam uma vez) e recorta na janela da fase
      const clipped = list.map(([a, b]) => [Math.max(a, w.a), Math.min(b, w.b)]).filter(([a, b]) => b > a).sort((x, y) => x[0] - y[0]);
      let total = 0;
      let ca = -1;
      let cb = -1;
      for (const [a, b] of clipped) {
        if (a > cb) {
          if (cb > ca) total += cb - ca;
          ca = a;
          cb = b;
        } else cb = Math.max(cb, b);
      }
      if (cb > ca) total += cb - ca;
      // raster tem várias threads: % pode passar de 100 (é soma das threads)
      busy[g] = (100 * total) / (w.b - w.a);
    }
    const work = Object.fromEntries([...(byName.get(w.name) ?? new Map())].map(([k, v]) => [k, v / 1000]).sort((a, b) => b[1] - a[1]));
    // quadros do compositor da página (mesma fonte da faixa "Frames" do DevTools)
    const fr = { presented: 0, partial: 0, dropped: 0, checkerboard: 0 };
    for (const e of events) {
      if (e.name !== "PipelineReporter" || e.ph !== "b" || e.pid !== pagePid || e.ts < w.a || e.ts > w.b) continue;
      const r = e.args?.frame_reporter ?? e.args?.chrome_frame_reporter ?? {};
      if (r.state === "STATE_PRESENTED_ALL") fr.presented++;
      else if (r.state === "STATE_PRESENTED_PARTIAL") fr.partial++;
      else if (r.state === "STATE_DROPPED") fr.dropped++;
      if (r.has_missing_content || r.checkerboarded_needs_raster || r.checkerboarded_needs_record) fr.checkerboard++;
    }
    out[w.name] = { wallMs: (w.b - w.a) / 1000, busy, work, frames: fr };
  }
  return out;
}

/* ───────────────────────── rolagem ───────────────────────── */
async function scrollPass(page, cdp, dir, vp) {
  const t0 = Date.now();
  const maxMs = 40000; // teto por passada (um canvas que prende o toque pode impedir a rolagem)
  let traps = 0;
  let stuck = 0;
  let lastY = await page.evaluate(() => scrollY);
  // ponto de contato: centro da tela (onde a pessoa de fato rola). Se preso, vai para a borda direita.
  let x = Math.round(vp.width / 2);
  const y = Math.round(vp.height * (opt.mobile ? 0.62 : 0.5));
  if (!opt.mobile) await page.mouse.move(x, y);
  const done = (s) => (dir > 0 ? s.y >= s.max - 2 : s.y <= 1);
  while (Date.now() - t0 < maxMs) {
    if (opt.mobile) {
      // "peteleco" com o dedo: toques reais (Input.dispatchTouchEvent) a cada ~8 ms, solta e deixa o fling rolar.
      // (Input.synthesizeScrollGesture não rola a página no Chrome headless com emulação de celular.)
      const dist = Math.round(vp.height * 0.55);
      const ms = Math.round((1000 * dist) / opt.speed);
      const steps = Math.max(4, Math.round(ms / 8));
      const y0 = dir > 0 ? Math.round(vp.height * 0.78) : Math.round(vp.height * 0.22);
      await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y: y0, id: 1 }] });
      for (let i = 1; i <= steps; i++) {
        await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x, y: y0 - (dir * dist * i) / steps, id: 1 }] });
        await sleep(ms / steps);
      }
      await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
      await sleep(260);
    } else {
      const step = 100;
      await page.mouse.wheel(0, dir * step);
      await sleep((1000 * step) / opt.speed);
    }
    const s = await page.evaluate(() => ({ y: window.__perf.y || scrollY, max: window.__perf.max || document.documentElement.scrollHeight - innerHeight }));
    if (done(s)) break;
    if (Math.abs(s.y - lastY) < 1) {
      stuck++;
      if (stuck >= (opt.mobile ? 2 : 8)) {
        traps++;
        stuck = 0;
        x = x === vp.width - 12 ? Math.round(vp.width * 0.08) : vp.width - 12;
        if (!opt.mobile) await page.mouse.move(x, y);
      }
    } else stuck = 0;
    lastY = s.y;
  }
  // espera a rolagem suave (Lenis) assentar
  let prev = -1;
  for (let i = 0; i < 40; i++) {
    const yy = await page.evaluate(() => scrollY);
    if (Math.abs(yy - prev) < 0.5) break;
    prev = yy;
    await sleep(60);
  }
  return { traps, ms: Date.now() - t0 };
}

async function metrics(cdp) {
  const { metrics: m } = await cdp.send("Performance.getMetrics");
  return Object.fromEntries(m.map((x) => [x.name, x.value]));
}

/* ───────────────────────── uma medição ───────────────────────── */
async function measure(browser, url, run) {
  const vp = opt.mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 };
  const context = await browser.newContext({
    viewport: vp,
    deviceScaleFactor: opt.mobile ? 3 : 1,
    isMobile: opt.mobile,
    hasTouch: opt.mobile,
    userAgent: opt.mobile
      ? "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36"
      : undefined,
  });
  await context.addInitScript(instrument);
  if (opt.block) await context.route(opt.block, (route) => route.abort());
  if (opt.init) await context.addInitScript({ content: opt.init });
  if (opt.css)
    await context.addInitScript((css) => {
      const add = () => document.head.append(Object.assign(document.createElement("style"), { textContent: css }));
      if (document.head) add();
      else document.addEventListener("DOMContentLoaded", add);
    }, opt.css);
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e).slice(0, 200)));
  const cdp = await context.newCDPSession(page);
  await cdp.send("Performance.enable");

  if (opt.warm && run === 0) {
    // aquecimento: no dev, compila a rota e os chunks preguiçosos (three.js) antes de medir
    await page.goto(url, { waitUntil: "load", timeout: 120000 });
    await sleep(1500);
    const h = await page.evaluate(() => document.documentElement.scrollHeight);
    for (let yy = 0; yy < h; yy += vp.height) {
      await page.evaluate((v) => window.scrollTo(0, v), yy);
      await sleep(250);
    }
    await sleep(2500);
  }
  await page.goto(url, { waitUntil: "load", timeout: 120000 });
  await sleep(opt.settle);
  await page.evaluate(() => window.scrollTo(0, 0));
  await sleep(300);

  const env = await page.evaluate(() => {
    const c = document.createElement("canvas");
    const gl = c.getContext("webgl2") || c.getContext("webgl");
    const ext = gl && gl.getExtension("WEBGL_debug_renderer_info");
    const gpu = gl ? (ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)) : "sem WebGL";
    return {
      gpu: String(gpu),
      dpr: devicePixelRatio,
      height: document.documentElement.scrollHeight,
      lenis: document.documentElement.classList.contains("lenis"),
      finePointer: matchMedia("(hover: hover) and (pointer: fine)").matches,
    };
  });

  // calibra o vsync (a tela pode ser 60/120/240 Hz): mediana do intervalo de rAF com a página parada
  const cal = await page.evaluate(
    () =>
      new Promise((res) => {
        const ts = [];
        const tick = (t) => {
          ts.push(t);
          if (ts.length < 90) requestAnimationFrame(tick);
          else res(ts.slice(1).map((x, i) => x - ts[i]).sort((a, b) => a - b)[44]);
        };
        requestAnimationFrame(tick);
      }),
  );
  VSYNC = cal;
  env.hz = 1000 / cal;

  if (opt.throttle > 1) await cdp.send("Emulation.setCPUThrottlingRate", { rate: opt.throttle });

  let tracing = false;
  if (opt.trace) {
    await cdp.send("Tracing.start", {
      transferMode: "ReturnAsStream",
      traceConfig: { includedCategories: TRACE_CATS, excludedCategories: ["*"], recordMode: "recordAsMuchAsPossible" },
    });
    tracing = true;
  }

  const phases = {};
  const phase = async (name, fn) => {
    const m0 = await metrics(cdp);
    const p0 = await page.evaluate((n) => {
      performance.mark(`perf:${n}:start`);
      window.__perf.start();
      return { t: performance.now(), gl: { ...window.__perf.gl } };
    }, name);
    const extra = (await fn()) ?? {};
    const p1 = await page.evaluate((n) => {
      const frames = window.__perf.stop();
      performance.mark(`perf:${n}:end`);
      return { t: performance.now(), frames, gl: { ...window.__perf.gl }, loaf: window.__perf.loaf, lt: window.__perf.lt, canvases: document.querySelectorAll("canvas").length };
    }, name);
    const m1 = await metrics(cdp);
    const wall = (m1.Timestamp - m0.Timestamp) * 1000;
    const inWin = (e) => e.start >= p0.t && e.start <= p1.t;
    const loaf = p1.loaf.filter(inWin);
    const lt = p1.lt.filter(inWin);
    const topScripts = new Map();
    for (const l of loaf) for (const s of l.scripts) {
      const k = `${s.invoker || "?"} ${s.fn ? `${s.fn} ` : ""}(${s.src || "inline"})`;
      topScripts.set(k, (topScripts.get(k) ?? 0) + s.dur);
    }
    phases[name] = {
      ...frameStats(p1.frames),
      wallMs: wall,
      mainBusyPct: (100 * (m1.TaskDuration - m0.TaskDuration) * 1000) / wall,
      scriptMs: (m1.ScriptDuration - m0.ScriptDuration) * 1000,
      layoutMs: (m1.LayoutDuration - m0.LayoutDuration) * 1000,
      styleMs: (m1.RecalcStyleDuration - m0.RecalcStyleDuration) * 1000,
      layouts: m1.LayoutCount - m0.LayoutCount,
      styles: m1.RecalcStyleCount - m0.RecalcStyleCount,
      glFrames: p1.gl.frames - p0.gl.frames,
      glDraws: p1.gl.draws - p0.gl.draws,
      loafCount: loaf.length,
      loafBlockingMs: loaf.reduce((a, l) => a + l.blocking, 0),
      longtasks: lt.length,
      longtaskMs: lt.reduce((a, l) => a + l.dur, 0),
      topScripts: [...topScripts].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k, v]) => `${v}ms ${k}`),
      canvases: p1.canvases,
      ...extra,
    };
  };

  await phase("descida", () => scrollPass(page, cdp, 1, vp));
  await phase("ocioso", async () => {
    await sleep(opt.idle);
  });
  await phase("subida", () => scrollPass(page, cdp, -1, vp));

  let trace = null;
  if (tracing) {
    const done = new Promise((r) => cdp.once("Tracing.tracingComplete", r));
    await cdp.send("Tracing.end");
    const { stream } = await done;
    const text = await readStream(cdp, stream);
    if (typeof opt.trace === "string") {
      const file = opt.runs > 1 || urls.length > 1 ? opt.trace.replace(/\.json$/, `-${urls.indexOf(url)}-${run}.json`) : opt.trace;
      writeFileSync(file, text);
    }
    trace = analyzeTrace(JSON.parse(text), Object.keys(phases));
  }
  if (opt.throttle > 1) await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
  await context.close();
  return { url, env, phases, trace, errors };
}

/* ───────────────────────── impressão ───────────────────────── */
const f1 = (x) => (Number.isFinite(x) ? x.toFixed(1) : "-");
const f0 = (x) => (Number.isFinite(x) ? Math.round(x).toString() : "-");
function printRun(r, label) {
  const e = r.env;
  console.log(`\n── ${label} ${r.url}`);
  console.log(
    `   ${opt.mobile ? "celular 390×844" : "desktop 1440×900"} @${e.dpr}x · tela ${f0(e.hz)} Hz · CPU ${opt.throttle}× · Lenis ${e.lenis ? "ligado" : "desligado"} · altura ${e.height}px · GPU ${e.gpu}`,
  );
  const head = ["fase", "s", "quadros", "p50", "p95", "p99", "máx", ">16,7", ">33", "fps", "perdidos", "LoAF n/ms", "main%", "layout", "estilo", "script", "GLq", "GLdraw", "presos"];
  const rows = Object.entries(r.phases).map(([n, p]) => [
    n,
    f1(p.wallMs / 1000),
    p.frames,
    f1(p.p50),
    f1(p.p95),
    f1(p.p99),
    f0(p.max),
    `${f1(p.over16)}%`,
    `${f1(p.over33)}%`,
    f0(p.fps),
    p.dropped,
    `${p.loafCount}/${f0(p.loafBlockingMs)}`,
    f0(p.mainBusyPct),
    f0(p.layoutMs),
    f0(p.styleMs),
    f0(p.scriptMs),
    p.glFrames,
    p.glDraws,
    p.traps ?? "",
  ]);
  const w = head.map((h, i) => Math.max(String(h).length, ...rows.map((row) => String(row[i]).length)));
  const line = (cells) => "   " + cells.map((c, i) => String(c).padStart(w[i])).join("  ");
  console.log(line(head));
  for (const row of rows) console.log(line(row));
  for (const [n, p] of Object.entries(r.phases)) if (p.topScripts.length) console.log(`   LoAF ${n}: ${p.topScripts.join(" | ")}`);
  if (r.trace) {
    for (const [n, t] of Object.entries(r.trace)) {
      const b = Object.entries(t.busy).map(([k, v]) => `${k} ${f0(v)}%`).join(" · ");
      const wk = Object.entries(t.work).slice(0, 7).map(([k, v]) => `${k} ${f0(v)}ms`).join(" · ");
      const fr = t.frames;
      const tot = fr.presented + fr.partial + fr.dropped;
      console.log(
        `   trace ${n}: ${b} | quadros: ${fr.presented} completos, ${fr.partial} parciais, ${fr.dropped} descartados (${f1(tot ? (100 * fr.dropped) / tot : 0)}%), ${fr.checkerboard} com conteúdo faltando`,
      );
      if (wk) console.log(`         ${wk}`);
    }
  }
  if (r.errors.length) console.log(`   erros na página: ${r.errors.slice(0, 3).join(" | ")}`);
}
function printMedian(rs) {
  console.log(`\n── mediana de ${rs.length} execuções: ${rs[0].url}`);
  for (const n of Object.keys(rs[0].phases)) {
    const g = (k) => median(rs.map((r) => r.phases[n][k]));
    console.log(
      `   ${n.padEnd(8)} p50 ${f1(g("p50"))} · p95 ${f1(g("p95"))} · >16,7 ${f1(g("over16"))}% · >33 ${f1(g("over33"))}% · fps ${f0(g("fps"))} · LoAF ${f0(g("loafCount"))}/${f0(g("loafBlockingMs"))}ms · main ${f0(g("mainBusyPct"))}% · GL quadros ${f0(g("glFrames"))}`,
    );
  }
}

/* ───────────────────────── principal ───────────────────────── */
const browser = await chromium.launch({
  channel: "chrome",
  headless: !opt.headful,
  args: ["--enable-gpu", "--ignore-gpu-blocklist", "--use-angle=d3d11", "--disable-renderer-backgrounding", "--disable-background-timer-throttling"],
});
const all = [];
try {
  for (const url of urls) {
    const rs = [];
    for (let i = 0; i < opt.runs; i++) {
      const r = await measure(browser, url, i);
      printRun(r, opt.runs > 1 ? `[${i + 1}/${opt.runs}]` : "");
      rs.push(r);
    }
    if (rs.length > 1) printMedian(rs);
    all.push(...rs);
  }
} finally {
  await browser.close();
}
if (opt.json) {
  writeFileSync(opt.json, JSON.stringify({ opt, results: all }, null, 2));
  console.log(`\njson: ${opt.json}`);
}
