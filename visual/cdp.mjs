// Minimal Chrome DevTools Protocol client: Node built-ins only (fetch, WebSocket, http, child_process).
// Same approach as pazka/hosh-hub tools/interact.mjs, pazka/WordWave and pazka/henryivrevival visual/cdp.mjs:
// no package is installed for the visual harness.
//
// lbgca specifics: the front (ihm/) always talks to https://api-lbgca.hosh.it (ihm/src/services/config, PROD),
// and the image only accepts that host (Flask SERVER_NAME) and the CORS origin https://lbgca.hosh.it, with a
// `Secure; SameSite=Lax` session cookie for `.hosh.it`. So the pages are opened at their real production URL,
// https://lbgca.hosh.it/..., and Chrome's Fetch domain pauses every request to the two origins:
//   - https://lbgca.hosh.it/*      is answered from the built front (a directory, like the static host does:
//                                  a file when it exists, index.html for any other path = the SPA routes);
//   - https://api-lbgca.hosh.it/*  is replayed on the container under test (same method, headers, body, Origin,
//                                  Host api-lbgca.hosh.it, the context's cookies) and fulfilled with its answer
//                                  (CORS headers and Set-Cookie included: Chrome applies them as usual).
// Nothing goes to the network: every host name resolves to nothing (RESOLVER_RULES).
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { request as httpRequest } from "node:http";
import { tmpdir } from "node:os";
import { extname, join, normalize } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

export const FRONT = "https://lbgca.hosh.it";
export const API = "https://api-lbgca.hosh.it";
export const API_HOST = "api-lbgca.hosh.it";
export const RESOLVER_RULES = "MAP * ~NOTFOUND";

// request headers Chrome reports that must not be replayed as such
const DROP_REQ = new Set(["host", "content-length", "connection", "accept-encoding", "keep-alive", "transfer-encoding"]);
// response headers that no longer describe the body handed back to Chrome
const DROP_RES = new Set(["content-encoding", "content-length", "transfer-encoding", "connection", "keep-alive"]);
const TYPES = {
  ".html": "text/html; charset=utf-8", ".js": "application/javascript", ".css": "text/css", ".json": "application/json",
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".gif": "image/gif", ".svg": "image/svg+xml",
  ".ico": "image/x-icon", ".txt": "text/plain", ".map": "application/json", ".mp4": "video/mp4",
};

/** One request to the container (node:http: the Host header is ours to set). */
export function apiCall(app, method, path, { headers = {}, body } = {}) {
  const u = new URL(app);
  return new Promise((res, rej) => {
    const r = httpRequest({ host: u.hostname, port: u.port, method, path, headers: { ...headers, Host: API_HOST } }, (resp) => {
      const chunks = [];
      resp.on("data", (c) => chunks.push(c));
      resp.on("end", () => res({ status: resp.statusCode, headers: resp.headers, rawHeaders: resp.rawHeaders, body: Buffer.concat(chunks) }));
    });
    r.on("error", rej);
    if (body !== undefined) r.write(body);
    r.end();
  });
}

/** The built front: a file when it exists, else index.html (client-side routes), like a SPA static host. */
function frontFile(root, pathname) {
  let rel;
  try { rel = normalize(decodeURIComponent(pathname)).replace(/^(\.\.[/\\])+/, ""); } catch { rel = "/"; }
  const file = join(root, rel);
  if (file.startsWith(root) && existsSync(file) && statSync(file).isFile()) {
    return { status: 200, type: TYPES[extname(file).toLowerCase()] || "application/octet-stream", body: readFileSync(file) };
  }
  // a missing asset (a picture, the landing video) is a 404, like on a static host; a route is the SPA
  if (extname(rel) && extname(rel) !== ".html") return { status: 404, type: "text/plain", body: Buffer.from("not found") };
  return { status: 200, type: TYPES[".html"], body: readFileSync(join(root, "index.html")) };
}

/**
 * Starts headless Chrome ($CHROME or google-chrome) and returns { page(), close(), version }.
 * cdpPort: use a Chrome already started with --remote-debugging-port=<cdpPort> (visual/run.sh).
 * mouse: the visitor has a mouse (hover: hover, pointer: fine); headless Chrome says "none" otherwise.
 */
export async function launch({ mouse = false, cdpPort = 0 } = {}) {
  if (cdpPort) return connect(cdpPort, null, null);
  const profile = mkdtempSync(join(tmpdir(), "lbgca-visual-"));
  const chrome = spawn(process.env.CHROME || "google-chrome", [
    "--headless=new", "--no-sandbox", "--disable-gpu", "--mute-audio", "--no-first-run",
    "--hide-scrollbars", "--force-color-profile=srgb", "--font-render-hinting=none",
    "--disable-features=Translate,MediaRouter", "--disable-background-networking", "--lang=en-US",
    "--autoplay-policy=no-user-gesture-required",
    ...(mouse ? ["--blink-settings=primaryHoverType=2,availableHoverTypes=2,primaryPointerType=4,availablePointerTypes=4"] : []),
    `--host-resolver-rules=${RESOLVER_RULES}`,
    "--remote-debugging-port=0", `--user-data-dir=${profile}`, "about:blank",
  ], { stdio: ["ignore", "ignore", "pipe"] });
  let stderr = "";
  chrome.stderr.on("data", (d) => { stderr = (stderr + d).slice(-4000); });
  let port;
  for (let i = 0; i < 300 && !port; i++) {
    try { port = Number(readFileSync(join(profile, "DevToolsActivePort"), "utf8").split("\n")[0]); }
    catch { await sleep(100); }
  }
  if (!port) {
    chrome.kill();
    throw new Error(`Chrome did not start in 30 s (set CHROME=/path/to/chrome)\n${stderr}`);
  }
  return connect(port, chrome, profile);
}

async function connect(port, chrome, profile) {
  let info;
  for (let i = 0; i < 300 && !info; i++) {
    try { info = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json(); }
    catch { await sleep(100); }
  }
  if (!info) throw new Error(`no Chrome DevTools endpoint on 127.0.0.1:${port}`);
  const ws = new WebSocket(info.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let seq = 0;
  const pending = new Map();
  const listeners = new Set();
  ws.onmessage = (m) => {
    const d = JSON.parse(m.data);
    if (d.id && pending.has(d.id)) {
      const { res, rej } = pending.get(d.id);
      pending.delete(d.id);
      d.error ? rej(new Error(`${d.error.message}`)) : res(d.result);
    } else for (const l of listeners) l(d);
  };
  const raw = (method, params = {}, sessionId) => new Promise((res, rej) => {
    const id = ++seq;
    pending.set(id, { res, rej });
    ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
  });

  /**
   * A new tab in its own browser context (own cookies = a fresh visitor).
   * app: http://127.0.0.1:<port> of the container (the API); front: the built front's directory.
   * init: a script run in every document before the page's own scripts (visual/cases.mjs FREEZE_JS).
   * apiDown: every API request fails (connection refused), the front alone answers.
   */
  async function page({ app, front, init, apiDown = false } = {}) {
    const { browserContextId } = await raw("Target.createBrowserContext", { disposeOnDetach: true });
    const { targetId } = await raw("Target.createTarget", { url: "about:blank", browserContextId });
    const { sessionId } = await raw("Target.attachToTarget", { targetId, flatten: true });
    const send = (method, params) => raw(method, params, sessionId);
    const errors = [];
    const requests = []; // "<method> <origin-less path> -> <status>" of every answered request (report.json)
    const inflight = new Set();
    let closed = false;
    const fulfil = (requestId, responseCode, responseHeaders, body) => closed ? null
      : send("Fetch.fulfillRequest", { requestId, responseCode, responseHeaders, body: body.toString("base64") });
    const answer = async (p) => {
      const u = new URL(p.request.url);
      const tag = `${u.origin === API ? "api" : "front"} ${p.request.method} ${u.pathname}`;
      try {
        if (u.origin === FRONT) {
          const f = frontFile(front, u.pathname);
          requests.push(`${tag} -> ${f.status}`);
          await fulfil(p.requestId, f.status, [{ name: "Content-Type", value: f.type }, { name: "Cache-Control", value: "no-store" }], f.body);
          return;
        }
        if (apiDown) throw new Error("API down (use case)");
        const headers = {};
        for (const [k, v] of Object.entries(p.request.headers || {})) if (!DROP_REQ.has(k.toLowerCase())) headers[k] = v;
        // the request stage does not list the cookies Chrome will attach: add the context's own
        if (!Object.keys(headers).some((k) => k.toLowerCase() === "cookie")) {
          const { cookies } = await send("Network.getCookies", { urls: [p.request.url] });
          if (cookies.length) headers.Cookie = cookies.map((c) => `${c.name}=${c.value}`).join("; ");
        }
        let body;
        if (p.request.postDataEntries?.length) {
          body = Buffer.concat(p.request.postDataEntries.map((e) => Buffer.from(e.bytes || "", "base64")));
        } else if (p.request.postData !== undefined) body = p.request.postData;
        const r = await apiCall(app, p.request.method, u.pathname + u.search, { headers, body });
        const responseHeaders = [];
        for (let i = 0; i < r.rawHeaders.length; i += 2) {
          if (!DROP_RES.has(r.rawHeaders[i].toLowerCase())) responseHeaders.push({ name: r.rawHeaders[i], value: r.rawHeaders[i + 1] });
        }
        requests.push(`${tag} -> ${r.status}`);
        await fulfil(p.requestId, r.status, responseHeaders, r.body);
      } catch (e) {
        requests.push(`${tag} -> failed (${e.message})`);
        if (!closed) await send("Fetch.failRequest", { requestId: p.requestId, errorReason: "ConnectionRefused" }).catch(() => {});
      }
    };
    listeners.add((d) => {
      if (d.sessionId !== sessionId) return;
      if (d.method === "Fetch.requestPaused") {
        const t = answer(d.params).catch(() => {}).finally(() => inflight.delete(t));
        inflight.add(t);
      }
      if (d.method === "Runtime.exceptionThrown") {
        errors.push(d.params.exceptionDetails.exception?.description || d.params.exceptionDetails.text);
      }
      if (d.method === "Page.javascriptDialogOpening") {
        errors.push(`dialog ${d.params.type}: ${d.params.message}`);
        raw("Page.handleJavaScriptDialog", { accept: false }, sessionId).catch(() => {});
      }
    });
    await send("Page.enable");
    await send("Runtime.enable");
    await send("Network.enable");
    await send("Fetch.enable", { patterns: [{ urlPattern: `${FRONT}/*`, requestStage: "Request" }, { urlPattern: `${API}/*`, requestStage: "Request" }] });
    if (init) await send("Page.addScriptToEvaluateOnNewDocument", { source: init });
    const evaluate = async (expression) => {
      const r = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
      if (r.exceptionDetails) throw new Error(`evaluate failed: ${r.exceptionDetails.exception?.description || r.exceptionDetails.text}`);
      return r.result.value;
    };
    const waitFor = async (expression, ms = 10000) => {
      const end = Date.now() + ms;
      while (Date.now() < end) {
        try { if (await evaluate(expression)) return true; } catch { /* navigating */ }
        await sleep(50);
      }
      return false;
    };
    // no request in flight for `quiet` ms (the front fires its API calls in chains: session, profile, orders)
    const idle = async (quiet = 300, ms = 10000) => {
      const end = Date.now() + ms;
      let since = Date.now(), n = requests.length;
      while (Date.now() < end) {
        if (inflight.size || requests.length !== n) { since = Date.now(); n = requests.length; }
        else if (Date.now() - since >= quiet) return true;
        await sleep(25);
      }
      return false;
    };
    const goto = async (href) => {
      await send("Page.navigate", { url: href });
      await sleep(100);
      if (!(await waitFor("document.readyState === 'complete'"))) throw new Error(`page did not load: ${href}`);
      await evaluate("document.fonts ? document.fonts.ready.then(() => true) : true");
    };
    const close = async () => { closed = true; await raw("Target.closeTarget", { targetId }).catch(() => {}); };
    return { send, evaluate, waitFor, idle, goto, close, errors, requests };
  }

  function close() {
    try { ws.close(); } catch { /* closed */ }
    if (chrome) chrome.kill();
    if (profile) try { rmSync(profile, { recursive: true, force: true }); } catch { /* busy */ }
  }
  return { page, close, version: info.Browser };
}
