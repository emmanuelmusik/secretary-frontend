import { useEffect, useRef, useState } from 'react';
import { useI18n } from '../i18n/index.jsx';

/** Globe button that opens a list of the app's languages. */
export default function LanguageMenu({ className = '' }) {
  const { t, lang, setLang, languages } = useI18n();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    const onDown = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onDown);
    return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('pointerdown', onDown); };
  }, [open]);

  return (
    <div className={`lang-menu ${className}`.trim()} ref={wrapRef}>
      <button
        type="button"
        className="menu-btn"
        onClick={() => setOpen((o) => !o)}
        aria-label={t('lang.change')}
        aria-haspopup="listbox"
        aria-expanded={open}
        title={t('lang.change')}
      >
        <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="9" />
          <path d="M3 12h18M12 3c2.6 2.6 3.9 5.6 3.9 9s-1.3 6.4-3.9 9c-2.6-2.6-3.9-5.6-3.9-9S9.4 5.6 12 3z" />
        </svg>
      </button>
      {open && (
        <ul className="lang-list" role="listbox" aria-label={t('lang.title')}>
          {languages.map((l) => (
            <li key={l.code} role="option" aria-selected={l.code === lang}>
              <button
                type="button"
                className={`lang-item ${l.code === lang ? 'active' : ''}`}
                lang={l.code}
                onClick={() => { setLang(l.code); setOpen(false); }}
              >
                <span>{l.native}</span>
                {l.code === lang && <span aria-hidden="true">✓</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
