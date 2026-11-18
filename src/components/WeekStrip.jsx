import React, { useMemo } from 'react';
import { AlertCircle, CheckCircle2, Circle, Minus } from 'lucide-react';
import { dayStatus } from '../lib/analytics.js';
import { BY_KEY } from '../lib/catalog.js';
import { addDays, parseISO, weekStart } from '../lib/dates.js';

const DAY = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const STATE = {
  done: [CheckCircle2, 'Done'],
  partial: [Minus, 'Partly done'],
  missed: [AlertCircle, 'Missed'],
  today: [Circle, 'Today'],
  upcoming: [Circle, 'Planned'],
  rest: [null, 'Rest day'],
};
const shortName = (key) => (BY_KEY[key]?.name || key).split(' (')[0];

/** This week at a glance: one tile per day with what is planned and whether it was done. */
export default function WeekStrip({ rows, today }) {
  const days = useMemo(() => {
    const start = weekStart(today);
    return DAY.map((name, i) => {
      const date = addDays(start, i);
      const dayRows = rows.filter((r) => r.date === date);
      return { name, date, dayRows, status: dayStatus(dayRows) };
    });
  }, [rows, today]);
  return (
    <div className="kc-week" role="list" aria-label="This week">
      {days.map((d) => {
        const [Icon, text] = STATE[d.status];
        const names = [...new Set(d.dayRows.map((r) => shortName(r.exercise_key)))];
        return (
          <div key={d.date} role="listitem" className={`kc-day ${d.date === today ? 'kc-today' : ''} ${d.status === 'rest' ? 'kc-rest' : ''}`}
            aria-label={`${d.name} ${parseISO(d.date).getDate()}: ${text}${names.length ? `, ${names.join(', ')}` : ''}`}>
            <div className="kc-day-head"><span className="kc-day-name">{d.name}</span><span className="kc-day-date">{parseISO(d.date).getDate()}</span></div>
            <div className={`kc-day-state kc-st-${d.status}`}>{Icon && <Icon size={14} aria-hidden="true" />}{text}</div>
            {names.length > 0 && <div className="kc-day-ex">{names.join(', ')}</div>}
          </div>
        );
      })}
    </div>
  );
}
