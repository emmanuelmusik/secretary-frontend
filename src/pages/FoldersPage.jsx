import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useI18n } from '../i18n/index.jsx';
import { flattenFolders } from '../lib/folders.js';
import FolderMenu from '../components/FolderMenu.jsx';

export default function FoldersPage() {
  const { t } = useI18n();
  const [folders, setFolders] = useState([]);
  const [newName, setNewName] = useState('');
  const rows = useMemo(() => flattenFolders(folders), [folders]);

  useEffect(() => { load(); }, []);

  async function load() {
    setFolders(await api.getFolders());
  }

  async function handleCreate() {
    if (!newName.trim()) return;
    await api.createFolder(newName.trim());
    setNewName('');
    load();
  }

  return (
    <div className="folders-page">
      <h1>{t('folders.title')}</h1>
      <div className="new-folder">
        <input placeholder={t('folders.new_placeholder')} value={newName} onChange={(e) => setNewName(e.target.value)} />
        <button onClick={handleCreate}>{t('folders.create')}</button>
      </div>
      {rows.map((f) => (
        <div key={f.id} className="folder-row-wrap" style={{ marginInlineStart: (f.depth - 1) * 18 }}>
          <Link to={`/folders/${f.id}`} className="folder-row">
            <span className="folder-name">{f.name}</span>
          </Link>
          <FolderMenu folder={f} folders={folders} onChanged={load} />
        </div>
      ))}
    </div>
  );
}
