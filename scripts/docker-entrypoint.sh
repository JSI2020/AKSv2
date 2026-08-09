#!/bin/sh
set -eu

ROLE="${1:-app}"

echo "[entrypoint] role=${ROLE}"

# Wait for Postgres
if [ -n "${DATABASE_URL:-}" ]; then
  echo "[entrypoint] waiting for database..."
  i=0
  until node -e "
    const u = process.env.DATABASE_URL;
    const { hostname, port } = new URL(u);
    const net = require('net');
    const s = net.connect(Number(port || 5432), hostname, () => { s.end(); process.exit(0); });
    s.on('error', () => process.exit(1));
  " 2>/dev/null; do
    i=$((i + 1))
    if [ "$i" -gt 60 ]; then
      echo "[entrypoint] database not reachable after 60s" >&2
      exit 1
    fi
    sleep 1
  done
  echo "[entrypoint] database is up"
fi

if [ "${ROLE}" = "migrate" ] || [ "${AKS_RUN_MIGRATE:-0}" = "1" ]; then
  echo "[entrypoint] running migrations..."
  npx drizzle-kit migrate --config drizzle.config.ts
fi

if [ "${ROLE}" = "seed" ] || [ "${AKS_RUN_SEED:-0}" = "1" ]; then
  echo "[entrypoint] seeding base data..."
  npx tsx packages/db/seed.ts
  if [ "${AKS_RUN_SEED_DEMO:-0}" = "1" ]; then
    echo "[entrypoint] seeding demo catalogue..."
    npx tsx packages/db/seed-demo.ts || echo "[entrypoint] demo seed failed (non-fatal)"
  fi
fi

case "${ROLE}" in
  app)
    exec node server.js
    ;;
  worker)
    exec npx tsx worker/index.ts
    ;;
  migrate)
    exit 0
    ;;
  seed)
    exit 0
    ;;
  *)
    echo "[entrypoint] unknown role: ${ROLE}" >&2
    exit 1
    ;;
esac
