/**
 * Hilfsfunktionen und Konstanten für die gesamte Anwendung.
 * 
 * Zweck: Wiederverwendbare Utilities die keine React-Abhängigkeiten haben.
 */

/**
 * Formatiert Sekunden als "M:SS" Zeitstring.
 * 
 * @param {number} sec - Zeit in Sekunden
 * @returns {string} Formatierte Zeit z.B. "3:45"
 */
export const fmtTime = (sec) => {
  if (!sec || isNaN(sec)) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
};

/**
 * Formatiert einen Unix-Timestamp als lokalen Datums-/Zeitstring.
 * 
 * @param {number} ts - Unix-Timestamp in Sekunden
 * @returns {string} Formatiertes Datum und Uhrzeit
 */
export const fmtDateTime = (ts) => {
  if (!ts) return '–';
  const d = new Date(ts * 1000);
  return d.toLocaleDateString() + ' ' + d.toLocaleTimeString();
};

/**
 * Stern-Rating-Mapping: Stars 1–5 → numerische Rating-Werte
 * Stars: 1=1, 2=3, 3=5, 4=7, 5=9
 */
export const STAR_VALUES = [1, 3, 5, 7, 9];

/**
 * Konvertiert einen numerischen Rating-Wert in die Anzahl der anzuzeigenden Sterne.
 * 
 * @param {number} rating - Rating-Wert 0–10
 * @returns {number} Anzahl der Sterne 0–5
 */
export function starsFromRating(rating) {
  if (!rating || rating <= 0) return 0;
  for (let i = STAR_VALUES.length - 1; i >= 0; i--) {
    if (rating >= STAR_VALUES[i]) return i + 1;
  }
  return 0;
}
