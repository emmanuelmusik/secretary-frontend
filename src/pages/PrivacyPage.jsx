import { useNavigate } from 'react-router-dom';

export default function PrivacyPage() {
  const navigate = useNavigate();
  const goBack = () => (window.history.length > 1 ? navigate(-1) : navigate('/auth'));
  return (
    <div className="static-page">
      <button type="button" className="back-link" onClick={goBack}>&larr; Back</button>
      <h1>Privacy Policy</h1>
      <p>
        Audio recordings are stored locally on your device only and are never uploaded to our
        servers. Transcripts, translations, notes, and analysis are stored in your account so
        they sync across your devices.
      </p>
      {/* TODO: full legal privacy policy content */}
    </div>
  );
}
