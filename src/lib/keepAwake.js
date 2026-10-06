import { KeepAwake } from '@capacitor-community/keep-awake';

const PREF_KEY = 'secretary_keep_awake';
let active = false;

// On by default; the person can switch it off in Settings.
export function getKeepAwakePref() {
  try { return localStorage.getItem(PREF_KEY) !== 'off'; } catch { return true; }
}
export function setKeepAwakePref(on) {
  try { localStorage.setItem(PREF_KEY, on ? 'on' : 'off'); } catch { /* storage unavailable */ }
}

async function acquire() {
  try { await KeepAwake.keepAwake(); } catch { /* not supported here: recording still works */ }
}

// A browser releases its screen lock whenever the page is hidden, so take it again when it comes back.
function onVisible() {
  if (active && document.visibilityState === 'visible') acquire();
}

// Stops the screen from locking by itself while recording.
export async function startKeepAwake() {
  if (!getKeepAwakePref() || active) return;
  active = true;
  document.addEventListener('visibilitychange', onVisible);
  await acquire();
}

export async function stopKeepAwake() {
  if (!active) return;
  active = false;
  document.removeEventListener('visibilitychange', onVisible);
  try { await KeepAwake.allowSleep(); } catch { /* nothing to release */ }
}
