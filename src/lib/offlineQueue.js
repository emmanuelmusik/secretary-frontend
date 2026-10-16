// Offline recording queue. A recording made without a connection is kept on the phone (audio in the app's
// file storage, details in localStorage) and sent for transcription as soon as the signal is back.
import { Filesystem, Directory } from '@capacitor/filesystem';
import { api } from './api.js';
import { supabase } from './supabase.js';

const KEY = 'secretary_pending_v1';
const EVENT = 'secretary-queue';
let running = false;

function read() {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; }
}
function write(list) {
  try { localStorage.setItem(KEY, JSON.stringify(list)); } catch { /* storage full or blocked */ }
  window.dispatchEvent(new Event(EVENT));
}
function patch(id, fields) {
  write(read().map((p) => (p.id === id ? { ...p, ...fields } : p)));
}

export function onQueueChange(fn) {
  window.addEventListener(EVENT, fn);
  return () => window.removeEventListener(EVENT, fn);
}

export function listPending(userId) {
  return read().filter((p) => !userId || p.user_id === userId);
}

export function isNetworkError(err) {
  return !err?.status && (err instanceof TypeError || /network|failed to fetch|load failed/i.test(err?.message || ''));
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result.split(',')[1]);
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}
async function base64ToBlob(b64, type) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type });
}

// A finished recording that never had a session: keep the audio and the settings.
export async function enqueueRecording({ blob, userId, settings, duration }) {
  const id = (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2));
  const file = `pending-${id}.webm`;
  await Filesystem.writeFile({ path: file, data: await blobToBase64(blob), directory: Directory.Data });
  write([...read(), { id, kind: 'recording', user_id: userId, file, settings, duration: Math.round(duration || 0), created_at: new Date().toISOString(), state: 'waiting' }]);
  processQueue();
  return id;
}

// A session that exists on the server but could not be told "stop" (the signal dropped at that moment).
export function enqueueStop({ sessionId, userId, duration, localAudioPath }) {
  write([...read(), { id: `stop-${sessionId}`, kind: 'stop', user_id: userId, session_id: sessionId, duration: Math.round(duration || 0), local_audio_path: localAudioPath || null, created_at: new Date().toISOString(), state: 'waiting' }]);
  processQueue();
}

export async function removePending(id) {
  const item = read().find((p) => p.id === id);
  if (item?.file) await Filesystem.deleteFile({ path: item.file, directory: Directory.Data }).catch(() => {});
  write(read().filter((p) => p.id !== id));
}

// Used when the account is deleted: nothing of it may stay on the phone.
export async function clearPending(userId) {
  for (const p of read().filter((x) => !userId || x.user_id === userId)) await removePending(p.id);
}

async function runOne(item) {
  if (item.kind === 'stop') {
    await api.stopSession(item.session_id, { duration_seconds: item.duration, local_audio_path: item.local_audio_path });
    return;
  }
  let sessionId = item.session_id;
  if (!sessionId) {
    const s = await api.createSession({ ...item.settings, analysis_requested: true });
    sessionId = s.id;
    patch(item.id, { session_id: sessionId });
  }
  const { data } = await Filesystem.readFile({ path: item.file, directory: Directory.Data });
  const blob = await base64ToBlob(data, 'audio/webm');
  await api.uploadAudio(sessionId, new File([blob], 'recording.webm', { type: 'audio/webm' }), item.duration);
  // Keep the on-phone copy under the same name every other recording uses.
  const finalName = `session-${sessionId}.webm`;
  try {
    await Filesystem.rename({ from: item.file, to: finalName, directory: Directory.Data, toDirectory: Directory.Data });
    await api.saveSession(sessionId, { local_audio_path: finalName, duration_seconds: item.duration });
    patch(item.id, { file: null });
  } catch (e) {
    console.warn('[queue] could not rename the local copy', e);
  }
}

export async function processQueue() {
  if (running || !navigator.onLine) return;
  const { data: { session } } = await supabase.auth.getSession();
  const uid = session?.user?.id;
  if (!uid) return;
  running = true;
  try {
    for (const item of read().filter((p) => p.user_id === uid && p.state !== 'error')) {
      patch(item.id, { state: 'sending' });
      try {
        await runOne(item);
        write(read().filter((p) => p.id !== item.id));
      } catch (err) {
        if (isNetworkError(err) || err.status >= 500) { patch(item.id, { state: 'waiting' }); break; } // try again later
        if (err.status === 402 || err.status === 413) {
          // Not enough minutes, or longer than allowed: the audio stays on the phone, the item waits for a decision.
          if (item.session_id) api.deleteSession(item.session_id).catch(() => {});
          patch(item.id, { state: 'error', error: err.data?.error || String(err.status), session_id: null });
        } else {
          patch(item.id, { state: 'error', error: err.message || 'failed' });
        }
      }
    }
  } finally { running = false; }
}

export function startQueueWatcher() {
  // Load the file plugin now, while there is a connection, so saving a recording later never needs the network.
  Filesystem.readdir({ path: '', directory: Directory.Data }).catch(() => {});
  const go = () => processQueue();
  window.addEventListener('online', go);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) go(); });
  go();
  setInterval(go, 60000);
}

export async function retryPending(id) { patch(id, { state: 'waiting', error: undefined }); processQueue(); }
