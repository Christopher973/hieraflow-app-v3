# 1. Base ultra-légère avec la version EXACTE requise par Prisma
FROM node:22.14.0-alpine AS base

# 2. Installation des dépendances
FROM base AS deps
# libc6-compat est souvent requis par Prisma sur Alpine
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# 3. Phase de Build
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Génération du client Prisma (nécessaire avant le build)
RUN npx prisma generate

# Build Next.js (désactive la télémétrie pour gagner de la RAM au build)
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_OPTIONS="--max-old-space-size=768"
RUN npm run build

# 4. Image de Production (Runner)
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Optimisation critique pour ton VPS de 1Go
ENV NODE_OPTIONS="--max-old-space-size=256"

# On ne copie que l'essentiel du mode Standalone
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
