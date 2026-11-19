# Testing

Safety net for upgrades (Python base image, Flask / Flask-Session / SQLAlchemy, Actions): it pins what the
API does today so a Dependabot PR is judged on its CI run.

## Layout

| part | what | shipped as |
|---|---|---|
| `server/` | Flask API (`app/`), gunicorn, SQLite via Flask-SQLAlchemy, server-side sessions (Flask-Session) | image `ghcr.io/pazka/lbgca` (api-lbgca.hosh.it) |
| `ihm/` | CRA React front | deployed separately (prebuilt bundle also committed in `ihm/public/static`) |

The image copies `config_prod.py` over `config.py`; tests use that production config.

## Run it

```bash
docker build -t lbgca:smoke server
docker run --rm -v "$PWD/server:/src:ro" lbgca:smoke \
  sh -c 'mkdir /w && cp -r /src/app /src/tests /w/ && cd /w && python -m unittest discover -s tests -v'
bash scripts/smoke.sh lbgca:smoke          # mode ro (default)
bash scripts/smoke.sh lbgca:smoke legacy   # the box's legacy compose
bash scripts/smoke.sh lbgca:smoke template # the hosh-deploy compose (CI only: fixed names lbgca / lbgca-data)
bash scripts/smoke.sh lbgca:smoke cutover  # DEPLOY.md §5 rehearsal (CI only)
bash scripts/check-register.sh             # what `hosh-deploy register` validates on the box

# next Python before Dependabot's PR lands
sed 's/python:3.12-slim/python:3.14-slim/' server/Dockerfile | docker build -f - -t lbgca:next server
```

(Windows Git Bash: prefix `docker run` with `MSYS_NO_PATHCONV=1`, mount `"$(cygpath -w "$PWD/server")"`.)

## CI (`.github/workflows/ci.yml`)

PRs, `main`, `agent/**`, all blocking: `server tests (python 3.12|3.14)`; `container smoke` (builds
`server/`, runs `scripts/smoke.sh` in every mode below); `ihm build` (compile
check: the images are not in git, `scripts/ihm-stub-assets.sh` puts placeholders at the imported paths);
`visual regression` (below).

## What is covered

`server/tests/test_api.py` (22 tests, stdlib, production config, temp DB): boot text with the session
count, JSON 404, DB schema, signup, login-creates-account and **the exact `/session` body the front reads**
(`connected`, `username`, …) with the cookie flags, login without password (and legacy accounts that had
one), no password stored, logout, profile read/edit, order create / edit / validate / delete, order routes
need a session, cannot edit or delete another user's order, cannot edit a validated order, orders of a user,
public order list; `/healthz` (exact body, loopback Host, HEAD, 503 without database); env layout (defaults =
legacy paths, `DATA_DIR`/`STATIC_DIR` fresh volume without `init_database.db`, an existing database is never
replaced).

`scripts/smoke.sh <image> <mode>`: the built image, then boot, 404, login body, profile, order, order edit,
public list, logout, database file on the volume, no tracebacks. Modes:
- `ro`: read-only rootfs + `cap_drop ALL` + `no-new-privileges`, database and static named volumes.
- `legacy`: the box's legacy compose verbatim (`scripts/compose/legacy-box.yml`: root, `cap_add` CHOWN/SETGID/
  SETUID/NET_BIND_SERVICE, bind mounts `./app/database` + `.docker/static`, container port 80). Every image must
  keep passing it until the hosh-deploy cutover. Also proves the data (orders, accounts, server-side sessions)
  survives `compose restart` and `down`/`up`.
- `template`: `docker-compose.example.yml` + `.env.example` as `/srv/lbgca` on the box (user 10001, read-only
  rootfs, volume `lbgca-data` at `/data`, PORT 8000), checked like hosh-deploy does (healthy, non-root,
  read-only, loopback `/healthz` without Host header), then the flow, `POST_DEPLOY` (`server/app/smoke.py`,
  leaves no order), data kept across restart/re-create, rootfs not writable.
- `cutover`: legacy with data → stop → the DEPLOY.md §5 data move → same `database.db` sha256 in `lbgca-data`
  → template serves the data + `POST_DEPLOY` → rollback to legacy, data intact.

`release.yml` runs the unit tests, `check-register.sh` and the `legacy` + `template` smoke on the candidate
image before pushing anything.

## Visual use cases (front `ihm/`, harness `visual/`)

Every page and state a visitor of lbgca.hosh.it can reach, shot by `visual/run.sh` at **1400, 1024 and 390 px**
(phone = touch, no mouse) and compared with `visual/baseline/<id>-<width>.png` (CI job `visual regression`;
shots, diffs and `report.json` in the artifact `visual-<sha>`). Accounts have no password (owner decision):
"logged in as X" = the name X typed in the login dialog.

| id | page / state | steps to reach it |
|---|---|---|
| G1-home-guest | landing (Présentation), logged out | open `/` |
| G2-login-dialog | login dialog open | `/`, header **Login** |
| G3-login-too-short | login dialog, error "Login must be 3 char long" | `/`, **Login**, type `ab`, dialog **Login** |
| G4-products-guest | any other page logged out (`/products`, `/all`, `/myBasket`, `/user/x`): the login form in the frame | open `/products` logged out |
| G5-after-login | just logged in from the dialog (new account `erin`): name + empty basket in the header | `/`, **Login**, type `erin`, dialog **Login** |
| L1-home-logged-in | landing logged in, basket of 2 | logged in as `chloe`, `/` |
| L2-products | the shop "Les Oeufs du Magasin": 3 products, photo, arrows, zoom, Matière / Couleur / Option | logged in as `dan`, header **Les Oeufs du Magasin** |
| L3-product-zoom | the zoom dialog of a product photo | L2, zoom icon of the first product |
| L4-product-material-menu | the "Matière" menu open | L2, first product's **Matière** |
| L5-product-added | a product added: basket count 1 in the header | logged in as `frank` (empty basket), L2, cart button of the first product |
| L6-products-basket-validated | shop with a validated basket: no cart buttons, a tick in the header | logged in as `alice` (validated), `/products` |
| L7-basket-empty | "Your Basket" empty | logged in as `dan`, header basket button |
| L8-basket-open | basket with 2 orders, delete buttons, **Valider mon panier** | logged in as `chloe`, `/myBasket` |
| L9-basket-validate-tooltip | the tooltip of **Valider mon panier** (1400 / 1024 only: mouse hover) | L8, hover the button |
| L10-basket-validated | validated basket: ticks, **Dé-Valider mon panier**, the review field | logged in as `alice`, `/myBasket` |
| L11-basket-review-edited | review being edited: **Publish** / **Reset** shown | L10, type in the review |
| L12-all-baskets-empty | "Les Paniers" before any validated basket (empty frame) | fresh database, logged in, header **Les Paniers** |
| L13-all-baskets | "Les Paniers": every validated basket (alice with her review, bob), not chloe's open one | logged in as `dan`, `/all` |
| L14-user-own-page | your own page: Logout, avatar (initial), avatar upload field | logged in as `dan`, `/user/dan` |
| L15-user-other-page | somebody else's page (no edit) | logged in as `dan`, `/user/alice` |
| L16-user-unknown | page of a name nobody has | logged in as `dan`, `/user/nobody` |
| L17-unknown-route | a path the front does not know (empty frame) | logged in, `/nope` |
| E1-api-down | the API does not answer: guest landing | `/` with api-lbgca.hosh.it unreachable |

Seeded data (`visual/cases.mjs` SEED, made through the API on a fresh volume, as the front does): `alice` 2 orders,
validated, review "Parfait pour le salon…"; `bob` 1 order validated; `chloe` 2 orders not validated; `dan` none.
L12 runs before the seed. Determinism: fixed clock and seeded `Math.random` (the front uses neither today),
animations, transitions, ripples and caret off, fixed viewport height (900, phone 844), full-page shots except
the dialog / menu / tooltip cases (screen as the visitor sees it).

**Pictures.** The front's images and the landing video are not in git (Google Drive,
`ihm/public/README-ressource-to-fetch.txt`). The harness builds the front from a copy of `ihm/` where every
missing picture is a flat-colour placeholder with a darker frame (`visual/placeholders.mjs`); the landing
`<video>` (404 here) is hidden. So the shots check the layout, texts and states, not the real pictures.

Not covered: the avatar upload (file picker), **Publish** of a review and the **Valider** / **Dé-Valider** clicks
(they change shared data; the states they lead to are shot from seeded data: L10, L13), logout (leads to G1),
the real pictures and video.

Run it (Docker + Chrome): `docker build -t lbgca:smoke server && CHROME=$(command -v google-chrome) bash visual/run.sh lbgca:smoke`
(`IHM_BUILD=<dir>` reuses a front built by `visual/build-ihm.sh <dir>`; `ONLY=L1` some cases). A baseline only
means something for the Chrome that made it (`visual/baseline/chrome.txt`, the GitHub runner's): new baselines
come from the CI artifact (or `node visual/from-log.mjs <job log>`), are looked at one by one, and are committed
in a PR that says the visual change is wanted.

### Bugs the shots show today (pinned, not fixed: owner decision)

- **E1**: when the API does not answer, the front's REST layer resolves failed calls to `undefined` and
  `initUser` throws `Cannot read properties of undefined (reading 'connected')` (an uncaught page error,
  allowed for E1 only). The visitor sees the guest landing; logging in silently does nothing.
- **L16**: `/user/<unknown>` shows "Page of" with no name: the 400 "No user found" body is used as the user.
- Short pages (G4, L7-L17 except L13 at 390): the blue background ends under the footer; the rest of the screen is white.
- Footer: it touches the bottom of the page (no margin), and at 390 px its signature "xoxo Al² Studio" breaks
  onto two lines ("Studio" alone at the left).
- Every viewport narrower than 2:1 (all of 1400x900, 1024x900, 390x844) gets the `max-aspect-ratio: 2/1` "small
  screen" style (x-small text, 80 % frame), so desktop and phone share it.
- L14: the **Logout** text button is light blue on white (low contrast).

## Changes and upgrades (2026-10-19)

- **No passwords** (owner decision): the login name opens or creates the account; a sent password is ignored;
  new accounts store `""`. Accounts created earlier with a password still log in by name.
- **Python 3.14 fix**: on 3.14 `json.dumps(session, default=…)` serialised the Flask-Session object itself
  (`accessed`, `modified`, `sid`…) instead of its items, which broke the front's login.
  `services` now serialises `dict(session)`. 17/17 tests and the smoke pass on 3.12 and 3.14 → Dependabot #4
  (Python 3.14) is a **go**.
- Fixed: `POST /order/<id>` (always 500 before; now edits your own, non-validated order),
  `GET /user/<id>/orders` (always 500), `delete_order` commits, order routes answer 400 "User is not
  connected" without a session instead of a 500.
- `SECRET_KEY` comes from the environment (random per boot otherwise). It is not used for sessions
  (Flask-Session ids are not signed), but the value that was committed must be considered public.
  Session cookie is now `Secure; SameSite=Lax` in production (the site is HTTPS only).
- `gunicorn` pinned in `server/app/requirements.txt`; duplicate `server/requirements.txt` removed;
  `ihm/package-lock.json` re-synced (adds the missing `typescript` entry only).

## Known issues (kept)

- `GET /orders` needs no session and returns every order with its user's profile (by design, joke site).
- Image default user is root (the legacy compose needs it); the hosh-deploy compose runs it as 10001.
- SQLAlchemy is a transitive, unpinned dependency.
- `server/identifier.sqlite` is committed (not read by this work).
