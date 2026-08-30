import { Filesystem, Directory } from '@capacitor/filesystem';

/**
 * Reads a locally-saved recording (written during RecordPage.stopRecording)
 * back off the device and returns a blob URL an <audio> tag can play.
 * Returns null if the file isn't found (e.g. reinstalled app, cleared
 * browser storage on web) — callers should handle that gracefully.
 */
export async function getLocalAudioUrl(path) {
  if (!path) return null;
  try {
    const result = await Filesystem.readFile({ path, directory: Directory.Data });
    const byteChars = atob(result.data);
    const byteNumbers = new Array(byteChars.length);
    for (let i = 0; i < byteChars.length; i++) byteNumbers[i] = byteChars.charCodeAt(i);
    const blob = new Blob([new Uint8Array(byteNumbers)], { type: 'audio/webm' });
    return URL.createObjectURL(blob);
  } catch (err) {
    console.warn('[localAudio] could not read local recording', path, err);
    return null;
  }
}

/** List all locally-saved recordings on this device (for a future "manage storage" view). */
export async function listLocalRecordings() {
  try {
    const result = await Filesystem.readdir({ path: '', directory: Directory.Data });
    return result.files.filter((f) => f.name.startsWith('session-'));
  } catch (err) {
    console.warn('[localAudio] could not list local recordings', err);
    return [];
  }
}

export async function deleteLocalRecording(path) {
  try {
    await Filesystem.deleteFile({ path, directory: Directory.Data });
    return true;
  } catch (err) {
    console.warn('[localAudio] could not delete local recording', path, err);
    return false;
  }
}
