// A random id for this install of the app. The server uses it so a second free account on the same phone
// shares the free allowance. It is not tied to the person or the device hardware.
const KEY = 'secretary_install_id';

export function getInstallId() {
  try {
    let id = localStorage.getItem(KEY);
    if (!id || id.length < 8) {
      id = (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}-${Math.random().toString(16).slice(2)}`);
      localStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    return null;
  }
}
