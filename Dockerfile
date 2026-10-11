FROM node:22-bookworm-slim AS base

WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates openssl mariadb-client zip unzip \
  && rm -rf /var/lib/apt/lists/*

FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

FROM base AS builder
ENV APP_URL=http://localhost:3000
ENV DATABASE_URL=mysql://limo:limo@localhost:3306/limo_db
ENV SESSION_SECRET=build-time-placeholder-secret-32-chars
ENV PRIVATE_STORAGE_PATH=/app/storage/private
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build
# Prune dev dependencies DI BUILDER sehingga layer yang disalin ke runner
# langsung ramping (satu node_modules saja). Prisma CLI ada di dependencies;
# generate diulang setelah prune karena folder .prisma bisa ikut terbuang.
RUN npm prune --omit=dev && npx prisma generate

FROM base AS runner

# LIMO_BUILD_SHA/TIME diisi --build-arg saat deploy agar /api/health bisa
# membuktikan commit yang berjalan (deteksi build stale).
ARG LIMO_BUILD_SHA=""
ARG LIMO_BUILD_TIME=""
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV LIMO_BUILD_SHA=${LIMO_BUILD_SHA}
ENV LIMO_BUILD_TIME=${LIMO_BUILD_TIME}
ENV DOKPLOY_SQLITE_DEMO=false
ENV DOKPLOY_SEED_ON_START=false

RUN groupadd --system --gid 1001 nodejs \
  && useradd --system --uid 1001 nextjs

COPY --from=builder --chown=nextjs:nodejs /app ./
COPY --chown=nextjs:nodejs docker-entrypoint.sh ./docker-entrypoint.sh

RUN chmod +x /app/docker-entrypoint.sh \
  && mkdir -p /app/storage/private \
  && mkdir -p /app/backups \
  && mkdir -p /app/data \
  && chown -R nextjs:nodejs /app/storage /app/backups /app/data

USER nextjs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health/ready').then((response) => process.exit(response.ok ? 0 : 1)).catch(() => process.exit(1))"

ENTRYPOINT ["./docker-entrypoint.sh"]
# next start langsung via node (bukan npm) agar SIGTERM dari `docker stop`
# sampai ke Next dan request in-flight selesai dulu (graceful shutdown).
CMD ["node", "node_modules/next/dist/bin/next", "start"]
