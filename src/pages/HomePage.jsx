import { formatSeconds } from '../lib/format.js';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useI18n } from '../i18n/index.jsx';
import { searchSessions } from '../lib/search.js';
import RenameDialog from '../components/RenameDialog.jsx';
import RowMenu from '../components/RowMenu.jsx';
import Highlight from '../components/Highlight.jsx';
import { useAuth } from '../hooks/useAuth.jsx';
import { listPending, onQueueChange, removePending, retryPending } from '../lib/offlineQueue.js';

export default function HomePage() {
  const navigate = useNavigate();
  const { t, formatDate, lang } = useI18n();
  const [mode, setMode] = useState('conversation'); // 'conversation' | 'quick_capture'
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [renaming, setRenaming] = useState(null);
  const { user } = useAuth();
  const [pending, setPending] = useState(() => listPending(user?.id));
  const results = useMemo(() => searchSessions(sessions, query, lang), [sessions, query, lang]);

  useEffect(() => {
    const load = () => api.getSessions().then(setSessions).catch(console.error).finally(() => setLoading(false));
    load();
    let count = listPending(user?.id).length;
    return onQueueChange(() => {
      const list = listPending(user?.id);
      setPending(list);
      if (list.length < count) load(); // one finished uploading: it is now in the list
      count = list.length;
    });
  }, [user?.id]);

  async function handleDelete(sessionId) {
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

      {pending.length > 0 && (
        <section className="pending-sessions">
          <h2>{t('offline.pending_title')}</h2>
          {pending.map((p) => (
            <div key={p.id} className="session-row pending-row">
              <span className="session-row-main">
                <strong>{formatDate(p.created_at)}{p.duration > 0 ? ` · ⏱ ${formatSeconds(t, p.duration)}` : ''}</strong>
                <small className="session-duration">
                  {p.state === 'sending' ? t('offline.sending')
                    : p.state === 'error' ? (p.error === 'not_enough_time' || p.error === 'limit_reached' || p.error === '402' ? t('offline.err_time') : p.error === 'too_long' || p.error === '413' ? t('offline.err_long') : t('offline.err_generic'))
                    : t('offline.waiting')}
                </small>
              </span>
              {p.state === 'error' && <button type="button" className="pending-btn" onClick={() => retryPending(p.id)}>{t('offline.retry')}</button>}
              {p.state === 'error' && <button type="button" className="pending-btn" onClick={() => { if (confirm(t('offline.remove_confirm'))) removePending(p.id); }}>{t('offline.remove')}</button>}
            </div>
          ))}
        </section>
      )}

      <section className="recent-sessions">
        <h2>{t('home.recent')}</h2>
        {loading && <p>{t('common.loading')}</p>}
        {!loading && sessions.length > 0 && (
          <input
            className="home-search"
            type="search"
            enterKeyHint="search"
            placeholder={t('home.search')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label={t('home.search')}
          />
        )}
        {!loading && sessions.length === 0 && <p>{t('home.empty')}</p>}
        {!loading && sessions.length > 0 && query.trim() && results.length === 0 && <p>{t('home.no_results')}</p>}
        {results.map(({ s, snippet }) => (
          <Link key={s.id} to={`/sessions/${s.id}`} className="session-row">
            <span className="session-row-main">
              <strong><Highlight text={s.name} query={query} /></strong>
              <small className="session-duration">{formatDate(s.created_at)}{s.duration_seconds > 0 ? ` · ⏱ ${formatSeconds(t, s.duration_seconds)}` : ''}</small>
              {snippet && <small className="session-snippet"><Highlight text={snippet} query={query} /></small>}
            </span>
            <RowMenu label={t('folders.menu')} items={[{ label: t('folders.rename'), onClick: () => setRenaming(s) }, { label: t('common.delete'), danger: true, onClick: () => handleDelete(s.id) }]} />
          </Link>
        ))}
      </section>
      {renaming && (
        <RenameDialog t={t} title={t('session.rename_title')} initial={renaming.name} onClose={() => setRenaming(null)}
          onSave={async (name) => { try { const u = await api.saveSession(renaming.id, { name }); setSessions((prev) => prev.map((x) => (x.id === renaming.id ? { ...x, name: u.name } : x))); setRenaming(null); } catch (err) { alert(err.message); } }} />
      )}
    </div>
  );
}
