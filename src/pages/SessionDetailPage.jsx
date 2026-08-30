import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../lib/api.js';

export default function SessionDetailPage() {
  const { id } = useParams();
  const [session, setSession] = useState(null);
  const [tab, setTab] = useState('transcript'); // transcript | analysis | translation | history
  const [analyzingHistory, setAnalyzingHistory] = useState(false);
  const [historyRange, setHistoryRange] = useState('last_20');

  useEffect(() => { load(); }, [id]);

  async function load() {
    const s = await api.getSession(id);
    setSession(s);
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

  if (!session) return <div className="loading-screen">Loading…</div>;

  return (
    <div className="session-detail">
      <h1>{session.name}</h1>
      <p className="meta">
        {new Date(session.created_at).toLocaleString()} · {formatDuration(session.duration_seconds)}
        {session.source_language && ` · ${session.source_language}`}
      </p>

      <div className="tabs">
        <button className={tab === 'transcript' ? 'active' : ''} onClick={() => setTab('transcript')}>Transcript</button>
        {session.analysis && <button className={tab === 'analysis' ? 'active' : ''} onClick={() => setTab('analysis')}>Analysis</button>}
        {session.translated_transcript && <button className={tab === 'translation' ? 'active' : ''} onClick={() => setTab('translation')}>Translation</button>}
        {session.history_analysis && <button className={tab === 'history' ? 'active' : ''} onClick={() => setTab('history')}>History Insights</button>}
      </div>

      {tab === 'transcript' && <pre className="transcript">{session.raw_transcript}</pre>}
      {tab === 'translation' && <pre className="transcript">{session.translated_transcript}</pre>}

      {tab === 'analysis' && session.analysis && (
        <div className="analysis">
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
