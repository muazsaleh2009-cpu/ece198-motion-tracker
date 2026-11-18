import React, { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { BY_KEY } from '../lib/catalog.js';
import { formatShort } from '../lib/dates.js';
import { MAX_NOTE_LENGTH } from '../lib/notes.js';

/** Supervisor notes for the period shown, with a small form to add one. */
export default function NotesPanel({ notes, today, options, defaultAuthor, onAdd, onRemove, readOnly = false }) {
  const [date, setDate] = useState(today);
  const [exercise, setExercise] = useState('');
  const [text, setText] = useState('');
  const [author, setAuthor] = useState(defaultAuthor || '');
  const [error, setError] = useState('');

  const submit = (e) => {
    e.preventDefault();
    const err = onAdd({ date, text, exercise_key: exercise || null, author });
    if (err) return setError(err);
    setText('');
    setError('');
  };

  return (
    <div>
      {notes.length === 0 ? <p className="kc-muted" style={{ margin: '0 0 12px' }}>No notes in this period.</p> : (
        <div role="list" aria-label="Supervisor notes">
          {[...notes].reverse().map((n) => (
            <div key={n.id} role="listitem" className="kc-note">
              <div>
                <div className="kc-note-meta"><strong style={{ color: 'var(--kc-text)' }}>{formatShort(n.date)}</strong>{n.exercise_key ? <span>{BY_KEY[n.exercise_key]?.name}</span> : <span>Whole day</span>}{n.author && <span>{n.author}</span>}</div>
                <p className="kc-note-text">{n.text}</p>
              </div>
              {!readOnly && <button type="button" className="kc-btn kc-btn-quiet kc-btn-sm kc-no-print" onClick={() => onRemove(n.id)} aria-label={`Delete note from ${formatShort(n.date)}`}><Trash2 size={14} aria-hidden="true" /></button>}
            </div>
          ))}
        </div>
      )}
      {!readOnly && (
        <form onSubmit={submit} className="kc-no-print" style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
          <div className="kc-form-grid">
            <div className="kc-field"><label htmlFor="kc-note-date">Date</label><input id="kc-note-date" type="date" className="kc-input" value={date} onChange={(e) => setDate(e.target.value)} /></div>
            <div className="kc-field"><label htmlFor="kc-note-ex">About</label>
              <select id="kc-note-ex" className="kc-select" value={exercise} onChange={(e) => setExercise(e.target.value)}>
                <option value="">The whole day</option>
                {options.map((o) => <option key={o.key} value={o.key}>{o.name}</option>)}
              </select></div>
            <div className="kc-field"><label htmlFor="kc-note-author">From</label><input id="kc-note-author" className="kc-input" value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="Your name" /></div>
          </div>
          <div className="kc-field">
            <label htmlFor="kc-note-text">Note</label>
            <textarea id="kc-note-text" className="kc-textarea" value={text} maxLength={MAX_NOTE_LENGTH + 50} onChange={(e) => setText(e.target.value)} placeholder="For example: ease off the squat depth until the pain settles." />
          </div>
          {error && <div className="kc-help" role="alert" style={{ color: 'var(--kc-danger)', fontWeight: 650 }}>{error}</div>}
          <div><button type="submit" className="kc-btn kc-btn-primary kc-btn-sm"><Plus size={14} aria-hidden="true" /> Add note</button></div>
        </form>
      )}
    </div>
  );
}
