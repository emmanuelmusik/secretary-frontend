/**
 * Native Sign in with Apple requires a nonce round-trip:
 * - Apple gets the HASHED nonce, embeds it in the identity token it returns
 * - Supabase gets the RAW nonce, hashes it itself, and checks it matches
 * This proves the token was issued for this exact sign-in attempt.
 */
export async function generateNonce() {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  const rawNonce = Array.from(array, (b) => b.toString(16).padStart(2, '0')).join('');

  const encoded = new TextEncoder().encode(rawNonce);
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoded);
  const hashedNonce = Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  return { rawNonce, hashedNonce };
}
