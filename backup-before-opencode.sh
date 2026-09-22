#!/bin/bash
# Backup-Skript als SavePoint-Ersatz für OpenCode
# Erstellt snapshots mit Zeitstempel vor jedem OpenCode-Lauf

BACKUP_DIR="/root/src/radio/backups"
mkdir -p "$BACKUP_DIR"

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_NAME="snapshot_${TIMESTAMP}"

echo "Erstelle Backup: $BACKUP_NAME"

# Backup der wichtigsten Dateien
mkdir -p "$BACKUP_DIR/$BACKUP_NAME"

# Frontend
cp -r ~/src/radio/frontend/src "$BACKUP_DIR/$BACKUP_NAME/src" 2>/dev/null
cp ~/src/radio/frontend/src/App.jsx "$BACKUP_DIR/$BACKUP_NAME/App.jsx" 2>/dev/null
cp ~/src/radio/frontend/src/App.css "$BACKUP_DIR/$BACKUP_NAME/App.css" 2>/dev/null
cp ~/src/radio/frontend/src/api.js "$BACKUP_DIR/$BACKUP_NAME/api.js" 2>/dev/null

# Backend
cp ~/src/radio/backend/main.py "$BACKUP_DIR/$BACKUP_NAME/main.py" 2>/dev/null

# Config
cp /mnt/radio/config/stations.json "$BACKUP_DIR/$BACKUP_NAME/stations.json" 2>/dev/null

echo "✓ Backup erstellt: $BACKUP_DIR/$BACKUP_NAME"

# Liste der Backups anzeigen
echo -e "\nVorhandene Backups:"
ls -lt "$BACKUP_DIR" | head -10
