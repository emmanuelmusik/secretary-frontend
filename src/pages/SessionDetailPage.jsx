import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { getLocalAudioUrl, shareLocalAudio } from '../lib/localAudio.js';

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'fr', label: 'French' },
  { code: 'de', label: 'German' },
  { code: 'es', label: 'Spanish' },
  { code: 'pt', label: 'Portuguese' },
  { code: 'yo', label: 'Yoruba' },
  { code: 'ar', label: 'Arabic' },
  { code: 'zh', label: 'Chinese' },
];

export default function SessionDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [session, setSession] = useState(null);
  const [tab, setTab] = useState('transcript'); // transcript | insight | translation | history | audio

  const [analyzingHistory, setAnalyzingHistory] = useState(false);
  const [historyRange, setHistoryRange] = useState('last_20');

  const [generatingInsight, setGeneratingInsight] = useState(false);

  const [translateTarget, setTranslateTarget] = useState('en');
  const [translating, setTranslating] = useState(false);

  const [audioUrl, setAudioUrl] = useState(null);
  const [audioMissing, setAudioMissing] = useState(false);
  const [sharing, setSharing] = useState(false);
  const audioObjectUrl = useRef(null);

  useEffect(() => { load(); }, [id]);

  useEffect(() => {
    return () => { if (audioObjectUrl.current) URL.revokeObjectURL(audioObjectUrl.current); };
  }, []);

  async function load() {
    const s = await api.getSession(id);
    setSession(s);
  }

  async function loadAudio() {
    if (!session?.local_audio_path) { setAudioMissing(true); return; }
    const url = await getLocalAudioUrl(session.local_audio_path);
    if (!url) { setAudioMissing(true); return; }
    audioObjectUrl.current = url;
    setAudioUrl(url);
  }

  function openAudioTab() {
    setTab('audio');
    if (!audioUrl && !audioMissing) loadAudio();
  }

  async function handleShareAudio() {
    setSharing(true);
    try {
      await shareLocalAudio(session.local_audio_path, session.name);
    } catch (err) {
      if (err?.message !== 'Share canceled') alert(err.message || 'Could not share this recording');
    } finally {
      setSharing(false);
    }
  }

  async function handleAnalyzeWithHistory() {
    setAnalyzingHistory(true);
    try {
      const updated = await api.analyzeWithHistory(id, historyRange);
      setSession(updated);
      setTab('history');
    } catch (err) {
      alert(err.message);
    } finally {
      setAnalyzingHistory(false);
    }
  }

  async function handleGenerateInsight() {
    setGeneratingInsight(true);
    try {
      const updated = await api.generateInsight(id);
      setSession(updated);
      setTab('insight');
    } catch (err) {
      alert(err.message);
    } finally {
      setGeneratingInsight(false);
    }
  }

  async function handleTranslate() {
    setTranslating(true);
    try {
      const updated = await api.translateSession(id, translateTarget);
      setSession(updated);
      setTab('translation');
    } catch (err) {
      alert(err.message);
    } finally {
      setTranslating(false);
    }
  }

  async function handleDeleteSession() {
    if (!confirm('Delete this recording permanently? This cannot be undone.')) return;
    await api.deleteSession(id);
    navigate('/');
  }

  if (!session) return <div className="loading-screen">Loading…</div>;

  return (
    <div className="session-detail">
      <div className="session-detail-header">
        <h1>{session.name}</h1>
        <button className="danger-btn-sm" onClick={handleDeleteSession}>Delete</button>
      </div>
      <p className="meta">
        {new Date(session.created_at).toLocaleString()} · {formatDuration(session.duration_seconds)}
        {session.source_language && ` · Detected: ${session.source_language}`}
      </p>

      <div className="tabs">
        <button className={tab === 'transcript' ? 'active' : ''} onClick={() => setTab('transcript')}>Transcript</button>
        <button className={tab === 'insight' ? 'active' : ''} onClick={() => setTab('insight')}>Insight</button>
        <button className={tab === 'translation' ? 'active' : ''} onClick={() => setTab('translation')}>Translation</button>
        {session.history_analysis && <button className={tab === 'history' ? 'active' : ''} onClick={() => setTab('history')}>History Insight</button>}
        <button className={tab === 'audio' ? 'active' : ''} onClick={openAudioTab}>Audio</button>
      </div>

      {tab === 'transcript' && <pre className="transcript">{session.raw_transcript}</pre>}

      {tab === 'audio' && (
        <div className="audio-panel">
          {audioUrl && (
            <>
              <audio controls src={audioUrl} style={{ width: '100%' }} />
              <button className="share-btn" onClick={handleShareAudio} disabled={sharing}>
                {sharing ? 'Preparing…' : 'Share Recording'}
              </button>
            </>
          )}
          {!audioUrl && audioMissing && (
            <p className="meta">
              This recording isn't available on this device. Audio is saved locally only, on the
              device it was recorded on — it doesn't sync between devices or survive an app reinstall.
            </p>
          )}
          {!audioUrl && !audioMissing && <p className="meta">Loading audio…</p>}
        </div>
      )}

      {tab === 'insight' && (
        <div className="analysis">
          {!session.analysis && (
            <div className="empty-panel">
              <p className="meta">No insight has been generated for this recording yet.</p>
              <button onClick={handleGenerateInsight} disabled={generatingInsight}>
                {generatingInsight ? 'Generating…' : 'Generate Insight'}
              </button>
            </div>
          )}
          {session.analysis && (
            <>
              <div className="insight-header">
                <button onClick={handleGenerateInsight} disabled={generatingInsight}>
                  {generatingInsight ? 'Regenerating…' : 'Regenerate'}
                </button>
              </div>
              <h3>Summary</h3>
              <p>{session.analysis.summary}</p>
              <h3>Key Points</h3>
              <ul>{session.analysis.key_points?.map((p, i) => <li key={i}>{p}</li>)}</ul>
              <h3>Action Items</h3>
              <ul>{session.analysis.action_items?.map((a, i) => <li key={i}>{a.item} {a.owner && `— ${a.owner}`}</li>)}</ul>
              <h3>Decisions</h3>
              <ul>{session.analysis.decisions?.map((d, i) => <li key={i}>{d}</li>)}</ul>
              <h3>Questions Raised</h3>
              <ul>{session.analysis.questions_raised?.map((q, i) => <li key={i}>{q}</li>)}</ul>
            </>
          )}
        </div>
      )}

      {tab === 'translation' && (
        <div>
          <div className="translate-controls">
            <select value={translateTarget} onChange={(e) => setTranslateTarget(e.target.value)}>
              {LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>{l.label}</option>
              ))}
            </select>
            <button onClick={handleTranslate} disabled={translating}>
              {translating ? 'Translating…' : 'Translate'}
            </button>
          </div>
          {session.translated_transcript ? (
            <>
              <pre className="transcript">{session.translated_transcript}</pre>
              <p className="original-label">Original ({session.source_language || 'detected language'})</p>
              <pre className="transcript original-transcript">{session.raw_transcript}</pre>
            </>
          ) : (
            <p className="meta">Pick a language above and translate this transcript.</p>
          )}
        </div>
      )}

      {tab === 'history' && session.history_analysis && (
        <div className="analysis">
          <h3>Recurring Themes</h3>
          <ul>{session.history_analysis.recurring_themes?.map((t, i) => <li key={i}>{t}</li>)}</ul>
          <h3>Progress Notes</h3>
          <p>{session.history_analysis.progress_notes}</p>
          <h3>Outstanding Action Items</h3>
          <ul>{session.history_analysis.outstanding_action_items?.map((a, i) => <li key={i}>{a}</li>)}</ul>
          <h3>Pattern Observations</h3>
          <p>{session.history_analysis.pattern_observations}</p>
        </div>
      )}

      {session.folder_id && (
        <div className="history-analysis-trigger">
          <select value={historyRange} onChange={(e) => setHistoryRange(e.target.value)}>
            <option value="last_5">Last 5 sessions</option>
            <option value="last_20">Last 20 sessions</option>
            <option value="all">All sessions in folder</option>
          </select>
          <button onClick={handleAnalyzeWithHistory} disabled={analyzingHistory}>
            {analyzingHistory ? 'Analyzing…' : 'Analyze with History'}
          </button>
        </div>
      )}
    </div>
  );
}

function formatDuration(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}
