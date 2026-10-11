import { useState } from 'react';

// Small "rename" popup used for recordings. onSave receives the trimmed new name.
export default function RenameDialog({ t, title, initial, onSave, onClose }) {
  const [name, setName] = useState(initial || '');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    const n = name.replace(/\s+/g, ' ').trim();
    if (!n || busy) return;
    if (n === initial) { onClose(); return; }
    setBusy(true);
    try { await onSave(n); } finally { setBusy(false); }
  }

  return (
    <div className="dialog-backdrop" onClick={(e) => { e.stopPropagation(); e.preventDefault(); onClose(); }}>
      <form className="dialog-card" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <h2>{title}</h2>
        <input autoFocus value={name} onChange={(e) => setName(e.target.value)} maxLength={200} />
        <div className="dialog-actions">
          <button type="button" onClick={onClose}>{t('common.cancel')}</button>
          <button type="submit" className="primary" disabled={busy || !name.trim()}>{t('common.save')}</button>
        </div>
      </form>
    </div>
  );
}
