# Multi-stage Dockerfile for Next.js 16 (standalone) + Prisma 7
# Builder: install deps, generate Prisma client, build Next.js
FROM node:20-bullseye-slim AS builder
WORKDIR /app

# Install packages required to build native modules (sharp, prisma binaries)
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    python3 \
    build-essential \
    pkg-config \
    libcairo2-dev \
    libgif-dev \
    libjpeg-dev \
    libpango1.0-dev \
    librsvg2-dev \
    libvips-dev \
  && rm -rf /var/lib/apt/lists/*

# Install dependencies
COPY package.json package-lock.json ./
# Copy Prisma schema early so `prisma generate` (postinstall) can run during npm ci
COPY prisma ./prisma
RUN npm ci --no-audit --no-fund

# Copy source
COPY . .

# Generate Prisma client for production runtime
RUN npx prisma generate --schema=./prisma/schema.prisma

# Build Next.js (standalone output)
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

######### Runtime image #########
FROM node:20-bullseye-slim AS runner
WORKDIR /app

# Runtime libs required by sharp
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    ca-certificates \
    libvips-dev \
  && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN groupadd -r app && useradd -r -g app app

# Copy standalone build output and necessary files
COPY --from=builder /app/.next/standalone/ ./
COPY --from=builder /app/.next/static/ ./.next/static/
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts

# Copy production node_modules built in the builder stage
COPY --from=builder /app/node_modules ./node_modules

# Set permissions and user
RUN chown -R app:app /app
USER app

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

# Entrypoint: Next standalone exposes a server.js at the root of the standalone folder
CMD ["node", "server.js"]
