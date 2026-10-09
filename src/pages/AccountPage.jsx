import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.jsx';
import { api } from '../lib/api.js';
import { useI18n } from '../i18n/index.jsx';
import { getKeepAwakePref, setKeepAwakePref } from '../lib/keepAwake.js';
import UsageMeter from '../components/UsageMeter.jsx';

export default function AccountPage() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { t, lang, setLang, languages, formatDate } = useI18n();
  const [confirmText, setConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');
  const [keepAwake, setKeepAwake] = useState(getKeepAwakePref);
  const [usage, setUsage] = useState(null);

  useEffect(() => { api.getUsage().then(setUsage).catch(() => {}); }, []);

  async function handleDelete() {
    if (confirmText !== 'DELETE') return;
    setDeleting(true);
    setError('');
    try {
      await api.deleteAccount();
      await signOut();
      navigate('/auth');
    } catch (err) {
      setError(err.message || t('settings.delete_failed'));
      setDeleting(false);
    }
  }

  async function handleSignOut() {
    await signOut();
    navigate('/auth');
  }

  return (
    <div className="account-page">
      <h1>{t('settings.title')}</h1>
      <p className="meta">{t('settings.signed_in', { email: user?.email })}</p>

      {usage && (
        <section className="plan-section">
          <h2>{t('usage.title')}</h2>
          <p className="plan-name-line">{usage.unlimited ? t('usage.unlimited') : usage.plan === 'pro' ? t('usage.pro') : t('usage.free')}{usage.renews_at && ` · ${t('usage.renews', { date: formatDate(usage.renews_at) })}`}</p>
          <UsageMeter usage={usage} />
          {!usage.unlimited && (
            <button type="button" className="save-btn" onClick={() => navigate('/paywall')}>
              {usage.plan === 'pro' ? t('paywall.manage') : t('usage.upgrade')}
            </button>
          )}
        </section>
      )}

      <label className="lang-setting">
        {t('settings.language')}
        <select value={lang} onChange={(e) => setLang(e.target.value)}>
          {languages.map((l) => (
            <option key={l.code} value={l.code}>{l.native}</option>
          ))}
        </select>
      </label>

      <label className="keep-awake-setting">
        <input
          type="checkbox"
          checked={keepAwake}
          onChange={(e) => { setKeepAwake(e.target.checked); setKeepAwakePref(e.target.checked); }}
        />
        <span>
          {t('settings.keep_awake')}
          <small>{t('settings.keep_awake_hint')}</small>
        </span>
      </label>

      <div className="account-links">
        <Link to="/support">{t('support.title')}</Link>
        <Link to="/privacy">{t('nav.privacy')}</Link>
      </div>

      <button className="signout-btn" onClick={handleSignOut}>{t('settings.signout')}</button>

      <div className="danger-zone">
        <h2>{t('settings.delete_title')}</h2>
        <p className="meta">{t('settings.delete_desc')}</p>

        <label>
          {t('settings.type_delete', { word: 'DELETE' })}
          <input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder="DELETE" />
        </label>

        {error && <p className="error">{error}</p>}

        <button
          className="danger-btn"
          disabled={confirmText !== 'DELETE' || deleting}
          onClick={handleDelete}
        >
          {deleting ? t('settings.deleting') : t('settings.delete_btn')}
        </button>
      </div>
    </div>
  );
}
