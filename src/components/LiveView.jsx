import { useEffect, useMemo, useRef } from 'react';

const SENTENCE = /[^.!?。！？؟]+[.!?。！？؟]*\s*/g;

function fmt(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = String(Math.floor((seconds % 3600) / 60)).padStart(h > 0 ? 2 : 1, '0');
  const s = String(seconds % 60).padStart(2, '0');
  return h > 0 ? `${h}:${m}:${s}` : `${m}:${s}`;
}

// Full-screen recording view: a small floating status pill, the transcript with the newest sentence
// large (older ones smaller above it, scrolling by itself), and a see-through Pause / Stop bar.
export default function LiveView({
  t, elapsed, maxSeconds, paused, reconnecting, nearingCap, error, text, interim, translatedLabel,
  view, onView, insight, onGenerate, onPause, onResume, onStop,
}) {
  const scroller = useRef(null);
  const endRef = useRef(null);
  const stick = useRef(true); // follow the newest text unless the person scrolled up to read

  const sentences = useMemo(() => {
    const all = `${text}${interim ? ` ${interim}` : ''}`.trim();
    return (all.match(SENTENCE) || []).map((x) => x.trim()).filter(Boolean);
  }, [text, interim]);
  const older = sentences.slice(0, -1);
  const latest = sentences[sentences.length - 1];

  useEffect(() => {
    if (view === 'transcript' && stick.current) endRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' });
  }, [sentences.length, latest, view]);

  function onScroll() {
    const el = scroller.current;
    if (el) stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  }

  const state = reconnecting ? 'reconnecting' : paused ? 'paused' : 'live';
  const a = insight.data;

  return (
    <div className="live-view">
      <div className={`live-pill ${state}`} role="status">
        <span className="live-dot" aria-hidden="true" />
        <span className="live-time">{fmt(elapsed)} / {fmt(maxSeconds)}</span>
        {state === 'paused' && <span className="live-state">{t('record.paused_short')}</span>}
        {state === 'reconnecting' && <span className="live-state">{t('record.reconnecting_short')}</span>}
        {translatedLabel && <span className="live-state">{translatedLabel}</span>}
      </div>
      {nearingCap && !paused && <p className="live-note warning">{t('record.cap_warning')}</p>}
      {reconnecting && <p className="live-note warning">{t('record.reconnecting')}</p>}
      {error && <p className="live-note error">{error}</p>}

      <div className="live-tabs" role="tablist">
        <button role="tab" aria-selected={view === 'transcript'} className={view === 'transcript' ? 'active' : ''} onClick={() => onView('transcript')}>{t('record.view_transcript')}</button>
        <button role="tab" aria-selected={view === 'insights'} className={view === 'insights' ? 'active' : ''} onClick={() => onView('insights')}>{t('record.view_insights')}</button>
      </div>

      {view === 'transcript' ? (
        <div className="live-scroll" ref={scroller} onScroll={onScroll}>
          {sentences.length === 0 && <p className="live-empty">{paused ? t('record.paused_dots') : t('record.listening')}</p>}
          {older.map((sn, i) => <p key={i} className="live-older" dir="auto">{sn}</p>)}
          {latest && <p className="live-latest" dir="auto">{latest}</p>}
          <div ref={endRef} className="live-end" />
        </div>
      ) : (
        <div className="live-scroll live-insights">
          {!a && insight.status !== 'loading' && <p className="live-empty">{t('record.insight_hint')}</p>}
          {insight.status === 'loading' && <p className="live-empty">{t('record.insight_generating')}</p>}
          {a && (
            <div className="live-insight-body" dir="auto">
              {a.summary && <><h3>{t('insight.summary')}</h3><p>{a.summary}</p></>}
              {a.key_points?.length > 0 && <><h3>{t('insight.key_points')}</h3><ul>{a.key_points.map((p, i) => <li key={i}>{p}</li>)}</ul></>}
              {a.action_items?.length > 0 && <><h3>{t('insight.action_items')}</h3><ul>{a.action_items.map((x, i) => <li key={i}>{x.item}{x.owner ? ` — ${x.owner}` : ''}</li>)}</ul></>}
              {a.questions_raised?.length > 0 && <><h3>{t('insight.questions')}</h3><ul>{a.questions_raised.map((q, i) => <li key={i}>{q}</li>)}</ul></>}
              {insight.at && <p className="live-meta">{t('record.insight_at', { time: new Date(insight.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) })}</p>}
            </div>
          )}
          {insight.error === 'short' && <p className="warning">{t('record.insight_short')}</p>}
          {insight.error === 'failed' && <p className="error">{t('record.insight_failed')}</p>}
          {insight.status === 'limit' && <p className="warning">{t('record.insight_limit', { limit: insight.limit ?? '' })}</p>}
          {insight.status !== 'limit' && (
            <button className="live-generate" onClick={onGenerate} disabled={insight.status === 'loading'}>
              {insight.status === 'loading' ? t('record.insight_generating') : a ? t('record.insight_refresh') : t('record.insight_generate')}
            </button>
          )}
        </div>
      )}

      <div className="live-controls">
        {!paused
          ? <button className="pause-btn" onClick={onPause}>{t('record.pause')}</button>
          : <button className="resume-btn" onClick={onResume}>{t('record.resume')}</button>}
        <button className="stop-btn" onClick={onStop}>{t('record.stop')}</button>
      </div>
    </div>
  );
}
