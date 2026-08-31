import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';

export default function FoldersPage() {
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
    if (!confirm('Delete this folder? Sessions and notes inside will move to Unfiled, not be deleted.')) return;
    await api.deleteFolder(folderId);
    load();
  }

  return (
    <div className="folders-page">
      <h1>Folders</h1>
      <div className="new-folder">
        <input placeholder="New folder name" value={newName} onChange={(e) => setNewName(e.target.value)} />
        <button onClick={handleCreate}>Create</button>
      </div>
      {folders.map((f) => (
        <Link key={f.id} to={`/folders/${f.id}`} className="folder-row">
          <span>{f.name}</span>
          <button className="danger-btn-sm" onClick={(e) => handleDelete(e, f.id)}>Delete</button>
        </Link>
      ))}
    </div>
  );
}
