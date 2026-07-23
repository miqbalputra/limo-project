FROM node:22-bookworm-slim AS base

WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates openssl \
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

FROM base AS runner

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV DOKPLOY_SQLITE_DEMO=true
ENV SQLITE_DATABASE_URL=file:/app/data/limo-demo.db
ENV DOKPLOY_SEED_ON_START=true

RUN groupadd --system --gid 1001 nodejs \
  && useradd --system --uid 1001 nextjs

COPY --from=builder --chown=nextjs:nodejs /app ./
COPY --chown=nextjs:nodejs docker-entrypoint.sh ./docker-entrypoint.sh

RUN chmod +x /app/docker-entrypoint.sh \
  && mkdir -p /app/storage/private \
  && mkdir -p /app/data \
  && chown -R nextjs:nodejs /app/storage /app/data

USER nextjs

EXPOSE 3000

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["npm", "run", "start"]
