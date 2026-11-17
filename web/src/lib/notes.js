// Supervisor notes: short remarks attached to a day (and optionally one exercise).
// Stored with the plan and sessions, included in the backup file and in the printed report.
import { isISODate } from './dates.js';

export const MAX_NOTE_LENGTH = 600;

/** Validate and build a note. Returns { note } or { error }. `id` is passed in so the function stays pure. */
export function makeNote({ date, text, exercise_key = null, author = '' }, id, nowISO) {
  const body = String(text ?? '').trim();
  if (!isISODate(date)) return { error: 'Choose a date for the note.' };
  if (!body) return { error: 'Write something in the note first.' };
  if (body.length > MAX_NOTE_LENGTH) return { error: `Keep the note under ${MAX_NOTE_LENGTH} characters (it is ${body.length}).` };
  return { note: { id, date, exercise_key: exercise_key || null, text: body, author: String(author || '').trim() || null, created_at: nowISO } };
}

export const addNote = (notes, note) => [...notes, note].sort((a, b) => a.date.localeCompare(b.date) || a.created_at.localeCompare(b.created_at));
export const removeNote = (notes, id) => notes.filter((n) => n.id !== id);

/** Notes for the shown period / exercises (a note with no exercise is about the whole day and always shows). */
export function filterNotes(notes, { from, to, exercises }) {
  return notes.filter((n) => (!from || n.date >= from) && (!to || n.date <= to) && (!exercises || exercises.size === 0 || !n.exercise_key || exercises.has(n.exercise_key)));
}

/** Keep only well-formed notes from a backup file. */
export function sanitizeNotes(list) {
  return (Array.isArray(list) ? list : []).filter((n) => n && typeof n.id === 'string' && isISODate(n.date) && typeof n.text === 'string' && n.text.trim() && typeof n.created_at === 'string');
}
