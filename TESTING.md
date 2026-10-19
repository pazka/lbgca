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

PRs, `main`, `agent/**`. `server tests (python 3.12)` (gate) and `(python 3.14)` (early warning,
non-blocking); `container smoke` (builds `server/`, runs `scripts/smoke.sh` with a read-only rootfs and
the compose volumes); `ihm build` (non-blocking, see below).

## What is covered

`server/tests/test_api.py` (13 tests, stdlib, production config, temp DB): boot text with the session
count, JSON 404, DB schema, signup, login-creates-account and **the exact `/session` body the front reads**
(`connected`, `username`, …), wrong password, logout, profile read/edit, order create / validate / delete,
public order list, cannot delete another user's order, and the known-broken endpoints.

`scripts/smoke.sh`: the built image, read-only rootfs + `cap_drop ALL` + `no-new-privileges`, database and
static volumes as in `docker-compose.yml`: boot, 404, login body, profile, order, public list, logout,
database file on the volume, no tracebacks.

## Upgrades checked (2026-10-19)

- **Python 3.12 → 3.14** (Dependabot #4): **no-go.** On 3.14, `POST /session` and `GET /session` return
  `{"accessed", "modified", "on_update", "sid"}` instead of `{"_permanent", "connected", "role", "userid",
  "username"}`: `models.to_json_obj` (used by `services`) calls `json.dumps(session, default=lambda o: o.__dict__)` and 3.14's
  encoder now hands the Flask-Session object to `default`. The front (`ihm/src/StateManagement/
  userEffects.js`) reads `res.connected` and `username`, so **login breaks**, and the session id leaks into
  the body. Caught by `test_login_creates_the_account_on_first_use` and the smoke. Fix (owner
  decision, separate PR): serialise `dict(session)` instead of `session` in `models.to_json_obj` —
  verified: 13/13 tests on 3.14 with that one-line change.

## Known issues (pinned, not changed)

- **`SECRET_KEY` for production is committed** in `server/app/config_prod.py` (public repo): session
  cookies can be forged. Move it to an env var and rotate.
- **Passwords are stored in clear** (`utils.hash_password` returns its input).
- `GET /orders` needs no session and returns every order with its user's profile.
- `POST /order/<id>` always 500s (`edit_order` uses a Query, not `.first()`); `GET /user/<id>/orders`
  always 500s (`user.orders` does not exist; the relation is `basket`).
- `delete_order` does not commit explicitly (works today because the session is committed later).
- Session cookie is not `Secure` in production; image runs as root; `gunicorn` and SQLAlchemy are not pinned.
- `ihm/package-lock.json` is out of sync with `package.json` (`typescript@4.9.5` missing): `npm ci` fails.
  Fix: `npm install` in `ihm/` on a trusted machine/container, review, commit the lock. Then make the
  `ihm build` CI job blocking.
- `server/requirements.txt` duplicates `server/app/requirements.txt` (the Dockerfile uses the latter).
- `server/identifier.sqlite` is committed (not read by this work).
