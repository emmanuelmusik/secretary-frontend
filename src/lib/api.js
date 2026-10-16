import { supabase } from './supabase.js';
import { getInstallId } from './install.js';
import { cacheable, cacheGet, cacheSet } from './offlineCache.js';
import { tNow } from '../i18n/index.jsx';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3000';

async function offlineError(message) {
  const e = new Error(message);
  e.offline = true;
  return e;
}

async function authedFetch(path, options = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  const userId = session?.user?.id;
  const isRead = !options.method || options.method === 'GET';
  const useCache = isRead && userId && cacheable(path);

  // Without a connection, reads come from what the phone kept; changes are refused with a clear message.
  const serveOffline = async () => {
    if (useCache) {
      const kept = await cacheGet(userId, path);
      if (kept !== null) return { hit: kept };
    }
    throw await offlineError(await tNow('offline.needs_connection'));
  };
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    if (isRead) return (await serveOffline()).hit;
    throw await offlineError(await tNow('offline.needs_connection'));
  }

  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: {
        ...(options.body && !(options.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(getInstallId() ? { 'X-Install-Id': getInstallId() } : {}),
        ...options.headers,
      },
    });
  } catch (netErr) {
    if (isRead) { try { return (await serveOffline()).hit; } catch { throw netErr; } }
    throw netErr;
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    const failure = new Error(err.error || 'Request failed');
    failure.status = res.status;
    failure.usage = err.usage;
    failure.data = err;
    throw failure;
  }

  if (res.status === 204) return null;
  const body = await res.json();
  if (useCache) cacheSet(userId, path, body);
  return body;
}

export const api = {
  // Folders
  getFolders: () => authedFetch('/folders'),
  createFolder: (name, parentId) => authedFetch('/folders', { method: 'POST', body: JSON.stringify({ name, parent_id: parentId || null }) }),
  renameFolder: (id, name) => authedFetch(`/folders/${id}`, { method: 'PATCH', body: JSON.stringify({ name }) }),
  moveFolder: (id, parentId) => authedFetch(`/folders/${id}`, { method: 'PATCH', body: JSON.stringify({ parent_id: parentId || null }) }),
  deleteFolder: (id) => authedFetch(`/folders/${id}`, { method: 'DELETE' }),

  // Notes
  getNotes: (folderId) => authedFetch(`/notes${folderId ? `?folder_id=${folderId}` : ''}`),
  createNote: (note) => authedFetch('/notes', { method: 'POST', body: JSON.stringify(note) }),
  updateNote: (id, note) => authedFetch(`/notes/${id}`, { method: 'PATCH', body: JSON.stringify(note) }),
  deleteNote: (id) => authedFetch(`/notes/${id}`, { method: 'DELETE' }),
  searchNotes: (q) => authedFetch(`/notes?q=${encodeURIComponent(q)}`),

  // Sessions
  getSessions: (folderId) => authedFetch(`/sessions${folderId ? `?folder_id=${folderId}` : ''}`),
  getSession: (id) => authedFetch(`/sessions/${id}`),
  createSession: (payload) => authedFetch('/sessions', { method: 'POST', body: JSON.stringify(payload) }),
  stopSession: (id, payload) => authedFetch(`/sessions/${id}/stop`, { method: 'PATCH', body: JSON.stringify(payload) }),
  renameSpeaker: (id, from, to) => authedFetch(`/sessions/${id}/speakers`, { method: 'PATCH', body: JSON.stringify({ from, to }) }),
  saveSession: (id, payload) => authedFetch(`/sessions/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  deleteSession: (id) => authedFetch(`/sessions/${id}`, { method: 'DELETE' }),
  uploadAudio: (id, file, durationSeconds) => {
    const form = new FormData();
    if (durationSeconds > 0) form.append('duration', String(Math.round(durationSeconds)));
    form.append('audio', file);
    return authedFetch(`/sessions/${id}/upload`, { method: 'POST', body: form });
  },
  analyzeWithHistory: (id, range, sessionIds, folderId) =>
    authedFetch(`/sessions/${id}/analyze-with-history`, { method: 'POST', body: JSON.stringify(sessionIds ? { session_ids: sessionIds } : { range, folder_id: folderId || undefined }) }),
  getAskMessages: (id) => authedFetch(`/sessions/${id}/ask`, { cache: 'no-store' }),
  translateSession: (id, targetLanguage) =>
    authedFetch(`/sessions/${id}/translate`, { method: 'POST', body: JSON.stringify({ target_language: targetLanguage }) }),
  askAboutRecording: (id, question, transcript) => authedFetch(`/sessions/${id}/ask`, { method: 'POST', body: JSON.stringify({ question, transcript }) }),
  liveInsight: (id, transcript) => authedFetch(`/sessions/${id}/live-insight`, { method: 'POST', body: JSON.stringify({ transcript }) }),
  generateInsight: (id) => authedFetch(`/sessions/${id}/insight`, { method: 'POST' }),

  // Plan and monthly usage
  getUsage: () => authedFetch('/billing/usage'),
  // Right after a purchase: the server asks RevenueCat directly, so Pro unlocks without waiting for the webhook.
  syncBilling: () => authedFetch('/billing/sync', { method: 'POST' }),

  // Business cards
  scanCard: (images) => authedFetch('/cards/scan', { method: 'POST', body: JSON.stringify({ images }) }),
  getCards: () => authedFetch('/cards'),
  createCard: (card) => authedFetch('/cards', { method: 'POST', body: JSON.stringify(card) }),
  updateCard: (id, card) => authedFetch(`/cards/${id}`, { method: 'PATCH', body: JSON.stringify(card) }),
  deleteCard: (id) => authedFetch(`/cards/${id}`, { method: 'DELETE' }),

  // Account
  deleteAccount: () => authedFetch('/account', { method: 'DELETE' }),
};
