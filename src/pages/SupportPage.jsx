import { useNavigate } from 'react-router-dom';

export default function SupportPage() {
  const navigate = useNavigate();
  const goBack = () => (window.history.length > 1 ? navigate(-1) : navigate('/auth'));
  return (
    <div className="static-page">
      <button type="button" className="back-link" onClick={goBack}>&larr; Back</button>
      <h1>Support Center</h1>
      <p>Need help? Reach us at emmanuelmusik7@gmail.com.</p>
      <h2>Frequently Asked Questions</h2>
      <ul>
        <li>How do I record a meeting or class?</li>
        <li>Where is my audio stored?</li>
        <li>How does translation work?</li>
        <li>How do I use "Analyze with History"?</li>
      </ul>
      {/* TODO: flesh out real FAQ content */}
    </div>
  );
}
