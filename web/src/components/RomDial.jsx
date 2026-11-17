import React from 'react';

// A goniometer-style dial: the 0-180 degree protractor a physiotherapist measures range of motion with.
//   shaded band    the prescribed sweep, from the starting angle to the target
//   solid arc      how far the patient actually got (average peak)
//   brass marker   the target angle
//   needle         the average peak angle
const CX = 100;
const CY = 100;
const R = 70;
const pt = (deg, r) => [CX - r * Math.cos((deg * Math.PI) / 180), CY - r * Math.sin((deg * Math.PI) / 180)];
const clamp = (v) => Math.max(0, Math.min(180, v));
const arc = (a, b, r) => {
  const [lo, hi] = a <= b ? [a, b] : [b, a];
  const [x1, y1] = pt(clamp(lo), r);
  const [x2, y2] = pt(clamp(hi), r);
  return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r} ${r} 0 0 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
};

export default function RomDial({ name, start, target, peak, caption, onClick }) {
  const has = peak != null && Number.isFinite(peak);
  const label = `${name}: ${has ? `average peak ${peak.toFixed(0)} degrees` : 'no sessions yet'}, target ${target} degrees`;
  const ticks = [];
  for (let d = 0; d <= 180; d += 10) {
    const major = d % 30 === 0;
    const [x1, y1] = pt(d, R + 9);
    const [x2, y2] = pt(d, R + (major ? 17 : 13));
    ticks.push(<line key={d} x1={x1} y1={y1} x2={x2} y2={y2} className="kc-dial-tick" strokeWidth={major ? 1.6 : 1} />);
    if (major) {
      const [tx, ty] = pt(d, R + 28);
      ticks.push(<text key={`t${d}`} x={tx} y={ty + 3} textAnchor="middle" fontSize="9.5" className="kc-dial-cap">{d}</text>);
    }
  }
  const [tipX, tipY] = pt(clamp(target), R + 3);
  const [b1x, b1y] = pt(clamp(target) - 5, R + 13);
  const [b2x, b2y] = pt(clamp(target) + 5, R + 13);
  const [nx, ny] = has ? pt(clamp(peak), R - 14) : [CX, CY];

  const body = (
    <>
      <svg viewBox="0 0 200 142" role="img" aria-label={label}>
        <path d={arc(0, 180, R)} fill="none" className="kc-dial-track" strokeWidth="10" />
        <path d={arc(start, target, R)} fill="none" className="kc-dial-band" strokeWidth="10" />
        {has && <path d={arc(start, peak, R)} fill="none" className="kc-dial-reach" strokeWidth="10" strokeLinecap="round" />}
        {ticks}
        <polygon points={`${tipX},${tipY} ${b1x},${b1y} ${b2x},${b2y}`} className="kc-dial-target"><title>{`Target ${target}°`}</title></polygon>
        {has && <line x1={CX} y1={CY} x2={nx} y2={ny} className="kc-dial-needle" strokeWidth="3" strokeLinecap="round" />}
        <circle cx={CX} cy={CY} r="5.5" className="kc-dial-hub" />
        <text x={CX} y={134} textAnchor="middle" fontSize="30" className="kc-dial-num">{has ? `${peak.toFixed(0)}°` : '–'}</text>
      </svg>
      <span className="kc-dial-name">{name}</span>
      <span className="kc-dial-sub">{caption || `Target ${target}°`}</span>
    </>
  );
  return onClick
    ? <button type="button" className="kc-dial" onClick={onClick} aria-label={`${label}. Open exercise.`}>{body}</button>
    : <div className="kc-dial">{body}</div>;
}
