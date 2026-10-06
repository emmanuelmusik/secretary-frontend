import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.jsx';
import { useI18n } from '../i18n/index.jsx';
import AppShell from './AppShell.jsx';
import { AiConsentProvider } from './AiConsent.jsx';

export function RequireAuth({ children }) {
  const { isAuthenticated, isLoading } = useAuth();
  const { t } = useI18n();

  if (isLoading) return <div className="loading-screen">{t('common.loading')}</div>;
  if (!isAuthenticated) return <Navigate to="/auth" replace />;

  return (
    <AiConsentProvider>
      <AppShell>{children}</AppShell>
    </AiConsentProvider>
  );
}
