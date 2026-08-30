import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api.js';

export default function SaveSessionPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [folders, setFolders] = useState([]);
  const [folderId, setFolderId] = useState('');
  const [newFolderName, setNewFolderName] = useState('');
  const [creatingFolder, setCreatingFolder] = useState(false);

  useEffect(() => {
    api.getSession(id).then((s) => setName(s.name === 'Untitled Session' ? defaultName() : s.name));
    api.getFolders().then(setFolders);
  }, [id]);

  function defaultName() {
    return `Session – ${new Date().toLocaleDateString()}`;
  }

  async function handleSave() {
    let finalFolderId = folderId || null;

    if (creatingFolder && newFolderName.trim()) {
      const folder = await api.createFolder(newFolderName.trim());
      finalFolderId = folder.id;
    }

    await api.saveSession(id, { name: name.trim() || defaultName(), folder_id: finalFolderId });
    navigate(`/sessions/${id}`);
  }

  return (
    <div className="save-page">
      <h1>Save Session</h1>

      <label>
        Name
        <input value={name} onChange={(e) => setName(e.target.value)} />
      </label>

      <label>
        Folder
        {!creatingFolder ? (
          <>
            <select value={folderId} onChange={(e) => setFolderId(e.target.value)}>
              <option value="">Unfiled</option>
              {folders.map((f) => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
            <button type="button" onClick={() => setCreatingFolder(true)}>+ New Folder</button>
          </>
        ) : (
          <>
            <input
              placeholder="New folder name"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
            />
            <button type="button" onClick={() => setCreatingFolder(false)}>Cancel</button>
          </>
        )}
      </label>

      <button className="save-btn" onClick={handleSave}>Save</button>
    </div>
  );
}
