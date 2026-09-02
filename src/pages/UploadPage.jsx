import { useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { api } from '../lib/api.js';

export default function UploadPage() {
  const { state } = useLocation();
  const navigate = useNavigate();
  const mode = state?.mode || 'conversation';

  const [file, setFile] = useState(null);
  const [sourceLanguageMode, setSourceLanguageMode] = useState('auto');
  const [sourceLanguage, setSourceLanguage] = useState('');
  const [targetLanguage, setTargetLanguage] = useState('none');
  const [wantsInsight, setWantsInsight] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);

  function handleFileSelect(e) {
    const selected = e.target.files?.[0];
    if (selected) setFile(selected);
  }

  async function handleUpload() {
    if (!file) return;
    setUploading(true);
    setError('');

    try {
      // 1. Create the session row with the chosen settings
      const session = await api.createSession({
        mode,
        diarization_enabled: mode !== 'quick_capture',
        source_language_mode: sourceLanguageMode,
        source_language: sourceLanguage || null,
        target_language: targetLanguage,
        analysis_requested: wantsInsight,
      });

      // 2. Save a copy on-device (same as recorded audio — never leaves the device)
      const fileName = `session-${session.id}.${fileExtension(file.name)}`;
      try {
        const base64 = await blobToBase64(file);
        await Filesystem.writeFile({ path: fileName, data: base64, directory: Directory.Data });
        const duration = await getAudioDuration(file);
        await api.saveSession(session.id, { local_audio_path: fileName, duration_seconds: Math.round(duration) });
      } catch (err) {
        console.warn('[upload] could not save file locally', err);
        // Not fatal — transcription can still proceed even if the local copy fails
      }

      // 3. Send to backend for transcription (runs async — analysis/translation follow automatically)
      await api.uploadAudio(session.id, file);

      navigate(`/sessions/${session.id}/save`);
    } catch (err) {
      setError(err.message || 'Upload failed');
      setUploading(false);
    }
  }

  return (
    <div className="upload-page">
      <h1>Upload Audio File</h1>

      <div
        className="file-drop-zone"
        onClick={() => fileInputRef.current?.click()}
      >
        {file ? (
          <p>{file.name}</p>
        ) : (
          <p>Tap to choose an audio file from your device</p>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*"
          onChange={handleFileSelect}
          style={{ display: 'none' }}
        />
      </div>

      <div className="pre-record-settings">
        <label>
          Spoken Language
          <select value={sourceLanguageMode} onChange={(e) => setSourceLanguageMode(e.target.value)}>
            <option value="auto">Auto-detect</option>
            <option value="manual">I know the language</option>
          </select>
        </label>
        {sourceLanguageMode === 'manual' && (
          <input
            placeholder="Language code (e.g. fr, de, yo)"
            value={sourceLanguage}
            onChange={(e) => setSourceLanguage(e.target.value)}
          />
        )}
        <label>
          Translate To
          <select value={targetLanguage} onChange={(e) => setTargetLanguage(e.target.value)}>
            <option value="none">None (show original language)</option>
            <option value="en">English</option>
            <option value="fr">French</option>
            <option value="de">German</option>
            <option value="es">Spanish</option>
            <option value="pt">Portuguese</option>
            <option value="yo">Yoruba</option>
            <option value="ar">Arabic</option>
            <option value="zh">Chinese</option>
          </select>
        </label>
        <label className="checkbox-label">
          <input type="checkbox" checked={wantsInsight} onChange={(e) => setWantsInsight(e.target.checked)} />
          Generate AI insight (summary, action items, key points)
        </label>
      </div>

      {error && <p className="error">{error}</p>}

      <button className="record-btn" onClick={handleUpload} disabled={!file || uploading}>
        {uploading ? 'Uploading…' : 'Transcribe This File'}
      </button>
    </div>
  );
}

function fileExtension(filename) {
  const parts = filename.split('.');
  return parts.length > 1 ? parts.pop() : 'audio';
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function getAudioDuration(file) {
  return new Promise((resolve) => {
    const audio = new Audio();
    audio.preload = 'metadata';
    audio.onloadedmetadata = () => resolve(audio.duration || 0);
    audio.onerror = () => resolve(0);
    audio.src = URL.createObjectURL(file);
  });
}
