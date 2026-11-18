import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, BarChart3, CheckCircle2, ClipboardList, Eye, FileText, Layers, Type, Upload, X } from 'lucide-react';
import { STYLES } from './styles.js';
import { BY_KEY } from './lib/catalog.js';
import { todayISO } from './lib/dates.js';
import { expandPlan, validatePlan } from './lib/plan.js';
import { addNote, makeNote, removeNote, sanitizeNotes } from './lib/notes.js';
import { flattenBlocks, mergeSessions, validateSession } from './lib/sessions.js';
import { attention, matchPlan } from './lib/analytics.js';
import { clearAll, loadState, saveKey } from './lib/storage.js';
import FilterBar, { DEFAULT_RANGE } from './components/FilterBar.jsx';
import PlanBuilder from './components/PlanBuilder.jsx';
import { Notice, Segmented } from './components/ui.jsx';
import DataView, { Welcome } from './views/DataView.jsx';
import Overview from './views/Overview.jsx';
import ExerciseView from './views/ExerciseView.jsx';
import LogView from './views/LogView.jsx';
import PlanView from './views/PlanView.jsx';
import ReportView from './views/ReportView.jsx';

const TABS = [
  { id: 'overview', label: 'Overview', icon: BarChart3 },
  { id: 'exercise', label: 'Exercises', icon: Activity },
  { id: 'log', label: 'Log', icon: Layers },
  { id: 'plan', label: 'Plan', icon: ClipboardList },
  { id: 'report', label: 'Report', icon: FileText },
  { id: 'data', label: 'Data', icon: Upload },
];
const THEMES = [{ id: 'auto', label: 'Auto' }, { id: 'light', label: 'Light' }, { id: 'dark', label: 'Dark' }];

const parse = (file) => {
  try {
    return { json: JSON.parse(file.text) };
  } catch {
    return { error: `${file.name}: this is not valid JSON, so it cannot be read.` };
  }
};

// Per-viewer conveniences only; the app works when storage is blocked.
const readPref = (key, fallback) => { try { return window.localStorage.getItem(key) || fallback; } catch { return fallback; } };
const writePref = (key, value) => { try { window.localStorage.setItem(key, value); } catch { /* ignore */ } };

function Mark() {
  // A small goniometer: the half-dial a physiotherapist measures range of motion with.
  return (
    <svg width="34" height="34" viewBox="0 0 34 34" fill="none" aria-hidden="true">
      <path d="M4 25 A13 13 0 0 1 30 25" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <line x1="17" y1="25" x2="25" y2="13" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
      <circle cx="17" cy="25" r="2.6" fill="currentColor" />
      <path d="M5.6 20.4 L8 21.6 M9.4 14.6 L11.2 16.4 M17 11.6 V14" stroke="var(--kc-brass)" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export default function App() {
  const [loaded, setLoaded] = useState(false);
  const [persistent, setPersistent] = useState(true);
  const [plan, setPlan] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [notes, setNotes] = useState([]);
  const [tab, setTab] = useState('overview');
  const [building, setBuilding] = useState(false);
  const [range, setRange] = useState(DEFAULT_RANGE);
  const [exSet, setExSet] = useState(new Set());
  const [exKey, setExKey] = useState(null);
  const [report, setReport] = useState(null);
  const [toast, setToast] = useState('');
  const [theme, setTheme] = useState(() => readPref('kc-theme', 'auto'));
  const [highContrast, setHighContrast] = useState(false);
  const [largeText, setLargeText] = useState(false);
  const [today] = useState(todayISO);

  useEffect(() => {
    let alive = true;
    loadState().then((s) => {
      if (!alive) return;
      setPlan(s.plan);
      setSessions(s.sessions);
      setNotes(sanitizeNotes(s.notes));
      setPersistent(s.persistent);
      setLoaded(true);
    });
    return () => { alive = false; };
  }, []);

  const changeTheme = (t) => { setTheme(t); writePref('kc-theme', t); };
  const showToast = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 5000);
  }, []);
  const go = (t) => { setTab(t); if (typeof window !== 'undefined') window.scrollTo?.(0, 0); };

  // ---- derived data ------------------------------------------------------
  const occurrences = useMemo(() => (plan ? expandPlan(plan) : []), [plan]);
  const blocks = useMemo(() => flattenBlocks(sessions), [sessions]);
  const all = useMemo(() => matchPlan(occurrences, blocks, today), [occurrences, blocks, today]);
  const urgent = useMemo(() => attention(all.rows, blocks, today).filter((a) => a.severity === 'high').length, [all.rows, blocks, today]);
  const options = useMemo(() => {
    const keys = new Set([...occurrences.map((o) => o.exercise_key), ...blocks.map((b) => b.exercise_key)]);
    return [...keys].map((k) => BY_KEY[k]).filter(Boolean).sort((a, b) => a.name.localeCompare(b.name)).map((e) => ({ key: e.key, name: e.name, group: e.group }));
  }, [occurrences, blocks]);
  const activeEx = exKey && options.some((o) => o.key === exKey) ? exKey : options[0]?.key;
  const filters = useMemo(() => ({ from: range.from, to: range.to, exercises: exSet }), [range, exSet]);

  // ---- plan ----------------------------------------------------------------
  const applyPlan = async (p, title) => {
    setPlan(p);
    await saveKey('plan', p);
    setBuilding(false);
    setReport(title ? { title, errors: [], warnings: [], ok: true } : null);
    showToast(`Plan saved: ${p.name} (${expandPlan(p).length} scheduled sessions)`);
  };

  const applyBackup = async (obj) => {
    const p = validatePlan(obj.plan);
    if (!p.plan) return { title: 'The backup file contains an invalid plan.', errors: p.errors, warnings: [], ok: false };
    const kept = [];
    const warnings = [];
    (obj.sessions || []).forEach((raw, i) => {
      const v = validateSession(raw, `backup session ${i + 1}`);
      v.session ? kept.push(v.session) : warnings.push(...v.errors);
      warnings.push(...v.warnings);
    });
    const merged = mergeSessions([], kept).sessions;
    const restoredNotes = sanitizeNotes(obj.notes);
    setPlan(p.plan);
    setSessions(merged);
    setNotes(restoredNotes);
    await saveKey('plan', p.plan);
    await saveKey('sessions', merged);
    await saveKey('notes', restoredNotes);
    return { title: `Backup restored: plan, ${merged.length} sessions and ${restoredNotes.length} notes.`, errors: [], warnings, ok: true };
  };

  const handlePlanFiles = async (files) => {
    const { json, error } = parse(files[0]);
    if (error) return setReport({ title: 'Plan not loaded', errors: [error], warnings: [], ok: false });
    if (json?.kind === 'therapypal-backup') return setReport(await applyBackup(json));
    const v = validatePlan(json);
    if (!v.plan) return setReport({ title: `Plan not loaded: ${v.errors.length} problem${v.errors.length > 1 ? 's' : ''} found in ${files[0].name}`, errors: v.errors, warnings: v.warnings, ok: false });
    const warnings = [...v.warnings];
    const foreign = sessions.filter((s) => s.patient_id && s.patient_id !== v.plan.patient.id).length;
    if (foreign) warnings.push(`${foreign} recorded session${foreign > 1 ? 's belong' : ' belongs'} to a different patient id than this plan (${v.plan.patient.id}). Remove them on the Data tab if they should not be here.`);
    setPlan(v.plan);
    await saveKey('plan', v.plan);
    setReport({ title: `Plan loaded: ${v.plan.name} (${v.plan.items.length} exercises, ${expandPlan(v.plan).length} scheduled sessions)`, errors: [], warnings, ok: true });
    go('overview');
  };

  const handleSessionFiles = async (files) => {
    if (!plan) return setReport({ title: 'Upload the exercise plan first', errors: ['Sessions are compared with the plan, so the plan has to be loaded first.'], warnings: [], ok: false });
    const incoming = [];
    const errors = [];
    const warnings = [];
    for (const file of files) {
      const { json, error } = parse(file);
      if (error) { errors.push(error); continue; }
      if (json?.kind === 'therapypal-backup') { errors.push(`${file.name}: this is a backup file. Drop it on the plan upload to restore it.`); continue; }
      const v = validateSession(json, file.name);
      warnings.push(...v.warnings);
      if (!v.session) { errors.push(...v.errors); continue; }
      if (v.session.patient_id && v.session.patient_id !== plan.patient.id) {
        errors.push(`${file.name}: recorded for patient "${v.session.patient_id}", but this plan is for "${plan.patient.id}". Not imported.`);
        continue;
      }
      if (v.session.plan_id && v.session.plan_id !== plan.plan_id) warnings.push(`${file.name}: recorded against plan "${v.session.plan_id}", not "${plan.plan_id}". Imported, and matched by exercise and date.`);
      incoming.push(v.session);
    }
    let title = 'No sessions imported';
    if (incoming.length) {
      const m = mergeSessions(sessions, incoming);
      setSessions(m.sessions);
      await saveKey('sessions', m.sessions);
      title = `Imported ${m.added} new session${m.added === 1 ? '' : 's'}${m.replaced ? `, updated ${m.replaced} already present` : ''}`;
      showToast(title);
    }
    setReport({ title, errors, warnings, ok: incoming.length > 0 });
  };

  // ---- notes -----------------------------------------------------------------
  const onAddNote = (input) => {
    const id = `n-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    const made = makeNote(input, id, new Date().toISOString());
    if (made.error) return made.error;
    const next = addNote(notes, made.note);
    setNotes(next);
    saveKey('notes', next);
    return null;
  };
  const onRemoveNote = (id) => {
    const next = removeNote(notes, id);
    setNotes(next);
    saveKey('notes', next);
  };

  // ---- data management ---------------------------------------------------------
  const exportAll = () => {
    const text = JSON.stringify({ kind: 'therapypal-backup', exported_at: new Date().toISOString(), plan, sessions, notes }, null, 2);
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `therapypal-backup-${today}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const clearSessions = async () => { setSessions([]); await saveKey('sessions', []); setReport(null); showToast('All sessions removed.'); };
  const clearEverything = async () => { setPlan(null); setSessions([]); setNotes([]); await clearAll(); setReport(null); setTab('overview'); setRange(DEFAULT_RANGE); setExSet(new Set()); setBuilding(false); };
  const goExercise = (key) => { setExKey(key); go('exercise'); };

  // ---- render ----------------------------------------------------------------
  const showFilters = plan && ['overview', 'exercise', 'log', 'report'].includes(tab);
  const cls = `kc-app kc-theme-${theme} ${highContrast ? 'kc-high-contrast' : ''} ${largeText ? 'kc-large-text' : ''}`;

  let content;
  if (!loaded) content = <p className="kc-muted" role="status">Loading…</p>;
  else if (!plan && building) content = <PlanBuilder initialPlan={null} today={today} onCancel={() => setBuilding(false)} onApply={(p) => applyPlan(p)} />;
  else if (!plan) content = <Welcome onPlanFiles={handlePlanFiles} onBuild={() => setBuilding(true)} report={report} onCloseReport={() => setReport(null)} />;
  else {
    content = (
      <>
        {showFilters && (
          <div style={{ marginBottom: 22 }} className="kc-no-print">
            <FilterBar range={range} onRange={setRange} today={today} planStart={occurrences[0]?.date} options={options}
              single={tab === 'exercise'} exerciseValue={activeEx} onExerciseValue={setExKey} exercises={exSet} onExercises={setExSet} showExercises={tab !== 'overview' || options.length > 1} />
          </div>
        )}
        {tab === 'overview' && <Overview plan={plan} all={all} blocks={blocks} filters={filters} today={today} notes={notes} onAddNote={onAddNote} onRemoveNote={onRemoveNote} options={options} goExercise={goExercise} goData={() => go('data')} goReport={() => go('report')} />}
        {tab === 'exercise' && activeEx && <ExerciseView exKey={activeEx} all={all} blocks={blocks} filters={filters} />}
        {tab === 'log' && <LogView blocks={blocks} filters={filters} notes={notes} />}
        {tab === 'plan' && <PlanView plan={plan} rows={all.rows} today={today} sessionCount={sessions.length} onApplyPlan={(p) => applyPlan(p)} />}
        {tab === 'report' && <ReportView plan={plan} all={all} blocks={blocks} filters={filters} today={today} notes={notes} />}
        {tab === 'data' && <DataView plan={plan} sessions={sessions} noteCount={notes.length} persistent={persistent} onPlanFiles={handlePlanFiles} onSessionFiles={handleSessionFiles} onClearSessions={clearSessions} onClearAll={clearEverything} onExport={exportAll} report={report} onCloseReport={() => setReport(null)} />}
        {!persistent && tab !== 'data' && <Notice tone="warn" title="Data is not being saved">This browser is blocking site storage. Your uploads will be lost on reload.</Notice>}
      </>
    );
  }

  return (
    <>
      <style>{STYLES}</style>
      <div className={cls}>
        <aside className="kc-rail">
          <div className="kc-brand">
            <Mark />
            <div><div className="kc-brand-name">Kinesis Care</div><div className="kc-brand-sub">Exercise progress</div></div>
          </div>
          {plan && (
            <div className="kc-patient">
              <strong>{plan.patient.name || plan.patient.id}</strong>
              <span>{plan.name}</span>
              <span>{sessions.length} {sessions.length === 1 ? 'session' : 'sessions'} recorded</span>
            </div>
          )}
          {plan && (
            <nav className="kc-nav" role="tablist" aria-orientation="vertical" aria-label="Sections">
              {TABS.map((t) => (
                <button key={t.id} type="button" role="tab" id={`kc-tab-${t.id}`} aria-selected={tab === t.id} aria-controls="kc-panel" className="kc-nav-item" onClick={() => go(t.id)}>
                  <t.icon size={18} aria-hidden="true" /> {t.label}
                  {t.id === 'overview' && urgent > 0 && <span className="kc-nav-badge" aria-label={`${urgent} urgent`}>{urgent}</span>}
                </button>
              ))}
            </nav>
          )}
          <div className="kc-rail-foot" role="group" aria-label="Display options">
            <span className="kc-label">Display</span>
            <Segmented label="Theme" value={theme} onChange={changeTheme} options={THEMES} />
            <button type="button" onClick={() => setLargeText((v) => !v)} aria-pressed={largeText} className={`kc-btn kc-btn-secondary kc-btn-sm ${largeText ? 'kc-active' : ''}`}><Type size={15} aria-hidden="true" /> {largeText ? 'Large text: on' : 'Large text'}</button>
            <button type="button" onClick={() => setHighContrast((v) => !v)} aria-pressed={highContrast} className={`kc-btn kc-btn-secondary kc-btn-sm ${highContrast ? 'kc-active' : ''}`}><Eye size={15} aria-hidden="true" /> {highContrast ? 'High contrast: on' : 'High contrast'}</button>
          </div>
        </aside>

        <main className="kc-content" id="kc-panel" role={plan ? 'tabpanel' : undefined} aria-labelledby={plan ? `kc-tab-${tab}` : undefined}>
          {toast && (
            <div className="kc-toast" role="status" aria-live="polite">
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><CheckCircle2 size={18} aria-hidden="true" /> {toast}</span>
              <button type="button" onClick={() => setToast('')} aria-label="Dismiss notification" style={{ background: 'transparent', border: 0, color: 'inherit', cursor: 'pointer' }}><X size={16} /></button>
            </div>
          )}
          {content}
        </main>
      </div>
    </>
  );
}
