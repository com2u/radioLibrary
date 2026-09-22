# Radio Library

A full-stack web application for recording internet radio streams, managing a music library, and playing songs with a rich waveform player.

## Architecture

- **Frontend**: React + Vite with WaveSurfer.js waveform player
- **Backend**: FastAPI (Python) with uvicorn
- **Proxy**: nginx (serves frontend + API)
- **Container**: Docker with docker-compose
- **Recording**: StreamRipper managed by a shell daemon

## Quick Start

```bash
# Build and run
docker compose up -d

# Access
open http://localhost:8080
```

## Configuration

1. Create `/mnt/radio/config/stations.json` with your radio stations (see `stations.example.json`)
2. Mount `/mnt/radio` as a Docker volume for music storage
3. Recording management scripts go in `/mnt/radio/scripts/`

See `ARCHITEKTUR.md` for detailed architecture documentation.

## Requirements

- Docker & docker-compose
- `/mnt/radio` directory for music storage
- StreamRipper (on host for recording)
- `streamripper-manager.sh` in `/mnt/radio/scripts/`

## Version

V1.4