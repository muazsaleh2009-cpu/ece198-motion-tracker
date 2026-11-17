import React from 'react';
import { Calendar, Filter } from 'lucide-react';
import { GROUPS } from '../lib/catalog.js';
import { presetRange } from '../lib/analytics.js';
import { Segmented } from './ui.jsx';

export const DEFAULT_RANGE = { preset: 'all', from: null, to: null };

const PRESETS = [
  { id: '7d', label: '7D', title: 'Last 7 days' },
  { id: '30d', label: '30D', title: 'Last 30 days' },
  { id: '3m', label: '3M', title: 'Last 3 months' },
  { id: 'plan', label: 'Plan', title: 'Since the plan started' },
  { id: 'all', label: 'All', title: 'All recorded time' },
  { id: 'custom', label: 'Custom', title: 'Pick exact dates' },
];

/**
 * Date-range + exercise filter shared by every tab.
 *  range / onRange      { preset, from, to }
 *  exercises / onExercises   Set of exercise keys (empty set = all)
 *  options              [{ key, name, group }] exercises that can be selected
 *  single               true for the Exercises tab: one exercise via a <select> instead of chips
 */
export default function FilterBar({ range, onRange, today, planStart, exercises, onExercises, options, single, exerciseValue, onExerciseValue, showExercises = true }) {
  const choose = (id) => {
    if (id === 'custom') return onRange({ preset: 'custom', from: range.from, to: range.to || today });
    onRange({ preset: id, ...presetRange(id, today, planStart) });
  };
  const toggle = (key) => {
    const next = new Set(exercises);
    next.has(key) ? next.delete(key) : next.add(key);
    onExercises(next);
  };
  const groups = GROUPS.map((g) => [g, options.filter((o) => o.group === g)]).filter(([, list]) => list.length);

  return (
    <section className="kc-card kc-filter-bar" aria-label="Filters">
      <div className="kc-filter-group">
        <span id="kc-range-label" className="kc-filter-label"><Calendar size={14} aria-hidden="true" /> Time period</span>
        <Segmented label="Time period" options={PRESETS} value={range.preset} onChange={choose} />
      </div>
      {range.preset === 'custom' && (
        <div className="kc-filter-group">
          <span className="kc-filter-label">Custom dates</span>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input aria-label="From date" type="date" className="kc-input" style={{ width: 'auto' }} value={range.from || ''} max={range.to || undefined} onChange={(e) => onRange({ ...range, from: e.target.value || null })} />
            <span className="kc-muted">to</span>
            <input aria-label="To date" type="date" className="kc-input" style={{ width: 'auto' }} value={range.to || ''} min={range.from || undefined} onChange={(e) => onRange({ ...range, to: e.target.value || null })} />
          </div>
        </div>
      )}
      {showExercises && single && (
        <div className="kc-filter-group">
          <label htmlFor="kc-ex-select" className="kc-filter-label"><Filter size={14} aria-hidden="true" /> Exercise</label>
          <select id="kc-ex-select" className="kc-select" value={exerciseValue} onChange={(e) => onExerciseValue(e.target.value)}>
            {groups.map(([g, list]) => (
              <optgroup key={g} label={g}>
                {list.map((o) => <option key={o.key} value={o.key}>{o.name}</option>)}
              </optgroup>
            ))}
          </select>
        </div>
      )}
      {showExercises && !single && (
        <div className="kc-filter-group" style={{ flex: 1, minWidth: 260 }}>
          <span className="kc-filter-label"><Filter size={14} aria-hidden="true" /> Exercises {exercises.size === 0 ? '(all)' : `(${exercises.size} selected)`}</span>
          <div className="kc-chips" role="group" aria-label="Exercises">
            {options.map((o) => (
              <button key={o.key} type="button" className="kc-chip" aria-pressed={exercises.has(o.key)} onClick={() => toggle(o.key)} title={o.group}>
                {o.name}
              </button>
            ))}
            {exercises.size > 0 && <button type="button" className="kc-expander" onClick={() => onExercises(new Set())}>Clear</button>}
          </div>
        </div>
      )}
    </section>
  );
}
