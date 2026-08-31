import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';

export default function HomePage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState('conversation'); // 'conversation' | 'quick_capture'
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getSessions().then(setSessions).catch(console.error).finally(() => setLoading(false));
  }, []);

  async function handleDelete(e, sessionId) {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm('Delete this recording permanently? This cannot be undone.')) return;
    await api.deleteSession(sessionId);
    setSessions((prev) => prev.filter((s) => s.id !== sessionId));
  }

  return (
    <div className="home-page">
      <header>
        <h1>Secretary</h1>
      </header>

      <div className="mode-selector">
        <button className={mode === 'conversation' ? 'active' : ''} onClick={() => setMode('conversation')}>
          Meeting / Classroom
        </button>
        <button className={mode === 'quick_capture' ? 'active' : ''} onClick={() => setMode('quick_capture')}>
          Quick Capture
        </button>
      </div>

      <button className="record-btn" onClick={() => navigate('/record', { state: { mode } })}>
        Record
      </button>

      <button className="upload-btn" onClick={() => navigate('/upload', { state: { mode } })}>
        Upload Audio File
      </button>

      <section className="recent-sessions">
        <h2>Recent</h2>
        {loading && <p>Loading…</p>}
        {!loading && sessions.length === 0 && <p>No sessions yet. Tap Record to get started.</p>}
        {sessions.map((s) => (
          <Link key={s.id} to={`/sessions/${s.id}`} className="session-row">
            <strong>{s.name}</strong>
            <span className="session-row-right">
              {new Date(s.created_at).toLocaleDateString()}
              <button className="danger-btn-sm" onClick={(e) => handleDelete(e, s.id)}>Delete</button>
            </span>
          </Link>
        ))}
      </section>
    </div>
  );
}
