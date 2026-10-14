import { useState } from 'react';
import { api } from '../lib/api.js';
import { useI18n } from '../i18n/index.jsx';
import RowMenu from './RowMenu.jsx';
import RenameDialog from './RenameDialog.jsx';
import MoveDialog from './MoveDialog.jsx';

// Rename / Move to / Delete for a recording or a note in a list. Use `menu(kind, item)` for the ⋮ button and
// render `dialogs` once. `onDone` runs after any change so the list can refresh.
export function useItemActions({ folders, onDone }) {
  const { t } = useI18n();
  const [renaming, setRenaming] = useState(null); // { kind, item }
  const [moving, setMoving] = useState(null);

  async function run(fn) {
    try { await fn(); onDone?.(); } catch (err) { alert(err.message); }
  }

  const menu = (kind, item) => (
    <RowMenu label={t('folders.menu')} items={[
      { label: t('folders.rename'), onClick: () => setRenaming({ kind, item }) },
      { label: t('move.to'), onClick: () => setMoving({ kind, item }) },
      { label: t('common.delete'), danger: true, onClick: () => {
        if (!confirm(t(kind === 'session' ? 'session.delete_confirm' : 'notes.delete_confirm'))) return;
        run(() => (kind === 'session' ? api.deleteSession(item.id) : api.deleteNote(item.id)));
      } },
    ]} />
  );

  const dialogs = (
    <>
      {renaming && (
        <RenameDialog
          t={t}
          title={t(renaming.kind === 'session' ? 'session.rename_title' : 'notes.rename_title')}
          initial={renaming.kind === 'session' ? renaming.item.name : renaming.item.title}
          onClose={() => setRenaming(null)}
          onSave={async (name) => {
            const { kind, item } = renaming;
            setRenaming(null);
            await run(() => (kind === 'session' ? api.saveSession(item.id, { name }) : api.updateNote(item.id, { title: name })));
          }}
        />
      )}
      {moving && (
        <MoveDialog
          folders={folders}
          currentId={moving.item.folder_id}
          onClose={() => setMoving(null)}
          onPick={(folderId) => {
            const { kind, item } = moving;
            setMoving(null);
            run(() => (kind === 'session' ? api.saveSession(item.id, { folder_id: folderId }) : api.updateNote(item.id, { folder_id: folderId })));
          }}
        />
      )}
    </>
  );

  return { menu, dialogs };
}
