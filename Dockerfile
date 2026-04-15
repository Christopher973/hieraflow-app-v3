# 1. Base Alpine (Ultra-légère) avec la version exacte pour Prisma
FROM node:22.14.0-alpine AS base

# Dépendances système pour Prisma (libc6-compat) et Sharp (vips-dev)
RUN apk add --no-cache libc6-compat vips-dev build-base python3

# 2. Installation des dépendances
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
# SOLUTION ICI : --ignore-scripts empêche Prisma de se lancer prématurément
RUN npm ci --ignore-scripts --no-audit --no-fund

# 3. Phase de Build
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Génération du client Prisma (Maintenant que le dossier /prisma est copié)
RUN npx prisma generate

# Build Next.js (Limitation stricte de la RAM)
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_OPTIONS="--max-old-space-size=768"
RUN npm run build

# 4. Image de Production (Runner)
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Bridage mémoire au runtime
ENV NODE_OPTIONS="--max-old-space-size=256"

# Sécurité : Création d'un utilisateur non-root
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# On ne copie QUE ce qui est strictement nécessaire
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
