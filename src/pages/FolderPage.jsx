import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useI18n } from '../i18n/index.jsx';
import { MAX_FOLDER_DEPTH, folderPath } from '../lib/folders.js';
import FolderMenu from '../components/FolderMenu.jsx';

export default function FolderPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t, formatDate } = useI18n();
  const [folders, setFolders] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const [f, s, n] = await Promise.all([api.getFolders(), api.getSessions(id), api.getNotes(id)]);
      setFolders(f); setSessions(s); setNotes(n);
    } catch (err) { console.error(err); }
    setLoading(false);
  }, [id]);

  useEffect(() => { setLoading(true); load(); }, [load]);

  const path = useMemo(() => folderPath(folders, id), [folders, id]);
  const folder = path[path.length - 1];
  const subfolders = useMemo(() => folders.filter((f) => f.parent_id === id).sort((a, b) => a.name.localeCompare(b.name)), [folders, id]);
  const canNest = path.length < MAX_FOLDER_DEPTH;

  async function handleCreate() {
    if (!newName.trim()) return;
    setError('');
    try {
      await api.createFolder(newName.trim(), id);
      setNewName('');
      load();
    } catch (err) { setError(err.message); }
  }

  if (!loading && !folder) {
    return <div className="folders-page"><p>{t('folders.not_found')}</p></div>;
  }
  if (!folder) return <p>{t('common.loading')}</p>;

  const empty = !subfolders.length && !sessions.length && !notes.length;

  return (
    <div className="folders-page folder-detail">
      <nav className="breadcrumb" aria-label="Folder path">
        <Link to="/folders">{t('folders.title')}</Link>
        {path.map((f, i) => (
          <span key={f.id}>
            <span className="crumb-sep" aria-hidden="true">›</span>
            {i === path.length - 1 ? <strong>{f.name}</strong> : <Link to={`/folders/${f.id}`}>{f.name}</Link>}
          </span>
        ))}
      </nav>
      <div className="folder-title-row">
        <h1>{folder.name}</h1>
        <FolderMenu folder={folder} folders={folders} onChanged={load} onDeleted={() => navigate(folder.parent_id ? `/folders/${folder.parent_id}` : '/folders', { replace: true })} />
      </div>

      {canNest && (
        <div className="new-folder">
          <input placeholder={t('folders.sub_placeholder')} value={newName} onChange={(e) => setNewName(e.target.value)} />
          <button onClick={handleCreate}>{t('folders.new_sub')}</button>
        </div>
      )}
      {error && <p className="warning">{error}</p>}
      {!canNest && <p className="folder-hint">{t('folders.max_depth')}</p>}

      {subfolders.length > 0 && <h2 className="folder-section">{t('folders.subfolders')}</h2>}
      {subfolders.map((f) => (
        <div key={f.id} className="folder-row-wrap">
          <Link to={`/folders/${f.id}`} className="folder-row"><span className="folder-name">{f.name}</span></Link>
          <FolderMenu folder={f} folders={folders} onChanged={load} />
        </div>
      ))}

      {sessions.length > 0 && <h2 className="folder-section">{t('folders.recordings')}</h2>}
      {sessions.map((s) => (
        <Link key={s.id} to={`/sessions/${s.id}`} className="session-row">
          <span className="session-row-main"><strong>{s.name}</strong></span>
          <span className="session-row-right">{formatDate(s.created_at)}</span>
        </Link>
      ))}

      {notes.length > 0 && <h2 className="folder-section">{t('folders.notes')}</h2>}
      {notes.map((n) => (
        <Link key={n.id} to={`/notes/${n.id}`} className="note-row">
          <strong>{n.title}</strong>
          <span>{formatDate(n.updated_at)}</span>
        </Link>
      ))}

      {!loading && empty && <p className="folder-hint">{t('folders.empty')}</p>}
    </div>
  );
}
