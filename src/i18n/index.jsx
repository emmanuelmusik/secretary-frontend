import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../hooks/useAuth.jsx';
import en from './locales/en.js';

// Languages the app itself can be shown in. `native` is how each is written by its own speakers.
export const LANGUAGES = [
  { code: 'en', native: 'English', dir: 'ltr' },
  { code: 'es', native: 'Español', dir: 'ltr' },
  { code: 'fr', native: 'Français', dir: 'ltr' },
  { code: 'de', native: 'Deutsch', dir: 'ltr' },
  { code: 'pt', native: 'Português', dir: 'ltr' },
  { code: 'it', native: 'Italiano', dir: 'ltr' },
  { code: 'ru', native: 'Русский', dir: 'ltr' },
  { code: 'ar', native: 'العربية', dir: 'rtl' },
  { code: 'hi', native: 'हिन्दी', dir: 'ltr' },
  { code: 'ja', native: '日本語', dir: 'ltr' },
  { code: 'ko', native: '한국어', dir: 'ltr' },
  { code: 'id', native: 'Bahasa Indonesia', dir: 'ltr' },
];

// Languages a recording can be spoken in / translated into (a separate list from the app's own language).
export const TRANSLATION_LANGUAGES = ['en', 'es', 'fr', 'de', 'pt', 'it', 'ru', 'ar', 'hi', 'ja', 'ko', 'id', 'yo', 'zh'];

const STORAGE_KEY = 'secretary_lang';
const SUPPORTED = new Set(LANGUAGES.map((l) => l.code));
const loaders = import.meta.glob('./locales/*.js'); // other languages load on demand

function readStored() {
  try { const v = localStorage.getItem(STORAGE_KEY); return SUPPORTED.has(v) ? v : null; } catch { return null; }
}
function detectLanguage() {
  const wanted = (typeof navigator !== 'undefined' ? navigator.languages || [navigator.language] : [])
    .map((l) => String(l || '').toLowerCase().split('-')[0]);
  return wanted.find((l) => SUPPORTED.has(l)) || 'en';
}
async function loadDictionary(code) {
  if (code === 'en') return en;
  const load = loaders[`./locales/${code}.js`];
  if (!load) return en;
  try { return (await load()).default; } catch { return en; }
}
function fill(text, vars) {
  if (!vars) return text;
  return text.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
}

const I18nContext = createContext(null);

export function LanguageProvider({ children }) {
  const { user } = useAuth();
  const [lang, setLangState] = useState(() => readStored() || detectLanguage());
  const [dict, setDict] = useState(null);

  // Load the text for the chosen language.
  useEffect(() => {
    let alive = true;
    loadDictionary(lang).then((d) => { if (alive) setDict(d); });
    return () => { alive = false; };
  }, [lang]);

  // Tell the browser which language / direction the page is in.
  useEffect(() => {
    const meta = LANGUAGES.find((l) => l.code === lang);
    document.documentElement.lang = lang;
    document.documentElement.dir = meta?.dir || 'ltr';
  }, [lang]);

  // First sign-in on a new device with no saved choice: follow the account's language.
  useEffect(() => {
    const saved = user?.user_metadata?.language;
    if (saved && SUPPORTED.has(saved) && !readStored()) setLangState(saved);
  }, [user]);

  const setLang = useCallback((code) => {
    if (!SUPPORTED.has(code)) return;
    try { localStorage.setItem(STORAGE_KEY, code); } catch { /* storage unavailable */ }
    setLangState(code);
    // Remember it on the account too, so it follows the person to other devices.
    supabase.auth.getSession().then(({ data }) => {
      if (data?.session) supabase.auth.updateUser({ data: { language: code } }).catch(() => {});
    }).catch(() => {});
  }, []);

  const value = useMemo(() => {
    const t = (key, vars) => fill((dict && dict[key]) ?? en[key] ?? key, vars);
    const names = (() => { try { return new Intl.DisplayNames([lang], { type: 'language' }); } catch { return null; } })();
    return {
      t,
      lang,
      setLang,
      languages: LANGUAGES,
      dir: LANGUAGES.find((l) => l.code === lang)?.dir || 'ltr',
      // A language's name, written in the app's current language ("French", "Französisch", …).
      langName: (code) => { try { return names?.of(code) || code.toUpperCase(); } catch { return code.toUpperCase(); } },
      formatDate: (d) => new Date(d).toLocaleDateString(lang),
      formatDateTime: (d) => new Date(d).toLocaleString(lang),
    };
  }, [dict, lang, setLang]);

  if (!dict) return null; // a moment while the language file loads
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within LanguageProvider');
  return ctx;
}

/** Splits "text with **bold** parts" into React-friendly pieces. */
export function renderBold(text) {
  return String(text).split('**').map((part, i) => (i % 2 ? <strong key={i}>{part}</strong> : part));
}
