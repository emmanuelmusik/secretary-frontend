// While there is a connection, quietly fetch what the person is most likely to want offline, so it is
// already on the phone: the lists, and the details of the most recent recordings and of every folder.
import { api } from './api.js';

const RECENT = 30;     // recordings whose full details are kept ready
const MAX_FOLDERS = 50;
let last = 0;
let running = false;

export async function warmCache() {
  if (running || !navigator.onLine || Date.now() - last < 10 * 60 * 1000) return;
  running = true;
  last = Date.now();
  const quiet = (p) => p.catch(() => null);
  try {
    const [sessions, folders] = await Promise.all([quiet(api.getSessions()), quiet(api.getFolders())]);
    await Promise.all([quiet(api.getNotes()), quiet(api.getCards())]);
    for (const f of (folders || []).slice(0, MAX_FOLDERS)) {
      if (!navigator.onLine) break;
      await quiet(api.getSessions(f.id));
      await quiet(api.getNotes(f.id));
    }
    for (const s of (sessions || []).slice(0, RECENT)) {
      if (!navigator.onLine) break;
      await quiet(api.getSession(s.id));
      await quiet(api.getAskMessages(s.id));
    }
  } finally { running = false; }
}
