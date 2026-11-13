import { createContext, useContext, useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { SignInWithApple } from '@capacitor-community/apple-sign-in';
import { supabase } from '../lib/supabase.js';
import { clearCache } from '../lib/offlineCache.js';

const AuthContext = createContext(null);

// Where the link in the verification email lands (a plain web page that sends the person back to the app).
const VERIFIED_URL = 'https://secretary-frontend.vercel.app/verified';

/**
 * On a real iOS device (via Capacitor), uses native Sign in with Apple —
 * the actual Face ID system sheet, not a browser page.
 * In a browser, falls back to the standard web OAuth redirect.
 */
// Android: Google refuses to show its login page inside an app's own web view, so the sign-in opens in
// Chrome and returns to the app through a link of its own (handled in AuthProvider below).
const ANDROID_REDIRECT = 'com.johmacos.secretary://auth-callback';
const isAndroid = () => Capacitor.getPlatform() === 'android';

async function oauthInBrowser(provider) {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo: ANDROID_REDIRECT, skipBrowserRedirect: true },
  });
  if (error) return { error };
  const { Browser } = await import('@capacitor/browser');
  await Browser.open({ url: data.url });
  return { error: null };
}

async function signInWithGoogle() {
  if (isAndroid()) return oauthInBrowser('google');
  return supabase.auth.signInWithOAuth({ provider: 'google' });
}

async function signInWithApple() {
  if (isAndroid()) return oauthInBrowser('apple'); // no native Apple sign-in on Android: uses the web flow
  if (!Capacitor.isNativePlatform()) {
    return supabase.auth.signInWithOAuth({ provider: 'apple' });
  }

  const result = await SignInWithApple.authorize({
    clientId: 'com.johmacos.secretary',
    redirectURI: 'https://secretary-frontend.vercel.app/auth',
    scopes: 'email name',
    state: crypto.randomUUID(),
  });

  const identityToken = result?.response?.identityToken;
  if (!identityToken) {
    throw new Error('Apple did not return an identity token.');
  }

  const { error } = await supabase.auth.signInWithIdToken({
    provider: 'apple',
    token: identityToken,
  });

  return { error };
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(undefined);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));

    // Android: the browser sign-in comes back to the app as a link; finish the sign-in here.
    let removeLink = () => {};
    if (isAndroid()) {
      (async () => {
        const [{ App }, { Browser }] = await Promise.all([import('@capacitor/app'), import('@capacitor/browser')]);
        const handle = await App.addListener('appUrlOpen', async ({ url }) => {
          if (!url || !url.startsWith(ANDROID_REDIRECT)) return;
          try { await Browser.close(); } catch { /* already closed */ }
          const query = new URLSearchParams(url.split('#')[0].split('?')[1] || '');
          const hash = new URLSearchParams(url.split('#')[1] || '');
          if (query.get('code')) {
            await supabase.auth.exchangeCodeForSession(query.get('code'));
          } else if (hash.get('access_token') && hash.get('refresh_token')) {
            await supabase.auth.setSession({ access_token: hash.get('access_token'), refresh_token: hash.get('refresh_token') });
          }
        });
        removeLink = () => handle.remove();
      })().catch(() => {});
    }

    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => { sub.subscription.unsubscribe(); removeLink(); };
  }, []);

  const value = {
    session,
    user: session?.user ?? null,
    isLoading: session === undefined,
    isAuthenticated: !!session,
    signUp: (email, password) => supabase.auth.signUp({ email, password, options: { emailRedirectTo: VERIFIED_URL } }),
    resendVerification: (email) => supabase.auth.resend({ type: 'signup', email, options: { emailRedirectTo: VERIFIED_URL } }),
    signIn: (email, password) => supabase.auth.signInWithPassword({ email, password }),
    signInWithGoogle,
    signInWithApple,
    signOut: async () => { await clearCache(); return supabase.auth.signOut(); },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
