import { useEffect, useRef, useState } from 'react';
import { copyText } from '../lib/clipboard.js';
import { useI18n } from '../i18n/index.jsx';

/**
 * Small clipboard icon button. Shows a check mark for ~1.5s after copying.
 * `text` can be a string or a function returning a string (evaluated on click).
 */
export default function CopyButton({ text, label, className = '' }) {
  const { t } = useI18n();
  const [state, setState] = useState('idle'); // idle | copied | failed
  const timer = useRef(null);

  useEffect(() => () => clearTimeout(timer.current), []);

  async function handleClick() {
    const value = typeof text === 'function' ? text() : text;
    const ok = await copyText(value);
    setState(ok ? 'copied' : 'failed');
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setState('idle'), 1500);
  }

  const title = state === 'copied' ? t('copy.copied') : state === 'failed' ? t('copy.failed') : (label || t('copy.default'));

  return (
    <button
      type="button"
      className={`copy-btn ${state !== 'idle' ? state : ''} ${className}`.trim()}
      onClick={handleClick}
      aria-label={title}
      title={title}
    >
      {state === 'copied' ? (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      ) : (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </svg>
      )}
      <span className="copy-btn-text">{state === 'copied' ? t('copy.copied') : state === 'failed' ? t('copy.failed_short') : ''}</span>
    </button>
  );
}
