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

  return (
    <div className="folders-page">
      <h1>Folders</h1>
      <div className="new-folder">
        <input placeholder="New folder name" value={newName} onChange={(e) => setNewName(e.target.value)} />
        <button onClick={handleCreate}>Create</button>
      </div>
      {folders.map((f) => (
        <Link key={f.id} to={`/folders/${f.id}`} className="folder-row">{f.name}</Link>
      ))}
    </div>
  );
}
