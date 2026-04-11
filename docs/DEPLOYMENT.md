# BlockMiner deployment (test VM)

This project deploys from Windows via `deploy.py` → `scripts/deploy-vps-windows.ps1` (PuTTY `plink`/`pscp`) or via CI workflows. The application stack on the VM is **Docker Compose** (`docker-compose.yml`): `db`, `app`, optional `nginx` (profile `proxy`).

> **Note:** `deploy.md` at the repo root is gitignored for local notes. This file is the committed reference.

## Quick checks on the VM (SSH)

Run as the same user that owns the repo path (often `root`):

```bash
cd /path/to/block-miner   # e.g. /root/block-miner-v3
docker compose --env-file .env.production ps
docker compose --env-file .env.production logs --tail=120 app
```

Confirm the published app port matches health checks:

```bash
grep -E '^APP_HOST_PORT=' .env.production || true
```

Compose binds the app to `127.0.0.1:${APP_HOST_PORT:-3000}:3000`. The deploy script resolves this port from the **merged** `.env.production` text (uploaded from your machine) so `curl http://127.0.0.1:<port>/health` targets the same port Docker publishes.

## Common failure modes

1. **Health shows `000` or connection reset** — The Node process is still booting (`docker-entrypoint.sh` waits for Postgres, runs `prisma generate`, then starts the server). The deploy script **retries `/health` for up to ~90 seconds** and prints `docker compose logs` if it never reaches HTTP 200.

2. **`APP_HOST_PORT` mismatch** — If `deploy.secrets.local` sets `APP_HOST_PORT` but `.env.production` on the VM uses a different value after merge, the old script could curl the wrong port. The script now prefers **`APP_HOST_PORT` from the merged env** (same file Compose uses).

3. **Migrations before health** — If the app cannot start until `prisma migrate deploy` runs, checking health before migrate always fails. The script now runs **`DEPLOY_PRISMA_MIGRATE_DEPLOY` before the health loop** when that flag is enabled.

4. **Nginx profile** — `docker compose up -d nginx` uses profile `proxy`. If nginx fails to start, check `nginx/certs` and `nginx/nginx.conf`; app health on `127.0.0.1:<APP_HOST_PORT>` bypasses nginx.

## Local secrets (never commit)

- `deploy.secrets.local` — `SSH_HOST`, `SSH_USER`, `SSH_PASSWORD`, `REMOTE_PATH`, optional `DEPLOY_GIT_BRANCH`, `APP_HOST_PORT`, `DEPLOY_PRISMA_MIGRATE_DEPLOY=1`, etc.
- `.deploy-pw.txt` — single-line root password for `deploy.py` (gitignored).
- `.env.production.vm-backup` — base env merged with `VITE_*` overrides before upload.

See `deploy-credentials.local.example.md` for GitHub Actions test VM variables.
