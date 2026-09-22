import axios from 'axios';

// Docker: nginx served → relative /api Pfade
// Dev:    direkter Backend-Port 8000 (nur wenn via vite dev server)
const getBaseUrl = () => {
  if (typeof window === 'undefined') return 'http://localhost:8000';  // Change to your backend IP for SSR/dev
  // Im Docker-Container: nginx bedient Frontend UND API → relative URLs
  // Nur im Vite-Dev-Mode (Port 5173) brauchen wir Port 8000 direkt
  if (window.location.port === '5173') {
    return `${window.location.protocol}//${window.location.hostname}:8000`;
  }
  return '';  // relative URL, nginx proxied /api
};

const API_BASE = getBaseUrl();
const API = axios.create({ baseURL: API_BASE });

export const fetchSongs = (params) => API.get('/api/songs', { params });
export const fetchMeta = () => API.get('/api/songs/meta');
export const fetchSong = (id) => API.get(`/api/songs/${id}`);
export const updateSong = (id, data) => API.patch(`/api/songs/${id}`, data);
export const toggleFavorite = (id, favorite) => API.patch(`/api/songs/${id}/favorite`, { favorite });
export const saveClip = (data) => API.post('/api/clip/save', data);
export const rescan = () => API.post('/api/rescan');

export const deleteSong = (id) => API.delete(`/api/songs/${id}`);
export const streamUrl = (id) => `${API_BASE}/api/stream/${encodeURIComponent(id)}`;

// Recording Control
export const getRecordingStations = () => API.get('/api/recording/stations');
export const startRecording = (station) => API.post(`/api/recording/${encodeURIComponent(station)}/start`);
export const stopRecording = (station) => API.post(`/api/recording/${encodeURIComponent(station)}/stop`);
export const restartRecording = (station) => API.post(`/api/recording/${encodeURIComponent(station)}/restart`);
export const getRecordingStats = () => API.get('/api/recording/stats');

// Playlists
export const getPlaylists = () => API.get('/api/playlists');
export const createPlaylist = (name) => API.post('/api/playlists', { name });
export const renamePlaylist = (name, new_name) => API.put(`/api/playlists/${encodeURIComponent(name)}/rename`, { new_name });
export const deletePlaylist = (name) => API.delete(`/api/playlists/${encodeURIComponent(name)}`);
export const getPlaylistSongs = (name) => API.get(`/api/playlists/${encodeURIComponent(name)}/songs`);
export const addToPlaylist = (name, songId) => API.post(`/api/playlists/${encodeURIComponent(name)}/add`, { song_id: songId });
export const removeFromPlaylist = (name, songId) => API.delete(`/api/playlists/${encodeURIComponent(name)}/songs`, { data: { song_id: songId } });

// Cleanup
export const getCleanupPreview = (station) => API.get('/api/cleanup/preview', { params: station ? { station } : {} });
export const executeCleanup = (rules, station, limit) => API.post('/api/cleanup/execute', { rules, station, limit });
export const getCleanupStations = () => API.get('/api/cleanup/stations');

// Station Config
export const getStationsConfig = () => API.get('/api/stations');
export const saveStationsConfig = (stations) => API.post('/api/stations', stations);
export const addStation = (station) => API.post('/api/stations/add', station);
export const updateStation = (oldName, station) => API.put(`/api/stations/${encodeURIComponent(oldName)}`, station);
export const deleteStation = (name) => API.delete(`/api/stations/${encodeURIComponent(name)}`);
