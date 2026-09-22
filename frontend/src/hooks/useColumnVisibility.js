/**
 * useColumnVisibility – Sichtbarkeit der Spalten in der Songliste.
 *
 * Problem: Auf schmalen Displays (Smartphone) waren Titel und Artist
 * kaum lesbar, weil alle Spalten gleichzeitig angezeigt wurden.
 *
 * Lösung: Zwei Ebenen
 *   1) Automatik – abhängig von der Fensterbreite werden Spalten nach
 *      Priorität ausgeblendet. Der Titel bleibt IMMER sichtbar.
 *   2) Manuell  – der Nutzer kann jede Spalte (ausser Titel) im
 *      Play-Dialog selbst ein-/ausschalten. Die Auswahl wird in
 *      localStorage gespeichert.
 *
 * Die Automatik hat Vorrang: Ist die Breite zu klein, bleibt eine
 * Spalte ausgeblendet, auch wenn der Nutzer sie aktiviert hat.
 */

import { useState, useEffect, useCallback } from 'react';

// Alle Spalten ausser dem Titel, in der Reihenfolge in der sie
// bei Platzmangel verschwinden.
export const COLUMN_KEYS = [
  'favorite',
  'length',
  'rating',
  'genre',
  'playlist',
  'comment',
  'edit',
];

export const COLUMN_LABELS = {
  title: 'Titel',
  favorite: 'Favorit (Herz)',
  length: 'Länge',
  rating: 'Rating (Sterne)',
  genre: 'Genre',
  playlist: 'Playlist Manager',
  comment: 'Kommentar',
  edit: 'Metadaten bearbeiten',
};

// Ab dieser Breite (px) verschwinden die Spalten der Stufe 1
export const BREAKPOINT_COMPACT = 1100;
// Ab dieser Breite (px) verschwinden zusätzlich Rating und Favorit
export const BREAKPOINT_TINY = 700;

const STORAGE_KEY = 'radio-library-columns';

// Spalten die bei Stufe 1 (kompakt) ausgeblendet werden
const HIDE_COMPACT = ['genre', 'playlist', 'comment', 'length'];
// Zusätzlich bei Stufe 2 (sehr schmal)
const HIDE_TINY = ['rating', 'favorite'];

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...defaultColumns(), ...parsed };
    }
  } catch (e) {
    console.warn('[Columns] Konnte Einstellung nicht laden:', e);
  }
  return defaultColumns();
}

function defaultColumns() {
  const cols = { title: true };
  for (const key of COLUMN_KEYS) cols[key] = true;
  return cols;
}

export function useColumnVisibility() {
  const [columns, setColumns] = useState(loadFromStorage);
  const [width, setWidth] = useState(
    typeof window === 'undefined' ? 1400 : window.innerWidth
  );

  // Fensterbreite verfolgen
  useEffect(() => {
    const onResize = () => setWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Auswahl speichern
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(columns));
    } catch (e) {
      console.warn('[Columns] Konnte Einstellung nicht speichern:', e);
    }
  }, [columns]);

  const toggle = useCallback((key) => {
    if (key === 'title') return; // Titel ist immer sichtbar
    setColumns(prev => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const setAll = useCallback((value) => {
    setColumns(() => {
      const next = { title: true };
      for (const key of COLUMN_KEYS) next[key] = value;
      return next;
    });
  }, []);

  // Automatik: Welche Spalten sind wegen Platzmangel ausgeblendet?
  const autoHidden = new Set();
  if (width < BREAKPOINT_COMPACT) {
    for (const key of HIDE_COMPACT) autoHidden.add(key);
  }
  if (width < BREAKPOINT_TINY) {
    for (const key of HIDE_TINY) autoHidden.add(key);
  }

  // Effektiv sichtbar: Nutzer-Wahl UND nicht automatisch ausgeblendet
  const visible = { title: true };
  for (const key of COLUMN_KEYS) {
    visible[key] = columns[key] !== false && !autoHidden.has(key);
  }

  const isAutoHidden = (key) => autoHidden.has(key);

  return {
    columns,       // Nutzer-Einstellung (roh)
    visible,       // Effektiv sichtbar
    toggle,
    setAll,
    width,
    isAutoHidden,
  };
}
