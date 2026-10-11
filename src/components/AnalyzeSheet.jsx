import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api.js';
import { useI18n } from '../i18n/index.jsx';
import { searchSessions } from '../lib/search.js';
import Highlight from './Highlight.jsx';

export const MAX_PICKED = 20;

// One "Analyze" menu: this recording on its own, compared with its folder, or compared with recordings picked by hand.
export default function AnalyzeSheet({ session, busy, onClose, onInsight, onHistory }) {
  const { t, lang, formatDate } = useI18n();
  const [step, setStep] = useState('menu'); // 'menu' | 'pick'
  const [all, setAll] = useState(null);
  const [picked, setPicked] = useState(() => new Set());
  const [query, setQuery] = useState('');
  const [scope, setScope] = useState(session.folder_id ? 'folder' : 'all');

  useEffect(() => {
    if (step !== 'pick' || all) return;
    api.getSessions().then((list) => setAll(list.filter((s) => s.id !== session.id && (s.raw_transcript || '').trim()))).catch(() => setAll([]));
  }, [step, all, session.id]);

  const pool = useMemo(() => (all || []).filter((s) => scope === 'all' || s.folder_id === session.folder_id), [all, scope, session.folder_id]);
  const shown = useMemo(() => searchSessions(pool, query, lang), [pool, query, lang]);

  function toggle(id) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else if (next.size < MAX_PICKED) next.add(id);
      return next;
    });
  }

  return (
    <div className="dialog-backdrop sheet-backdrop" onClick={busy ? undefined : onClose}>
      <div className="sheet-card" role="dialog" aria-label={t('analyze.title')} onClick={(e) => e.stopPropagation()}>
        {busy && <p className="sheet-busy">{t('analyze.running')}</p>}

        {!busy && step === 'menu' && (
          <>
            <h2>{t('analyze.title')}</h2>
            <button type="button" className="sheet-row" onClick={onInsight}>
              <strong>{t('analyze.this')}</strong>
              <small>{session.analysis ? t('analyze.this_again') : t('analyze.this_desc')}</small>
            </button>
            {session.folder_id && (
              <div className="sheet-group">
                <strong>{t('analyze.folder_hist')}</strong>
                <div className="sheet-chips">
                  <button type="button" onClick={() => onHistory({ range: 'last_5' })}>{t('history.last5')}</button>
                  <button type="button" onClick={() => onHistory({ range: 'last_20' })}>{t('history.last20')}</button>
                  <button type="button" onClick={() => onHistory({ range: 'all' })}>{t('history.all')}</button>
                </div>
              </div>
            )}
            <button type="button" className="sheet-row" onClick={() => setStep('pick')}>
              <strong>{t('analyze.pick')}</strong>
              <small>{t('analyze.pick_desc')}</small>
            </button>
            <button type="button" className="sheet-cancel" onClick={onClose}>{t('common.cancel')}</button>
          </>
        )}

        {!busy && step === 'pick' && (
          <>
            <h2>{t('analyze.pick_title')}</h2>
            <input type="search" className="sheet-search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('home.search')} aria-label={t('home.search')} />
            {session.folder_id && (
              <div className="sheet-chips">
                <button type="button" className={scope === 'folder' ? 'on' : ''} onClick={() => setScope('folder')}>{t('analyze.in_folder')}</button>
                <button type="button" className={scope === 'all' ? 'on' : ''} onClick={() => setScope('all')}>{t('analyze.all_recordings')}</button>
              </div>
            )}
            <div className="sheet-list">
              {all === null && <p className="meta">{t('common.loading')}</p>}
              {all !== null && shown.length === 0 && <p className="meta">{t('analyze.none_found')}</p>}
              {shown.map(({ s }) => {
                const on = picked.has(s.id);
                return (
                  <button type="button" key={s.id} className={`sheet-pick ${on ? 'on' : ''}`} aria-pressed={on} onClick={() => toggle(s.id)} disabled={!on && picked.size >= MAX_PICKED}>
                    <span className="sheet-check" aria-hidden="true">{on ? '✓' : ''}</span>
                    <span className="sheet-pick-main"><strong><Highlight text={s.name} query={query} /></strong><small>{formatDate(s.created_at)}</small></span>
                  </button>
                );
              })}
            </div>
            <p className="meta sheet-count">{t('analyze.selected', { n: picked.size, max: MAX_PICKED })}</p>
            <div className="dialog-actions">
              <button type="button" onClick={() => setStep('menu')}>{t('common.back')}</button>
              <button type="button" className="primary" disabled={picked.size === 0} onClick={() => onHistory({ ids: [...picked] })}>{t('analyze.go', { n: picked.size })}</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
