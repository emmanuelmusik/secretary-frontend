import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useI18n } from '../i18n/index.jsx';

export default function NotesPage() {
  const navigate = useNavigate();
  const { t, formatDate } = useI18n();
  const [notes, setNotes] = useState([]);
  const [query, setQuery] = useState('');

  useEffect(() => { api.getNotes().then(setNotes); }, []);

  async function handleSearch(q) {
    setQuery(q);
    setNotes(q.trim() ? await api.searchNotes(q) : await api.getNotes());
  }

  async function handleNew() {
    const note = await api.createNote({ title: t('notes.untitled'), body: '' });
    navigate(`/notes/${note.id}`);
  }

  return (
    <div className="notes-page">
      <h1>{t('notes.title')}</h1>
      <input placeholder={t('notes.search')} value={query} onChange={(e) => handleSearch(e.target.value)} />
      <button className="new-note-btn" onClick={handleNew}>{t('notes.new')}</button>
      {notes.map((n) => (
        <Link key={n.id} to={`/notes/${n.id}`} className="note-row">
          <strong>{n.title}</strong>
          <span>{formatDate(n.updated_at)}</span>
        </Link>
      ))}
    </div>
  );
}
