#!/usr/bin/env python3
"""Fast library scanner - saves to JSON cache file."""
import json, sys, os, time
from pathlib import Path
from mutagen.mp3 import MP3
from mutagen.id3 import ID3, ID3NoHeaderError

MUSIC_DIR = Path("/mnt/radio/music")
CACHE_FILE = Path("/root/src/radio/backend/library_cache.json")

# Helper: read ID3 text safely
def get_text(tag, key):
    try:
        frame = tag.get(key)
        return str(frame.text[0]) if frame and hasattr(frame, 'text') and frame.text else ""
    except:
        return ""

def get_comment(tag):
    for key in tag.keys():
        if key.startswith("COMM"):
            try:
                return str(tag[key].text[0])
            except:
                pass
    return ""

def get_rating(tag):
    for key in tag.keys():
        if key.startswith("POPM"):
            try:
                return tag[key].rating
            except:
                pass
    return 0

print(f"Scanning {MUSIC_DIR}...")
start = time.time()
songs = []
count = 0

for filepath in sorted(MUSIC_DIR.rglob("*.mp3")):
    count += 1
    rel_path = str(filepath.relative_to(MUSIC_DIR))
    file_id = rel_path.replace("/", "|")
    
    try:
        audio = MP3(filepath)
        duration = audio.info.length
    except:
        duration = 0
    
    try:
        tag = ID3(filepath)
        title = get_text(tag, "TIT2") or filepath.stem
        artist = get_text(tag, "TPE1")
        album = get_text(tag, "TALB")
        year = get_text(tag, "TDRC")
        genre = get_text(tag, "TCON")
        comment = get_comment(tag)
        track = get_text(tag, "TRCK")
        rating_raw = get_rating(tag)
        community_rating = round(rating_raw / 25.5, 1) if rating_raw > 0 else 0
    except ID3NoHeaderError:
        title = filepath.stem
        artist = album = year = genre = comment = track = ""
        community_rating = 0
    except Exception as e:
        title = filepath.stem
        artist = album = year = genre = comment = track = ""
        community_rating = 0
    
    try:
        stat = filepath.stat()
        created = stat.st_ctime
        modified = stat.st_mtime
    except:
        created = modified = 0
    
    songs.append({
        "id": file_id,
        "path": str(filepath),
        "rel_path": rel_path,
        "filename": filepath.name,
        "title": title,
        "artist": artist,
        "album": album,
        "year": str(year),
        "genre": genre,
        "comment": comment,
        "track": track,
        "duration": round(duration, 2),
        "community_rating": community_rating,
        "favorite": False,
        "created": created,
        "modified": modified,
    })
    
    if count % 5000 == 0:
        elapsed = time.time() - start
        print(f"  {count} songs in {elapsed:.0f}s ({count/elapsed:.0f} songs/s)")

elapsed = time.time() - start
print(f"Done: {count} songs in {elapsed:.0f}s ({count/elapsed:.0f} songs/s)")

with open(CACHE_FILE, "w") as f:
    json.dump(songs, f)
print(f"Cache saved to {CACHE_FILE} ({CACHE_FILE.stat().st_size / 1024 / 1024:.1f} MB)")
