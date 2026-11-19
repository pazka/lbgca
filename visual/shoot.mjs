// Visual regression harness for lbgca's front (hosh-management AGENTS.md §3; pattern of pazka/WordWave and
// pazka/henryivrevival visual/shoot.mjs): the built ihm/ front against the built API image, fixed data made
// through the API, a screenshot (full page) of every use case of visual/cases.mjs at 1400, 1024 and 390 px,
// each compared with its baseline in visual/baseline/, a diff picture for every difference.
// Node built-ins + the machine's Chrome.
//
//   node visual/shoot.mjs <app url> <front dir> [--update]
//     app url: http://127.0.0.1:<port> of the API container (it must be on a FRESH database: the cases of
//       phase "empty" need no order at all, then seed() makes the fixed data)
//     front dir: the built front (visual/build-ihm.sh)
//     OUT=visual/out (shots + diffs + report.json)   CHROME=/path/to/chrome (default google-chrome)
//     --update: copy the new shots over the baselines (QA only, in a PR that says the change is wanted).
//     VISUAL_PRINT_NEW=1: also print every failing shot in the log (visual/from-log.mjs takes them back).
//     CDP_DESKTOP / CDP_PHONE=<port>: use Chromes already running (visual/run.sh), else spawn $CHROME.
//     ONLY=L1: only the cases whose id starts with L1 (the seed still runs between the two phases).
//
// The baseline is only meaningful for the Chrome that made it: report.json records the Chrome version, and a
// version change is reported as such.
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { createHash } from "node:crypto";
import { setTimeout as sleep } from "node:timers/promises";
import { API_HOST, FRONT, apiCall, launch } from "./cdp.mjs";
import { CASES, FREEZE_JS, WIDTHS, emptyBasket, seed } from "./cases.mjs";

const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const app = (args[0] || "http://127.0.0.1:18490").replace(/\/$/, "");
const front = resolve(args[1] || "visual/ihm-build");
const update = process.argv.includes("--update");
const OUT = process.env.OUT || "visual/out";
const BASE_DIR = process.env.BASELINE || new URL("./baseline/", import.meta.url).pathname;
// per-pixel tolerance (max channel difference, anti-aliasing) and share of differing pixels allowed
const CHANNEL_TOL = Number(process.env.VISUAL_CHANNEL_TOL || 24);
const MAX_RATIO = Number(process.env.VISUAL_MAX_RATIO || 0.001);
const MAX_HEIGHT = 8000; // a page longer than this is cut (and the size check reports a change)
if (!existsSync(join(front, "index.html"))) throw new Error(`no built front in ${front} (visual/build-ihm.sh)`);

mkdirSync(OUT, { recursive: true });
for (const f of readdirSync(OUT)) rmSync(join(OUT, f), { recursive: true, force: true });
mkdirSync(join(OUT, "diff"), { recursive: true });

const FREEZE = `
  *, *::before, *::after { animation: none !important; transition: none !important; caret-color: transparent !important; }
  html { scroll-behavior: auto !important; }
  .MuiTouchRipple-root { display: none !important; }
  #videoCover { visibility: hidden !important; }`;

const desktop = await launch({ mouse: true, cdpPort: Number(process.env.CDP_DESKTOP || 0) });
const phone = await launch({ mouse: false, cdpPort: Number(process.env.CDP_PHONE || 0) });
const browser = desktop;
const report = { chrome: browser.version, app, front: FRONT, shots: [], failures: [] };
console.log(`Chrome: ${browser.version}`);

const ctx = { emptyBasket: (name) => emptyBasket(apiCall, app, name) };

/** Logs `name` in through the API and gives the browser context that session cookie (as the front would get it). */
async function logIn(p, name) {
  let cookie;
  const r = await apiCall(app, "POST", "/session", {
    headers: { "Content-Type": "application/json", Origin: FRONT },
    body: JSON.stringify({ login: name, password: "nopassword" }),
  });
  for (const h of r.headers["set-cookie"] || []) if (h.startsWith("session=")) cookie = h.split(";")[0].slice("session=".length);
  if (r.status !== 200 || !cookie) throw new Error(`login ${name}: ${r.status} ${r.body}`);
  await p.send("Network.setCookie", { name: "session", value: cookie, domain: API_HOST, path: "/", secure: true, httpOnly: true, sameSite: "Lax" });
}

async function shoot(c, width) {
  const mobile = width < 600;
  if (c.before) await c.before(ctx);
  const p = await (mobile ? phone : desktop).page({ app, front, init: FREEZE_JS, apiDown: !!c.apiDown });
  try {
    const height = mobile ? 844 : 900;
    await p.send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile });
    if (mobile) await p.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 1 });
    await p.send("Emulation.setEmulatedMedia", {
      features: [{ name: "prefers-color-scheme", value: "light" }, { name: "prefers-reduced-motion", value: "reduce" }],
    });
    if (c.as) await logIn(p, c.as);
    await p.goto(FRONT + c.path);
    await p.idle();
    if (c.steps) await c.steps(p, ctx);
    if (c.ready && !(await p.waitFor(c.ready))) {
      const text = await p.evaluate("document.body.innerText.slice(0, 300)").catch(() => "?");
      throw new Error(`not ready: ${c.ready}\n    page text: ${JSON.stringify(text)}\n    requests: ${p.requests.join(", ")}`);
    }
    await p.idle();
    await sleep(c.settle ?? 300);
    const css = FREEZE + (c.mask || []).map((s) => `${s} { visibility: hidden !important; }`).join("\n");
    await p.evaluate(`(() => {
      const s = document.createElement("style"); s.textContent = ${JSON.stringify(css)}; document.head.appendChild(s);
      if (!${JSON.stringify(!!c.keepFocus)} && document.activeElement && document.activeElement !== document.body) document.activeElement.blur();
      if (!${JSON.stringify(!!c.viewport)}) window.scrollTo(0, 0);
      return true;
    })()`);
    for (let i = 0; i < 3; i++) await p.evaluate("new Promise((r) => requestAnimationFrame(() => r(true)))");
    await sleep(100);
    // full page, except the cases with a modal / menu / tooltip (c.viewport): their backdrop and position are
    // relative to the viewport, so the shot is what the visitor sees on the screen, where the steps left it
    const m = await p.send("Page.getLayoutMetrics");
    const h = Math.min(MAX_HEIGHT, Math.ceil(m.cssContentSize.height));
    const { data } = await p.send("Page.captureScreenshot", c.viewport
      ? { format: "png", captureBeyondViewport: false, fromSurface: true }
      : { format: "png", captureBeyondViewport: true, fromSurface: true, clip: { x: 0, y: 0, width, height: h, scale: 1 } });
    const errors = [...p.errors].filter((e) => !(c.allowErrors && c.allowErrors.test(e)));
    return { png: Buffer.from(data, "base64"), errors, allowed: p.errors.length - errors.length, requests: [...p.requests] };
  } finally {
    await p.close();
  }
}

/** Compares two PNGs in Chrome (canvas): differing pixels, and a diff picture (red where they differ). */
async function compare(a, b) {
  const p = await browser.page();
  const r = await p.evaluate(`(async () => {
    const load = (b64) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = "data:image/png;base64," + b64; });
    const [x, y] = await Promise.all([load(${JSON.stringify(a.toString("base64"))}), load(${JSON.stringify(b.toString("base64"))})]);
    if (x.width !== y.width || x.height !== y.height) return { size: [x.width, x.height, y.width, y.height] };
    const w = x.width, h = x.height;
    const get = (img) => { const c = new OffscreenCanvas(w, h); const g = c.getContext("2d"); g.drawImage(img, 0, 0); return g.getImageData(0, 0, w, h).data; };
    const da = get(x), db = get(y);
    const out = new OffscreenCanvas(w, h); const g = out.getContext("2d"); const od = g.createImageData(w, h);
    let diff = 0;
    for (let i = 0; i < da.length; i += 4) {
      const d = Math.max(Math.abs(da[i] - db[i]), Math.abs(da[i + 1] - db[i + 1]), Math.abs(da[i + 2] - db[i + 2]));
      if (d > ${CHANNEL_TOL}) { diff++; od.data[i] = 255; od.data[i + 1] = 0; od.data[i + 2] = 0; od.data[i + 3] = 255; }
      else { const v = (da[i] + da[i + 1] + da[i + 2]) / 3; od.data[i] = od.data[i + 1] = od.data[i + 2] = 255 - (255 - v) * 0.25; od.data[i + 3] = 255; }
    }
    g.putImageData(od, 0, 0);
    const blob = await out.convertToBlob({ type: "image/png" });
    const buf = new Uint8Array(await blob.arrayBuffer());
    let s = ""; for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
    return { diff, total: w * h, png: btoa(s) };
  })()`);
  await p.close();
  return r;
}

function printShot(name, png) {
  const b64 = png.toString("base64");
  const n = Math.ceil(b64.length / 8000);
  const sum = createHash("sha256").update(png).digest("hex");
  for (let i = 0; i < n; i++) console.log(`VISUAL-PNG ${name} ${i + 1}/${n} ${sum} ${b64.slice(i * 8000, (i + 1) * 8000)}`);
}

const selected = CASES.filter((x) => !process.env.ONLY || x.id.startsWith(process.env.ONLY));
const phases = [["empty", selected.filter((c) => c.phase === "empty")], ["seeded", selected.filter((c) => c.phase !== "empty")]];
for (const [phase, cases] of phases) {
  if (phase === "seeded") {
    await seed(apiCall, app);
    console.log("seeded: alice, bob (validated baskets), chloe (open basket), dan (empty)");
  }
  for (const c of cases) {
    for (const width of c.widths || WIDTHS) {
      const name = `${c.id}-${width}.png`;
      let shot;
      try {
        shot = await shoot(c, width);
      } catch (e) {
        report.failures.push({ name, reason: `could not take the shot: ${e.message}` });
        console.log(`FAIL  ${name}  (${e.message})`);
        continue;
      }
      writeFileSync(join(OUT, name), shot.png);
      const entry = { name, errors: shot.errors, allowedErrors: shot.allowed, requests: shot.requests };
      if (shot.errors.length) report.failures.push({ name, reason: `page error: ${shot.errors[0]}` });
      if (c.allowErrors && !shot.allowed) report.failures.push({ name, reason: `the pinned page error ${c.allowErrors} did not happen (fixed? update cases.mjs + TESTING.md)` });
      const basePath = join(BASE_DIR, name);
      if (update) {
        copyFileSync(join(OUT, name), basePath);
        entry.result = "baseline updated";
      } else if (!existsSync(basePath)) {
        entry.result = "no baseline";
        report.failures.push({ name, reason: "no baseline (visual/baseline/" + name + ")" });
      } else {
        const r = await compare(readFileSync(basePath), shot.png);
        if (r.size) {
          entry.result = `size ${r.size[0]}x${r.size[1]} -> ${r.size[2]}x${r.size[3]}`;
          report.failures.push({ name, reason: `page size changed: ${entry.result}` });
        } else {
          entry.ratio = r.diff / r.total;
          entry.result = r.diff ? `${r.diff} px differ (${(entry.ratio * 100).toFixed(3)} %)` : "identical";
          if (r.diff) writeFileSync(join(OUT, "diff", name), Buffer.from(r.png, "base64"));
          if (entry.ratio > MAX_RATIO) report.failures.push({ name, reason: entry.result });
        }
      }
      report.shots.push(entry);
      if (process.env.VISUAL_PRINT_NEW && report.failures.some((f) => f.name === name)) printShot(name, shot.png);
      console.log(`${report.failures.some((f) => f.name === name) ? "FAIL" : "ok  "}  ${name}  ${entry.result}`);
    }
  }
}

if (!update) {
  if (!process.env.ONLY) {
    const shot = new Set(report.shots.map((s) => s.name));
    for (const f of (existsSync(BASE_DIR) ? readdirSync(BASE_DIR) : []).filter((f) => f.endsWith(".png"))) {
      if (!shot.has(f) && !report.failures.some((x) => x.name === f)) report.failures.push({ name: f, reason: "baseline without a use case (removed from cases.mjs?)" });
    }
  }
  const prev = existsSync(join(BASE_DIR, "chrome.txt")) ? readFileSync(join(BASE_DIR, "chrome.txt"), "utf8").trim() : "";
  if (prev && prev !== browser.version) {
    console.log(`note: baselines were made with ${prev}, this run uses ${browser.version}`);
    report.baselineChrome = prev;
  }
} else {
  writeFileSync(join(BASE_DIR, "chrome.txt"), browser.version + "\n");
}

desktop.close();
phone.close();
writeFileSync(join(OUT, "report.json"), JSON.stringify(report, null, 2));
console.log(`\n${report.shots.length} shots, ${report.failures.length} failure(s)`);
for (const f of report.failures) console.log(`  - ${f.name}: ${f.reason}`);
process.exit(report.failures.length ? 1 : 0);
