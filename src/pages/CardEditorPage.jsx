import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams, Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import { shareVCard } from '../lib/vcard.js';
import CopyButton from '../components/CopyButton.jsx';
import { useI18n } from '../i18n/index.jsx';

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
  const { t } = useI18n();
  const isNew = !id;

  const [form, setForm] = useState(() => {
    const c = state?.card || EMPTY;
    return { ...EMPTY, ...c, emails: toLines(c.emails), phones: toLines(c.phones) };
  });
  const [thumb, setThumb] = useState(state?.thumb || null);
  const [thumbBack, setThumbBack] = useState(state?.thumbBack || null);
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
        setThumbBack(c.image_thumb_back || null);
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
      if (isNew) await api.createCard({ ...payload(), image_thumb: thumb, image_thumb_back: thumbBack });
      else await api.updateCard(id, payload());
      navigate('/cards');
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm(t('card.delete_confirm'))) return;
    await api.deleteCard(id);
    navigate('/cards');
  }

  async function handleContacts() {
    try { await shareVCard(payload()); }
    catch (err) { if (err?.message !== 'Share canceled') setError(err.message || t('card.share_failed')); }
  }

  if (loading) return <div className="loading-screen">{t('common.loading')}</div>;

  const firstPhone = fromLines(form.phones)[0];
  const firstEmail = fromLines(form.emails)[0];
  const site = form.website && (/^https?:\/\//i.test(form.website) ? form.website : `https://${form.website}`);

  return (
    <div className="card-editor">
      <div className="session-detail-header">
        <h1>{isNew ? (state?.card ? t('card.title_review') : t('card.title_new')) : t('card.title')}</h1>
        {!isNew && <button className="danger-btn-sm" onClick={handleDelete}>{t('common.delete')}</button>}
      </div>

      {isNew && state?.card && (
        <p className="meta">{t('card.review_hint')}</p>
      )}

      {duplicate && (
        <div className="duplicate-note">
          {t('card.duplicate')} <Link to={`/cards/${duplicate.id}`}>{duplicate.name || duplicate.company || t('card.duplicate_open')}</Link>.
        </div>
      )}

      {(thumb || thumbBack) && (
        <div className="card-photos">
          {thumb && <img className="card-photo" src={thumb} alt={t('card.front')} />}
          {thumbBack && <img className="card-photo" src={thumbBack} alt={t('card.back')} />}
        </div>
      )}

      {!isNew && (
        <div className="card-actions">
          {firstPhone && <a className="action-chip" href={`tel:${firstPhone.replace(/[^\d+]/g, '')}`}>{t('card.call')}</a>}
          {firstEmail && <a className="action-chip" href={`mailto:${firstEmail}`}>{t('card.email')}</a>}
          {site && <a className="action-chip" href={site} target="_blank" rel="noreferrer">{t('card.website')}</a>}
          <button className="action-chip" onClick={handleContacts}>{t('card.contacts')}</button>
          <CopyButton text={() => cardText(form)} label={t('copy.details')} />
        </div>
      )}

      <label>{t('card.name')}<input value={form.name} onChange={set('name')} autoComplete="off" /></label>
      <label>{t('card.job')}<input value={form.job_title} onChange={set('job_title')} autoComplete="off" /></label>
      <label>{t('card.company')}<input value={form.company} onChange={set('company')} autoComplete="off" /></label>
      <label>{t('card.phones')} <small>{t('card.one_per_line')}</small>
        <textarea rows={2} value={form.phones} onChange={set('phones')} />
      </label>
      <label>{t('card.emails')} <small>{t('card.one_per_line')}</small>
        <textarea rows={2} value={form.emails} onChange={set('emails')} />
      </label>
      <label>{t('card.website')}<input value={form.website} onChange={set('website')} autoCapitalize="none" autoComplete="off" /></label>
      <label>{t('card.address')}<textarea rows={2} value={form.address} onChange={set('address')} /></label>
      <label>{t('card.notes')}<textarea rows={3} value={form.notes} onChange={set('notes')} /></label>

      {error && <p className="form-error">{error}</p>}

      <button className="save-btn" onClick={handleSave} disabled={saving}>
        {saving ? t('card.saving') : isNew ? t('card.save_new') : t('card.save_changes')}
      </button>
    </div>
  );
}
