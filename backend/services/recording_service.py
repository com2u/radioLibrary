"""
Recording Service – Verwaltet Streamripper-Prozesse und Stationskonfiguration.

Verantwortlichkeit:
  - Stationskonfiguration laden/speichern (stations.json)
  - Streamripper-Prozesse starten/stoppen
  - Prozess-Status prüfen (PID-Datei + ps-Fallback)
  - Recording-Statistiken berechnen
"""
import json
import logging
import os
import subprocess
import time
from datetime import date
from pathlib import Path

logger = logging.getLogger(__name__)

RADIO_DIR = Path(os.environ.get("RADIO_DIR", "/mnt/radio"))
INBOX_DIR = RADIO_DIR / "inbox"
STATE_DIR = RADIO_DIR / "state"
MUSIC_DIR = RADIO_DIR / "music"
STATIONS_CONFIG = RADIO_DIR / "config" / "stations.json"
MANAGER_SCRIPT = RADIO_DIR / "scripts" / "streamripper-manager.sh"

# Standard-Stationen falls keine Konfiguration vorhanden
# NOTE: Replace these with your own radio stream URLs!
DEFAULT_STATIONS = [
    {"name": "Example Station 1", "url": "https://example.com/stream1.mp3", "path": "Example1", "default_enabled": False},
    {"name": "Example Station 2", "url": "https://example.com/stream2.mp3", "path": "Example2", "default_enabled": False},
]

# Sicherstellen dass State-Verzeichnis existiert
STATE_DIR.mkdir(parents=True, exist_ok=True)


def load_stations_config() -> list:
    """
    Lädt Stationskonfiguration aus stations.json.
    Gibt DEFAULT_STATIONS zurück falls keine Datei vorhanden.

    Output: list[dict] mit name, url, path, default_enabled
    """
    if STATIONS_CONFIG.exists():
        try:
            with open(STATIONS_CONFIG) as f:
                stations = json.load(f)
                logger.debug("stations.json geladen: %d Stationen", len(stations))
                return stations
        except Exception as e:
            logger.error("Fehler beim Lesen von stations.json: %s", e)
    logger.info("stations.json nicht gefunden, verwende Defaults (%d Stationen)", len(DEFAULT_STATIONS))
    return DEFAULT_STATIONS


def save_stations_config(stations: list) -> None:
    """
    Speichert Stationskonfiguration in stations.json.

    Input: list[dict] – Liste der Stationskonfigurationen
    """
    STATIONS_CONFIG.parent.mkdir(parents=True, exist_ok=True)
    with open(STATIONS_CONFIG, "w") as f:
        json.dump(stations, f, indent=2)
    logger.info("stations.json gespeichert: %d Stationen", len(stations))


def _run(cmd, timeout: int = 10) -> tuple[int, str, str]:
    """
    Führt einen Shell-Befehl aus.

    Input:
        cmd     – Liste oder String mit Befehlsargumenten
        timeout – Timeout in Sekunden
    Output: (returncode, stdout, stderr)
    """
    try:
        r = subprocess.run(
            cmd, capture_output=True, text=True,
            timeout=timeout, shell=isinstance(cmd, str)
        )
        return r.returncode, r.stdout, r.stderr
    except subprocess.TimeoutExpired:
        logger.warning("Befehl-Timeout: %s", cmd)
        return -1, "", "timeout"
    except Exception as e:
        logger.error("Befehl-Fehler '%s': %s", cmd, e)
        return -1, "", str(e)


def station_enabled(station: str) -> bool:
    """
    Prüft ob eine Station zum Aufnehmen aktiviert ist.

    WICHTIG: Das State-File ist die EINZIGE Wahrheit (Single Source of Truth).
    Es gibt KEINEN Fallback auf default_enabled mehr – sonst wird eine
    manuell gestoppte Station von station_enabled() wieder als "aktiv"
    gemeldet und vom Manager-Daemon sofort neu gestartet.

    default_enabled wird ausschliesslich beim ALLERERSTEN Aufruf
    (Initialisierung durch init_station_states()) angewendet.

    Input:  station – Stationsname
    Output: bool
    """
    state_file = STATE_DIR / f"{station}.enabled"
    return state_file.exists()


def init_station_states() -> list:
    """
    Initialisiert fehlende State-Dateien anhand von default_enabled.

    WICHTIG: Darf AUSSCHLIESSLICH beim Backend-Start aufgerufen werden,
    NIEMALS aus einem GET-Endpunkt (siehe routers/recording.py).

    Input:  –
    Output: list[str] – Namen der neu aktivierten Stationen
    """
    STATE_DIR.mkdir(parents=True, exist_ok=True)
    created = []
    for station in load_stations_config():
        name = station["name"]
        state_file = STATE_DIR / f"{name}.enabled"
        if not state_file.exists() and station.get("default_enabled", False):
            state_file.touch()
            created.append(name)
            logger.info("State-Datei für '%s' initialisiert (default_enabled)", name)
    if created:
        logger.info("Stationen beim Start aktiviert: %s", ", ".join(created))
    return created


def set_station_enabled(station: str, enabled: bool) -> None:
    """
    Aktiviert/Deaktiviert eine Station durch Erstellen/Löschen der State-Datei.

    Input:
        station – Stationsname
        enabled – True = aktivieren, False = deaktivieren
    """
    state_file = STATE_DIR / f"{station}.enabled"
    if enabled:
        state_file.touch()
        logger.info("Station aktiviert: '%s'", station)
    else:
        state_file.unlink(missing_ok=True)
        logger.info("Station deaktiviert: '%s'", station)


def station_running(station: str) -> bool:
    """
    Prüft ob Streamripper für eine Station läuft.

    Nutzt dieselbe PID-Ermittlung wie stop_station(), damit Statusanzeige
    und Stop-Logik nie voneinander abweichen (Frontend zeigte zuvor
    "gestoppt", während die Aufnahme lief).

    Input:  station – Stationsname
    Output: bool
    """
    return bool(_pids_for_station(station))


def start_station(station_name: str) -> dict:
    """
    Startet Streamripper für eine Station.

    Im Docker-Container (pid=host) wird nur die State-Datei erstellt;
    der Manager-Daemon auf dem Host übernimmt das Starten des
    streamripper-Prozesses im nächsten Zyklus (max. 5 Min).

    Input:  station_name – Name der Station
    Output: dict mit 'ok' und optionalem 'message'
    Raises: RuntimeError bei Fehlern
    """
    set_station_enabled(station_name, True)
    if station_running(station_name):
        logger.info("Station '%s' läuft bereits", station_name)
        return {"ok": True, "message": "Already running"}

    # Docker-Container: streamripper ist nicht installiert.
    # Nur State-Datei setzen; Manager-Daemon startet den Prozess.
    in_docker = Path("/.dockerenv").exists()
    if in_docker:
        logger.info(
            "Station '%s': State-Datei erstellt, Manager-Daemon wird "
            "streamripper in Kürze starten", station_name
        )
        return {
            "ok": True,
            "message": "State gesetzt, Manager-Daemon startet Prozess in Kürze"
        }

    if MANAGER_SCRIPT.exists():
        rc, out, err = _run([str(MANAGER_SCRIPT), "start", station_name], timeout=15)
        if rc != 0:
            raise RuntimeError(f"Manager-Script Fehler: {err or out}")
        logger.info("Station '%s' gestartet", station_name)
        return {"ok": True}
    raise RuntimeError("Manager-Script nicht gefunden")


def _find_pid_files(station_name: str) -> list:
    """
    Findet alle PID-Dateien, die zu einer Station gehören könnten.

    Der Manager-Daemon schreibt /tmp/streamripper-<Sender>.pid. Da Sender-Namen
    Leerzeichen enthalten können (z.B. "Vintage Radio"), werden mehrere
    Schreibweisen geprüft, damit keine verwaiste PID-Datei übrig bleibt.

    Im Docker-Container (pid=host) liegt /host-tmp als readonly-Mount des
    Host-/tmp — dort liegen die eigentlichen PID-Dateien.
    """
    candidates = set()
    for base in [Path("/tmp"), Path("/host-tmp")]:
        if not base.exists():
            continue
        for name in [station_name, station_name.replace(" ", "_")]:
            candidates.add(base / f"streamripper-{name}.pid")
    return [p for p in candidates if p.exists()]


def _pids_for_station(station_name: str) -> list:
    """
    Ermittelt alle laufenden Streamripper-PIDs für eine Station.

    Kombiniert zwei Quellen, damit wirklich jeder Prozess gefunden wird:
      1. Alle passenden PID-Dateien
      2. `pgrep -f` auf die Kommandozeile (findet auch Prozesse ohne PID-Datei)

    Input:  station_name – Name der Station
    Output: list[int] – laufende PIDs
    """
    pids = set()

    # 1) PID-Dateien
    for pid_file in _find_pid_files(station_name):
        try:
            pid = int(pid_file.read_text().strip())
            rc, out, _ = _run(["ps", "-p", str(pid), "-o", "pid="])
            if rc == 0 and out.strip():
                pids.add(pid)
        except Exception as e:
            logger.debug("PID-Datei '%s' unbrauchbar: %s", pid_file, e)

    # 2) pgrep auf die Kommandozeile (Escaping gegen Regex-Injektion)
    import re
    pattern = "streamripper.*" + re.escape(station_name)
    rc, out, _ = _run(["pgrep", "-f", pattern])
    if rc == 0:
        for line in out.splitlines():
            line = line.strip()
            if line.isdigit():
                pids.add(int(line))

    return sorted(pids)


def stop_station(station_name: str) -> dict:
    """
    Stoppt Streamripper für eine Station – ZUVERLÄSSIG und VERIFIZIERT.

    Reihenfolge (wichtig!):
      1. State-Datei löschen → der Manager-Daemon startet NICHT neu
      2. Alle PIDs ermitteln (PID-Datei + pgrep)
      3. SIGTERM, danach SIGKILL falls möglich (Docker: evtl. keine Berechtigung)
      4. Verifizieren + ggf. auf Manager-Daemon-Cleanup verweisen

    Der Manager-Daemon auf dem Host löscht verwaiste Prozesse automatisch
    beim nächsten Durchlauf (max. 5 Min), falls der Container sie nicht
    beenden konnte.

    Input:  station_name – Name der Station
    Output: dict mit 'ok', 'stopped', 'remaining', 'delegated_to_manager'
    """
    # 1) ZUERST deaktivieren – bevor irgendetwas anderes passiert.
    #    Der Manager-Daemon prüft die State-Datei; sie muss weg sein,
    #    sonst startet er die Aufnahme sofort neu.
    set_station_enabled(station_name, False)
    logger.info("Station '%s' deaktiviert (State-Datei entfernt)", station_name)

    # 2) Alle laufenden Prozesse finden
    pids = _pids_for_station(station_name)
    stopped = []
    delegated = False

    for pid in pids:
        # 3a) Sanft beenden
        rc, _, err = _run(["kill", "-TERM", str(pid)])
        if rc != 0:
            logger.debug("SIGTERM an PID %d nicht möglich: %s", pid, err)
        else:
            logger.info("Station '%s': SIGTERM an PID %d gesendet", station_name, pid)

        # 3b) Kurz warten, dann prüfen
        for _ in range(10):  # max. 5 Sekunden
            rc, out, _ = _run(["ps", "-p", str(pid), "-o", "pid="])
            if rc != 0 or not out.strip():
                break
            time.sleep(0.5)
        else:
            # 3c) Hart beenden (kann in Docker fehlschlagen)
            rc, _, err = _run(["kill", "-KILL", str(pid)])
            if rc == 0:
                logger.warning("Station '%s': SIGKILL an PID %d nötig", station_name, pid)
            else:
                logger.warning(
                    "Station '%s': SIGKILL an PID %d fehlgeschlagen (%s) – "
                    "Manager-Daemon wird übernehmen", station_name, pid, err
                )
                delegated = True
        time.sleep(0.5)
        stopped.append(pid)

    # 4) Aufräumen: alle PID-Dateien entfernen
    for pid_file in _find_pid_files(station_name):
        try:
            pid_file.unlink()
            logger.debug("PID-Datei entfernt: %s", pid_file)
        except Exception as e:
            logger.warning("PID-Datei '%s' konnte nicht entfernt werden: %s", pid_file, e)

    # 5) Verifizieren
    remaining = _pids_for_station(station_name)
    result = {"ok": True, "stopped": stopped, "remaining": remaining}
    
    if remaining:
        if delegated:
            # Docker-Container hat keine Berechtigung, aber Manager-Daemon
            # wird die verwaisten Prozesse im nächsten Zyklus beenden.
            logger.warning(
                "Station '%s': %d Prozesse verbleiben, werden vom Manager-Daemon "
                "bereinigt. State-Datei wurde gelöscht.", station_name, len(remaining)
            )
            result["delegated_to_manager"] = True
        else:
            logger.error(
                "Station '%s' konnte NICHT vollständig gestoppt werden. Verbleibend: %s",
                station_name, remaining
            )
            raise RuntimeError(
                f"Aufnahme für '{station_name}' läuft noch (PIDs: {remaining}). "
                f"Bitte Prozess manuell prüfen."
            )

    logger.info("Station '%s' sauber gestoppt (PIDs: %s)", station_name, stopped or "keine")
    return result


def count_mp3(path: Path, since_minutes: int = None, since_today: bool = False) -> int:
    """
    Zählt MP3-Dateien in einem Verzeichnis, optional nach Zeit gefiltert.

    Input:
        path          – Zu durchsuchendes Verzeichnis
        since_minutes – Nur Dateien jünger als N Minuten
        since_today   – Nur Dateien von heute
    Output: int – Anzahl der gefundenen MP3-Dateien
    """
    if not path.exists():
        return 0
    cmd = ["find", str(path), "-type", "f", "-name", "*.mp3"]
    if since_today:
        today = date.today().strftime("%Y-%m-%d")
        cmd += ["-newermt", f"{today} 00:00"]
    elif since_minutes is not None:
        cmd += ["-mmin", f"-{since_minutes}"]
    rc, out, _ = _run(cmd, timeout=30)
    if rc != 0:
        return 0
    return len([line for line in out.splitlines() if line.strip()])


def get_recording_stats() -> dict:
    """
    Berechnet Recording-Statistiken: Gesamtanzahl, Heute, Letzte 30 Min.
    BERÜCKSICHTIGT NUR AKTIVE STATIONEN!
    
    Output: dict mit 'total_music', 'today_music', 'last_30min_music', 'stations'
    """
    stations = load_stations_config()
    # Gesamt-Statistik nur für aktive Stationen
    total = 0
    today = 0
    last_30 = 0
    station_stats = {}
    
    for station in stations:
        name = station["name"]
        # NUR aktive Stationen berücksichtigen!
        if not station_enabled(name):
            logger.debug("Station '%s' ist inaktiv - überspringe Statistik", name)
            continue
            
        # Pfad bestimmen: Falls path bereits absoluten Pfad enthält, nutze ihn,
        # sonst Music-Verzeichnis + path
        station_path = station.get("path", name)
        if Path(station_path).is_absolute():
            music_path = Path(station_path)
        else:
            # Vermeide doppeltes " - Musik"
            if " - Musik" in station_path:
                music_path = MUSIC_DIR / station_path
            else:
                music_path = MUSIC_DIR / f"{station_path} - Musik"
        
        # Statistiken für diese Station
        s_total = count_mp3(music_path)
        s_today = count_mp3(music_path, since_today=True)
        s_30min = count_mp3(music_path, since_minutes=30)
        
        station_stats[name] = {
            "total_music": s_total,
            "today_music": s_today,
            "last_30min_music": s_30min,
            "last_activity": date.today().strftime("%Y-%m-%d") if s_today > 0 else "-"
        }
        
        total += s_total
        today += s_today
        last_30 += s_30min
        logger.debug("Stats für '%s': total=%d, today=%d, 30min=%d", 
                    name, s_total, s_today, s_30min)
    
    stats = {
        "total_music": total,
        "today_music": today,
        "last_30min_music": last_30,
        "stations": station_stats
    }
    logger.info("Recording-Stats berechnet: %d Gesamt, %d heute", total, today)
    return stats
