import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './hooks/useAuth.jsx';
import { RequireAuth } from './components/RequireAuth.jsx';
import { LanguageProvider } from './i18n/index.jsx';

import AuthPage from './pages/AuthPage.jsx';
import SupportPage from './pages/SupportPage.jsx';
import PrivacyPage from './pages/PrivacyPage.jsx';
import HomePage from './pages/HomePage.jsx';
import RecordPage from './pages/RecordPage.jsx';
import UploadPage from './pages/UploadPage.jsx';
import SaveSessionPage from './pages/SaveSessionPage.jsx';
import SessionDetailPage from './pages/SessionDetailPage.jsx';
import FoldersPage from './pages/FoldersPage.jsx';
import NotesPage from './pages/NotesPage.jsx';
import NoteEditorPage from './pages/NoteEditorPage.jsx';
import AccountPage from './pages/AccountPage.jsx';
import CardsPage from './pages/CardsPage.jsx';
import CardEditorPage from './pages/CardEditorPage.jsx';
import ScanCardPage from './pages/ScanCardPage.jsx';

export default function App() {
  return (
    <AuthProvider>
      <LanguageProvider>
      <BrowserRouter>
        <Routes>
          {/* Public — no signup required */}
          <Route path="/auth" element={<AuthPage />} />
          <Route path="/support" element={<SupportPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />

          {/* Everything else requires signup */}
          <Route path="/" element={<RequireAuth><HomePage /></RequireAuth>} />
          <Route path="/record" element={<RequireAuth><RecordPage /></RequireAuth>} />
          <Route path="/upload" element={<RequireAuth><UploadPage /></RequireAuth>} />
          <Route path="/sessions/:id/save" element={<RequireAuth><SaveSessionPage /></RequireAuth>} />
          <Route path="/sessions/:id" element={<RequireAuth><SessionDetailPage /></RequireAuth>} />
          <Route path="/folders" element={<RequireAuth><FoldersPage /></RequireAuth>} />
          <Route path="/notes" element={<RequireAuth><NotesPage /></RequireAuth>} />
          <Route path="/notes/:id" element={<RequireAuth><NoteEditorPage /></RequireAuth>} />
          <Route path="/cards" element={<RequireAuth><CardsPage /></RequireAuth>} />
          <Route path="/cards/scan" element={<RequireAuth><ScanCardPage /></RequireAuth>} />
          <Route path="/cards/new" element={<RequireAuth><CardEditorPage /></RequireAuth>} />
          <Route path="/cards/:id" element={<RequireAuth><CardEditorPage /></RequireAuth>} />
          <Route path="/account" element={<RequireAuth><AccountPage /></RequireAuth>} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
      </LanguageProvider>
    </AuthProvider>
  );
}
