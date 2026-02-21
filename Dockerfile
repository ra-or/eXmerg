# ─── Stage 1: Builder (Workspaces: shared, server, client) ─────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Workspace-Struktur + Abhängigkeiten
COPY package.json package-lock.json* ./
COPY shared/package.json shared/
COPY server/package.json server/
COPY client/package.json client/

RUN npm ci

COPY shared/ shared/
COPY server/ server/
COPY client/ client/

RUN npm run build && npm prune --omit=dev

# ─── Stage 2: Runtime (nur Backend) ─────────────────────────────────────────
FROM node:20-alpine AS runtime

# Temporär: unzip für Datei-Integritätscheck (unzip -t <xlsx> im Container)
RUN apk add --no-cache unzip

ENV NODE_ENV=production

WORKDIR /app

# Root + Workspace-Pakete (für Auflösung shared/server)
COPY package.json package-lock.json* ./
COPY shared/package.json shared/
COPY server/package.json server/

# Geprüfte Node-Module + Build-Artefakte aus Builder
COPY --from=builder /app/node_modules node_modules
COPY --from=builder /app/shared/dist shared/dist
COPY --from=builder /app/server/dist server/dist
COPY --from=builder /app/client/dist client/dist

# Server starten (Port 3003)
EXPOSE 3003

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -qO- http://localhost:3003/api/health || exit 1

CMD ["node", "server/dist/index.js"]
