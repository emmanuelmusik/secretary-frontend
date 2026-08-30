import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';

export default function NotesPage() {
  const navigate = useNavigate();
  const [notes, setNotes] = useState([]);
  const [query, setQuery] = useState('');

  useEffect(() => { api.getNotes().then(setNotes); }, []);

  async function handleSearch(q) {
    setQuery(q);
    setNotes(q.trim() ? await api.searchNotes(q) : await api.getNotes());
  }

  async function handleNew() {
    const note = await api.createNote({ title: 'Untitled Note', body: '' });
    navigate(`/notes/${note.id}`);
  }

  return (
    <div className="notes-page">
      <h1>Notepad</h1>
      <input placeholder="Search notes…" value={query} onChange={(e) => handleSearch(e.target.value)} />
      <button className="new-note-btn" onClick={handleNew}>+ New Note</button>
      {notes.map((n) => (
        <Link key={n.id} to={`/notes/${n.id}`} className="note-row">
          <strong>{n.title}</strong>
          <span>{new Date(n.updated_at).toLocaleDateString()}</span>
        </Link>
      ))}
    </div>
  );
}
