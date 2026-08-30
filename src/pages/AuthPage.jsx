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
      <h1>Secretary</h1>
      <p>Your AI-powered meeting, class, and voice notes assistant.</p>

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
        <button type="submit" disabled={loading}>
          {loading ? 'Please wait…' : mode === 'signup' ? 'Sign Up' : 'Log In'}
        </button>
      </form>

      <div className="oauth-buttons">
        <button onClick={signInWithGoogle}>Continue with Google</button>
        <button onClick={signInWithApple}>Continue with Apple</button>
      </div>

      <button className="link-btn" onClick={() => setMode(mode === 'signup' ? 'login' : 'signup')}>
        {mode === 'signup' ? 'Already have an account? Log in' : "Don't have an account? Sign up"}
      </button>

      <div className="footer-links">
        <Link to="/support">Support Center</Link>
        <Link to="/privacy">Privacy Policy</Link>
      </div>
    </div>
  );
}
