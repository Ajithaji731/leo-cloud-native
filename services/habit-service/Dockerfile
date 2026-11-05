# ==========================================
# Multi-Stage Dockerfile for habit-service
# ==========================================

# --- Stage 1: Dependency Builder ---
FROM node:20-alpine AS deps
WORKDIR /app

# Copy dependency manifests first to leverage Docker layer caching
COPY package.json ./

# Install production dependencies cleanly
RUN npm install --omit=dev

# --- Stage 2: Minimal Production Runner ---
FROM node:20-alpine AS runner
WORKDIR /app

# Set production environment
ENV NODE_ENV=production
ENV PORT=8081

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./

# Copy application source code
COPY src ./src

# SRE Best Practice: Run as non-root user for security
USER node

# Expose microservice port
EXPOSE 8081

# Docker Healthcheck targeting our SRE probe
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:8081/healthz || exit 1

# Start the microservice
CMD ["node", "src/index.js"]
