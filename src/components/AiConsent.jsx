import { createContext, useCallback, useContext, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../hooks/useAuth.jsx';

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
            <h2 id="consent-title">Before you start</h2>
            <p>
              Secretary uses two outside AI services to do its job. With your permission, this is what gets sent:
            </p>
            <ul>
              <li><strong>Deepgram</strong> receives the audio you record or upload, to turn it into text.</li>
              <li><strong>xAI (Grok)</strong> receives transcript text, to write insights and translations, and photos of business cards, to read the details on them.</li>
            </ul>
            <p>
              Each service processes your data to give the result back to you. Your recordings are not stored on our servers.
              Business cards contain other people's details, so only scan cards you are entitled to keep.
            </p>
            <p className="consent-small">
              You can change your mind at any time by deleting your data or your account in Settings. Details are in
              our <Link to="/privacy" onClick={() => setOpen(false)}>Privacy Policy</Link>.
            </p>
            <div className="consent-actions">
              <button type="button" className="consent-accept" onClick={() => finish(true)}>Agree and continue</button>
              <button type="button" className="consent-decline" onClick={() => finish(false)}>Not now</button>
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
