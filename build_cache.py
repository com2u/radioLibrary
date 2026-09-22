#!/usr/bin/env python3
"""Build library cache from file names (fast, no ID3). < 10 seconds."""
import json, sys
from pathlib import Path

MUSIC_DIR = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("/mnt/radio/music")
CACHE_FILE = Path(sys.argv[2]) if len(sys.argv) > 2 else Path("/app/backend/library_cache.json")

songs = []
for filepath in sorted(MUSIC_DIR.rglob("*.mp3")):
    rel_path = str(filepath.relative_to(MUSIC_DIR))
    file_id = rel_path.replace("/", "|")
    stem = filepath.stem

    if " - " in stem:
        parts = stem.split(" - ", 1)
        artist, title = parts[0], parts[1]
    else:
        artist, title = "", stem

    try:
        stat = filepath.stat()
        created, modified, size = stat.st_ctime, stat.st_mtime, stat.st_size
    except:
        created = modified = size = 0

    songs.append({
        "id": file_id, "path": str(filepath), "rel_path": rel_path,
        "filename": filepath.name, "title": title, "artist": artist,
        "album": filepath.parent.name, "year": "", "genre": "", "comment": "",
        "track": "", "duration": 0, "community_rating": 0, "favorite": False,
        "created": created, "modified": modified, "size": size,
    })

with open(CACHE_FILE, "w") as f:
    json.dump(songs, f)
print(f"{len(songs)} songs → {CACHE_FILE} ({CACHE_FILE.stat().st_size / 1024 / 1024:.1f} MB)")