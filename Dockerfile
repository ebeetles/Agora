# Agora — one container: Vite-built SPA + Express API + Python multi_agent workers
#
# Build:  docker build -t agora .
# Run:    docker run --env-file backend/.env -p 3001:3001 agora
#
# Cloud hosts usually set PORT; map it to the container listening port.

FROM node:22-bookworm AS frontend
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY index.html vite.config.ts tsconfig.json tsconfig.app.json tsconfig.node.json ./
COPY src ./src
COPY public ./public
RUN npm run build

FROM node:22-bookworm

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 python3-venv \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY backend/requirements.txt ./backend/requirements.txt
RUN python3 -m venv /app/backend/.venv \
  && /app/backend/.venv/bin/pip install --no-cache-dir -r /app/backend/requirements.txt

COPY backend/package.json backend/package-lock.json ./backend/
RUN cd backend && npm ci --omit=dev

COPY backend ./backend
COPY --from=frontend /app/dist /app/dist

WORKDIR /app/backend

ENV NODE_ENV=production
EXPOSE 3001

CMD ["node", "server.js"]
