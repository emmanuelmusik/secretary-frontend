import { useEffect, useRef, useState } from 'react';
import { api } from '../lib/api.js';
import { useI18n } from '../i18n/index.jsx';
import { descendantIds, folderPath } from '../lib/folders.js';
import { exportPdf } from '../lib/pdf.js';
import { formatSeconds } from '../lib/format.js';

// The ⋮ menu on a folder: rename, delete (contents move up one level) and export everything inside as a PDF.
export default function FolderMenu({ folder, folders, onChanged, onDeleted }) {
  const { t, formatDate } = useI18n();
  const [open, setOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(folder.name);
  const [busy, setBusy] = useState('');
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [open]);

  function stop(e) { e.preventDefault(); e.stopPropagation(); }

  async function doRename(e) {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      await api.renameFolder(folder.id, name.trim());
      setRenaming(false);
      onChanged?.();
    } catch (err) { alert(err.message); }
  }

  async function doDelete() {
    setOpen(false);
    if (!confirm(t('folders.delete_confirm'))) return;
    try {
      await api.deleteFolder(folder.id);
      onDeleted ? onDeleted() : onChanged?.();
    } catch (err) { alert(err.message); }
  }

  async function doExport() {
    setOpen(false);
    setBusy(t('folders.exporting'));
    try {
      const ids = [folder.id, ...descendantIds(folders, folder.id)];
      const blocks = [{ type: 'title', text: folder.name }];
      let any = false;
      for (const id of ids) {
        const [sessions, notes] = await Promise.all([api.getSessions(id), api.getNotes(id)]);
        if (!sessions.length && !notes.length) continue;
        any = true;
        if (ids.length > 1) {
          if (blocks.length > 1) blocks.push({ type: 'break' });
          blocks.push({ type: 'meta', text: folderPath(folders, id).map((f) => f.name).join(' › ') });
        }
        for (const s of [...sessions].reverse()) {
          blocks.push({ type: 'h1', text: s.name || t('folders.untitled') });
          const dur = s.duration_seconds ? ` · ${formatSeconds(t, s.duration_seconds)}` : '';
          blocks.push({ type: 'meta', text: `${formatDate(s.created_at)}${dur}` });
          const a = s.analysis;
          if (a?.summary) { blocks.push({ type: 'h2', text: t('insight.summary') }); blocks.push({ type: 'text', text: a.summary }); }
          if (a?.key_points?.length) { blocks.push({ type: 'h2', text: t('insight.key_points') }); blocks.push({ type: 'text', text: a.key_points.map((p) => `• ${p}`).join('\n') }); }
          if (a?.action_items?.length) { blocks.push({ type: 'h2', text: t('insight.action_items') }); blocks.push({ type: 'text', text: a.action_items.map((x) => `• ${x.item}${x.owner ? ` — ${x.owner}` : ''}`).join('\n') }); }
          if (s.raw_transcript) { blocks.push({ type: 'h2', text: t('folders.pdf_transcript') }); blocks.push({ type: 'text', text: s.raw_transcript }); }
          blocks.push({ type: 'text', text: '' });
        }
        for (const n of notes) {
          blocks.push({ type: 'h1', text: n.title || t('notes.untitled') });
          blocks.push({ type: 'meta', text: formatDate(n.updated_at || n.created_at) });
          if (n.body) blocks.push({ type: 'text', text: n.body });
          blocks.push({ type: 'text', text: '' });
        }
      }
      if (!any) { alert(t('folders.export_empty')); return; }
      await exportPdf(folder.name, blocks);
    } catch (err) {
      if (err?.message !== 'Share canceled') alert(t('folders.export_failed'));
      console.error('[folders] export failed', err);
    } finally { setBusy(''); }
  }

  return (
    <span className="folder-menu" ref={ref} onClick={stop}>
      <button type="button" className="folder-menu-btn" aria-label={t('folders.menu')} aria-expanded={open} onClick={(e) => { stop(e); setOpen((o) => !o); }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="12" cy="5" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="12" cy="19" r="2" /></svg>
      </button>
      {open && (
        <div className="folder-menu-pop" role="menu">
          <button type="button" role="menuitem" onClick={() => { setOpen(false); setName(folder.name); setRenaming(true); }}>{t('folders.rename')}</button>
          <button type="button" role="menuitem" onClick={doExport}>{t('folders.export_pdf')}</button>
          <button type="button" role="menuitem" className="danger" onClick={doDelete}>{t('common.delete')}</button>
        </div>
      )}
      {busy && <div className="dialog-backdrop"><div className="dialog-card"><p>{busy}</p></div></div>}
      {renaming && (
        <div className="dialog-backdrop" onClick={() => setRenaming(false)}>
          <form className="dialog-card" onClick={(e) => e.stopPropagation()} onSubmit={doRename}>
            <h2>{t('folders.rename_title')}</h2>
            <input autoFocus value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
            <div className="dialog-actions">
              <button type="button" onClick={() => setRenaming(false)}>{t('common.cancel')}</button>
              <button type="submit" className="primary">{t('common.save')}</button>
            </div>
          </form>
        </div>
      )}
    </span>
  );
}
