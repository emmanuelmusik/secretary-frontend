import { useNavigate } from 'react-router-dom';
import { useI18n } from '../i18n/index.jsx';

const FAQ_COUNT = 10;

export default function SupportPage() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const goBack = () => (window.history.length > 1 ? navigate(-1) : navigate('/auth'));
  return (
    <div className="static-page legal">
      <button type="button" className="back-link" onClick={goBack}><span className="back-arrow">←</span> {t('common.back')}</button>
      <h1>{t('support.title')}</h1>
      <p>
        {t('support.intro', { email: '\u0000' }).split('\u0000').flatMap((part, i, arr) => (
          i < arr.length - 1
            ? [part, <a key={i} href="mailto:emmanuelmusik7@gmail.com">emmanuelmusik7@gmail.com</a>]
            : [part]
        ))}
      </p>
      <h2>{t('support.faq_title')}</h2>
      {Array.from({ length: FAQ_COUNT }, (_, n) => n + 1).map((n) => (
        <details className="faq-item" key={n}>
          <summary>{t(`faq.q${n}`)}</summary>
          <p>{t(`faq.a${n}`)}</p>
        </details>
      ))}
    </div>
  );
}
