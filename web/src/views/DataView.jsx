import React, { useState } from 'react';
import { ClipboardList, Download, Pencil, Trash2, Upload } from 'lucide-react';
import { CATALOG, GROUPS } from '../lib/catalog.js';
import { formatLong } from '../lib/dates.js';
import { planTemplate } from '../lib/plan.js';
import { FileDrop, Notice, downloadFile } from '../components/ui.jsx';

function Report({ report, onClose }) {
  if (!report) return null;
  const tone = report.errors.length ? (report.ok ? 'warn' : 'bad') : report.warnings.length ? 'warn' : 'good';
  return (
    <Notice tone={tone} title={report.title} onClose={onClose}>
      {report.errors.length > 0 && <ul>{report.errors.map((e, i) => <li key={`e${i}`}>{e}</li>)}</ul>}
      {report.warnings.length > 0 && <ul>{report.warnings.map((w, i) => <li key={`w${i}`}>{w}</li>)}</ul>}
    </Notice>
  );
}

/** Table of every exercise the tracker supports, generated from the catalog. */
export function SupportedExercises() {
  return (
    <div className="kc-table-scroll">
      <table className="kc-table">
        <thead>
          <tr><th>Exercise</th><th>Measured angle</th><th>Starts at</th><th>Default target</th><th>Allowed target</th><th>Camera</th></tr>
        </thead>
        <tbody>
          {GROUPS.flatMap((g) => [
            <tr key={g} className="kc-group-row"><td colSpan={6}>{g}</td></tr>,
            ...CATALOG.filter((e) => e.group === g).map((e) => (
              <tr key={e.key}>
                <td><strong>{e.name}</strong><div className="kc-muted kc-code" style={{ display: 'inline-block', marginTop: 2 }}>{e.key}</div></td>
                <td title={e.convention}>{e.angle_label}</td>
                <td className="kc-num">{e.start_angle_deg}°</td>
                <td className="kc-num">{e.default_target_angle_deg}°</td>
                <td className="kc-num">{e.target_bounds_deg[0]}° to {e.target_bounds_deg[1]}°</td>
                <td>{e.camera_view} view</td>
              </tr>
            )),
          ])}
        </tbody>
      </table>
    </div>
  );
}

/** First-run screen: the app is blank until a plan is uploaded. */
export function Welcome({ onPlanFiles, onBuild, report, onCloseReport }) {
  return (
    <div className="kc-stack">
      <header className="kc-hero"><h1 className="kc-h1">Kinesis Care</h1><p className="kc-lede">Track a home exercise programme against what was prescribed. Start with the plan: nothing is shown until there is one to compare sessions with.</p></header>
      <section className="kc-card" aria-labelledby="kc-welcome-h">
        <div className="kc-panel-header">
          <div>
            <div className="kc-panel-title-wrap"><ClipboardList size={20} color="var(--kc-primary)" aria-hidden="true" /><h2 id="kc-welcome-h" className="kc-panel-title">Start by uploading the exercise plan</h2></div>
            <p className="kc-panel-desc">Nothing is shown until there is a plan to compare your sessions with. Everything stays on this device.</p>
          </div>
        </div>
        <div className="kc-steps" style={{ marginBottom: 20 }}>
          {[
            ['Upload the plan', 'A plan file (plan.json) lists each exercise, sets, repetitions, target angle and the days it is scheduled.'],
            ['Exercise with the camera', 'Run the tracker on the plan. After each session it saves one session file.'],
            ['Import the sessions', 'Upload the session files. Progress, consistency and improvement appear here.'],
          ].map(([t, d], i) => (
            <div className="kc-step" key={t}><div className="kc-step-n">{i + 1}</div><div><strong>{t}</strong><div className="kc-muted" style={{ fontSize: '.88em' }}>{d}</div></div></div>
          ))}
        </div>
        <FileDrop id="kc-plan-drop-welcome" title="Choose or drop the plan file" hint="plan.json" onFiles={onPlanFiles} />
        <div style={{ display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
          <button type="button" className="kc-btn kc-btn-primary" onClick={onBuild}><Pencil size={16} aria-hidden="true" /> Build a plan here instead</button>
          <button type="button" className="kc-btn kc-btn-secondary" onClick={() => downloadFile('plan-template.json', JSON.stringify(planTemplate(), null, 2))}>
            <Download size={16} aria-hidden="true" /> Download a plan template
          </button>
        </div>
      </section>
      <Report report={report} onClose={onCloseReport} />
      <section className="kc-card kc-card-flush" aria-label="Supported exercises">
        <div className="kc-card-head">
          <div><h2 className="kc-panel-title">Exercises the model can track</h2><p className="kc-panel-desc">Use these keys in the plan. Angles are measured in the camera image, so follow the camera view shown.</p></div>
        </div>
        <SupportedExercises />
      </section>
    </div>
  );
}

export default function DataView({ plan, sessions, noteCount = 0, persistent, onPlanFiles, onSessionFiles, onClearSessions, onClearAll, onExport, report, onCloseReport }) {
  const [confirm, setConfirm] = useState(null);
  const first = sessions[0]?.started_at.slice(0, 10);
  const last = sessions[sessions.length - 1]?.started_at.slice(0, 10);
  return (
    <div className="kc-stack">
      <header className="kc-hero"><h1 className="kc-h1">Data</h1><p className="kc-lede">Import the plan and the session files from the tracker, keep a backup, or start over. Everything stays in this browser.</p></header>
      {!persistent && <Notice tone="warn" title="Data is not being saved">This browser is blocking site storage, so what you upload will be lost when the page is reloaded. Use "Export all data" to keep a copy.</Notice>}
      <div className="kc-grid-eq">
        <section className="kc-card">
          <h2 className="kc-panel-title">Exercise plan</h2>
          <p className="kc-panel-desc" style={{ marginBottom: 12 }}>{plan ? `${plan.name} · ${plan.patient.name || plan.patient.id}` : 'No plan uploaded'}</p>
          <FileDrop id="kc-plan-drop" title={plan ? 'Replace the plan' : 'Upload the plan'} hint="plan.json. Recorded sessions are kept and re-matched to the new plan." onFiles={onPlanFiles} />
          <button type="button" className="kc-btn kc-btn-secondary" style={{ marginTop: 12 }} onClick={() => downloadFile('plan-template.json', JSON.stringify(planTemplate(), null, 2))}>
            <Download size={16} aria-hidden="true" /> Download a plan template
          </button>
        </section>
        <section className="kc-card">
          <h2 className="kc-panel-title">Session files from the tracker</h2>
          <p className="kc-panel-desc" style={{ marginBottom: 12 }}>{sessions.length ? `${sessions.length} sessions, ${formatLong(first)} to ${formatLong(last)}` : 'No sessions imported yet'}</p>
          <FileDrop id="kc-session-drop" multiple title="Upload session files" hint="session_*.json. Select several at once. Re-importing a file never creates duplicates." onFiles={onSessionFiles} />
        </section>
      </div>
      <Report report={report} onClose={onCloseReport} />
      <section className="kc-card">
        <h2 className="kc-panel-title">Manage data</h2>
        <p className="kc-panel-desc">Data is stored only in this browser. A backup holds the plan, {sessions.length} sessions and {noteCount} notes.</p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 14 }}>
          <button type="button" className="kc-btn kc-btn-secondary" onClick={onExport} disabled={!plan}><Upload size={16} aria-hidden="true" /> Export all data (backup)</button>
          {confirm === 'sessions' ? (
            <>
              <button type="button" className="kc-btn kc-btn-danger" onClick={() => { onClearSessions(); setConfirm(null); }}>Yes, remove {sessions.length} sessions</button>
              <button type="button" className="kc-btn kc-btn-secondary" onClick={() => setConfirm(null)}>Cancel</button>
            </>
          ) : (
            <button type="button" className="kc-btn kc-btn-danger" disabled={!sessions.length} onClick={() => setConfirm('sessions')}><Trash2 size={16} aria-hidden="true" /> Remove all sessions</button>
          )}
          {confirm === 'all' ? (
            <>
              <button type="button" className="kc-btn kc-btn-danger" onClick={() => { onClearAll(); setConfirm(null); }}>Yes, erase the plan and all sessions</button>
              <button type="button" className="kc-btn kc-btn-secondary" onClick={() => setConfirm(null)}>Cancel</button>
            </>
          ) : (
            <button type="button" className="kc-btn kc-btn-danger" disabled={!plan} onClick={() => setConfirm('all')}><Trash2 size={16} aria-hidden="true" /> Start over (blank app)</button>
          )}
        </div>
      </section>
      <section className="kc-card kc-card-flush" aria-label="Supported exercises">
        <div className="kc-card-head"><div><h2 className="kc-panel-title">Exercises the model can track</h2><p className="kc-panel-desc">Use these keys in the plan.</p></div></div>
        <SupportedExercises />
      </section>
    </div>
  );
}
