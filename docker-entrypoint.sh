#!/usr/bin/env sh
set -eu

if [ -n "${PRIVATE_STORAGE_PATH:-}" ]; then
  mkdir -p "$PRIVATE_STORAGE_PATH"
fi

if [ -n "${BACKUP_DIR:-}" ]; then
  mkdir -p "$BACKUP_DIR"
fi

if [ "${DOKPLOY_SQLITE_DEMO:-false}" = "true" ]; then
  mkdir -p /app/data
  export DATABASE_URL="${SQLITE_DATABASE_URL:-file:/app/data/limo-demo.db}"
  node scripts/prepare-sqlite-schema.mjs
  npx prisma db push --schema prisma/schema.sqlite.prisma --skip-generate
  npx prisma generate --schema prisma/schema.sqlite.prisma
  if [ "${DOKPLOY_SEED_ON_START:-true}" = "true" ]; then
    if [ "${LIMO_ALLOW_DEMO_SEED:-false}" != "true" ]; then
      echo "Refusing demo seed: set LIMO_ALLOW_DEMO_SEED=true for an explicit disposable demo."
      exit 1
    fi
    npm run prisma:seed
  fi
  exec "$@"
fi

if [ -z "${DATABASE_URL:-}" ]; then
  if [ -z "${DB_HOST:-}" ] || [ -z "${DB_NAME:-}" ] || [ -z "${DB_USER:-}" ] || [ -z "${DB_PASS:-}" ]; then
    echo "Set DATABASE_URL or all of DB_HOST, DB_NAME, DB_USER, and DB_PASS." >&2
    exit 1
  fi

  export DATABASE_URL="$(node -e '
    const host = process.env.DB_HOST.trim();
    const database = process.env.DB_NAME.trim();
    if (!/^[a-zA-Z0-9._-]+$/.test(host)) {
      throw new Error("DB_HOST must be a hostname without protocol or port");
    }
    if (!database) {
      throw new Error("DB_NAME cannot be blank");
    }
    const user = encodeURIComponent(process.env.DB_USER);
    const password = encodeURIComponent(process.env.DB_PASS);
    process.stdout.write(`mysql://${user}:${password}@${host}:3306/${encodeURIComponent(database)}`);
  ')"
fi

case "${DATABASE_URL:-}" in
  mariadb://*)
    export DATABASE_URL="mysql://${DATABASE_URL#mariadb://}"
    ;;
esac

run_migrations() {
  attempt=1

  while true; do
    migration_status=0
    migration_output="$(npx prisma migrate deploy 2>&1)" || migration_status=$?
    printf '%s\n' "$migration_output"

    if [ "$migration_status" -eq 0 ]; then
      return 0
    fi

    case "$migration_output" in
      *P1001*|*P1008*|*P1017*|*ECONNREFUSED*|*"Can't reach database server"*|*"Can't connect to MySQL server"*)
        if [ "$attempt" -ge 30 ]; then
          echo "Database did not become available after 30 migration attempts." >&2
          return "$migration_status"
        fi
        echo "Database is not ready; retrying migration in 2 seconds ($attempt/30)..." >&2
        attempt=$((attempt + 1))
        sleep 2
        ;;
      *)
        return "$migration_status"
        ;;
    esac
  done
}

if [ "${DOKPLOY_DB_PUSH_ON_START:-false}" = "true" ]; then
  npx prisma db push --accept-data-loss
else
  run_migrations
fi

if [ "${DOKPLOY_SEED_ON_START:-false}" = "true" ]; then
  echo "Refusing demo seed in the production database path. Use DOKPLOY_SQLITE_DEMO=true for a disposable demo."
  exit 1
fi

exec "$@"
