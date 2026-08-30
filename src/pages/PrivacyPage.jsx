import { Link } from 'react-router-dom';

export default function PrivacyPage() {
  return (
    <div className="static-page">
      <Link to="/auth">&larr; Back</Link>
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
