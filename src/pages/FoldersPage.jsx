import { useEffect, useRef, useState } from 'react';
import { api } from '../lib/api.js';
import { useI18n } from '../i18n/index.jsx';
import FolderTree, { FolderIcon } from '../components/FolderTree.jsx';

export default function FoldersPage() {
  const { t } = useI18n();
  const [folders, setFolders] = useState([]);
  const [newName, setNewName] = useState('');
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState('');
  const newRef = useRef(null);
  const searchRef = useRef(null);

  useEffect(() => { load(); }, []);

  async function load() {
    setFolders(await api.getFolders());
  }

  async function handleCreate(e) {
    e?.preventDefault();
    if (!newName.trim()) { newRef.current?.focus(); return; }
    await api.createFolder(newName.trim());
    setNewName('');
    load();
  }

  function toggleSearch() {
    setSearching((s) => {
      if (s) setQuery('');
      else setTimeout(() => searchRef.current?.focus(), 0);
      return !s;
    });
  }

  return (
    <div className="folders-page">
      <div className="folders-head">
        <h1>{t('folders.title')}</h1>
        <button type="button" className="folders-icon-btn" aria-label={t('folders.search')} aria-pressed={searching} onClick={toggleSearch}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
        </button>
        <button type="button" className="folders-create-btn" onClick={() => { newRef.current?.focus(); newRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' }); }}>
          <span aria-hidden="true">+</span> {t('folders.create')}
        </button>
      </div>

      {searching && (
        <input ref={searchRef} className="folders-search" type="search" enterKeyHint="search" placeholder={t('folders.search')} value={query} onChange={(e) => setQuery(e.target.value)} aria-label={t('folders.search')} />
      )}

      <form className="ftree-new" onSubmit={handleCreate}>
        <FolderIcon />
        <input ref={newRef} placeholder={t('folders.new_placeholder')} value={newName} onChange={(e) => setNewName(e.target.value)} maxLength={80} />
        <button type="submit">{t('folders.create')}</button>
      </form>

      <FolderTree folders={folders} query={query} onChanged={load} />
    </div>
  );
}
