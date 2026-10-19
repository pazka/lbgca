# CLAUDE.md — pazka/lbgca

Joke shop site among friends. `server/` = Flask API (image `ghcr.io/pazka/lbgca`, api-lbgca.hosh.it),
`ihm/` = CRA React front deployed separately. Owner: Alexandre (pazka). Read **TESTING.md** first.

## Maintenance (autonomous agent)
Goal: keep the base image, dependencies and Actions current **without changing behaviour**.
- **Gate = `ci` green**: `server tests (python 3.12)` + `container smoke`. `server tests (python 3.14)`
  and `ihm build` are non-blocking early-warning jobs (both red today, reasons in TESTING.md).
- **Branches**: work on `agent/<topic>`; CI runs without a PR. Never push to `main` (`deploy.yml` /
  `release.yml` publish from it), never tag. **The owner merges.**
- **Dependabot PRs**: green → summarise risk in a PR comment. Red → reproduce per TESTING.md, smallest fix
  on an `agent/` branch. The Python 3.14 PR needs the `/session` serialisation fix first (owner decision).
- Never weaken or delete a test to get green; the API body the front reads is a contract.
- Security issues in TESTING.md (committed SECRET_KEY, clear-text passwords, public order list) are owner
  decisions; don't fix them silently inside a dependency PR.

## Rules
- Never read, print or commit secrets, `*.db` / `*.sqlite` files or user data.
- No new dependency without the owner's yes. Tests use the standard library.
- Run installs and tests in containers (TESTING.md), not on the owner's machine.
