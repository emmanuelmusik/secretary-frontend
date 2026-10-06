import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams, Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import { shareVCard } from '../lib/vcard.js';
import CopyButton from '../components/CopyButton.jsx';

const EMPTY = { name: '', job_title: '', company: '', emails: [], phones: [], website: '', address: '', notes: '' };
const toLines = (arr) => (arr || []).join('\n');
const fromLines = (text) => text.split('\n').map((x) => x.trim()).filter(Boolean);

function cardText(f) {
  return [
    f.name, [f.job_title, f.company].filter(Boolean).join(', '),
    ...fromLines(f.phones), ...fromLines(f.emails), f.website, f.address,
  ].filter(Boolean).join('\n');
}

export default function CardEditorPage() {
  const { id } = useParams();
  const { state } = useLocation();
  const navigate = useNavigate();
  const isNew = !id;

  const [form, setForm] = useState(() => {
    const c = state?.card || EMPTY;
    return { ...EMPTY, ...c, emails: toLines(c.emails), phones: toLines(c.phones) };
  });
  const [thumb, setThumb] = useState(state?.thumb || null);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const duplicate = state?.duplicate;

  useEffect(() => {
    if (isNew) return;
    api.getCards()
      .then((all) => {
        const c = all.find((x) => x.id === id);
        if (!c) { navigate('/cards', { replace: true }); return; }
        setForm({ ...EMPTY, ...c, emails: toLines(c.emails), phones: toLines(c.phones) });
        setThumb(c.image_thumb || null);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const payload = () => ({ ...form, emails: fromLines(form.emails), phones: fromLines(form.phones) });

  async function handleSave() {
    setSaving(true);
    setError('');
    try {
      if (isNew) await api.createCard({ ...payload(), image_thumb: thumb });
      else await api.updateCard(id, payload());
      navigate('/cards');
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm('Delete this card permanently?')) return;
    await api.deleteCard(id);
    navigate('/cards');
  }

  async function handleContacts() {
    try { await shareVCard(payload()); }
    catch (err) { if (err?.message !== 'Share canceled') setError(err.message || 'Could not share this contact.'); }
  }

  if (loading) return <div className="loading-screen">Loading…</div>;

  const firstPhone = fromLines(form.phones)[0];
  const firstEmail = fromLines(form.emails)[0];
  const site = form.website && (/^https?:\/\//i.test(form.website) ? form.website : `https://${form.website}`);

  return (
    <div className="card-editor">
      <div className="session-detail-header">
        <h1>{isNew ? (state?.card ? 'Review card' : 'New card') : 'Card'}</h1>
        {!isNew && <button className="danger-btn-sm" onClick={handleDelete}>Delete</button>}
      </div>

      {isNew && state?.card && (
        <p className="meta">Check the details below, fix anything that was misread, then save.</p>
      )}

      {duplicate && (
        <div className="duplicate-note">
          You may already have this person saved: <Link to={`/cards/${duplicate.id}`}>{duplicate.name || duplicate.company || 'open card'}</Link>.
        </div>
      )}

      {thumb && <img className="card-photo" src={thumb} alt="Scanned business card" />}

      {!isNew && (
        <div className="card-actions">
          {firstPhone && <a className="action-chip" href={`tel:${firstPhone.replace(/[^\d+]/g, '')}`}>Call</a>}
          {firstEmail && <a className="action-chip" href={`mailto:${firstEmail}`}>Email</a>}
          {site && <a className="action-chip" href={site} target="_blank" rel="noreferrer">Website</a>}
          <button className="action-chip" onClick={handleContacts}>Add to Contacts</button>
          <CopyButton text={() => cardText(form)} label="Copy details" />
        </div>
      )}

      <label>Name<input value={form.name} onChange={set('name')} autoComplete="off" /></label>
      <label>Job title<input value={form.job_title} onChange={set('job_title')} autoComplete="off" /></label>
      <label>Company<input value={form.company} onChange={set('company')} autoComplete="off" /></label>
      <label>Phone numbers <small>(one per line)</small>
        <textarea rows={2} value={form.phones} onChange={set('phones')} />
      </label>
      <label>Emails <small>(one per line)</small>
        <textarea rows={2} value={form.emails} onChange={set('emails')} />
      </label>
      <label>Website<input value={form.website} onChange={set('website')} autoCapitalize="none" autoComplete="off" /></label>
      <label>Address<textarea rows={2} value={form.address} onChange={set('address')} /></label>
      <label>Notes<textarea rows={3} value={form.notes} onChange={set('notes')} /></label>

      {error && <p className="form-error">{error}</p>}

      <button className="save-btn" onClick={handleSave} disabled={saving}>
        {saving ? 'Saving…' : isNew ? 'Save card' : 'Save changes'}
      </button>
    </div>
  );
}
