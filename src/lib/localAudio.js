import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { Capacitor } from '@capacitor/core';

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

/**
 * Shares a locally-saved recording via the device's native share sheet
 * (iOS/Android), or the Web Share API / a direct download on browsers
 * where native sharing isn't available.
 */
export async function shareLocalAudio(path, title) {
  if (!path) throw new Error('No local recording to share');

  if (Capacitor.isNativePlatform()) {
    const { uri } = await Filesystem.getUri({ path, directory: Directory.Data });
    await Share.share({ title: title || 'Recording', url: uri });
    return;
  }

  // Web: try the Web Share API with the actual file first (supported on
  // most mobile browsers), falling back to a plain download if not.
  const result = await Filesystem.readFile({ path, directory: Directory.Data });
  const byteChars = atob(result.data);
  const byteNumbers = new Array(byteChars.length);
  for (let i = 0; i < byteChars.length; i++) byteNumbers[i] = byteChars.charCodeAt(i);
  const blob = new Blob([new Uint8Array(byteNumbers)], { type: 'audio/webm' });
  const file = new File([blob], `${title || 'recording'}.webm`, { type: 'audio/webm' });

  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    await navigator.share({ files: [file], title: title || 'Recording' });
    return;
  }

  // Fallback: trigger a plain browser download
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${title || 'recording'}.webm`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
