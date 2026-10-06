import { useNavigate } from 'react-router-dom';
import { useI18n } from '../i18n/index.jsx';

export default function PrivacyPage() {
  const navigate = useNavigate();
  const { t, lang } = useI18n();
  const goBack = () => (window.history.length > 1 ? navigate(-1) : navigate('/auth'));
  return (
    <div className="static-page legal">
      <button type="button" className="back-link" onClick={goBack}><span className="back-arrow">←</span> {t('common.back')}</button>
      <h1>{t('nav.privacy')}</h1>
      {lang !== 'en' && <p className="meta legal-notice">{t('privacy.notice')}</p>}
      <div lang="en" dir="ltr">
      <p className="meta">Secretary – Live Transcriber · Last updated 6 October 2026</p>

      <p>
        Secretary is made by The Johmacos (Ndubuisi Ukwuani), Vienna, Austria. This policy explains what
        the app collects, who it is shared with, how long it is kept, and the choices you have.
        Questions or requests: <a href="mailto:emmanuelmusik7@gmail.com">emmanuelmusik7@gmail.com</a>.
      </p>

      <h2>What we collect</h2>
      <ul>
        <li><strong>Account details:</strong> your email address and sign-in method (email and password, Sign in with Apple, or Google). If you use Apple's "Hide My Email", we only see Apple's relay address.</li>
        <li><strong>Recordings you make or upload:</strong> the audio is processed to produce a transcript. We do not keep a copy of your audio on our servers. A recording you make in the app is saved on your own device only.</li>
        <li><strong>Content in your account:</strong> transcripts, translations, insights, folders and notes.</li>
        <li><strong>Business cards you scan:</strong> the details read from the card (name, job title, company, emails, phone numbers, website, address, notes) and a small thumbnail of the card photo, so you can see the card later. These are other people's details; please only scan cards you are entitled to keep.</li>
        <li><strong>Plan and usage:</strong> whether you have a Pro subscription and how many minutes you have recorded or transcribed each month, so that we can apply the limits of your plan. The app also creates a random install ID (not linked to your device hardware or to other apps) so that the free monthly allowance is applied once per phone.</li>
        <li><strong>Technical logs:</strong> our servers keep short-lived operational logs (for example error messages) to keep the service running.</li>
      </ul>
      <p>We do not use advertising, we do not track you across other apps or websites, and we do not use third-party analytics.</p>

      <h2>Who processes your data</h2>
      <p>To provide the app we use these services. Each receives only what it needs for its job:</p>
      <ul>
        <li><strong>Deepgram</strong> – receives the audio you record or upload, to convert speech to text.</li>
        <li><strong>xAI (Grok)</strong> – receives transcript text to write insights and translations, and receives photos of business cards to read the details on them.</li>
        <li><strong>RevenueCat</strong> – manages subscription purchases made through Apple. It receives your account ID and the status of your purchases. Apple processes the payment; we never see your payment details.</li>
        <li><strong>Supabase</strong> – stores your account and the content described above in a database.</li>
        <li><strong>Railway and Vercel</strong> – host our server and our web app, so your data passes through them in transit.</li>
      </ul>
      <p>
        The app asks for your permission before it first sends any audio, text or card photo to Deepgram or xAI.
        We do not sell your data. We require the services above to protect it, and their own privacy policies
        describe how they handle it.
      </p>

      <h2>Permissions on your device</h2>
      <ul>
        <li><strong>Microphone</strong> – to record meetings, classes and voice notes.</li>
        <li><strong>Camera</strong> – to scan business cards, and to attach a video when you upload a file to transcribe.</li>
        <li><strong>Photos / files</strong> – only the specific photo, video or audio file you choose.</li>
      </ul>

      <h2>How long we keep it, and deleting it</h2>
      <p>
        Your content stays in your account until you delete it. You can delete a recording, note or card at any time
        inside the app. You can delete your whole account in Settings → Delete Account, which permanently removes your
        account and everything stored in it from our database. Audio saved on your device is not affected by this and
        can be removed from the app or by deleting the app. Copies held briefly by the services above while they process
        a request are governed by their own policies.
      </p>

      <h2>Your rights and choices</h2>
      <p>
        You can ask us to access, correct or delete your data, and you can withdraw your permission for AI processing at any time
        by deleting your data or your account, or by simply not using the recording, upload and card-scanning features.
        If you are in the European Economic Area you also have the right to object to or restrict processing and to
        complain to your data protection authority (in Austria, the Datenschutzbehörde).
      </p>

      <h2>Children</h2>
      <p>Secretary is not directed at children under 16 and we do not knowingly collect their data.</p>

      <h2>Security</h2>
      <p>Data is sent over encrypted connections and every account can only read its own content. No system is perfectly secure, so please avoid recording anything you could not share with these services.</p>

      <h2>Changes</h2>
      <p>If we change this policy in a meaningful way we will update the date above and, where appropriate, tell you in the app.</p>
      </div>
    </div>
  );
}
