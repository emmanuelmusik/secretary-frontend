import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { supabase } from '../lib/supabase.js';
import { api } from '../lib/api.js';
import { startKeepAwake, stopKeepAwake } from '../lib/keepAwake.js';
import { getInstallId } from '../lib/install.js';
import { useAiConsent } from '../components/AiConsent.jsx';
import { useI18n, TRANSLATION_LANGUAGES } from '../i18n/index.jsx';

const MAX_DURATION_SECONDS = 3 * 60 * 60; // 3-hour cap
const WS_BASE = (import.meta.env.VITE_API_BASE || 'http://localhost:3000').replace(/^http/, 'ws');

export default function RecordPage() {
  const { state } = useLocation();
  const navigate = useNavigate();
  const { ensureConsent } = useAiConsent();
  const { t, langName } = useI18n();
  const mode = state?.mode || 'conversation';

  const [sourceLanguageMode, setSourceLanguageMode] = useState('auto');
  const [sourceLanguage, setSourceLanguage] = useState('');
  const [targetLanguage, setTargetLanguage] = useState('none');

  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [liveTranscript, setLiveTranscript] = useState('');
  const [error, setError] = useState('');

  const sessionIdRef = useRef(null);
  const wsRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);
  const limitHitRef = useRef(false);
  const elapsedRef = useRef(0);
  elapsedRef.current = elapsed; // always the latest value, even inside callbacks created earlier

  useEffect(() => () => cleanup(), []);

  async function startRecording() {
    if (!(await ensureConsent())) return;
    setError('');
    try {
      // 1. Create the session row first
      const session = await api.createSession({
        mode,
        diarization_enabled: mode !== 'quick_capture',
        source_language_mode: sourceLanguageMode,
        source_language: sourceLanguage || null,
        target_language: targetLanguage,
      });
      sessionIdRef.current = session.id;

      // 2. Get mic access, start local recording (this is the durable copy)
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      // 3. Open WS to backend for live transcription (separate from local recording —
      //    if this drops, local audio keeps recording regardless). If target_language
      //    is set, the backend translates each line on the fly before sending it back,
      //    so the live view shows the chosen language even if that's not what's spoken.
      const { data: { session: authSession } } = await supabase.auth.getSession();
      const ws = new WebSocket(
        `${WS_BASE}/ws/live-transcription?sessionId=${session.id}&token=${authSession.access_token}&installId=${encodeURIComponent(getInstallId() || '')}`
      );
      wsRef.current = ws;

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'transcript' && data.is_final) {
          setLiveTranscript((prev) => prev + data.text + ' ');
        } else if (data.type === 'limit') {
          // The monthly allowance ran out: keep what was recorded and save it.
          limitHitRef.current = true;
          if (mediaRecorderRef.current?.state !== 'inactive') stopRecording();
        } else if (data.type === 'error') {
          setError(data.message);
        }
      };

      ws.onerror = () => setError(t('record.err_ws'));

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
          if (ws.readyState === WebSocket.OPEN) e.data.arrayBuffer().then((buf) => ws.send(buf));
        }
      };

      mediaRecorder.start(1000); // 1s chunks
      startKeepAwake();
      setIsRecording(true);
      setIsPaused(false);

      timerRef.current = setInterval(() => {
        setElapsed((prev) => {
          const next = prev + 1;
          if (next >= MAX_DURATION_SECONDS) {
            stopRecording(); // auto-stop at cap
          }
          return next;
        });
      }, 1000);
    } catch (err) {
      if (err.status === 402) {
        navigate('/paywall', { state: { limitReached: true, usage: err.usage } });
        return;
      }
      setError(err.message || t('record.err_start'));
    }
  }

  function pauseRecording() {
    mediaRecorderRef.current?.pause();
    clearInterval(timerRef.current);
    setIsPaused(true);
  }

  function resumeRecording() {
    mediaRecorderRef.current?.resume();
    setIsPaused(false);
    timerRef.current = setInterval(() => {
      setElapsed((prev) => {
        const next = prev + 1;
        if (next >= MAX_DURATION_SECONDS) {
          stopRecording();
        }
        return next;
      });
    }, 1000);
  }

  async function stopRecording() {
    clearInterval(timerRef.current);
    stopKeepAwake();
    mediaRecorderRef.current?.stop();
    wsRef.current?.close();
    setIsRecording(false);
    setIsPaused(false);

    // Save audio locally on-device (Capacitor Filesystem). Audio never
    // leaves the device — only the transcript goes to Supabase.
    const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
    const fileName = `session-${sessionIdRef.current}.webm`;

    try {
      const base64 = await blobToBase64(blob);
      await Filesystem.writeFile({ path: fileName, data: base64, directory: Directory.Data });
    } catch (err) {
      console.error('[record] local audio save failed', err);
      setError(t('record.err_save_audio'));
    }

    const session = await api.stopSession(sessionIdRef.current, {
      duration_seconds: elapsedRef.current,
      local_audio_path: fileName,
    });

    navigate(`/sessions/${session.id}/save`, { state: { limitReached: limitHitRef.current } });
  }

  function cleanup() {
    clearInterval(timerRef.current);
    stopKeepAwake();
    wsRef.current?.close();
    mediaRecorderRef.current?.stream?.getTracks().forEach((t) => t.stop());
  }

  const remaining = MAX_DURATION_SECONDS - elapsed;
  const nearingCap = remaining <= 5 * 60; // last 5 minutes
  const showingTranslatedLive = targetLanguage && targetLanguage !== 'none';

  return (
    <div className="record-page">
      <h1>{mode === 'quick_capture' ? t('record.title_quick') : t('record.title')}</h1>

      {!isRecording && (
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
            {t('record.live_translate')}
            <select value={targetLanguage} onChange={(e) => setTargetLanguage(e.target.value)}>
              <option value="none">{t('record.none')}</option>
              {TRANSLATION_LANGUAGES.map((c) => (
                <option key={c} value={c}>{langName(c)}</option>
              ))}
            </select>
          </label>
          {showingTranslatedLive && (
            <p className="meta">{t('record.live_note')}</p>
          )}
        </div>
      )}

      {error && <p className="error">{error}</p>}

      <div className="timer">
        {formatTime(elapsed)} {isRecording && <span> / 3:00:00</span>}
      </div>
      {nearingCap && isRecording && !isPaused && <p className="warning">{t('record.cap_warning')}</p>}
      {isPaused && <p className="warning">{t('record.paused_warning')}</p>}

      {!isRecording && (
        <button className="record-btn" onClick={startRecording}>{t('record.start')}</button>
      )}

      {isRecording && (
        <div className="recording-controls-floating">
          {!isPaused ? (
            <button className="pause-btn" onClick={pauseRecording}>{t('record.pause')}</button>
          ) : (
            <button className="resume-btn" onClick={resumeRecording}>{t('record.resume')}</button>
          )}
          <button className="stop-btn" onClick={stopRecording}>{t('record.stop')}</button>
        </div>
      )}

      {isRecording && (
        <div className="live-transcript">
          <h3>{t('record.live_title')}{showingTranslatedLive && ` (${targetLanguage.toUpperCase()})`}</h3>
          <p>{liveTranscript || (isPaused ? t('record.paused_dots') : t('record.listening'))}</p>
        </div>
      )}
    </div>
  );
}

function formatTime(seconds) {
  const h = String(Math.floor(seconds / 3600)).padStart(2, '0');
  const m = String(Math.floor((seconds % 3600) / 60)).padStart(2, '0');
  const s = String(seconds % 60).padStart(2, '0');
  return `${h}:${m}:${s}`;
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
