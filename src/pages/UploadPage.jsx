import { useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { api } from '../lib/api.js';
import { useAiConsent } from '../components/AiConsent.jsx';
import { useI18n, TRANSLATION_LANGUAGES } from '../i18n/index.jsx';

export default function UploadPage() {
  const { state } = useLocation();
  const navigate = useNavigate();
  const { ensureConsent } = useAiConsent();
  const { t, langName } = useI18n();
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
    if (!(await ensureConsent())) return;
    if (!file) return;
    setUploading(true);
    setError('');

    let session = null;
    try {
      // 1. Create the session row with the chosen settings
      session = await api.createSession({
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
      if (err.status === 402) {
        // Out of time this month: remove the empty session and show the upgrade screen.
        if (session) api.deleteSession(session.id).catch(() => {});
        navigate('/paywall', { state: { limitReached: true, usage: err.usage } });
        return;
      }
      setError(err.message || t('upload.failed'));
      setUploading(false);
    }
  }

  return (
    <div className="upload-page">
      <h1>{t('upload.title')}</h1>

      <div
        className="file-drop-zone"
        onClick={() => fileInputRef.current?.click()}
      >
        {file ? (
          <p>{file.name}</p>
        ) : (
          <p>{t('upload.tap')}</p>
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
          {t('record.spoken_language')}
          <select value={sourceLanguageMode} onChange={(e) => setSourceLanguageMode(e.target.value)}>
            <option value="auto">{t('record.auto')}</option>
            <option value="manual">{t('record.manual')}</option>
          </select>
        </label>
        {sourceLanguageMode === 'manual' && (
          <input
            placeholder={t('record.code_placeholder')}
            value={sourceLanguage}
            onChange={(e) => setSourceLanguage(e.target.value)}
          />
        )}
        <label>
          {t('upload.translate_to')}
          <select value={targetLanguage} onChange={(e) => setTargetLanguage(e.target.value)}>
            <option value="none">{t('record.none')}</option>
            {TRANSLATION_LANGUAGES.map((c) => (
              <option key={c} value={c}>{langName(c)}</option>
            ))}
          </select>
        </label>
        <label className="checkbox-label">
          <input type="checkbox" checked={wantsInsight} onChange={(e) => setWantsInsight(e.target.checked)} />
          {t('upload.insight')}
        </label>
      </div>

      {error && <p className="error">{error}</p>}

      <button className="record-btn" onClick={handleUpload} disabled={!file || uploading}>
        {uploading ? t('upload.uploading') : t('upload.transcribe')}
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
