import { createContext, useContext, useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { SignInWithApple } from '@capacitor-community/apple-sign-in';
import { GoogleAuth } from '@codetrix-studio/capacitor-google-auth';
import { supabase } from '../lib/supabase.js';

const AuthContext = createContext(null);

let googleAuthInitialized = false;
function ensureGoogleAuthInitialized() {
  if (googleAuthInitialized) return;
  // No clientId passed here on purpose — native config comes from
  // capacitor.config.json's serverClientId/iosClientId instead.
  GoogleAuth.initialize();
  googleAuthInitialized = true;
}

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
 * Same idea as Apple: native Google Sign-In sheet on device, web OAuth
 * redirect fallback in the browser.
 */
async function signInWithGoogle() {
  if (!Capacitor.isNativePlatform()) {
    return supabase.auth.signInWithOAuth({ provider: 'google' });
  }

  ensureGoogleAuthInitialized();
  const googleUser = await GoogleAuth.signIn();

  const idToken = googleUser?.authentication?.idToken;
  if (!idToken) {
    throw new Error('Google did not return an identity token — sign-in was cancelled or failed on the native side.');
  }

  const { error } = await supabase.auth.signInWithIdToken({
    provider: 'google',
    token: idToken,
  });

  return { error };
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
