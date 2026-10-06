import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useI18n } from '../i18n/index.jsx';

export default function FoldersPage() {
  const { t } = useI18n();
  const [folders, setFolders] = useState([]);
  const [newName, setNewName] = useState('');

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

  async function handleDelete(e, folderId) {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm(t('folders.delete_confirm'))) return;
    await api.deleteFolder(folderId);
    load();
  }

  return (
    <div className="folders-page">
      <h1>{t('folders.title')}</h1>
      <div className="new-folder">
        <input placeholder={t('folders.new_placeholder')} value={newName} onChange={(e) => setNewName(e.target.value)} />
        <button onClick={handleCreate}>{t('folders.create')}</button>
      </div>
      {folders.map((f) => (
        <Link key={f.id} to={`/folders/${f.id}`} className="folder-row">
          <span>{f.name}</span>
          <button className="danger-btn-sm" onClick={(e) => handleDelete(e, f.id)}>{t('common.delete')}</button>
        </Link>
      ))}
    </div>
  );
}
