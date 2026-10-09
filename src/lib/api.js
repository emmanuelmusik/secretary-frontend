import { supabase } from './supabase.js';
import { getInstallId } from './install.js';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3000';

async function authedFetch(path, options = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      ...(options.body && !(options.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(getInstallId() ? { 'X-Install-Id': getInstallId() } : {}),
      ...options.headers,
    },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    const failure = new Error(err.error || 'Request failed');
    failure.status = res.status;
    failure.usage = err.usage;
    throw failure;
  }

  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  // Folders
  getFolders: () => authedFetch('/folders'),
  createFolder: (name) => authedFetch('/folders', { method: 'POST', body: JSON.stringify({ name }) }),
  renameFolder: (id, name) => authedFetch(`/folders/${id}`, { method: 'PATCH', body: JSON.stringify({ name }) }),
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
  saveSession: (id, payload) => authedFetch(`/sessions/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  deleteSession: (id) => authedFetch(`/sessions/${id}`, { method: 'DELETE' }),
  uploadAudio: (id, file) => {
    const form = new FormData();
    form.append('audio', file);
    return authedFetch(`/sessions/${id}/upload`, { method: 'POST', body: form });
  },
  analyzeWithHistory: (id, range) =>
    authedFetch(`/sessions/${id}/analyze-with-history`, { method: 'POST', body: JSON.stringify({ range }) }),
  translateSession: (id, targetLanguage) =>
    authedFetch(`/sessions/${id}/translate`, { method: 'POST', body: JSON.stringify({ target_language: targetLanguage }) }),
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
