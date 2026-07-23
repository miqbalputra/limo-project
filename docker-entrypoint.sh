#!/usr/bin/env sh
set -eu

if [ -n "${PRIVATE_STORAGE_PATH:-}" ]; then
  mkdir -p "$PRIVATE_STORAGE_PATH"
fi

case "${DATABASE_URL:-}" in
  mariadb://*)
    export DATABASE_URL="mysql://${DATABASE_URL#mariadb://}"
    ;;
esac

npx prisma migrate deploy

if [ "${DOKPLOY_SEED_ON_START:-false}" = "true" ]; then
  npm run prisma:seed
fi

exec "$@"
