import { useMemo } from 'react';
import { useI18n } from '../i18n/index.jsx';
import { MAX_FOLDER_DEPTH, descendantIds, flattenFolders, folderDepth, folderHeight } from '../lib/folders.js';
import { FolderIcon } from './FolderTree.jsx';

// "Move to…" sheet. For a recording or note pass `kind="item"`; for a folder pass `kind="folder"` and `movingId`,
// which switches off the folders it cannot go into (itself, what is inside it, and anything that would nest too deep).
export default function MoveDialog({ folders, currentId, kind = 'item', movingId = null, onPick, onClose }) {
  const { t } = useI18n();
  const rows = useMemo(() => flattenFolders(folders), [folders]);
  const blocked = useMemo(() => {
    const set = new Set();
    if (kind === 'folder' && movingId) {
      set.add(movingId);
      descendantIds(folders, movingId).forEach((d) => set.add(d));
      const h = folderHeight(folders, movingId);
      for (const f of folders) if (folderDepth(folders, f.id) + h > MAX_FOLDER_DEPTH) set.add(f.id);
    }
    return set;
  }, [folders, kind, movingId]);

  const rootLabel = kind === 'folder' ? t('move.top_level') : t('save.unfiled');

  return (
    <div className="dialog-backdrop sheet-backdrop" onClick={onClose}>
      <div className="sheet-card" role="dialog" aria-label={t('move.title')} onClick={(e) => e.stopPropagation()}>
        <h2>{t('move.title')}</h2>
        <div className="sheet-list move-list">
          <button type="button" className={`sheet-pick ${!currentId ? 'on' : ''}`} disabled={!currentId} onClick={() => onPick(null)}>
            <FolderIcon /><span className="sheet-pick-main"><strong>{rootLabel}</strong></span>
          </button>
          {rows.map((f) => {
            const off = blocked.has(f.id);
            return (
              <button
                type="button"
                key={f.id}
                className={`sheet-pick ${f.id === currentId ? 'on' : ''}`}
                style={{ marginInlineStart: (f.depth - 1) * 16 }}
                disabled={off || f.id === currentId}
                onClick={() => onPick(f.id)}
              >
                <FolderIcon /><span className="sheet-pick-main"><strong>{f.name}</strong></span>
              </button>
            );
          })}
        </div>
        {kind === 'folder' && <p className="meta">{t('folders.max_depth')}</p>}
        <button type="button" className="sheet-cancel" onClick={onClose}>{t('common.cancel')}</button>
      </div>
    </div>
  );
}
