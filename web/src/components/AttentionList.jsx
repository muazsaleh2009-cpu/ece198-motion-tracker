import React from 'react';
import { AlertCircle, CheckCircle2, Info } from 'lucide-react';
import { Badge } from './ui.jsx';

const SEV = { high: ['bad', 'High', AlertCircle], medium: ['warn', 'Medium', AlertCircle], low: ['info', 'Low', Info] };

/** The short list a supervisor should look at first (see attention() in lib/analytics.js). */
export default function AttentionList({ items, onOpen }) {
  if (!items.length) {
    return <div className="kc-clear"><CheckCircle2 size={20} aria-hidden="true" /> Nothing needs attention right now.</div>;
  }
  return (
    <ul className="kc-attn">
      {items.map((a) => {
        const [tone, label, Icon] = SEV[a.severity];
        return (
          <li key={a.id} className={`kc-attn-item kc-sev-${a.severity}`}>
            <span className="kc-attn-bar" aria-hidden="true" />
            <div>
              <div className="kc-attn-title"><Badge tone={tone} icon={Icon}>{label}</Badge>{a.title}</div>
              <div className="kc-attn-detail">{a.detail}</div>
            </div>
            {a.exercise && onOpen && <button type="button" className="kc-expander" onClick={() => onOpen(a.exercise)} aria-label={`Open ${a.title}`}>Open</button>}
          </li>
        );
      })}
    </ul>
  );
}
