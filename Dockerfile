# ── Stage 1: Build frontend ──────────────────────────────
FROM node:22-slim AS frontend-builder

WORKDIR /src
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm ci --no-audit --no-fund 2>/dev/null || npm install --no-audit --no-fund
COPY frontend/ ./
RUN npm run build

# ── Stage 2: Production image ────────────────────────────
FROM python:3.12-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg nginx curl procps \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ ./backend/
COPY --from=frontend-builder /src/dist/ ./frontend/dist/
COPY build_cache.py ./build_cache.py
COPY nginx.conf /etc/nginx/sites-available/default

RUN rm -f /etc/nginx/sites-enabled/default \
    && ln -s /etc/nginx/sites-available/default /etc/nginx/sites-enabled/default

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENV RADIO_DIR=/mnt/radio
ENV PYTHONUNBUFFERED=1

VOLUME ["/mnt/radio"]
EXPOSE 80

ENTRYPOINT ["/entrypoint.sh"]