import { createContext, useContext, useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';
import { App as CapacitorApp } from '@capacitor/app';
import { SignInWithApple } from '@capacitor-community/apple-sign-in';
import { supabase } from '../lib/supabase.js';

const AuthContext = createContext(null);

// Custom scheme the app listens for — Google sends the user back here
// after they finish signing in, so the app can catch it and stay open.
const NATIVE_REDIRECT = 'com.johmacos.secretary://auth/callback';

/**
 * On a real iOS device (via Capacitor), uses native Sign in with Apple —
 * the actual Face ID system sheet, not a browser page.
 * In a browser, falls back to the standard web OAuth redirect.
 */
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
    throw new Error('Apple did not return an identity token — sign-in was cancelled or failed on the native side.');
  }

  const { error } = await supabase.auth.signInWithIdToken({
    provider: 'apple',
    token: identityToken,
  });

  return { error };
}

/**
 * Google sign-in on native: opens the same web sign-in page in an in-app
 * browser tab, then catches the redirect back into the app so it doesn't
 * hand off to Safari and leave the app.
 */
function signInWithGoogle() {
  if (!Capacitor.isNativePlatform()) {
    return supabase.auth.signInWithOAuth({ provider: 'google' });
  }

  return new Promise(async (resolve, reject) => {
    let listenerHandle;
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
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

async function completeSessionFromRedirectUrl(url) {
  const urlObj = new URL(url);

  const code = urlObj.searchParams.get('code');
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    return { error };
  }

  const hashParams = new URLSearchParams(urlObj.hash.replace(/^#/, ''));
  const access_token = hashParams.get('access_token');
  const refresh_token = hashParams.get('refresh_token');
  if (access_token && refresh_token) {
    const { error } = await supabase.auth.setSession({ access_token, refresh_token });
    return { error };
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
    signInWithGoogle: signInWithGoogle,
    signInWithApple: signInWithApple,
    signOut: () => supabase.auth.signOut(),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
