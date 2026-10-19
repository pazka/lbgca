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
bash scripts/smoke.sh lbgca:smoke

# next Python before Dependabot's PR lands
sed 's/python:3.12-slim/python:3.14-slim/' server/Dockerfile | docker build -f - -t lbgca:next server
```

(Windows Git Bash: prefix `docker run` with `MSYS_NO_PATHCONV=1`, mount `"$(cygpath -w "$PWD/server")"`.)

## CI (`.github/workflows/ci.yml`)

PRs, `main`, `agent/**`, all blocking: `server tests (python 3.12|3.14)`; `container smoke` (builds
`server/`, runs `scripts/smoke.sh` with a read-only rootfs and the compose volumes); `ihm build` (compile
check: the images are not in git, `scripts/ihm-stub-assets.sh` puts placeholders at the imported paths).

## What is covered

`server/tests/test_api.py` (17 tests, stdlib, production config, temp DB): boot text with the session
count, JSON 404, DB schema, signup, login-creates-account and **the exact `/session` body the front reads**
(`connected`, `username`, …) with the cookie flags, login without password (and legacy accounts that had
one), no password stored, logout, profile read/edit, order create / edit / validate / delete, order routes
need a session, cannot edit or delete another user's order, cannot edit a validated order, orders of a user,
public order list.

`scripts/smoke.sh`: the built image, read-only rootfs + `cap_drop ALL` + `no-new-privileges`, database and
static volumes as in `docker-compose.yml`: boot, 404, login body, profile, order, order edit, public list,
logout, database file on the volume, no tracebacks.

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
- Image runs as root; SQLAlchemy is a transitive, unpinned dependency.
- `server/identifier.sqlite` is committed (not read by this work).
