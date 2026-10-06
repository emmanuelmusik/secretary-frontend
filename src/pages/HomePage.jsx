import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useI18n } from '../i18n/index.jsx';

export default function HomePage() {
  const navigate = useNavigate();
  const { t, formatDate } = useI18n();
  const [mode, setMode] = useState('conversation'); // 'conversation' | 'quick_capture'
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getSessions().then(setSessions).catch(console.error).finally(() => setLoading(false));
  }, []);

  async function handleDelete(e, sessionId) {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm(t('session.delete_confirm'))) return;
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
          {t('home.mode_meeting')}
        </button>
        <button className={mode === 'quick_capture' ? 'active' : ''} onClick={() => setMode('quick_capture')}>
          {t('home.mode_quick')}
        </button>
      </div>

      <button className="record-btn" onClick={() => navigate('/record', { state: { mode } })}>
        {t('home.record')}
      </button>

      <button className="upload-btn" onClick={() => navigate('/upload', { state: { mode } })}>
        {t('home.upload')}
      </button>

      <section className="recent-sessions">
        <h2>{t('home.recent')}</h2>
        {loading && <p>{t('common.loading')}</p>}
        {!loading && sessions.length === 0 && <p>{t('home.empty')}</p>}
        {sessions.map((s) => (
          <Link key={s.id} to={`/sessions/${s.id}`} className="session-row">
            <strong>{s.name}</strong>
            <span className="session-row-right">
              {formatDate(s.created_at)}
              <button className="danger-btn-sm" onClick={(e) => handleDelete(e, s.id)}>{t('common.delete')}</button>
            </span>
          </Link>
        ))}
      </section>
    </div>
  );
}
