#!/bin/bash
set -e

echo "=== Radio Library Container ==="
echo "RADIO_DIR: ${RADIO_DIR:-/mnt/radio}"
echo ""

# Ensure radio directories exist
mkdir -p "${RADIO_DIR:-/mnt/radio}"/{music,inbox,state,config,scripts,logs,backups,temp}

# Build fast cache if not present
if [ ! -f /app/backend/library_cache.json ]; then
    echo "[entrypoint] Building library cache (fast)..."
    python3 /app/build_cache.py "${RADIO_DIR:-/mnt/radio}/music" /app/backend/library_cache.json
fi

# Start backend (uvicorn)
echo "[entrypoint] Starting backend on 127.0.0.1:8000..."
cd /app/backend
python3 -m uvicorn main:app --host 127.0.0.1 --port 8000 &
BACKEND_PID=$!

# Wait for backend to be ready
echo "[entrypoint] Waiting for backend..."
for i in $(seq 1 30); do
    if curl -s http://127.0.0.1:8000/docs > /dev/null 2>&1; then
        echo "[entrypoint] Backend ready after ${i}s"
        break
    fi
    sleep 1
done

# Start nginx (frontend + API proxy)
echo "[entrypoint] Starting nginx..."
nginx -g "daemon off;" &
NGINX_PID=$!

echo "[entrypoint] All services started!"
echo "  Frontend: http://localhost:80"
echo "  API Docs: http://localhost:80/docs"
echo "  Status:   http://localhost:80/api/status"
echo ""

# Wait for any process to exit
wait -n $BACKEND_PID $NGINX_PID
EXIT_CODE=$?
echo "[entrypoint] A service exited with code $EXIT_CODE, shutting down..."
exit $EXIT_CODE