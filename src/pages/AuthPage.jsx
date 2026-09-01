import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.jsx';

export default function AuthPage() {
  const { signUp, signIn, signInWithGoogle, signInWithApple } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState('signup'); // 'signup' | 'login'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { error } = mode === 'signup'
        ? await signUp(email, password)
        : await signIn(email, password);
      if (error) throw error;
      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-glow" aria-hidden="true" />

      <div className="auth-hero">
        <h1 className="auth-title">Secretary</h1>
        <p>Your AI-powered meeting, class, and voice notes assistant.</p>
      </div>

      <div className="auth-card">
        <form onSubmit={handleSubmit}>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
          />
          {error && <p className="error">{error}</p>}
          <button type="submit" className="auth-primary-btn" disabled={loading}>
            {loading ? 'Please wait…' : mode === 'signup' ? 'Sign Up' : 'Log In'}
          </button>
        </form>

        <button className="oauth-btn" onClick={signInWithGoogle}>
          <GoogleIcon /> Continue with Google
        </button>

        <div className="auth-divider"><span>OR CONTINUE WITH</span></div>

        <button className="oauth-btn" onClick={signInWithApple}>
          <AppleIcon /> Continue with Apple
        </button>

        <button className="link-btn" onClick={() => setMode(mode === 'signup' ? 'login' : 'signup')}>
          {mode === 'signup' ? (
            <>Already have an account? <span className="link-accent">Log in</span></>
          ) : (
            <>Don't have an account? <span className="link-accent">Sign up</span></>
          )}
        </button>
      </div>

      <div className="footer-links">
        <Link to="/support">Support Center</Link>
        <span>|</span>
        <Link to="/privacy">Privacy Policy</Link>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18">
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 01-1.8 2.72v2.26h2.91c1.7-1.57 2.69-3.88 2.69-6.62z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.91-2.26c-.81.54-1.84.86-3.05.86-2.35 0-4.34-1.58-5.05-3.71H.96v2.33A9 9 0 009 18z" />
      <path fill="#FBBC05" d="M3.95 10.71a5.4 5.4 0 010-3.42V4.96H.96a9 9 0 000 8.08l2.99-2.33z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.51.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 00.96 4.96l2.99 2.33C4.66 5.16 6.65 3.58 9 3.58z" />
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 384 512" fill="currentColor">
      <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z" />
    </svg>
  );
}
