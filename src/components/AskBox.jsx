import { useRef, useState } from 'react';
import { api } from '../lib/api.js';

// Ask a question about a recording. `getTranscript` (optional) supplies the freshest text while still recording.
export default function AskBox({ t, sessionId, getTranscript }) {
  const [q, setQ] = useState('');
  const [turns, setTurns] = useState([]); // { q, a } in order
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [limit, setLimit] = useState(false);
  const endRef = useRef(null);

  async function send(e) {
    e?.preventDefault();
    const question = q.trim();
    if (!question || busy || limit) return;
    setBusy(true); setError('');
    const history = turns.flatMap((x) => [{ role: 'user', content: x.q }, { role: 'assistant', content: x.a }]);
    try {
      const r = await api.askAboutRecording(sessionId, question, history, getTranscript ? getTranscript() : undefined);
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
        {turns.length === 0 && <p className="meta">{t('ask.hint')}</p>}
        {turns.map((x, i) => (
          <div key={i} className="ask-turn">
            <p className="ask-q" dir="auto">{x.q}</p>
            <p className="ask-a" dir="auto">{x.a}</p>
          </div>
        ))}
        {busy && <p className="meta">{t('ask.thinking')}</p>}
        <div ref={endRef} />
      </div>
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
