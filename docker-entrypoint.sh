#!/usr/bin/env sh
set -eu

if [ -n "${PRIVATE_STORAGE_PATH:-}" ]; then
  mkdir -p "$PRIVATE_STORAGE_PATH"
fi

if [ "${DOKPLOY_SQLITE_DEMO:-false}" = "true" ]; then
  mkdir -p /app/data
  export DATABASE_URL="${SQLITE_DATABASE_URL:-file:/app/data/limo-demo.db}"
  node scripts/prepare-sqlite-schema.mjs
  npx prisma db push --schema prisma/schema.sqlite.prisma --skip-generate
  npx prisma generate --schema prisma/schema.sqlite.prisma
  if [ "${DOKPLOY_SEED_ON_START:-true}" = "true" ]; then
    npm run prisma:seed
  fi
  exec "$@"
fi

case "${DATABASE_URL:-}" in
  mariadb://*)
    export DATABASE_URL="mysql://${DATABASE_URL#mariadb://}"
    ;;
esac

if [ "${DOKPLOY_DB_PUSH_ON_START:-false}" = "true" ]; then
  npx prisma db push --accept-data-loss
else
  npx prisma migrate deploy
fi

if [ "${DOKPLOY_SEED_ON_START:-false}" = "true" ]; then
  npm run prisma:seed
fi

exec "$@"
