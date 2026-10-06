import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useI18n } from '../i18n/index.jsx';

export default function SaveSessionPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { state } = useLocation();
  const { t, formatDate } = useI18n();
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
    return t('save.default_name', { date: formatDate(new Date()) });
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
      <h1>{t('save.title')}</h1>
      {state?.limitReached && (
        <div className="warning limit-banner">
          <p>{t('limit.banner')}</p>
          <button type="button" className="link-button" onClick={() => navigate('/paywall', { state: { limitReached: true } })}>{t('usage.upgrade')}</button>
        </div>
      )}

      <label>
        {t('save.name')}
        <input value={name} onChange={(e) => setName(e.target.value)} />
      </label>

      <label>
        {t('save.folder')}
        {!creatingFolder ? (
          <>
            <select value={folderId} onChange={(e) => setFolderId(e.target.value)}>
              <option value="">{t('save.unfiled')}</option>
              {folders.map((f) => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
            <button type="button" onClick={() => setCreatingFolder(true)}>{t('save.new_folder')}</button>
          </>
        ) : (
          <>
            <input
              placeholder={t('save.new_folder_placeholder')}
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
            />
            <button type="button" onClick={() => setCreatingFolder(false)}>{t('common.cancel')}</button>
          </>
        )}
      </label>

      <button className="save-btn" onClick={handleSave}>{t('common.save')}</button>
    </div>
  );
}
