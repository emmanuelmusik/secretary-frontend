import { useNavigate } from 'react-router-dom';

const FAQ = [
  ['How do I record a meeting or class?',
    'Tap the red Record button, choose Meeting / Classroom or Quick Capture on the Home screen, then Start Recording. Recording stops after 3 hours at a stretch. When you stop, choose a folder and a name to save it.'],
  ['Can I transcribe a file I already have?',
    'Yes. On the Home screen choose Upload, then pick an audio or video file. It is transcribed and saved like a live recording.'],
  ['Where is my audio stored?',
    'Audio you record in the app is saved only on your device. It is not kept on our servers, it does not sync between devices, and it is removed if you delete the app. You can share a saved recording from its Audio tab.'],
  ['How does translation work?',
    'Open a recording, go to the Translation tab, pick a language and tap Translate. You can also choose a language before you record to see a live translation as you go.'],
  ['What is an Insight?',
    'An Insight is a short AI-written summary with key points, action items, decisions, questions raised and, when there are any, quotable quotes taken word for word from the recording. Open a recording and tap Generate Insight.'],
  ['What does "Analyze with History" do?',
    'For a recording that is in a folder, it compares it with earlier recordings in the same folder and highlights recurring themes, progress and open action items.'],
  ['How do I scan a business card?',
    'Open Cards and tap Scan a card, or choose From photos. Check the details that were read, fix anything wrong, then save. You can search your cards and add one to your phone contacts from its page.'],
  ['How do I copy a transcript or insight?',
    'Tap the copy icon at the top of the transcript, translation or insight. Each quote has its own copy icon.'],
  ['How do I delete my data or my account?',
    'Delete a recording, note or card from its own page. To delete your whole account and everything in it, open the menu, choose Settings, then Delete Account.'],
  ['Which services see my data?',
    'Audio goes to Deepgram for transcription. Transcript text and card photos go to xAI for insights, translations and reading cards. The app asks your permission first. Full details are in the Privacy Policy.'],
];

export default function SupportPage() {
  const navigate = useNavigate();
  const goBack = () => (window.history.length > 1 ? navigate(-1) : navigate('/auth'));
  return (
    <div className="static-page legal">
      <button type="button" className="back-link" onClick={goBack}>&larr; Back</button>
      <h1>Support Center</h1>
      <p>
        Need help, found a problem, or want something deleted? Email{' '}
        <a href="mailto:emmanuelmusik7@gmail.com">emmanuelmusik7@gmail.com</a> and we will get back to you.
      </p>
      <h2>Frequently asked questions</h2>
      {FAQ.map(([q, a]) => (
        <details className="faq-item" key={q}>
          <summary>{q}</summary>
          <p>{a}</p>
        </details>
      ))}
    </div>
  );
}
