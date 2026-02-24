# ---------- deps (cacheable) ----------
FROM node:24-bookworm-slim AS deps
WORKDIR /app

COPY package*.json ./
RUN npm ci

# ---------- builder ----------
FROM node:24-bookworm-slim AS builder
WORKDIR /app

ENV NODE_ENV=production

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN npx prisma generate
RUN npm run build

# ---------- runner (minimal runtime) ----------
FROM node:24-bookworm-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"


# Copy standalone server (already includes public & static from build script)
COPY --from=builder /app/.next/standalone ./

# Copy Prisma client (required for runtime)

COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

USER node

EXPOSE 3000

CMD ["node", "server.js"]