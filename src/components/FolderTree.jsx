import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import FolderMenu from './FolderMenu.jsx';
import Highlight from './Highlight.jsx';
import { useI18n } from '../i18n/index.jsx';
import { norm } from '../lib/search.js';

const KEY = 'secretary_folders_open_v1';
function loadOpen() {
  try { return new Set(JSON.parse(localStorage.getItem(KEY) || '[]')); } catch { return new Set(); }
}
function saveOpen(set) {
  try { localStorage.setItem(KEY, JSON.stringify([...set])); } catch { /* storage can be unavailable */ }
}

export function FolderIcon() {
  return (
    <svg className="ftree-icon" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 6.5a1.5 1.5 0 011.5-1.5h4.6l2 2.2h8.4A1.5 1.5 0 0121 8.7v9.8a1.5 1.5 0 01-1.5 1.5h-15A1.5 1.5 0 013 18.5v-12z" />
    </svg>
  );
}

// Folders as a tree: a chevron opens or closes the subfolders, which hang under their parent on a line.
// `rootId` null shows every top-level folder; a folder id shows only what is inside that folder.
export default function FolderTree({ folders, rootId = null, query = '', onChanged }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(loadOpen);
  const q = norm(query.trim());

  const kids = useMemo(() => {
    const ids = new Set(folders.map((f) => f.id));
    const map = new Map();
    for (const f of folders) {
      const p = f.parent_id && ids.has(f.parent_id) ? f.parent_id : null;
      if (!map.has(p)) map.set(p, []);
      map.get(p).push(f);
    }
    for (const list of map.values()) list.sort((a, b) => a.name.localeCompare(b.name));
    return map;
  }, [folders]);

  // While searching: keep a folder if its name matches or something inside it does, and open the path to it.
  const visible = useMemo(() => {
    if (!q) return null;
    const keep = new Set();
    const walk = (id) => {
      let any = false;
      for (const f of kids.get(id) || []) {
        const inner = walk(f.id);
        if (inner || norm(f.name).includes(q)) { keep.add(f.id); any = true; }
      }
      return any;
    };
    walk(rootId);
    return keep;
  }, [q, kids, rootId]);

  function toggle(id) {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      saveOpen(next);
      return next;
    });
  }

  function renderLevel(parentId) {
    const list = (kids.get(parentId) || []).filter((f) => !visible || visible.has(f.id));
    return list.map((f) => {
      const children = (kids.get(f.id) || []).filter((c) => !visible || visible.has(c.id));
      const hasKids = (kids.get(f.id) || []).length > 0;
      const isOpen = visible ? children.length > 0 : open.has(f.id);
      return (
        <div key={f.id} className="ftree-item">
          <div className="ftree-row">
            {hasKids ? (
              <button type="button" className="ftree-chevron" aria-expanded={isOpen} aria-label={isOpen ? t('folders.collapse') : t('folders.expand')} onClick={() => toggle(f.id)}>
                <svg className={isOpen ? 'open' : ''} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>
              </button>
            ) : <span className="ftree-spacer" />}
            <Link to={`/folders/${f.id}`} className="ftree-link">
              <FolderIcon />
              <span className="ftree-name"><Highlight text={f.name} query={query} /></span>
            </Link>
            <FolderMenu folder={f} folders={folders} onChanged={onChanged} />
          </div>
          {isOpen && children.length > 0 && <div className="ftree-children">{renderLevel(f.id)}</div>}
        </div>
      );
    });
  }

  const rows = renderLevel(rootId);
  if (q && rows.length === 0) return <p className="folder-hint">{t('folders.no_match')}</p>;
  return <div className="ftree">{rows}</div>;
}
