// Visual use cases covered by the harness (ids from TESTING.md "Visual use cases").
// Each: { id, path, as?, phase?, widths?, before?, steps?, ready, viewport?, mask?, settle?, keepFocus?, allowErrors?, apiDown? }.
// - path: opened in a NEW browser context (a fresh visitor) at https://lbgca.hosh.it<path>; the front is the
//   built ihm/, the API is the container under test (visual/cdp.mjs).
// - as: the account the visitor is logged in with before the page opens (POST /session through the page's
//   own API origin, so the browser holds a real session cookie). No password: the name alone (owner decision).
// - phase: "empty" cases run first, on the fresh database (no order at all); "seeded" (default) cases run
//   after seed() created the fixed data below. Within a phase no case changes what another case shows
//   (the only case that orders, L5, uses its own account and empties its basket before each shot).
// - steps(page, ctx): what the visitor does before the shot. ready: a JS expression that must become true.
// - viewport: the shot is the screen as the steps left it (a dialog, menu or tooltip), not the full page.
// - allowErrors: the page error(s) this case produces today (a pinned bug, TESTING.md) do not fail the shot.
//
// Determinism: fresh database volume per run, fixed data, Date.now()/new Date() fixed and Math.random seeded
// (FREEZE_JS: the front draws none of them today, this keeps it so), animations/transitions/caret off, the
// landing video hidden (its source is not in git: Chrome shows a spinning "loading" control), placeholder
// pictures (visual/placeholders.mjs), a fixed viewport height (900, phone 844), full-page shots.
export const WIDTHS = [1400, 1024, 390];
const js = (v) => JSON.stringify(v);

// ---------- seeded data (made through the API, as the front does) ----------
// variant strings are built as the front builds them: `${matière} ${couleur} ${option}`
export const SEED = {
  alice: { orders: [["Couilles Pleines", "Sculpture - Plâtre Or Creusé"], ["Socle de stabilité", "Bougie - Cire Blanc "]],
    validate: true, comment: "Parfait pour le salon, mes plantes adorent. Merci Al² Studio !" },
  bob: { orders: [["Demi Avocat", "Pot de Fleur - Résine Transparent Rempli"]], validate: true },
  chloe: { orders: [["Couilles Pleines", "StressBall - Silicone Blanc Rempli"], ["Demi Avocat", "Bougie - Cire Blanc Creusé"]] },
  dan: { orders: [] },
};

/** A tiny client for the container with its own cookie jar (Node side, for seeding). */
export function client(apiCall, app) {
  let cookie = "";
  const call = async (method, path, body) => {
    const headers = { Origin: "https://lbgca.hosh.it", ...(cookie ? { Cookie: cookie } : {}) };
    if (body !== undefined) headers["Content-Type"] = "application/json";
    const r = await apiCall(app, method, path, { headers, body: body === undefined ? undefined : JSON.stringify(body) });
    const set = r.headers["set-cookie"];
    if (set) cookie = set.map((c) => c.split(";")[0]).join("; ");
    const text = r.body.toString("utf8");
    if (r.status >= 300) throw new Error(`seed: ${method} ${path} -> ${r.status} ${text.slice(0, 200)}`);
    try { return JSON.parse(text); } catch { return text; }
  };
  return { call };
}

export async function seed(apiCall, app) {
  for (const [name, u] of Object.entries(SEED)) {
    const c = client(apiCall, app);
    await c.call("POST", "/session", { login: name, password: "nopassword" });
    for (const [product, variant] of u.orders) await c.call("POST", "/order", { product, amount: 1, variant });
    if (u.validate) await c.call("POST", "/order/validate", { value: true });
    if (u.comment) {
      const me = await c.call("GET", `/user/${name}`);
      await c.call("POST", "/user", { ...me, avatar: null, comment: u.comment });
    }
  }
  const orders = await client(apiCall, app).call("GET", "/orders");
  if (orders.length !== 5 || orders.filter((o) => o.validated).length !== 3) throw new Error(`seed: unexpected orders ${js(orders)}`);
}

/** Empties the basket of `name` (every order deleted, the account kept). */
export async function emptyBasket(apiCall, app, name) {
  const c = client(apiCall, app);
  const s = await c.call("POST", "/session", { login: name, password: "nopassword" });
  await c.call("POST", "/order/validate", { value: false });
  for (const o of (await c.call("GET", "/orders")).filter((o) => o.user_id === s.userid)) await c.call("DELETE", `/order/${o.id}`);
}

// Runs in every document before its own scripts (Page.addScriptToEvaluateOnNewDocument).
export const FREEZE_JS = `(() => {
  const FIXED = 1767225600000; // 2026-01-01T00:00:00Z
  let s = 0x9e3779b9;
  Math.random = () => { // mulberry32
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const D = Date;
  function FixedDate(...a) { return a.length ? new D(...a) : new D(FIXED); }
  FixedDate.prototype = D.prototype; FixedDate.now = () => FIXED; FixedDate.UTC = D.UTC; FixedDate.parse = D.parse;
  window.Date = FixedDate;
})();`;

// ---------- steps ----------
async function must(p, expression, what, ms) {
  if (!(await p.waitFor(expression, ms))) throw new Error(`step failed: ${what}`);
}
/** Clicks the first visible element matching sel whose text contains label (textContent: MUI upper-cases in CSS). */
async function click(p, sel, label = "") {
  await must(p, `(() => {
    const e = [...document.querySelectorAll(${js(sel)})].find((x) => x.textContent.includes(${js(label)}) && !x.disabled && x.offsetParent);
    if (!e) return false;
    e.click();
    return true;
  })()`, `click ${sel} "${label}"`);
}
/** Types into the first element matching sel (focus + Input.insertText = real key input for React). */
async function type(p, sel, text) {
  await must(p, `(() => { const e = document.querySelector(${js(sel)}); if (!e) return false; e.focus(); return true; })()`, `focus ${sel}`);
  await p.send("Input.insertText", { text });
}
/** Moves the mouse over the centre of the first element matching sel (hover: tooltips). */
async function hover(p, sel, label = "") {
  const box = await p.evaluate(`(() => {
    const e = [...document.querySelectorAll(${js(sel)})].find((x) => x.textContent.includes(${js(label)}));
    if (!e) return null;
    e.scrollIntoView({ block: "center" });
    const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  })()`);
  if (!box) throw new Error(`step failed: hover ${sel} "${label}"`);
  await p.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: box.x, y: box.y });
}
/** MUI Select opens on mousedown of its [role=button]/[role=combobox] element. */
async function openSelect(p, index) {
  await must(p, `(() => { const e = document.querySelectorAll(".product-display [role=combobox], .product-display [role=button][aria-haspopup]")[${index}];
    if (!e) return false; e.scrollIntoView({ block: "center" }); e.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, button: 0 })); return true; })()`, `open select #${index}`);
}

const header = `document.querySelector(".header")?.innerText || ""`;
// the header shows the session: logged in as `name` with `n` orders in the basket (MUI upper-cases the text)
const loggedAs = (name, n) => `(${header}).toUpperCase().includes(${js(name.toUpperCase())}) && /\\b${n}\\b/.test(${header})`;
const guest = `/LOGIN/i.test(${header}) && !document.querySelector(".header svg[data-testid=LogoutIcon]")`;
const text = (t) => `document.body.innerText.includes(${js(t)})`;
const products = `document.querySelectorAll(".product-display").length === 3 && [...document.querySelectorAll(".product-display img")].every((i) => i.complete && i.naturalWidth > 0)`;
const home = `document.querySelectorAll(".descBlock").length === 4 && ${text("Culminant l'expérience")}`;
const loginForm = `!!document.querySelector(".main-frame input") && ${text("Login")} && !document.querySelector(".descBlock")`;
const dialog = `document.querySelector("[role=dialog]")`;

export const CASES = [
  // ---------- phase "empty": fresh database ----------
  {
    // "Les Paniers" before anybody validated a basket: an empty white frame
    id: "L12-all-baskets-empty", phase: "empty", path: "/all", as: "dan",
    ready: `${loggedAs("dan", 0)} && !!document.querySelector(".main-frame") && !document.querySelector(".main-frame .MuiPaper-root")`,
  },

  // ---------- guest (logged out) ----------
  { id: "G1-home-guest", path: "/", ready: `${guest} && ${home}` },
  {
    id: "G2-login-dialog", path: "/",
    steps: async (p) => { await must(p, `${guest} && ${home}`, "home"); await click(p, ".header button", "Login"); },
    ready: `!!${dialog} && !!${dialog}.querySelector("input")`,
    viewport: true,
  },
  {
    // a login under 3 characters: the field turns red with "Login must be 3 char long"
    id: "G3-login-too-short", path: "/",
    steps: async (p) => {
      await must(p, `${guest} && ${home}`, "home");
      await click(p, ".header button", "Login");
      await type(p, "[role=dialog] input", "ab");
      await click(p, "[role=dialog] button", "Login");
    },
    ready: `!!${dialog} && ${dialog}.innerText.includes("Login must be 3 char long")`,
    viewport: true,
  },
  {
    // any other page while logged out (/products, /all, /myBasket, /user/x): the login form in the frame
    id: "G4-products-guest", path: "/products", ready: `${guest} && ${loginForm}`,
  },
  {
    // the visitor logs in from the header dialog (creates the account "erin" on first use): the header
    // shows the name and an empty basket, the page stays on the landing
    id: "G5-after-login", path: "/",
    steps: async (p) => {
      await must(p, `${guest} && ${home}`, "home");
      await click(p, ".header button", "Login");
      await type(p, "[role=dialog] input", "erin");
      await click(p, "[role=dialog] button", "Login");
    },
    ready: `${loggedAs("erin", 0)} && !${dialog} && ${home}`,
  },

  // ---------- logged in ----------
  { id: "L1-home-logged-in", path: "/", as: "chloe", ready: `${loggedAs("chloe", 2)} && ${home}` },
  { id: "L2-products", path: "/products", as: "dan", ready: `${loggedAs("dan", 0)} && ${products}` },
  {
    // the zoom dialog of the first product (its first photo, previous/next arrows, "Fermer")
    id: "L3-product-zoom", path: "/products", as: "dan",
    steps: async (p) => {
      await must(p, `${loggedAs("dan", 0)} && ${products}`, "products");
      await must(p, `(() => { const b = [...document.querySelectorAll(".product-display button")].find((b) => b.querySelector("[data-testid=ZoomInIcon]"));
        if (!b) return false; b.click(); return true; })()`, "zoom");
    },
    ready: `!!${dialog} && !!${dialog}.querySelector("img[alt='product image zoomed']")?.naturalWidth`,
    viewport: true,
  },
  {
    // the "Matière" menu of the first product is open
    id: "L4-product-material-menu", path: "/products", as: "dan",
    steps: async (p) => { await must(p, `${loggedAs("dan", 0)} && ${products}`, "products"); await openSelect(p, 0); },
    ready: `document.querySelectorAll("[role=listbox] [role=option]").length === 4`,
    keepFocus: true,
    viewport: true,
  },
  {
    // "add to basket" on the first product: the header's basket count goes to 1
    id: "L5-product-added", path: "/products", as: "frank",
    before: async (ctx) => ctx.emptyBasket("frank"),
    steps: async (p) => {
      await must(p, `${loggedAs("frank", 0)} && ${products}`, "products");
      await must(p, `(() => { const b = document.querySelector(".product-display button[aria-label=order]"); if (!b) return false; b.click(); return true; })()`, "add to basket");
    },
    ready: `${loggedAs("frank", 1)}`,
    settle: 500,
  },
  {
    // a validated basket: no "add" button on the products any more, a tick in the header
    id: "L6-products-basket-validated", path: "/products", as: "alice",
    ready: `${loggedAs("alice", 2)} && ${products} && !document.querySelector(".product-display button[aria-label=order]") && !!document.querySelector(".header [data-testid=CheckBoxIcon]")`,
  },
  { id: "L7-basket-empty", path: "/myBasket", as: "dan", ready: `${loggedAs("dan", 0)} && ${text("Your Basket")}` },
  {
    id: "L8-basket-open", path: "/myBasket", as: "chloe",
    ready: `${loggedAs("chloe", 2)} && ${text("Your Basket")} && document.querySelectorAll("[data-testid=DeleteIcon]").length === 2 && /Valider mon panier/i.test(document.body.innerText)`,
  },
  {
    // the tooltip of "Valider mon panier" (mouse only: desktop and laptop)
    id: "L9-basket-validate-tooltip", path: "/myBasket", as: "chloe", widths: [1400, 1024],
    steps: async (p) => {
      await must(p, `${loggedAs("chloe", 2)} && document.querySelectorAll("[data-testid=DeleteIcon]").length === 2`, "basket");
      await hover(p, ".main-frame button", "mon panier");
    },
    ready: `!!document.querySelector("[role=tooltip]") && document.querySelector("[role=tooltip]").innerText.includes("prêt à fabriquer")`,
    settle: 600,
    viewport: true,
  },
  {
    // a validated basket: ticks instead of delete buttons, "Dé-Valider", the review field with the comment
    id: "L10-basket-validated", path: "/myBasket", as: "alice",
    ready: `${loggedAs("alice", 2)} && /Dé-Valider/i.test(document.body.innerText) && document.querySelector(".main-frame textarea")?.value === ${js(SEED.alice.comment)}`,
  },
  {
    // the review is being edited: "Publish" and "Reset" appear (nothing is sent)
    id: "L11-basket-review-edited", path: "/myBasket", as: "alice",
    steps: async (p) => {
      await must(p, `document.querySelector(".main-frame textarea")?.value === ${js(SEED.alice.comment)}`, "review loaded");
      await must(p, `(() => { const t = document.querySelector(".main-frame textarea"); t.focus(); t.setSelectionRange(t.value.length, t.value.length); return true; })()`, "focus review");
      await p.send("Input.insertText", { text: " Et vite livré." });
    },
    ready: `/Publish/i.test(document.body.innerText) && /Reset/i.test(document.body.innerText)`,
  },
  {
    // "Les Paniers": every validated basket (alice with her review, bob), not chloe's open one
    id: "L13-all-baskets", path: "/all", as: "dan",
    ready: `${loggedAs("dan", 0)} && document.querySelectorAll(".main-frame .small-logo-parent").length === 2 && ${text("Demi Avocat")}`,
  },
  {
    // your own page: name, logout, avatar (initial letter), avatar upload field
    id: "L14-user-own-page", path: "/user/dan", as: "dan",
    ready: `${loggedAs("dan", 0)} && ${text("Page of dan")} && !!document.querySelector("#file-input")`,
  },
  {
    id: "L15-user-other-page", path: "/user/alice", as: "dan",
    ready: `${loggedAs("dan", 0)} && ${text("Page of alice")} && !document.querySelector("#file-input")`,
  },
  {
    // a name nobody has: the API answers 400 "No user found", the front's REST layer hands the error body on
    // as if it were the user, and the page says "Page of" with no name (pinned bug, TESTING.md)
    id: "L16-user-unknown", path: "/user/nobody", as: "dan",
    ready: `${loggedAs("dan", 0)} && ${text("Page of")}`,
  },
  {
    // a path the front does not know: the white frame stays empty
    id: "L17-unknown-route", path: "/nope", as: "dan",
    ready: `${loggedAs("dan", 0)} && !!document.querySelector(".main-frame") && document.querySelector(".main-frame").innerText.trim() === ""`,
  },

  // ---------- error ----------
  {
    // the API does not answer: the front shows the guest landing; the failed GET /session resolves to nothing
    // and initUser throws "Cannot read properties of undefined (reading 'connected')" (pinned bug, TESTING.md)
    id: "E1-api-down", path: "/", apiDown: true,
    ready: `${guest} && ${home}`,
    allowErrors: /reading 'connected'/,
    settle: 500,
  },
];
// Not covered (TESTING.md): the avatar upload (a file picker), "Publish" of a review and "Valider"/"Dé-Valider"
// clicks (they change shared data; the resulting states are shot from seeded data: L10, L13), the landing video
// (not in git), the real pictures (not in git: placeholders).
