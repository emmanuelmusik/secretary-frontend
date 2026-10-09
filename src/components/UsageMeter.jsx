import { useI18n } from '../i18n/index.jsx';
import { formatSeconds } from '../lib/format.js';

/** Bar showing how much of this month's recording time has been used. */
export default function UsageMeter({ usage }) {
  const { t, formatDate } = useI18n();
  if (!usage || usage.unlimited) return null;
  const pct = usage.limit_seconds > 0 ? Math.min(100, Math.round((usage.used_seconds / usage.limit_seconds) * 100)) : 100;
  return (
    <div className="usage-meter">
      <div className="usage-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
        <span className={pct >= 90 ? 'full' : ''} style={{ width: `${pct}%` }} />
      </div>
      <p className="usage-text">
        {t('paywall.usage', { used: formatSeconds(t, usage.used_seconds), limit: formatSeconds(t, usage.limit_seconds) })}
      </p>
      <p className="meta">{t('paywall.resets', { date: formatDate(usage.period_end) })}</p>
    </div>
  );
}
