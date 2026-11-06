# CLAUDE.md — pazka/lbgca

Joke shop site among friends. `server/` = Flask API (image `ghcr.io/pazka/lbgca`, api-lbgca.hosh.it),
`ihm/` = CRA React front deployed separately. Owner: Alexandre (pazka). Read **TESTING.md** first.

## Maintenance (autonomous agent)
Goal: keep the base image, dependencies and Actions current **without changing behaviour**.
- **Gate = `ci` green**: `server tests (python 3.12|3.14)`, `container smoke`, `ihm build`.
- **Branches**: work on `agent/<topic>`; CI runs without a PR. Never push to `main` (`build-scan-push.yml` /
  `release.yml` publish from it), never tag. **The owner merges.**
- **Dependabot PRs**: green → summarise risk in a PR comment. Red → reproduce per TESTING.md, smallest fix
  on an `agent/` branch.
- Never weaken or delete a test to get green; the API body the front reads is a contract.
- Accounts have no password on purpose (owner decision); don't reintroduce one.

## Deploy
`DEPLOY.md`: the image runs under the box's **legacy compose** (root, port 80, bind mounts) until the cutover
(§5) and under the **hosh-deploy compose** (10001, read-only, `lbgca-data` at `/data`, PORT 8000) after it.
CI tests both (`scripts/smoke.sh legacy|template|cutover`); keep both green. A final `vX.Y.Z` tag deploys.

## Rules
- Never read, print or commit secrets, `*.db` / `*.sqlite` files or user data.
- No new dependency without the owner's yes. Tests use the standard library.
- Run installs and tests in containers (TESTING.md), not on the owner's machine.
