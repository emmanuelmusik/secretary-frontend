import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { supabase } from '../lib/supabase.js';
import { api } from '../lib/api.js';

const MAX_DURATION_SECONDS = 3 * 60 * 60; // 3-hour cap
const WS_BASE = (import.meta.env.VITE_API_BASE || 'http://localhost:3000').replace(/^http/, 'ws');

export default function RecordPage() {
  const { state } = useLocation();
  const navigate = useNavigate();
  const mode = state?.mode || 'conversation';

  const [sourceLanguageMode, setSourceLanguageMode] = useState('auto');
  const [sourceLanguage, setSourceLanguage] = useState('');
  const [targetLanguage, setTargetLanguage] = useState('en');

  const [isRecording, setIsRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [liveTranscript, setLiveTranscript] = useState('');
  const [error, setError] = useState('');

  const sessionIdRef = useRef(null);
  const wsRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);

  useEffect(() => () => cleanup(), []);

  async function startRecording() {
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

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      // 3. Open WS to backend for live transcription (separate from local recording —
      //    if this drops, local audio keeps recording regardless)
      const { data: { session: authSession } } = await supabase.auth.getSession();
      const ws = new WebSocket(
        `${WS_BASE}/ws/live-transcription?sessionId=${session.id}&token=${authSession.access_token}`
      );
      wsRef.current = ws;

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'transcript' && data.is_final) {
          setLiveTranscript((prev) => prev + data.text + ' ');
        } else if (data.type === 'error') {
          setError(data.message);
        }
      };

      ws.onerror = () => setError('Live transcript connection lost — audio is still recording locally.');

      // Stream audio chunks to the backend over WS as they're captured
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
          if (ws.readyState === WebSocket.OPEN) e.data.arrayBuffer().then((buf) => ws.send(buf));
        }
      };

      mediaRecorder.start(1000); // 1s chunks
      setIsRecording(true);

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
      setError(err.message || 'Could not start recording');
    }
  }

  async function stopRecording() {
    clearInterval(timerRef.current);
    mediaRecorderRef.current?.stop();
    wsRef.current?.close();
    setIsRecording(false);

    // Save audio locally on-device (Capacitor Filesystem). Audio never
    // leaves the device — only the transcript goes to Supabase.
    const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
    const fileName = `session-${sessionIdRef.current}.webm`;

    try {
      const base64 = await blobToBase64(blob);
      await Filesystem.writeFile({ path: fileName, data: base64, directory: Directory.Data });
    } catch (err) {
      console.error('[record] local audio save failed', err);
      setError('Could not save audio locally — transcript is still safe.');
    }

    const session = await api.stopSession(sessionIdRef.current, {
      duration_seconds: elapsed,
      local_audio_path: fileName,
    });

    navigate(`/sessions/${session.id}/save`);
  }

  function cleanup() {
    clearInterval(timerRef.current);
    wsRef.current?.close();
    mediaRecorderRef.current?.stream?.getTracks().forEach((t) => t.stop());
  }

  const remaining = MAX_DURATION_SECONDS - elapsed;
  const nearingCap = remaining <= 5 * 60; // last 5 minutes

  return (
    <div className="record-page">
      <h1>{mode === 'quick_capture' ? 'Quick Capture' : 'Recording'}</h1>

      {!isRecording && (
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
              <option value="none">None</option>
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
        </div>
      )}

      {error && <p className="error">{error}</p>}

      <div className="timer">
        {formatTime(elapsed)} {isRecording && <span> / 3:00:00</span>}
      </div>
      {nearingCap && isRecording && <p className="warning">Approaching 3-hour limit — recording will auto-stop.</p>}

      {!isRecording ? (
        <button className="record-btn" onClick={startRecording}>Start Recording</button>
      ) : (
        <button className="stop-btn" onClick={stopRecording}>Stop</button>
      )}

      {isRecording && (
        <div className="live-transcript">
          <h3>Live Transcript</h3>
          <p>{liveTranscript || 'Listening…'}</p>
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
