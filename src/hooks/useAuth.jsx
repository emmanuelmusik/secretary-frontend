import { createContext, useContext, useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { SignInWithApple } from '@capacitor-community/apple-sign-in';
import { supabase } from '../lib/supabase.js';
import { generateNonce } from '../lib/nonce.js';

const AuthContext = createContext(null);

/**
 * On a real iOS device (via Capacitor), uses native Sign in with Apple —
 * same approach as Guardian, no web secret rotation needed.
 * In a browser, falls back to the standard web OAuth redirect.
 */
async function signInWithApple() {
  if (!Capacitor.isNativePlatform()) {
    return supabase.auth.signInWithOAuth({ provider: 'apple' });
  }

  const { rawNonce, hashedNonce } = await generateNonce();

  const result = await SignInWithApple.authorize({
    clientId: 'com.johmacos.secretary',
    redirectURI: 'https://secretary-frontend.vercel.app/auth',
    scopes: 'email name',
    state: crypto.randomUUID(),
    nonce: hashedNonce,
  });

  const identityToken = result.response.identityToken;
  if (!identityToken) throw new Error('Apple sign-in did not return an identity token');

  return supabase.auth.signInWithIdToken({
    provider: 'apple',
    token: identityToken,
    nonce: rawNonce,
  });
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
    signInWithGoogle: () => supabase.auth.signInWithOAuth({ provider: 'google' }),
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
