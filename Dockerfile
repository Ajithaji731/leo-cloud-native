# ==========================================
# Cloud Production Dockerfile for Render
# Runs all 3 microservices in 1 container (< 150MB RAM)
# ==========================================

FROM node:20-alpine AS deps
WORKDIR /app

# Install dependencies for all 3 microservices
COPY services/habit-service/package.json ./services/habit-service/
RUN cd services/habit-service && npm install --omit=dev

COPY services/wealthflow-service/package.json ./services/wealthflow-service/
RUN cd services/wealthflow-service && npm install --omit=dev

COPY services/ai-agent-service/package.json ./services/ai-agent-service/
RUN cd services/ai-agent-service && npm install --omit=dev

# --- Runner Stage ---
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080
ENV HABIT_SERVICE_URL=http://127.0.0.1:8081
ENV WEALTHFLOW_SERVICE_URL=http://127.0.0.1:8082
ENV SECURE_ID=2108

# Copy installed dependencies and source code
COPY --from=deps /app/services/habit-service/node_modules ./services/habit-service/node_modules
COPY --from=deps /app/services/wealthflow-service/node_modules ./services/wealthflow-service/node_modules
COPY --from=deps /app/services/ai-agent-service/node_modules ./services/ai-agent-service/node_modules

COPY services/habit-service ./services/habit-service
COPY services/wealthflow-service ./services/wealthflow-service
COPY services/ai-agent-service ./services/ai-agent-service

EXPOSE 8080

# SRE Best Practice: Start habit & wealthflow services in background, then run gateway in foreground
CMD sh -c "PORT=8081 node services/habit-service/src/index.js & PORT=8082 node services/wealthflow-service/src/index.js & node services/ai-agent-service/src/index.js"
