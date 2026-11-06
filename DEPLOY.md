# Deploying api-lbgca.hosh.it

The lbgca API (`server/`, image `ghcr.io/pazka/lbgca`) on the hosh.it box (box standard:
`docs/BOX-CONTRACT.md`). The front (`ihm/`) is deployed separately and is not covered here.

**Two ways to run the same image** (both tested in CI on every commit, `scripts/smoke.sh`):

| | legacy box compose (until the cutover) | hosh-deploy compose (after the cutover) |
|---|---|---|
| Compose | `/root/hosh-deploy/lbgca/docker-compose.yml` (copy: `scripts/compose/legacy-box.yml`) | `/srv/lbgca/docker-compose.yml` ← `docker-compose.example.yml` |
| User / rootfs | image default (root), writable | `10001:10001`, read-only, tmpfs `/tmp` |
| Port | container 80 → `127.0.0.1:8080` | container 8000 (`PORT`) → `127.0.0.1:9141` |
| Data | bind mounts `./app/database` → `/app/database`, `.docker/static` → `/app/static` | volume `lbgca-data` → `/data` (`DATA_DIR=/data`, `STATIC_DIR=/data/static`) |
| Edge | router in `/root/hosh-deploy/edge/traefik/dynamic/routes.yml` | `/root/hosh-deploy/edge/traefik/dynamic/lbgca.yml` (written by hosh-deploy) |
| Deploy | by hand (`docker compose pull && up -d`) | every final `vX.Y.Z` release, by GitHub Actions through hosh-deploy |

Image defaults = the legacy layout, so a release can still be pulled by the legacy compose unchanged.
Before the cutover the release workflow's `deploy` job is a no-op (no `HOSH_DEPLOY_KEY` secret).

## 1. How releases go live (hosh-deploy, after the cutover)

Every final release (`release` workflow on tag `vX.Y.Z`; prerelease tags `vX.Y.Z-rc.N` never deploy nor move
`:latest`) runs unit tests, Trivy, the container smoke in **both** composes, pushes `:vX.Y.Z` + `:latest`, then
the **`deploy`** job: GitHub connects to the box as `deployer` with this repo's `HOSH_DEPLOY_KEY` (bound to lbgca
only) and runs `hosh-deploy deploy lbgca vX.Y.Z`. The box pulls the image, swaps the tag in `lbgca.env`, waits
healthy, checks `/healthz` on the loopback port and through Traefik, runs `POST_DEPLOY`
(`python /app/smoke.py http://127.0.0.1:8000`, `deploy/hosh-deploy.conf`) inside the container and **rolls back
by itself** if any check fails (the workflow then goes red). Nothing from the repo runs on the host.

- Redeploy / roll forward / back: Actions → **deploy** → `vX.Y.Z`, `rollback` or `status`.
- On the box (owner, or the on-box Claude without a sudo window): `sudo hosh-deploy deploy lbgca vX.Y.Z`,
  `sudo hosh-deploy rollback lbgca`, `sudo hosh-deploy status lbgca`. Log: `/var/log/hosh-deploy.log`.
- Repo variable `HOSH_AUTODEPLOY=false` stops auto-deploy after releases (manual dispatch still works).

## 1b. First install = the cutover from legacy (§5)

lbgca is not a new app: its first install **is** the cutover in §5 (the data must move).

## 2. Variables (`lbgca.env`, mode 600)

| Variable | Default (`.env.example`) | Who sets it | Meaning |
|---|---|---|---|
| `APP_IMAGE` | `ghcr.io/pazka/lbgca:v1.2.0` | hosh-deploy (each deploy) | image tag; the only line hosh-deploy rewrites |
| `APP_BIND` | `127.0.0.1:9141` | box value | loopback publish address (must equal `BIND`) |
| `SECRET_KEY` | empty, **`# required:`** | generated on the box (§5 step 2), never printed | Flask secret key. Not used to sign sessions today (Flask-Session ids are server-side), so changing it logs nobody out; without it the app uses a random per-boot value |
| `PORT` | `8000` (compose) | fixed in the compose | gunicorn port; image default 80 (legacy) |
| `DATA_DIR` | `/data` (compose) | fixed in the compose | holds `database.db` (+ `init_database.db` if copied); image default `/app/database` |
| `STATIC_DIR` | `/data/static` (compose) | fixed in the compose | static dir (created if missing); image default `/app/static` |

The legacy compose has no env file or `environment:` → no value moves from the legacy deployment.

## 3. Capability checks (what "works" means — not just a 200)

Host `api-lbgca.hosh.it` (or the loopback `127.0.0.1:9141` with `-H 'Host: api-lbgca.hosh.it'`):

- `GET /healthz` → 200 `{"status":"ok","database":"ok","data_dir":"writable","static_dir":"writable","users":N,"orders":N,"sessions":N}`
  (503 + `"status":"fail"` when the database or a dir is not usable). HEAD answers too.
- `GET /` → 200 text `The app is running ! [N] connected !`
- `GET /nope` → 404 JSON `{"code":404,"name":"ServerKnownError","error":"Resource not found"}`
- `GET /orders` → 200 JSON list (every order with its user; public by design). **After the cutover the count must
  equal the legacy count** (`/healthz` `users`/`orders` before vs after).
- Round-trip = `POST_DEPLOY` (`python /app/smoke.py http://127.0.0.1:8000` inside the container, also runnable as
  `sudo docker exec lbgca python /app/smoke.py http://127.0.0.1:8000`): login `hosh-smoke` → body
  `connected: true` + `session` cookie → `GET /user` → `POST /order` → `POST /order/<id>` edit → read back in
  `/orders` → `DELETE /order/<id>` → `DELETE /session` → `GET /user` 400. Leaves no order; the account
  `hosh-smoke` stays (no delete endpoint).
- Front (unchanged, separate deploy): `https://lbgca.hosh.it` logs in and lists orders (CORS origin + the
  `Secure; SameSite=Lax` session cookie on `api-lbgca.hosh.it`).

Box smoke harness: update `svc_lbgca` in `/home/pazka/MIGRATION/scripts/smoke.sh` to these checks
(upstream `127.0.0.1:9141`, `/healthz` JSON, round-trip via `docker exec lbgca python /app/smoke.py …`).

## 4. What runs

| Item | Value |
|---|---|
| Image | `ghcr.io/pazka/lbgca:vX.Y.Z` (python:3.14-slim, gunicorn, Flask, SQLite) |
| Upstream | container :8000 → `127.0.0.1:9141` |
| Edge | `/root/hosh-deploy/edge/traefik/dynamic/lbgca.yml` (router `lbgca@file`, resolver `le`, HSTS) |
| Volume | docker volume `lbgca-data` → `/data` (in the monthly restic golden backup) |
| Health | `GET /healthz` → `{"status":"ok", …}` (image `HEALTHCHECK` + compose healthcheck) |
| Outbound | none |

## 5. Cutover from legacy (coordinator = on-box Claude in an owner-opened sudo window)

Rehearsed in CI on every commit: `scripts/smoke.sh <image> cutover` (legacy with data → stop → the step-4
command → same `database.db` sha256 → template sees the data → rollback to legacy, data intact).

**Prerequisites:** a final release `v1.2.0` (or later; use that tag below) built by the `release` workflow; the
GHCR package `lbgca` **public** (owner: package settings → visibility; today it is private and the box pulls
anonymously, 11-BOX-STANDARD §6) or the X.28d export fallback; port 9141 free (`ss -ltn`).
Box rules: `ACTIONS-LOG.md` intent BEFORE, result + REVERT AFTER; `scripts/smoke.sh` BEFORE and AFTER.

```sh
V=v1.2.0                       # the release to install
L=/root/hosh-deploy/lbgca      # legacy deployment (compose + bind-mounted data)

# 0 — baseline (BEFORE): legacy counts, kept for step 7
curl -sS -H 'Host: api-lbgca.hosh.it' http://127.0.0.1:8080/orders | python3 -c 'import json,sys; print(len(json.load(sys.stdin)), "orders")'
curl -sS -H 'Host: api-lbgca.hosh.it' http://127.0.0.1:8080/
sudo docker volume inspect lbgca-data >/dev/null 2>&1 && echo "STOP: lbgca-data already exists"

# 1 — release checkout (provides docker-compose.example.yml, .env.example, deploy/*)
sudo mkdir -p /srv/lbgca && sudo chmod 750 /srv/lbgca && cd /srv/lbgca
[ -d .git ] || { sudo git init -q && sudo git remote add origin https://github.com/pazka/lbgca; }
sudo git fetch -q --depth 1 origin tag "$V" && sudo git checkout -q "$V"

# 2 — env file + SECRET_KEY generated on the box (never printed; nothing moves from the legacy deployment)
[ -e lbgca.env ] || sudo install -m 600 .env.example lbgca.env
sudo sh -c 'k=$(openssl rand -hex 32); sed -i "s|^SECRET_KEY=.*|SECRET_KEY='"'"'$k'"'"'|" /srv/lbgca/lbgca.env'
sudo sed -i "s|^APP_IMAGE=.*|APP_IMAGE='ghcr.io/pazka/lbgca:$V'|" lbgca.env
sudo grep -c "^SECRET_KEY='[0-9a-f]\{64\}'$" lbgca.env      # → 1 (count only, no value)

# 3 — register (validates the compose hardening, pins it) + deployer key. No deploy yet.
sudo hosh-deploy register lbgca
ssh-keygen -q -t ed25519 -N '' -C hosh-deploy:lbgca -f /tmp/lbgca-deploy
sudo /home/pazka/MIGRATION/scripts/setup-hosh-deploy.sh key lbgca /tmp/lbgca-deploy.pub
gh secret set HOSH_DEPLOY_KEY -R pazka/lbgca < /tmp/lbgca-deploy && shred -u /tmp/lbgca-deploy /tmp/lbgca-deploy.pub
#     (if the agent is blocked on the key lines, the owner runs them with `!`)

# 4 — DOWNTIME STARTS: stop legacy, safety tarball, data move into lbgca-data (chown 10001), verify sha256
sudo docker pull "ghcr.io/pazka/lbgca:$V"
sudo docker compose --project-directory "$L" -f "$L/docker-compose.yml" stop
sudo mkdir -p /mnt/data/attic && sudo tar -C "$L" -czf "/mnt/data/attic/lbgca-legacy-$(date -u +%Y%m%dT%H%MZ).tgz" app/database .docker/static
sudo docker volume create lbgca-data
sudo docker run --rm --network none --user 0:0 --entrypoint sh \
  -v "$L/app/database:/from/database:ro" -v "$L/.docker/static:/from/static:ro" -v lbgca-data:/to \
  "ghcr.io/pazka/lbgca:$V" -c 'set -e; cp -a /from/database/. /to/; mkdir -p /to/static; cp -a /from/static/. /to/static/; chown -R 10001:10001 /to; chmod 750 /to; ls -la /to'
sudo sha256sum "$L/app/database/database.db"
sudo docker run --rm --network none --entrypoint sha256sum -v lbgca-data:/d:ro "ghcr.io/pazka/lbgca:$V" /d/database.db
#     → the two hashes MUST be equal; otherwise stop and roll back (step R)

# 5 — remove the legacy router for api-lbgca.hosh.it (coordinator): edit
#     /root/hosh-deploy/edge/traefik/dynamic/routes.yml, delete the router (and its service if only it uses
#     127.0.0.1:8080). Otherwise two routers match the host and hosh-deploy's HTTPS check may hit the stopped
#     legacy one. Traefik hot-reloads; check: curl -s 127.0.0.1:8899/api/http/routers | grep -c api-lbgca → 0

# 6 — first deploy = CI (owner rule): writes the route, runs POST_DEPLOY, rolls back by itself on failure
gh workflow run deploy -R pazka/lbgca -f version="$V"
sudo hosh-deploy status lbgca

# 7 — smoke AFTER: §3 checks; counts equal step 0; then scripts/smoke.sh all
curl -sS https://api-lbgca.hosh.it/healthz
curl -sS https://api-lbgca.hosh.it/orders | python3 -c 'import json,sys; print(len(json.load(sys.stdin)), "orders")'
sudo docker exec lbgca python /app/smoke.py http://127.0.0.1:8000
```
Then: commit `routes.yml` + `lbgca.yml` in `/root/hosh-deploy` (`sudo git -C /root/hosh-deploy push`), registry
line 9141 → `live` and 8080 → retired in `11-BOX-STANDARD.md` §4, `svc_lbgca` updated (§3). Leave the legacy
directory `$L` (compose + bind-mounted data) untouched for at least one release cycle: it is the rollback.

**R — rollback (= legacy again; its data was only read):**
```sh
cd /srv/lbgca && sudo docker compose --env-file lbgca.env down       # keeps the lbgca-data volume
sudo rm -f /root/hosh-deploy/edge/traefik/dynamic/lbgca.yml
sudo git -C /root/hosh-deploy checkout -- edge/traefik/dynamic/routes.yml   # legacy router back
sudo docker compose --project-directory /root/hosh-deploy/lbgca -f /root/hosh-deploy/lbgca/docker-compose.yml up -d
```
Anything written after the cutover (new accounts/orders) lives only in `lbgca-data`; the legacy database is
the state at step 4. To remove the hosh-deploy side completely, also `sudo rm /etc/hosh-deploy/apps/lbgca.conf`
and `sudo /home/pazka/MIGRATION/scripts/setup-hosh-deploy.sh unkey lbgca` (+ delete the `HOSH_DEPLOY_KEY` secret).

## 6. Decisions / known limits
- Accounts have no password (owner decision, v1.1.0). `GET /orders` is public by design.
- The image's default user stays root only for the legacy compose (root-owned bind mounts); the hosh-deploy
  compose runs it as 10001 with a read-only rootfs. Once the legacy compose is gone, `USER 10001` and the
  template defaults can move into the Dockerfile.
- A fresh `lbgca-data` volume without `init_database.db` starts from an empty database (schema created at boot).
- `POST_DEPLOY` writes then deletes one order of the account `hosh-smoke` on each deploy.
