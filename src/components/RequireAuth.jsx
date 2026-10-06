import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.jsx';
import AppShell from './AppShell.jsx';
import { AiConsentProvider } from './AiConsent.jsx';

export function RequireAuth({ children }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) return <div className="loading-screen">Loading…</div>;
  if (!isAuthenticated) return <Navigate to="/auth" replace />;

  return (
    <AiConsentProvider>
      <AppShell>{children}</AppShell>
    </AiConsentProvider>
  );
}
