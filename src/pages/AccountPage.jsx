import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.jsx';
import { api } from '../lib/api.js';

export default function AccountPage() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [confirmText, setConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  async function handleDelete() {
    if (confirmText !== 'DELETE') return;
    setDeleting(true);
    setError('');
    try {
      await api.deleteAccount();
      await signOut();
      navigate('/auth');
    } catch (err) {
      setError(err.message || 'Could not delete account');
      setDeleting(false);
    }
  }

  async function handleSignOut() {
    await signOut();
    navigate('/auth');
  }

  return (
    <div className="account-page">
      <h1>Account</h1>
      <p className="meta">Signed in as {user?.email}</p>

      <div className="account-links">
        <Link to="/support">Support Center</Link>
        <Link to="/privacy">Privacy Policy</Link>
      </div>

      <button className="signout-btn" onClick={handleSignOut}>Sign out</button>

      <div className="danger-zone">
        <h2>Delete Account</h2>
        <p className="meta">
          This permanently deletes your account and every folder, session, transcript, and note
          associated with it. This cannot be undone. Audio saved on your device is not affected
          by this — you'd need to remove that separately.
        </p>

        <label>
          Type DELETE to confirm
          <input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder="DELETE" />
        </label>

        {error && <p className="error">{error}</p>}

        <button
          className="danger-btn"
          disabled={confirmText !== 'DELETE' || deleting}
          onClick={handleDelete}
        >
          {deleting ? 'Deleting…' : 'Permanently Delete My Account'}
        </button>
      </div>
    </div>
  );
}
