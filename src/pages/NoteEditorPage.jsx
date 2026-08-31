import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import { supabase } from '../lib/supabase.js';
import { api } from '../lib/api.js';

const WS_BASE = (import.meta.env.VITE_API_BASE || 'http://localhost:3000').replace(/^http/, 'ws');

export default function NoteEditorPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [note, setNote] = useState(null);
  const [preview, setPreview] = useState(false);
  const [isDictating, setIsDictating] = useState(false);
  const saveTimeout = useRef(null);
  const wsRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const dictationSessionId = useRef(null);

  useEffect(() => { api.getNote?.(id); load(); }, [id]);

  async function load() {
    const notes = await api.getNotes();
    setNote(notes.find((n) => n.id === id));
  }

  function scheduleSave(updates) {
    setNote((prev) => ({ ...prev, ...updates }));
    clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(() => {
      api.updateNote(id, updates);
    }, 800); // debounced autosave
  }

  // Voice-to-note: reuses the same Quick Capture pipeline, but inserts
  // transcribed text into the note body instead of creating a session.
  async function toggleDictation() {
    if (isDictating) {
      wsRef.current?.close();
      mediaRecorderRef.current?.stream?.getTracks().forEach((t) => t.stop());
      setIsDictating(false);
      return;
    }

    const session = await api.createSession({
      mode: 'quick_capture',
      diarization_enabled: false,
      analysis_requested: false,
      source_language_mode: 'auto',
      target_language: 'none',
    });
    dictationSessionId.current = session.id;

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
    mediaRecorderRef.current = mediaRecorder;

    const { data: { session: authSession } } = await supabase.auth.getSession();
    const ws = new WebSocket(`${WS_BASE}/ws/live-transcription?sessionId=${session.id}&token=${authSession.access_token}`);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'transcript' && data.is_final) {
        setNote((prev) => {
          const updatedBody = (prev.body || '') + data.text + ' ';
          scheduleSave({ body: updatedBody });
          return { ...prev, body: updatedBody };
        });
      }
    };

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0 && ws.readyState === WebSocket.OPEN) e.data.arrayBuffer().then((buf) => ws.send(buf));
    };

    mediaRecorder.start(1000);
    setIsDictating(true);
  }

  function insertChecklistItem() {
    scheduleSave({ body: (note.body || '') + '\n- [ ] ' });
  }

  async function handleDeleteNote() {
    if (!confirm('Delete this note permanently? This cannot be undone.')) return;
    await api.deleteNote(id);
    navigate('/notes');
  }

  if (!note) return <div className="loading-screen">Loading…</div>;

  return (
    <div className="note-editor">
      <input
        className="note-title"
        value={note.title}
        onChange={(e) => scheduleSave({ title: e.target.value })}
      />

      <div className="note-toolbar">
        <button onClick={toggleDictation} className={isDictating ? 'active' : ''}>
          {isDictating ? '⏹ Stop Dictation' : '🎙 Dictate'}
        </button>
        <button onClick={insertChecklistItem}>+ Checklist item</button>
        <button onClick={() => setPreview((p) => !p)}>{preview ? 'Edit' : 'Preview'}</button>
        <button className="danger-btn-sm" onClick={handleDeleteNote}>Delete</button>
      </div>

      {preview ? (
        <div className="note-preview"><ReactMarkdown>{note.body}</ReactMarkdown></div>
      ) : (
        <textarea
          className="note-body"
          value={note.body}
          onChange={(e) => scheduleSave({ body: e.target.value })}
          placeholder="Start typing… (Markdown supported: **bold**, - bullet, - [ ] checklist)"
        />
      )}

      {note.linked_session_id && (
        <p className="linked-session">Linked to a recorded session</p>
      )}
    </div>
  );
}
