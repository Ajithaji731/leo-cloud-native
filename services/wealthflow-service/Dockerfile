# ==========================================
# Multi-Stage Dockerfile for wealthflow-service
# ==========================================

# --- Stage 1: Dependency Builder ---
FROM node:20-alpine AS deps
WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev

# --- Stage 2: Production Runner ---
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8082

COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY src ./src

# SRE Best Practice: Non-root user
USER node

EXPOSE 8082

# SRE Healthcheck
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:8082/healthz || exit 1

CMD ["node", "src/index.js"]
