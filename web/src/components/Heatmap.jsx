import React, { useMemo } from 'react';
import { dayCells } from '../lib/analytics.js';
import { BY_KEY } from '../lib/catalog.js';
import { addDays, formatLong, parseISO, weekStart } from '../lib/dates.js';

const LABEL = { done: 'done', partial: 'partly done', missed: 'missed', today: 'due today', upcoming: 'planned', rest: 'rest day' };
const MONTH = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** One square per day, one column per week (Monday first). Fill pattern, not just colour, tells the states apart. */
export default function Heatmap({ rows, from, to }) {
  const { weeks, summary } = useMemo(() => {
    const first = weekStart(from);
    const last = addDays(weekStart(to), 6);
    const cells = dayCells(rows, first, last).map((c) => ({ ...c, out: c.date < from || c.date > to }));
    const cols = [];
    for (let i = 0; i < cells.length; i += 7) cols.push(cells.slice(i, i + 7));
    const inside = cells.filter((c) => !c.out && c.status !== 'rest');
    const count = (s) => inside.filter((c) => c.status === s).length;
    return { weeks: cols, summary: `${count('done')} days done, ${count('partial')} partly done, ${count('missed')} missed` };
  }, [rows, from, to]);

  return (
    <div>
      <div className="kc-heat-wrap" role="img" aria-label={`Calendar of planned exercise days: ${summary}`}>
        <div className="kc-heat-days" aria-hidden="true">{['Mon', '', 'Wed', '', 'Fri', '', ''].map((d, i) => <span key={i}>{d}</span>)}</div>
        <div className="kc-heat-cols">
          {weeks.map((col, i) => {
            const m = parseISO(col[0].date).getMonth();
            const prev = i > 0 ? parseISO(weeks[i - 1][0].date).getMonth() : -1;
            return (
              <div key={col[0].date} className="kc-heat-col">
                <span className="kc-heat-month" aria-hidden="true">{m !== prev ? MONTH[m] : ''}</span>
                {col.map((c) => {
                  const exercises = [...new Set(c.exercises)].map((k) => (BY_KEY[k]?.name || k).split(' (')[0]).join(', ');
                  const title = `${formatLong(c.date)}: ${LABEL[c.status]}${c.planned ? `, ${c.done} of ${c.planned} reps` : ''}${exercises ? ` (${exercises})` : ''}`;
                  return <span key={c.date} title={title} className={`kc-heat-cell kc-hc-${c.status} ${c.out ? 'kc-hc-out' : ''}`} />;
                })}
              </div>
            );
          })}
        </div>
      </div>
      <div className="kc-legend-row" aria-hidden="true">
        {['done', 'partial', 'missed', 'upcoming', 'rest'].map((s) => <span key={s}><span className={`kc-heat-cell kc-hc-${s}`} />{LABEL[s][0].toUpperCase() + LABEL[s].slice(1)}</span>)}
      </div>
    </div>
  );
}
