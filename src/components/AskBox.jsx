import { useEffect, useRef, useState } from 'react';
import { api } from '../lib/api.js';

const cache = new Map(); // sessionId -> turns, so switching tabs never shows an empty chat while the saved one loads

// Ask a question about a recording. `getTranscript` (optional) supplies the freshest text while still recording.
export default function AskBox({ t, sessionId, getTranscript }) {
  const [q, setQ] = useState('');
  const [turns, setTurnsState] = useState(() => cache.get(sessionId) || []); // { q, a } in order
  const setTurns = (updater) => setTurnsState((prev) => { const next = typeof updater === 'function' ? updater(prev) : updater; cache.set(sessionId, next); return next; });
  const [loadError, setLoadError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [limit, setLimit] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const endRef = useRef(null);

  // The conversation is saved with the recording, so it is still here after leaving the page or signing in again.
  function loadSaved() {
    setLoadError(false);
    return api.getAskMessages(sessionId)
      .then((rows) => {
        const saved = rows.map((r) => ({ q: r.question, a: r.answer }));
        setTurns((prev) => (saved.length >= prev.length ? saved : prev));
        setLoaded(true);
        setTimeout(() => endRef.current?.scrollIntoView({ block: 'nearest' }), 50);
      })
      .catch(() => { setLoadError(true); setLoaded(true); });
  }
  useEffect(() => { loadSaved(); }, [sessionId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function send(e) {
    e?.preventDefault();
    const question = q.trim();
    if (!question || busy || limit) return;
    setBusy(true); setError('');
    try {
      const r = await api.askAboutRecording(sessionId, question, getTranscript ? getTranscript() : undefined);
      setTurns((prev) => [...prev, { q: question, a: r.answer }]);
      setQ('');
      setTimeout(() => endRef.current?.scrollIntoView({ block: 'nearest' }), 50);
    } catch (err) {
      const code = err?.data?.error;
      if (code === 'ask_limit' || err?.status === 429) setLimit(true);
      else setError(code === 'too_short' ? t('ask.too_short') : t('ask.failed'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="ask-box">
      <div className="ask-turns">
        {loaded && turns.length === 0 && <p className="meta">{t('ask.hint')}</p>}
        {turns.map((x, i) => (
          <div key={i} className="ask-turn">
            <p className="ask-bubble ask-q" dir="auto">{x.q}</p>
            <p className="ask-bubble ask-a" dir="auto">{x.a}</p>
          </div>
        ))}
        {busy && <p className="meta">{t('ask.thinking')}</p>}
        <div ref={endRef} />
      </div>
      {loadError && <p className="warning">{t('ask.load_failed')} <button type="button" className="ask-retry" onClick={loadSaved}>{t('ask.retry')}</button></p>}
      {error && <p className="error">{error}</p>}
      {limit && <p className="warning">{t('ask.limit')}</p>}
      {!limit && (
        <form className="ask-form" onSubmit={send}>
          <input value={q} maxLength={500} onChange={(e) => setQ(e.target.value)} placeholder={t('ask.placeholder')} enterKeyHint="send" />
          <button type="submit" disabled={busy || q.trim().length < 2}>{t('ask.send')}</button>
        </form>
      )}
    </div>
  );
}
