#!/usr/bin/env python3
"""Blitz-Scan: nur Dateinamen, keine ID3-Tags. < 10 Sekunden."""
import json, time, os
from pathlib import Path

MUSIC_DIR = Path("/mnt/radio/music")
CACHE_FILE = Path("/root/src/radio/backend/library_cache.json")

print(f"Scanning {MUSIC_DIR} (fast, no ID3)...")
start = time.time()
songs = []

for filepath in sorted(MUSIC_DIR.rglob("*.mp3")):
    rel_path = str(filepath.relative_to(MUSIC_DIR))
    file_id = rel_path.replace("/", "|")
    stem = filepath.stem
    
    # Parse "Artist - Title" from filename
    if " - " in stem:
        parts = stem.split(" - ", 1)
        artist, title = parts[0], parts[1]
    else:
        artist, title = "", stem
    
    # Album from parent folder
    album = filepath.parent.name
    
    try:
        stat = filepath.stat()
        created = stat.st_ctime
        modified = stat.st_mtime
        size = stat.st_size
    except:
        created = modified = 0
        size = 0
    
    songs.append({
        "id": file_id,
        "path": str(filepath),
        "rel_path": rel_path,
        "filename": filepath.name,
        "title": title,
        "artist": artist,
        "album": album,
        "year": "",
        "genre": "",
        "comment": "",
        "track": "",
        "duration": 0,
        "community_rating": 0,
        "favorite": False,
        "created": created,
        "modified": modified,
        "size": size,
    })

elapsed = time.time() - start
print(f"Done: {len(songs)} songs in {elapsed:.1f}s ({len(songs)/elapsed:.0f} songs/s)")

with open(CACHE_FILE, "w") as f:
    json.dump(songs, f)
print(f"Cache: {CACHE_FILE} ({CACHE_FILE.stat().st_size / 1024 / 1024:.1f} MB)")
