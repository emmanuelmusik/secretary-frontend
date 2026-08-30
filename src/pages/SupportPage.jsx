import { Link } from 'react-router-dom';

export default function SupportPage() {
  return (
    <div className="static-page">
      <Link to="/auth">&larr; Back</Link>
      <h1>Support Center</h1>
      <p>Need help? Reach us at support@johmacos.com.</p>
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
