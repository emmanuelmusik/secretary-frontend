// Offline read cache. Every successful read from the server is kept on the phone (IndexedDB), per account,
// so recordings, transcripts, insights, Ask chats, folders, notes and cards can still be opened without a
// connection. It is read-only: changes need a connection. It is wiped on sign-out and account deletion.
const DB = 'secretary_cache_v1';
const STORE = 'reads';
const MAX_ENTRIES = 600;   // oldest entries go first when the cache grows past this
const SKIP = ['/billing'];  // usage and plan must always be live

function open() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('no indexeddb'));
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'k' });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
function run(mode, fn) {
  return open().then((db) => new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const out = fn(tx.objectStore(STORE));
    tx.oncomplete = () => resolve(out && 'result' in out ? out.result : undefined);
    tx.onerror = () => reject(tx.error);
  }));
}

export const cacheable = (path) => !SKIP.some((p) => path.startsWith(p));

export async function cacheGet(userId, path) {
  try { return (await run('readonly', (s) => s.get(`${userId}|${path}`)))?.v ?? null; } catch { return null; }
}
export async function cacheHas(userId, path, maxAgeMs) {
  try {
    const row = await run('readonly', (s) => s.get(`${userId}|${path}`));
    return !!row && Date.now() - row.at < maxAgeMs;
  } catch { return false; }
}
export async function cacheSet(userId, path, value) {
  try {
    await run('readwrite', (s) => s.put({ k: `${userId}|${path}`, u: userId, v: value, at: Date.now() }));
    prune();
  } catch { /* storage full or blocked: the app simply works online-only */ }
}
let pruning = false;
async function prune() {
  if (pruning) return;
  pruning = true;
  try {
    const rows = await run('readonly', (s) => s.getAll());
    if (rows.length > MAX_ENTRIES) {
      rows.sort((a, b) => a.at - b.at);
      const drop = rows.slice(0, rows.length - MAX_ENTRIES);
      await run('readwrite', (s) => { drop.forEach((r) => s.delete(r.k)); });
    }
  } catch { /* ignore */ } finally { pruning = false; }
}
export async function clearCache() {
  try { await run('readwrite', (s) => { s.clear(); }); } catch { /* ignore */ }
}
