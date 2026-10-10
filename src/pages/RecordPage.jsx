import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { supabase } from '../lib/supabase.js';
import { api } from '../lib/api.js';
import { startKeepAwake, stopKeepAwake } from '../lib/keepAwake.js';
import { getInstallId } from '../lib/install.js';
import { useAiConsent } from '../components/AiConsent.jsx';
import { useI18n, TRANSLATION_LANGUAGES } from '../i18n/index.jsx';
import LiveView from '../components/LiveView.jsx';

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
  const [interim, setInterim] = useState('');          // words still being recognised, shown until they are final
  const [view, setView] = useState('transcript');      // 'transcript' | 'insights'
  const [insight, setInsight] = useState({ status: 'idle', data: null, at: null, used: 0, limit: null, error: '' });
  const [error, setError] = useState('');
  const [reconnecting, setReconnecting] = useState(false);
  const [saveState, setSaveState] = useState('idle'); // 'idle' | 'saving' | 'failed' (saving the finished recording)

  const sessionIdRef = useRef(null);
  const wsRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);
  const limitHitRef = useRef(false);
  const stoppingRef = useRef(false);
  const sentUpToRef = useRef(-1);        // index of the last audio chunk handed to the live connection
  const reconnectTimerRef = useRef(null);
  const reconnectAttemptRef = useRef(0);
  const savedFileRef = useRef(null);
  const elapsedRef = useRef(0);
  elapsedRef.current = elapsed; // always the latest value, even inside callbacks created earlier

  useEffect(() => () => cleanup(), []);

  // When the phone gets its connection back, or the app comes back to the front, reconnect right away
  // instead of waiting for the next retry.
  useEffect(() => {
    const retryNow = () => {
      if (!mediaRecorderRef.current || stoppingRef.current) return;
      if (wsRef.current?.readyState === WebSocket.OPEN || wsRef.current?.readyState === WebSocket.CONNECTING) return;
      clearTimeout(reconnectTimerRef.current);
      openSocket();
    };
    const onVisible = () => { if (document.visibilityState === 'visible') retryNow(); };
    window.addEventListener('online', retryNow);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('online', retryNow);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  // Sends every audio chunk the live connection has not received yet. After a reconnect the new
  // transcription stream needs the first chunk (the audio header) again, then everything that was
  // recorded while the connection was down, so nothing said in the gap is missing from the transcript.
  function flushUnsent(ws, afterReconnect) {
    const chunks = audioChunksRef.current;
    if (!chunks.length || ws.readyState !== WebSocket.OPEN) return;
    if (afterReconnect && sentUpToRef.current >= 0) ws.send(chunks[0]);
    for (let i = sentUpToRef.current + 1; i < chunks.length; i++) ws.send(chunks[i]);
    sentUpToRef.current = chunks.length - 1;
  }

  function scheduleReconnect() {
    clearTimeout(reconnectTimerRef.current);
    const attempt = reconnectAttemptRef.current++;
    const delay = Math.min(10000, 1000 * 2 ** Math.min(attempt, 4)); // 1s, 2s, 4s, 8s, then every 10s
    reconnectTimerRef.current = setTimeout(() => { if (!stoppingRef.current) openSocket(); }, delay);
  }

  // Opens the live-transcription connection. If it drops while recording, the audio keeps being recorded
  // on the phone and the connection is retried until it works again.
  async function openSocket() {
    let token = null;
    try { token = (await supabase.auth.getSession()).data.session?.access_token; } catch { /* offline */ }
    if (stoppingRef.current) return;
    if (!token) { setReconnecting(true); scheduleReconnect(); return; }

    const ws = new WebSocket(
      `${WS_BASE}/ws/live-transcription?sessionId=${sessionIdRef.current}&token=${token}&installId=${encodeURIComponent(getInstallId() || '')}`
    );
    wsRef.current = ws;

    ws.onopen = () => {
      const wasDown = reconnectAttemptRef.current > 0;
      reconnectAttemptRef.current = 0;
      setReconnecting(false);
      flushUnsent(ws, wasDown);
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'transcript' && data.is_final) {
        setLiveTranscript((prev) => prev + data.text + ' ');
        setInterim('');
      } else if (data.type === 'transcript') {
        setInterim(data.text || '');
      } else if (data.type === 'limit') {
        // The monthly allowance ran out: keep what was recorded and save it.
        limitHitRef.current = true;
        if (mediaRecorderRef.current?.state !== 'inactive') stopRecording();
      } else if (data.type === 'error') {
        setError(data.message);
      }
    };

    ws.onclose = (e) => {
      if (wsRef.current !== ws) return; // an older connection that was already replaced
      if (stoppingRef.current || limitHitRef.current || e.code === 4002 || e.code === 4004) return;
      setReconnecting(true);
      scheduleReconnect();
    };
  }

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

      // 3. Live transcription runs on a separate connection to the backend. If it drops, the local
      //    recording above keeps going and the connection is re-opened (see openSocket). If a language
      //    is picked for the live view, the backend translates each line before sending it back.
      stoppingRef.current = false;
      sentUpToRef.current = -1;
      reconnectAttemptRef.current = 0;
      setReconnecting(false);
      openSocket();

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
          const ws = wsRef.current;
          if (ws && ws.readyState === WebSocket.OPEN) flushUnsent(ws, false);
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
      // iPhone only asks for the microphone once. After a "Don't allow", the person has to switch it on in Settings.
      if (err?.name === 'NotAllowedError' || err?.name === 'SecurityError') { setError(t('record.err_mic_denied')); return; }
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
    if (stoppingRef.current) return;
    stoppingRef.current = true;
    clearTimeout(reconnectTimerRef.current);
    clearInterval(timerRef.current);
    stopKeepAwake();
    const recorder = mediaRecorderRef.current;
    // Wait for the recorder to hand over its last piece of audio before the file is put together.
    if (recorder && recorder.state !== 'inactive') {
      await new Promise((resolve) => { recorder.onstop = resolve; recorder.stop(); });
    }
    wsRef.current?.close();
    recorder?.stream?.getTracks().forEach((tr) => tr.stop());
    setIsRecording(false);
    setIsPaused(false);
    setReconnecting(false);

    // Save audio locally on-device (Capacitor Filesystem). Audio never
    // leaves the device — only the transcript goes to Supabase.
    const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
    const fileName = `session-${sessionIdRef.current}.webm`;
    savedFileRef.current = fileName;

    try {
      const base64 = await blobToBase64(blob);
      await Filesystem.writeFile({ path: fileName, data: base64, directory: Directory.Data });
    } catch (err) {
      console.error('[record] local audio save failed', err);
      setError(t('record.err_save_audio'));
    }

    await finishSave();
  }

  // Tells the server the recording is over. Without a connection it keeps trying for a while, and then
  // offers a button, so a recording is never lost just because the signal dropped at the moment of Stop.
  const durationRef = useRef(0);
  async function finishSave() {
    setSaveState('saving');
    if (durationRef.current === 0) durationRef.current = elapsedRef.current;
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        const session = await api.stopSession(sessionIdRef.current, {
          duration_seconds: durationRef.current,
          local_audio_path: savedFileRef.current,
        });
        navigate(`/sessions/${session.id}/save`, { state: { limitReached: limitHitRef.current } });
        return;
      } catch (err) {
        console.error('[record] stop failed, retrying', err);
        await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
      }
    }
    setSaveState('failed');
  }

  function cleanup() {
    stoppingRef.current = true;
    clearTimeout(reconnectTimerRef.current);
    clearInterval(timerRef.current);
    stopKeepAwake();
    wsRef.current?.close();
    mediaRecorderRef.current?.stream?.getTracks().forEach((t) => t.stop());
  }

  async function generateInsight() {
    if (insight.status === 'loading') return;
    setInsight((i) => ({ ...i, status: 'loading', error: '' }));
    try {
      const r = await api.liveInsight(sessionIdRef.current, (liveTranscript + ' ' + interim).trim());
      setInsight({ status: 'ready', data: r.insight, at: r.generated_at, used: r.used, limit: r.limit, error: '' });
    } catch (err) {
      const code = err?.data?.error || err?.status; // 'too_short' | 'insight_limit' | 429 | ...
      setInsight((i) => ({
        ...i,
        status: code === 'insight_limit' || code === 429 ? 'limit' : 'idle',
        limit: err?.data?.limit ?? i.limit,
        error: code === 'too_short' ? 'short' : code === 'insight_limit' || code === 429 ? '' : 'failed',
      }));
    }
  }

  const remaining = MAX_DURATION_SECONDS - elapsed;
  const nearingCap = remaining <= 5 * 60; // last 5 minutes
  const showingTranslatedLive = targetLanguage && targetLanguage !== 'none';

  return (
    <div className="record-page">
      <h1>{mode === 'quick_capture' ? t('record.title_quick') : t('record.title')}</h1>

      {!isRecording && saveState === 'idle' && (
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
      {saveState !== 'idle' && (
        <div className="save-status">
          {saveState === 'saving' && <p className="meta">{t('record.saving')}</p>}
          {saveState === 'failed' && (
            <>
              <p className="error">{t('record.err_stop')}</p>
              <button className="record-btn" onClick={finishSave}>{t('record.retry_save')}</button>
            </>
          )}
        </div>
      )}

      {!isRecording && (
        <>
          <div className="timer">{formatTime(elapsed)}</div>
          {saveState === 'idle' && <button className="record-btn" onClick={startRecording}>{t('record.start')}</button>}
        </>
      )}

      {isRecording && (
        <LiveView
          t={t}
          elapsed={elapsed}
          maxSeconds={MAX_DURATION_SECONDS}
          paused={isPaused}
          reconnecting={reconnecting}
          nearingCap={nearingCap}
          error={error}
          text={liveTranscript}
          interim={interim}
          translatedLabel={showingTranslatedLive ? targetLanguage.toUpperCase() : ''}
          view={view}
          onView={setView}
          insight={insight}
          onGenerate={generateInsight}
          onPause={pauseRecording}
          onResume={resumeRecording}
          onStop={stopRecording}
        />
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
