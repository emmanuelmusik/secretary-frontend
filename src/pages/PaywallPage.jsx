import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useAuth } from '../hooks/useAuth.jsx';
import { useI18n } from '../i18n/index.jsx';
import { purchasesAvailable, initPurchases, loadPlans, buy, restore, runDiagnostics } from '../lib/purchases.js';
import UsageMeter from '../components/UsageMeter.jsx';

const PERIOD_KEYS = {
  month: { name: 'paywall.monthly', price: 'paywall.price_month' },
  quarter: { name: 'paywall.quarterly', price: 'paywall.price_quarter' },
  year: { name: 'paywall.yearly', price: 'paywall.price_year' },
};
const TERMS_URL = 'https://www.apple.com/legal/internet-services/itunes/dev/stdeula/';

export default function PaywallPage() {
  const navigate = useNavigate();
  const { state } = useLocation();
  const { user } = useAuth();
  const { t } = useI18n();

  const [usage, setUsage] = useState(state?.usage || null);
  const [plans, setPlans] = useState(null);       // null = still loading
  const [chosen, setChosen] = useState('quarter');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [detail, setDetail] = useState('');
  const [diag, setDiag] = useState([]); // live self-test lines shown when plans fail to load
  const canBuy = purchasesAvailable();

  useEffect(() => {
    api.getUsage().then(setUsage).catch(() => {});
    if (!canBuy) { setPlans([]); return; }
    const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('[v4] No answer from the App Store after 25s')), 25000));
    Promise.race([initPurchases(user?.id).then(loadPlans), timeout])
      .then((list) => setPlans(list))
      .catch((err) => {
        setPlans([]); setError(t('paywall.plans_failed')); setDetail(String(err?.message || err || '').slice(0, 300));
        runDiagnostics((line, done) => setDiag((prev) => (done ? [...prev.filter((l) => !l.startsWith(line.split(':')[0] + ':')), line] : [...prev, line])), user?.id);
      });
  }, []);

  // After a purchase the store tells our server; wait a few seconds for the plan to switch to Pro.
  async function waitForPro() {
    for (let i = 0; i < 15; i += 1) {
      // The first call usually settles it: the server checks with RevenueCat itself instead of waiting for the webhook.
      const u = await api.syncBilling().catch(() => api.getUsage().catch(() => null));
      if (u) setUsage(u);
      if (u?.plan === 'pro') return true;
      await new Promise((r) => setTimeout(r, 1600));
    }
    return false;
  }

  async function handleBuy() {
    const plan = plans?.find((p) => p.period === chosen);
    if (!plan) return;
    setBusy(true); setError(''); setMessage('');
    try {
      if (await buy(plan)) {
        setMessage(t('paywall.activating'));
        if (await waitForPro()) setMessage(t('paywall.thanks'));
      }
    } catch {
      setError(t('paywall.purchase_failed'));
    } finally {
      setBusy(false);
    }
  }

  async function handleRestore() {
    setBusy(true); setError(''); setMessage('');
    try {
      await restore();
      setMessage(t('paywall.activating'));
      setMessage((await waitForPro()) ? t('paywall.restored') : t('paywall.nothing_restored'));
    } catch {
      setError(t('paywall.purchase_failed'));
    } finally {
      setBusy(false);
    }
  }

  const isPro = usage?.plan === 'pro';
  const proHours = Math.round((usage?.pro_limit_seconds || 12 * 3600) / 3600);
  const reasonText = usage?.reason === 'disposable_email' ? t('paywall.reason_disposable')
    : usage?.reason === 'email_not_verified' ? t('paywall.reason_unverified') : '';

  return (
    <div className="paywall-page">
      <button type="button" className="back-link" onClick={() => navigate(-1)}>
        <span className="back-arrow">←</span> {t('common.back')}
      </button>

      <h1>{t('paywall.title')}</h1>
      <p className="paywall-tagline">{t('paywall.tagline', { hours: proHours })}</p>

      {state?.limitReached && !isPro && <p className="warning">{t('paywall.limit_reached')}</p>}
      {reasonText && !isPro && <p className="warning">{reasonText}</p>}
      <UsageMeter usage={usage} />

      {isPro ? (
        <div className="paywall-active">
          <p><strong>{t('paywall.thanks')}</strong></p>
          <a className="link-accent" href="https://apps.apple.com/account/subscriptions" target="_blank" rel="noreferrer">{t('paywall.manage')}</a>
        </div>
      ) : !canBuy ? (
        <p className="meta">{t('paywall.unavailable')}</p>
      ) : plans === null ? (
        <p className="meta">{t('common.loading')}</p>
      ) : plans.length > 0 ? (
        <>
          <div className="plan-list" role="radiogroup">
            {plans.map((p) => (
              <button
                key={p.period}
                type="button"
                role="radio"
                aria-checked={chosen === p.period}
                className={`plan-card ${chosen === p.period ? 'selected' : ''}`}
                onClick={() => setChosen(p.period)}
              >
                <span className="plan-name">{t(PERIOD_KEYS[p.period].name)}</span>
                <span className="plan-price">{t(PERIOD_KEYS[p.period].price, { price: p.priceString })}</span>
                {p.period !== 'month' && p.perMonth && <span className="meta">{t('paywall.price_month', { price: p.perMonth })}</span>}
              </button>
            ))}
          </div>
          <button type="button" className="save-btn" onClick={handleBuy} disabled={busy}>
            {busy ? t('common.loading') : t('paywall.subscribe')}
          </button>
        </>
      ) : null}

      {message && <p className="meta paywall-message">{message}</p>}
      {error && <p className="form-error">{error}</p>}
      {detail && <p className="meta">{detail}</p>}
      {diag.length > 0 && <p className="meta" style={{ whiteSpace: 'pre-line', fontSize: 12 }}>{[...diag].sort().join('\n')}</p>}

      {canBuy && !isPro && (
        <button type="button" className="link-button" onClick={handleRestore} disabled={busy}>{t('paywall.restore')}</button>
      )}

      <p className="paywall-legal">{t('paywall.auto_renew')}</p>
      <p className="paywall-links">
        <a href={TERMS_URL} target="_blank" rel="noreferrer">{t('paywall.terms')}</a>
        {' · '}
        <a href="/privacy" onClick={(e) => { e.preventDefault(); navigate('/privacy'); }}>{t('nav.privacy')}</a>
      </p>
    </div>
  );
}
