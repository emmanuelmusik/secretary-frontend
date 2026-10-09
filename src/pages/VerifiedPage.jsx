import { useI18n } from '../i18n/index.jsx';
import LanguageMenu from '../components/LanguageMenu.jsx';

// Where the link in the verification email lands. It is a normal web page (opened in Safari),
// so it just confirms and sends the person back to the app, where they log in.
export default function VerifiedPage() {
  const { t } = useI18n();
  const failed = /error/i.test(window.location.hash + window.location.search);
  return (
    <div className="auth-page">
      <div className="auth-glow" aria-hidden="true" />
      <LanguageMenu />
      <div className="auth-hero">
        <h1 className="auth-title">Secretary</h1>
      </div>
      <div className="auth-card check-email">
        <h2>{failed ? t('auth.failed') : t('verified.title')}</h2>
        <p>{failed ? t('verified.expired') : t('verified.body')}</p>
        <a className="auth-primary-btn open-app-btn" href="com.johmacos.secretary://verified">{t('verified.open')}</a>
      </div>
    </div>
  );
}
