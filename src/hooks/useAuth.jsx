import { createContext, useContext, useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';
import { App } from '@capacitor/app';
import { SignInWithApple } from '@capacitor-community/apple-sign-in';
import { supabase } from '../lib/supabase.js';

const AuthContext = createContext(null);

const GOOGLE_REDIRECT = 'com.johmacos.secretary://auth-callback';

async function signInWithApple() {
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

// Google on native: Capacitor's own docs confirm Browser.open() (an
// in-app Safari sheet) is the officially compliant method for OAuth.
function signInWithGoogle() {
  if (!Capacitor.isNativePlatform()) {
    return supabase.auth.signInWithOAuth({ provider: 'google' });
  }

  return new Promise(async (resolve, reject) => {
    let listener;
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: GOOGLE_REDIRECT, skipBrowserRedirect: true },
      });
      if (error) throw error;
      if (!data?.url) throw new Error('Supabase did not return a sign-in URL.');

      // DIAGNOSTIC: show the exact URL before opening it.
      alert('DEBUG - URL being opened:\n\n' + data.url);

      listener = await App.addListener('appUrlOpen', async ({ url }) => {
        if (!url.startsWith(GOOGLE_REDIRECT)) return;
        try {
          const code = new URL(url).searchParams.get('code');
          if (!code) throw new Error('No code returned from Google sign-in.');
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          await Browser.close();
          listener.remove();
          resolve({ error: exchangeError });
        } catch (err) {
          await Browser.close();
          listener.remove();
          reject(err);
        }
      });

      try {
        await Browser.open({ url: data.url });
      } catch (browserErr) {
        alert('DEBUG - Browser.open() itself threw:\n\n' + (browserErr?.message || JSON.stringify(browserErr)));
        throw browserErr;
      }
    } catch (err) {
      listener?.remove();
      reject(err);
    }
  });
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(undefined);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));

    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const value = {
    session,
    user: session?.user ?? null,
    isLoading: session === undefined,
    isAuthenticated: !!session,
    signUp: (email, password) => supabase.auth.signUp({ email, password }),
    signIn: (email, password) => supabase.auth.signInWithPassword({ email, password }),
    signInWithGoogle,
    signInWithApple,
    signOut: () => supabase.auth.signOut(),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
