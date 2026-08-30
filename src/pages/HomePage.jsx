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
            <span>{new Date(s.created_at).toLocaleDateString()}</span>
          </Link>
        ))}
      </section>
    </div>
  );
}
