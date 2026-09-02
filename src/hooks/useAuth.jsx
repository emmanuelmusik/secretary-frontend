import { createContext, useContext, useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';
import { App as CapacitorApp } from '@capacitor/app';
import { supabase } from '../lib/supabase.js';

const AuthContext = createContext(null);

// Custom URL scheme the native app listens for — Apple/Google send the
// user back here after they finish signing in in the in-app browser.
const NATIVE_REDIRECT = 'com.johmacos.secretary://auth/callback';

/**
 * Native OAuth via in-app browser + deep link — reuses the exact same,
 * already-working web OAuth flow instead of a separate native plugin.
 * Opens the provider's sign-in page in an in-app browser tab; when it
 * redirects back to our custom URL scheme, the app catches that redirect,
 * hands the resulting code/tokens to Supabase, and closes the browser.
 */
function signInWithProviderNative(provider) {
  return new Promise(async (resolve, reject) => {
    let listenerHandle;

    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: NATIVE_REDIRECT, skipBrowserRedirect: true },
      });
      if (error) throw error;

      listenerHandle = await CapacitorApp.addListener('appUrlOpen', async ({ url }) => {
        if (!url.startsWith(NATIVE_REDIRECT)) return;

        try {
          const result = await completeSessionFromRedirectUrl(url);
          await Browser.close();
          listenerHandle.remove();
          resolve(result);
        } catch (err) {
          await Browser.close();
          listenerHandle.remove();
          reject(err);
        }
      });

      await Browser.open({ url: data.url });
    } catch (err) {
      listenerHandle?.remove();
      reject(err);
    }
  });
}

/** Handles both possible OAuth response shapes Supabase might send back. */
async function completeSessionFromRedirectUrl(url) {
  const urlObj = new URL(url);

  const code = urlObj.searchParams.get('code');
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) throw error;
    return { error: null };
  }

  const hashParams = new URLSearchParams(urlObj.hash.replace(/^#/, ''));
  const access_token = hashParams.get('access_token');
  const refresh_token = hashParams.get('refresh_token');
  if (access_token && refresh_token) {
    const { error } = await supabase.auth.setSession({ access_token, refresh_token });
    if (error) throw error;
    return { error: null };
  }

  throw new Error('Sign-in did not return a valid session');
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(undefined); // undefined = loading, null = signed out

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  const value = {
    session,
    user: session?.user ?? null,
    isLoading: session === undefined,
    isAuthenticated: !!session,
    signUp: (email, password) => supabase.auth.signUp({ email, password }),
    signIn: (email, password) => supabase.auth.signInWithPassword({ email, password }),
    signInWithGoogle: () =>
      Capacitor.isNativePlatform()
        ? signInWithProviderNative('google')
        : supabase.auth.signInWithOAuth({ provider: 'google' }),
    signInWithApple: () =>
      Capacitor.isNativePlatform()
        ? signInWithProviderNative('apple')
        : supabase.auth.signInWithOAuth({ provider: 'apple' }),
    signOut: () => supabase.auth.signOut(),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
