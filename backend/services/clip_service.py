"""
Clip Service – Schneidet MP3-Dateien via ffmpeg.

Verantwortlichkeit:
  - Clip-Trim durchführen (Start/End in Sekunden)
  - Optionale Fade-In / Fade-Out-Filter anwenden
  - Original-ID3-Tags nach dem Schnitt wiederherstellen
  - Kommentar 'saved' setzen falls bisher leer
"""
import os
import shutil
import logging
import tempfile
import subprocess
from pathlib import Path

from mutagen.id3 import ID3, COMM, ID3NoHeaderError

logger = logging.getLogger(__name__)


def _run_ffmpeg(cmd: list) -> tuple[int, str, str]:
    """
    Führt einen ffmpeg-Befehl aus und gibt (returncode, stdout, stderr) zurück.

    Input:  cmd – Liste mit Befehlsargumenten
    Output: (returncode: int, stdout: str, stderr: str)
    """
    logger.debug("ffmpeg: %s", " ".join(cmd))
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        logger.error("ffmpeg Fehler (rc=%d): %s", result.returncode, result.stderr[-500:])
    return result.returncode, result.stdout, result.stderr


def apply_clip(path: Path, start: float, end: float,
               fade_in: bool, fade_out: bool, fade_duration: float) -> None:
    """
    Schneidet eine MP3-Datei und ersetzt sie mit dem Clip.

    Ablauf:
      1. Bestehende ID3-Tags sichern
      2. ffmpeg trim (start → end)
      3. Optional: ffmpeg afade Filter
      4. Datei ersetzen
      5. ID3-Tags wiederherstellen, ggf. 'saved' Kommentar setzen

    Input:
        path          – Absoluter Pfad zur MP3-Datei (wird überschrieben)
        start         – Clip-Start in Sekunden
        end           – Clip-Ende in Sekunden
        fade_in       – Fade-In aktivieren
        fade_out      – Fade-Out aktivieren
        fade_duration – Fade-Dauer in Sekunden
    Output: None
    Raises: RuntimeError bei ffmpeg-Fehler
    """
    logger.info("Clip speichern: '%s' [%.2fs – %.2fs] fade_in=%s fade_out=%s",
                path.name, start, end, fade_in, fade_out)

    # ID3-Tags vor der Verarbeitung sichern
    try:
        original_tags = ID3(path)
        logger.debug("Bestehende ID3-Tags gesichert")
    except Exception as e:
        logger.warning("ID3-Tags nicht lesbar (werden nicht wiederhergestellt): %s", e)
        original_tags = None

    duration = end - start

    with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as tmp:
        tmp_path = tmp.name

    try:
        # Schritt 1: Trim
        cmd = [
            "ffmpeg", "-y",
            "-i", str(path),
            "-ss", str(start),
            "-t", str(duration),
            "-c", "copy",
            tmp_path
        ]
        rc, _, err = _run_ffmpeg(cmd)
        if rc != 0:
            raise RuntimeError(f"ffmpeg Trim-Fehler: {err}")

        # Schritt 2: Optionale Fades
        if fade_in or fade_out:
            tmp_faded = tmp_path + "_faded.mp3"
            af_parts = []
            if fade_in:
                af_parts.append(f"afade=t=in:st=0:d={fade_duration}")
            if fade_out:
                fade_start = max(0, duration - fade_duration)
                af_parts.append(f"afade=t=out:st={fade_start:.3f}:d={fade_duration}")
            af = ",".join(af_parts)

            cmd2 = [
                "ffmpeg", "-y",
                "-i", tmp_path,
                "-af", af,
                "-codec:a", "libmp3lame",
                "-q:a", "2",
                tmp_faded
            ]
            rc2, _, err2 = _run_ffmpeg(cmd2)
            os.unlink(tmp_path)
            if rc2 != 0:
                if os.path.exists(tmp_faded):
                    os.unlink(tmp_faded)
                raise RuntimeError(f"ffmpeg Fade-Fehler: {err2}")
            tmp_path = tmp_faded
            logger.debug("Fades angewendet: %s", af)

        # Schritt 3: Original ersetzen
        shutil.move(tmp_path, str(path))
        logger.info("Clip gespeichert: '%s'", path.name)

        # Schritt 4: ID3-Tags wiederherstellen
        if original_tags:
            # Kommentar auf 'saved' setzen falls bisher leer
            existing_comment = ""
            for key in original_tags.keys():
                if key.startswith("COMM"):
                    try:
                        existing_comment = str(original_tags[key].text[0])
                    except Exception:
                        pass
                    break
            if not existing_comment.strip():
                original_tags["COMM::eng"] = COMM(lang="eng", desc="", text=["saved"])
                logger.debug("Kommentar 'saved' gesetzt")
            original_tags.save(str(path))
            logger.debug("ID3-Tags wiederhergestellt")
        else:
            # Neue minimale Tags mit 'saved' Kommentar erstellen
            try:
                new_tag = ID3()
                new_tag["COMM::eng"] = COMM(lang="eng", desc="", text=["saved"])
                new_tag.save(str(path))
            except Exception as e:
                logger.warning("Neue ID3-Tags konnten nicht erstellt werden: %s", e)

    except RuntimeError:
        raise
    except Exception as e:
        logger.error("Unerwarteter Fehler beim Clip: %s", e)
        if os.path.exists(tmp_path):
            os.unlink(tmp_path)
        raise RuntimeError(str(e))
