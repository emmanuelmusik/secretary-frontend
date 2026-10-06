import { createContext, useCallback, useContext, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../hooks/useAuth.jsx';
import { useI18n, renderBold } from '../i18n/index.jsx';

const CONSENT_KEY = 'secretary_ai_consent_v1';
const ConsentContext = createContext(null);

function hasLocalConsent() {
  try { return localStorage.getItem(CONSENT_KEY) === 'yes'; } catch { return false; }
}

/**
 * Asks, once per account, for permission to send the person's audio, text and
 * card photos to the outside services that process them (Apple guideline 5.1.2).
 * Call `await ensureConsent()` right before anything that sends data out;
 * it resolves true when permission exists (or was just given), false otherwise.
 */
export function AiConsentProvider({ children }) {
  const { user } = useAuth();
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const resolver = useRef(null);

  const ensureConsent = useCallback(() => {
    if (user?.user_metadata?.ai_consent_v1 || hasLocalConsent()) return Promise.resolve(true);
    return new Promise((resolve) => {
      resolver.current = resolve;
      setOpen(true);
    });
  }, [user]);

  function finish(accepted) {
    setOpen(false);
    if (accepted) {
      try { localStorage.setItem(CONSENT_KEY, 'yes'); } catch { /* storage unavailable */ }
      // Also remember it on the account so it follows the person to other devices.
      supabase.auth.updateUser({ data: { ai_consent_v1: new Date().toISOString() } }).catch(() => {});
    }
    resolver.current?.(accepted);
    resolver.current = null;
  }

  return (
    <ConsentContext.Provider value={{ ensureConsent }}>
      {children}
      {open && (
        <div className="consent-overlay" role="dialog" aria-modal="true" aria-labelledby="consent-title">
          <div className="consent-card">
            <h2 id="consent-title">{t('consent.title')}</h2>
            <p>{t('consent.intro')}</p>
            <ul>
              <li>{renderBold(t('consent.audio'))}</li>
              <li>{renderBold(t('consent.text'))}</li>
              <li>{renderBold(t('consent.cards'))}</li>
            </ul>
            <p>{t('consent.body')}</p>
            <p className="consent-small">
              {t('consent.small', { link: '\u0000' }).split('\u0000').flatMap((part, i, arr) => (
                i < arr.length - 1
                  ? [part, <Link key={i} to="/privacy" onClick={() => setOpen(false)}>{t('nav.privacy')}</Link>]
                  : [part]
              ))}
            </p>
            <div className="consent-actions">
              <button type="button" className="consent-accept" onClick={() => finish(true)}>{t('consent.agree')}</button>
              <button type="button" className="consent-decline" onClick={() => finish(false)}>{t('consent.decline')}</button>
            </div>
          </div>
        </div>
      )}
    </ConsentContext.Provider>
  );
}

export function useAiConsent() {
  const ctx = useContext(ConsentContext);
  if (!ctx) throw new Error('useAiConsent must be used within AiConsentProvider');
  return ctx;
}
