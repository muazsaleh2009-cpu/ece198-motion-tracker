// One self-contained stylesheet (kc- prefix) so the app renders identically in Vite, Next or CRA
// without Tailwind or web fonts. Colours are CSS variables, so light, dark and high contrast are
// just three token sets, and the SVG charts follow them without any extra code.
//
// Look: a clinic's assessment sheet. Sage-grey paper, deep lagoon blue-green ink, and one brass
// accent reserved for TARGETS (the physio's goniometer is brass). Headlines and big numbers are set
// in a book serif; everything you read or scan is a system sans.

const LIGHT = `
  --kc-bg:#ecf1ee;--kc-surface:#fafbf9;--kc-surface-2:#f1f5f2;--kc-border:#d6dfd9;--kc-border-strong:#b4c2ba;
  --kc-text:#15262d;--kc-text-2:#44575e;--kc-text-3:#5a6c73;
  --kc-primary:#0b5c6b;--kc-primary-hover:#084a56;--kc-primary-soft:#dcebe6;--kc-primary-border:#a6c9c6;--kc-on-primary:#fff;
  --kc-accent:#99620a;--kc-accent-soft:#f8edd3;--kc-accent-border:#e4c98a;--kc-brass:#c98a1b;
  --kc-danger:#a42f40;--kc-danger-soft:#f8e4e6;--kc-danger-border:#e5b3ba;
  --kc-info:#2a628f;--kc-info-soft:#e1ecf5;--kc-info-border:#b5cde1;
  --kc-neutral-soft:#e6ece8;
  --kc-s1:#0b5c6b;--kc-s2:#b8780c;--kc-s3:#2a628f;--kc-s4:#7b4fa0;--kc-s5:#5f7279;
  --kc-grid:#d6dfd9;--kc-axis:#5a6c73;--kc-dot-ring:#fafbf9;
  --kc-shadow:0 1px 0 rgba(21,38,45,.04),0 8px 24px -16px rgba(21,38,45,.18);
`;
const DARK = `
  --kc-bg:#0e191e;--kc-surface:#15242a;--kc-surface-2:#1b2d34;--kc-border:#28404a;--kc-border-strong:#3c5a66;
  --kc-text:#e7efeb;--kc-text-2:#b6c6c2;--kc-text-3:#8ea5a7;
  --kc-primary:#5cc2cf;--kc-primary-hover:#86d5df;--kc-primary-soft:#12353c;--kc-primary-border:#25606a;--kc-on-primary:#062a31;
  --kc-accent:#e2a93b;--kc-accent-soft:#3a2c10;--kc-accent-border:#6b5120;--kc-brass:#e2a93b;
  --kc-danger:#f08a97;--kc-danger-soft:#3e1a20;--kc-danger-border:#7a3440;
  --kc-info:#7fb4e0;--kc-info-soft:#14304a;--kc-info-border:#2a5a85;
  --kc-neutral-soft:#1f323a;
  --kc-s1:#5cc2cf;--kc-s2:#e2a93b;--kc-s3:#7fb4e0;--kc-s4:#c19ee6;--kc-s5:#9fb2b6;
  --kc-grid:#28404a;--kc-axis:#8ea5a7;--kc-dot-ring:#15242a;
  --kc-shadow:none;
`;
const CONTRAST = `
  --kc-bg:#000;--kc-surface:#000;--kc-surface-2:#141414;--kc-border:#fff;--kc-border-strong:#fff;
  --kc-text:#fff;--kc-text-2:#f2f2f2;--kc-text-3:#d9d9d9;
  --kc-primary:#5eead4;--kc-primary-hover:#99f6e4;--kc-primary-soft:#0c3f3a;--kc-primary-border:#5eead4;--kc-on-primary:#000;
  --kc-accent:#fbbf24;--kc-accent-soft:#3d2a00;--kc-accent-border:#fbbf24;--kc-brass:#fbbf24;
  --kc-danger:#ffa8a8;--kc-danger-soft:#4a0d0d;--kc-danger-border:#ffa8a8;
  --kc-info:#a5cdfc;--kc-info-soft:#0e2a52;--kc-info-border:#a5cdfc;
  --kc-neutral-soft:#262626;
  --kc-s1:#5eead4;--kc-s2:#fbbf24;--kc-s3:#a5cdfc;--kc-s4:#d9c4ff;--kc-s5:#e5e5e5;
  --kc-grid:#555;--kc-axis:#fff;--kc-dot-ring:#000;
  --kc-shadow:none;
`;

export const STYLES = `
.kc-app{${LIGHT}
  --kc-font-display:"Iowan Old Style","Palatino Linotype",Palatino,"Book Antiqua",Georgia,serif;
  --kc-font-body:-apple-system,BlinkMacSystemFont,"SF Pro Text","Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;
  --kc-r-sm:9px;--kc-r-md:14px;--kc-r-lg:20px;
  display:grid;grid-template-columns:252px minmax(0,1fr);min-height:100vh;
  background:var(--kc-bg);color:var(--kc-text);font-family:var(--kc-font-body);
  font-size:16px;line-height:1.5;-webkit-font-smoothing:antialiased;box-sizing:border-box}
.kc-app *,.kc-app *::before,.kc-app *::after{box-sizing:border-box}
.kc-app.kc-theme-dark{${DARK}}
@media (prefers-color-scheme:dark){.kc-app.kc-theme-auto{${DARK}}}
.kc-app.kc-high-contrast{${CONTRAST}}
.kc-app.kc-large-text{font-size:18.5px;line-height:1.6}
.kc-app button,.kc-app input,.kc-app select,.kc-app textarea{font-family:inherit;font-size:inherit}
.kc-app :focus-visible{outline:3px solid var(--kc-info);outline-offset:2px;border-radius:6px}
.kc-app h1,.kc-app h2,.kc-app h3{margin:0}
.kc-serif{font-family:var(--kc-font-display)}
@media (prefers-reduced-motion:reduce){.kc-app *{transition:none!important;animation:none!important}}

/* ---- rail ---- */
.kc-rail{position:sticky;top:0;height:100vh;overflow-y:auto;padding:22px 14px 18px;background:var(--kc-surface);border-right:1px solid var(--kc-border);display:flex;flex-direction:column;gap:20px}
.kc-brand{display:flex;align-items:center;gap:11px;padding:0 6px}
.kc-brand svg{flex-shrink:0;color:var(--kc-primary)}
.kc-brand-name{font-family:var(--kc-font-display);font-size:1.3rem;font-weight:600;letter-spacing:-.01em;line-height:1.1}
.kc-brand-sub{font-size:.78rem;color:var(--kc-text-3)}
.kc-patient{margin:0 6px;padding:12px 14px;border-radius:var(--kc-r-md);background:var(--kc-primary-soft);border:1px solid var(--kc-primary-border)}
.kc-patient strong{display:block;font-family:var(--kc-font-display);font-size:1.12rem;font-weight:600;line-height:1.25}
.kc-patient span{display:block;font-size:.8rem;color:var(--kc-text-2);margin-top:2px}
.kc-nav{display:flex;flex-direction:column;gap:2px}
.kc-nav-item{display:flex;align-items:center;gap:11px;width:100%;padding:10px 12px;border:0;border-radius:var(--kc-r-sm);background:transparent;color:var(--kc-text-2);font-weight:600;font-size:.93rem;text-align:left;cursor:pointer;position:relative}
.kc-nav-item:hover{background:var(--kc-surface-2);color:var(--kc-text)}
.kc-nav-item[aria-selected="true"]{background:var(--kc-primary-soft);color:var(--kc-primary)}
.kc-nav-item[aria-selected="true"]::before{content:"";position:absolute;left:-14px;top:9px;bottom:9px;width:4px;border-radius:0 4px 4px 0;background:var(--kc-primary)}
.kc-nav-badge{margin-left:auto;min-width:22px;padding:1px 7px;border-radius:999px;background:var(--kc-danger);color:var(--kc-surface);font-size:.72rem;font-weight:800;text-align:center}
.kc-rail-foot{margin-top:auto;display:flex;flex-direction:column;gap:10px;padding:14px 6px 0;border-top:1px solid var(--kc-border)}
.kc-rail-foot .kc-label{margin-bottom:-4px}

/* ---- content ---- */
.kc-content{padding:30px 40px 72px;min-width:0;width:100%;max-width:1280px}
.kc-stack{display:flex;flex-direction:column;gap:26px}
.kc-hero{display:flex;flex-direction:column;gap:8px;padding-bottom:2px}
.kc-h1{font-family:var(--kc-font-display);font-size:2.35rem;font-weight:600;letter-spacing:-.02em;line-height:1.12}
.kc-lede{margin:0;max-width:64ch;font-size:1.06rem;color:var(--kc-text-2)}
.kc-meta{font-size:.86rem;color:var(--kc-text-3)}
.kc-label{font-size:.82rem;font-weight:700;color:var(--kc-text-2)}
.kc-muted{color:var(--kc-text-3)}
.kc-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.kc-num{font-variant-numeric:tabular-nums lining-nums;white-space:nowrap}
.kc-code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:.85em;background:var(--kc-neutral-soft);padding:1px 6px;border-radius:6px}

/* ---- surfaces ---- */
.kc-card{background:var(--kc-surface);border:1px solid var(--kc-border);border-radius:var(--kc-r-lg);box-shadow:var(--kc-shadow);padding:22px 24px}
.kc-high-contrast .kc-card{border-width:2px}
.kc-card-flush{padding:0;overflow:hidden}
.kc-card-head{padding:20px 24px 16px;display:flex;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;gap:12px;border-bottom:1px solid var(--kc-border)}
.kc-panel-header{display:flex;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:16px}
.kc-panel-title{font-family:var(--kc-font-display);font-size:1.28rem;font-weight:600;letter-spacing:-.01em;line-height:1.25}
.kc-panel-desc{margin:4px 0 0;font-size:.9rem;color:var(--kc-text-2);max-width:70ch}
.kc-grid-2{display:grid;grid-template-columns:minmax(0,3fr) minmax(300px,2fr);gap:26px;align-items:start}
.kc-grid-eq{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:26px;align-items:start}
@media (max-width:1100px){.kc-grid-2,.kc-grid-eq{grid-template-columns:1fr}}
.kc-about{display:grid;grid-template-columns:230px minmax(0,1fr) minmax(0,1fr);gap:28px;align-items:start}
@media (max-width:1100px){.kc-about{grid-template-columns:1fr}.kc-about .kc-dial{max-width:260px}}

/* ---- ledger: the headline numbers as one ruled strip, not four cards ---- */
.kc-ledger{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));background:var(--kc-surface);border:1px solid var(--kc-border);border-radius:var(--kc-r-lg);box-shadow:var(--kc-shadow);overflow:hidden}
.kc-ledger.kc-ledger-4{grid-template-columns:repeat(4,minmax(0,1fr))}
.kc-ledger-item{padding:18px 22px 16px;border-left:1px solid var(--kc-border);display:flex;flex-direction:column;gap:3px;min-width:0}
.kc-ledger-item:first-child{border-left:0}
.kc-ledger-label{font-size:.86rem;font-weight:700;color:var(--kc-text-2)}
.kc-ledger-value{font-family:var(--kc-font-display);font-size:2.5rem;font-weight:600;letter-spacing:-.025em;line-height:1.05;font-variant-numeric:lining-nums}
.kc-ledger-unit{font-family:var(--kc-font-body);font-size:.9rem;font-weight:600;color:var(--kc-text-3);letter-spacing:0;margin-left:4px}
.kc-ledger-note{font-size:.82rem;color:var(--kc-text-2);display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-top:2px}
@media (max-width:1180px){.kc-ledger,.kc-ledger.kc-ledger-4{grid-template-columns:repeat(2,minmax(0,1fr))}.kc-ledger-item{border-left:0;border-top:1px solid var(--kc-border)}.kc-ledger-item:nth-child(-n+2){border-top:0}.kc-ledger-item:nth-child(even){border-left:1px solid var(--kc-border)}}
@media (max-width:520px){.kc-ledger,.kc-ledger.kc-ledger-4{grid-template-columns:1fr}.kc-ledger-item,.kc-ledger-item:nth-child(even){border-left:0;border-top:1px solid var(--kc-border)}.kc-ledger-item:first-child{border-top:0}}

/* ---- buttons ---- */
.kc-btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:9px 16px;border-radius:var(--kc-r-sm);font-size:.9rem;font-weight:650;cursor:pointer;transition:background .15s ease,border-color .15s ease;border:1px solid transparent;line-height:1.3}
.kc-btn:disabled{opacity:.5;cursor:not-allowed}
.kc-btn-secondary{background:var(--kc-surface);color:var(--kc-text);border-color:var(--kc-border-strong)}
.kc-btn-secondary:hover:not(:disabled){background:var(--kc-surface-2)}
.kc-btn-primary{background:var(--kc-primary);color:var(--kc-on-primary)}
.kc-btn-primary:hover:not(:disabled){background:var(--kc-primary-hover)}
.kc-high-contrast .kc-btn-primary{border:2px solid #fff;font-weight:800}
.kc-btn-danger{background:var(--kc-danger-soft);color:var(--kc-danger);border-color:var(--kc-danger-border)}
.kc-btn-sm{padding:6px 12px;font-size:.82rem}
.kc-btn-quiet{background:transparent;color:var(--kc-text-2);border-color:transparent}
.kc-btn-quiet:hover:not(:disabled){background:var(--kc-surface-2);color:var(--kc-text)}
.kc-expander{background:none;border:0;color:var(--kc-primary);font-weight:700;cursor:pointer;padding:2px 4px;font-size:.9rem;text-decoration:underline;text-underline-offset:3px}

/* ---- form controls ---- */
.kc-select,.kc-input,.kc-textarea{padding:9px 12px;border-radius:var(--kc-r-sm);border:1px solid var(--kc-border-strong);background:var(--kc-surface);color:var(--kc-text);font-size:.92rem;width:100%}
.kc-textarea{min-height:76px;resize:vertical;line-height:1.45}
.kc-select{min-width:200px;font-weight:600;cursor:pointer}
.kc-high-contrast .kc-select,.kc-high-contrast .kc-input,.kc-high-contrast .kc-textarea{border-width:2px}
.kc-field{display:flex;flex-direction:column;gap:5px;min-width:0}
.kc-field>label,.kc-field>.kc-label{font-size:.84rem;font-weight:700;color:var(--kc-text-2)}
.kc-help{font-size:.8rem;color:var(--kc-text-3)}
.kc-segmented{display:inline-flex;flex-wrap:wrap;gap:3px;background:var(--kc-surface-2);padding:3px;border-radius:var(--kc-r-md);border:1px solid var(--kc-border)}
.kc-seg-btn{padding:6px 13px;border-radius:var(--kc-r-sm);font-size:.86rem;font-weight:650;border:1px solid transparent;background:transparent;color:var(--kc-text-2);cursor:pointer}
.kc-seg-btn:hover{color:var(--kc-text)}
.kc-seg-btn.kc-seg-active{background:var(--kc-surface);color:var(--kc-primary);border-color:var(--kc-border-strong);box-shadow:0 1px 2px rgba(0,0,0,.08)}
.kc-high-contrast .kc-seg-btn.kc-seg-active{background:#fff;color:#000;font-weight:800}
.kc-chips{display:flex;flex-wrap:wrap;gap:6px}
.kc-chip{display:inline-flex;align-items:center;gap:6px;padding:5px 12px;border-radius:999px;border:1px solid var(--kc-border-strong);background:var(--kc-surface);color:var(--kc-text-2);font-size:.84rem;font-weight:650;cursor:pointer}
.kc-chip:hover{background:var(--kc-surface-2)}
.kc-chip[aria-pressed="true"]{background:var(--kc-primary);border-color:var(--kc-primary);color:var(--kc-on-primary)}
.kc-high-contrast .kc-chip[aria-pressed="true"]{background:#fff;color:#000}
.kc-filter-bar{display:flex;align-items:flex-end;flex-wrap:wrap;gap:16px 28px;padding:14px 20px;box-shadow:none}
.kc-filter-group{display:flex;flex-direction:column;gap:6px}
.kc-filter-label{display:inline-flex;align-items:center;gap:6px;font-size:.82rem;font-weight:700;color:var(--kc-text-2)}

/* ---- badges, notices ---- */
.kc-badge{display:inline-flex;align-items:center;gap:5px;padding:2px 10px;border-radius:999px;font-size:.78rem;font-weight:700;white-space:nowrap;border:1px solid transparent}
.kc-tone-good{background:var(--kc-primary-soft);color:var(--kc-primary);border-color:var(--kc-primary-border)}
.kc-tone-warn{background:var(--kc-accent-soft);color:var(--kc-accent);border-color:var(--kc-accent-border)}
.kc-tone-bad{background:var(--kc-danger-soft);color:var(--kc-danger);border-color:var(--kc-danger-border)}
.kc-tone-info{background:var(--kc-info-soft);color:var(--kc-info);border-color:var(--kc-info-border)}
.kc-tone-neutral{background:var(--kc-neutral-soft);color:var(--kc-text-2);border-color:var(--kc-border)}
.kc-notice{display:flex;gap:10px;align-items:flex-start;padding:12px 16px;border-radius:var(--kc-r-md);border:1px solid;font-size:.92rem}
.kc-notice ul{margin:4px 0 0;padding-left:18px}
.kc-notice-text{flex:1;min-width:0}
.kc-toast{position:fixed;right:24px;top:20px;z-index:60;display:flex;align-items:center;justify-content:space-between;gap:14px;max-width:420px;padding:12px 16px;border-radius:var(--kc-r-md);background:var(--kc-text);color:var(--kc-bg);font-weight:650;font-size:.92rem;box-shadow:0 12px 32px -8px rgba(0,0,0,.35)}
.kc-insights{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:8px}
.kc-insight{display:flex;gap:10px;align-items:flex-start;font-size:.92rem;padding:10px 12px;border-radius:var(--kc-r-sm);border:1px solid}

/* ---- needs attention ---- */
.kc-attn{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:10px}
.kc-attn-item{display:grid;grid-template-columns:5px minmax(0,1fr) auto;gap:14px;align-items:center;padding:12px 14px 12px 0;border:1px solid var(--kc-border);border-radius:var(--kc-r-md);background:var(--kc-surface);overflow:hidden}
.kc-attn-bar{align-self:stretch;margin:-12px 0}
.kc-sev-high .kc-attn-bar{background:var(--kc-danger)}
.kc-sev-medium .kc-attn-bar{background:var(--kc-brass)}
.kc-sev-low .kc-attn-bar{background:var(--kc-info)}
.kc-attn-title{display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-weight:700}
.kc-attn-detail{font-size:.88rem;color:var(--kc-text-2);margin-top:2px}
.kc-clear{display:flex;align-items:center;gap:12px;padding:14px 16px;border-radius:var(--kc-r-md);background:var(--kc-primary-soft);border:1px solid var(--kc-primary-border);color:var(--kc-primary);font-weight:650}

/* ---- range dial ---- */
.kc-dials{display:grid;grid-template-columns:repeat(auto-fill,minmax(216px,1fr));gap:14px}
.kc-dial{display:flex;flex-direction:column;align-items:center;text-align:center;gap:2px;padding:16px 12px 16px;border:1px solid var(--kc-border);border-radius:var(--kc-r-lg);background:var(--kc-surface);cursor:pointer;color:inherit;font:inherit;width:100%}
button.kc-dial:hover{border-color:var(--kc-primary);background:var(--kc-surface-2)}
.kc-dial svg{width:100%;max-width:200px;height:auto;overflow:visible}
.kc-dial-name{font-weight:700;font-size:.95rem;margin-top:2px}
.kc-dial-sub{font-size:.82rem;color:var(--kc-text-2)}
.kc-dial-track{stroke:var(--kc-border-strong)}
.kc-dial-band{stroke:var(--kc-primary);opacity:.28}
.kc-dial-tick{stroke:var(--kc-axis)}
.kc-dial-needle{stroke:var(--kc-text)}
.kc-dial-hub{fill:var(--kc-text)}
.kc-dial-target{fill:var(--kc-brass)}
.kc-dial-reach{stroke:var(--kc-primary)}
.kc-dial-num{font-family:var(--kc-font-display);font-weight:600;fill:var(--kc-text);font-variant-numeric:lining-nums}
.kc-dial-cap{fill:var(--kc-text-3);font-family:var(--kc-font-body)}

/* ---- week strip + heat map ---- */
.kc-week{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:8px}
.kc-day{display:flex;flex-direction:column;gap:6px;padding:10px 10px 12px;min-height:104px;border:1px solid var(--kc-border);border-radius:var(--kc-r-md);background:var(--kc-surface);min-width:0}
.kc-day-head{display:flex;align-items:baseline;justify-content:space-between;gap:4px}
.kc-day-name{font-size:.82rem;font-weight:700;color:var(--kc-text-2)}
.kc-day-date{font-family:var(--kc-font-display);font-size:1.25rem;font-weight:600;line-height:1;font-variant-numeric:lining-nums}
.kc-day.kc-today{border:2px solid var(--kc-primary);padding:9px 9px 11px}
.kc-day.kc-rest{background:transparent;border-style:dashed}
.kc-day-state{display:flex;align-items:center;gap:5px;font-size:.78rem;font-weight:700}
.kc-day-ex{font-size:.78rem;color:var(--kc-text-2);line-height:1.3;overflow:hidden;text-overflow:ellipsis}
.kc-st-done{color:var(--kc-primary)}.kc-st-partial{color:var(--kc-accent)}.kc-st-missed{color:var(--kc-danger)}.kc-st-today{color:var(--kc-info)}.kc-st-upcoming,.kc-st-rest{color:var(--kc-text-3)}
@media (max-width:720px){.kc-week{grid-template-columns:repeat(7,minmax(46px,1fr));overflow-x:auto}.kc-day-ex{display:none}.kc-day{min-height:78px}}
.kc-heat-wrap{display:flex;gap:10px;overflow-x:auto;padding-bottom:4px}
.kc-heat-days{display:grid;grid-template-rows:repeat(7,20px);gap:4px;font-size:.72rem;color:var(--kc-text-3);padding-top:22px;line-height:20px}
.kc-heat-cols{display:flex;gap:4px}
.kc-heat-col{display:grid;grid-template-rows:18px repeat(7,20px);gap:4px}
.kc-heat-month{font-size:.72rem;color:var(--kc-text-3);line-height:18px;white-space:nowrap;overflow:visible}
.kc-heat-cell{width:20px;height:20px;border-radius:5px;border:2px solid transparent;display:block}
.kc-hc-done{background:var(--kc-primary)}
.kc-hc-partial{background:repeating-linear-gradient(135deg,var(--kc-primary) 0 3px,var(--kc-primary-soft) 3px 6px);border-color:var(--kc-primary)}
.kc-hc-missed{background:var(--kc-danger-soft);border-color:var(--kc-danger)}
.kc-hc-upcoming{background:transparent;border:2px dashed var(--kc-border-strong)}
.kc-hc-today{background:var(--kc-info-soft);border-color:var(--kc-info)}
.kc-hc-rest{background:var(--kc-surface-2);border-color:transparent;opacity:.7}
.kc-hc-out{visibility:hidden}
.kc-legend-row{display:flex;flex-wrap:wrap;gap:8px 18px;font-size:.82rem;color:var(--kc-text-2);margin-top:12px;align-items:center}
.kc-legend-row .kc-heat-cell{display:inline-block;width:14px;height:14px;border-radius:4px;vertical-align:-2px;margin-right:6px}

/* ---- charts ---- */
.kc-chart-shell{position:relative;width:100%}
.kc-chart-legend{display:flex;align-items:center;flex-wrap:wrap;gap:6px 18px;margin-top:8px;font-size:.84rem;font-weight:600;color:var(--kc-text-2)}
.kc-legend-item{display:inline-flex;align-items:center;gap:7px}
.kc-legend-swatch{width:16px;height:4px;border-radius:3px}
.kc-svg-tooltip{position:absolute;top:6px;right:6px;z-index:15;width:236px;background:var(--kc-surface);border:1px solid var(--kc-border-strong);border-radius:var(--kc-r-md);padding:10px 13px;box-shadow:0 14px 30px -10px rgba(0,0,0,.35);pointer-events:none;font-size:.84rem}
.kc-high-contrast .kc-svg-tooltip{border-width:2px}
.kc-tip-row{display:flex;justify-content:space-between;gap:10px;margin-top:2px}
.kc-empty-chart{padding:36px 20px;text-align:center;border:1px dashed var(--kc-border-strong);border-radius:var(--kc-r-md);color:var(--kc-text-2)}

/* ---- tables ---- */
.kc-table-scroll{width:100%;overflow-x:auto}
.kc-table td:first-child,.kc-table th:first-child{padding-left:18px;min-width:130px}
.kc-table td:last-child,.kc-table th:last-child{padding-right:18px}
.kc-table{width:100%;border-collapse:collapse;text-align:left}
.kc-table th{padding:11px 12px;font-size:.82rem;font-weight:700;color:var(--kc-text-2);background:var(--kc-surface-2);border-bottom:1px solid var(--kc-border);white-space:nowrap}
.kc-table td{padding:12px 12px;font-size:.92rem;border-bottom:1px solid var(--kc-border);vertical-align:middle}
.kc-table tbody tr:last-child td{border-bottom:none}
.kc-table tbody tr.kc-row-click{cursor:pointer}
.kc-table tbody tr.kc-row-click:hover{background:var(--kc-surface-2)}
.kc-row-detail td{background:var(--kc-surface-2);padding:16px 20px}
.kc-group-row td{background:var(--kc-surface-2);font-weight:700;font-size:.85rem;color:var(--kc-text-2)}
.kc-mini-bar{display:inline-block;width:64px;height:8px;border-radius:999px;background:var(--kc-border);overflow:hidden;vertical-align:middle;margin-right:8px}
.kc-mini-fill{display:block;height:100%;border-radius:999px}
.kc-progress-track{width:100%;height:8px;border-radius:999px;background:var(--kc-surface-2);border:1px solid var(--kc-border);overflow:hidden}
.kc-progress-fill{height:100%;background:var(--kc-primary);border-radius:999px;transition:width .3s ease}
.kc-kv{display:grid;grid-template-columns:auto 1fr;gap:5px 16px;font-size:.92rem;margin:0}
.kc-kv dt{color:var(--kc-text-3);font-weight:600}.kc-kv dd{margin:0;font-weight:600}

/* ---- plan calendar ---- */
.kc-cal{display:grid;grid-template-columns:96px repeat(7,minmax(112px,1fr));gap:1px;background:var(--kc-border);border:1px solid var(--kc-border);border-radius:var(--kc-r-md);overflow:hidden;min-width:900px}
.kc-cal>div{background:var(--kc-surface);padding:6px 7px;min-height:46px;font-size:.78rem}
.kc-cal .kc-cal-h{background:var(--kc-surface-2);font-weight:700;color:var(--kc-text-2);min-height:0}
.kc-cal .kc-cal-wk{background:var(--kc-surface-2);font-weight:700;color:var(--kc-text-2)}
.kc-cal-date{color:var(--kc-text-3);margin-bottom:3px}
.kc-cal-today{box-shadow:inset 0 0 0 2px var(--kc-primary)}
.kc-cal-chip{display:block;margin-top:3px;padding:2px 6px;border-radius:6px;border:1px solid;font-weight:700;line-height:1.3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}

/* ---- import ---- */
.kc-drop{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;text-align:center;padding:28px 20px;border:2px dashed var(--kc-border-strong);border-radius:var(--kc-r-lg);background:var(--kc-surface-2);cursor:pointer;transition:border-color .15s,background .15s}
.kc-drop:hover,.kc-drop.kc-drop-over{border-color:var(--kc-primary);background:var(--kc-primary-soft)}
.kc-drop input{position:absolute;width:1px;height:1px;opacity:0}
.kc-drop:focus-within{outline:3px solid var(--kc-info);outline-offset:2px}
.kc-steps{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:18px}
@media (max-width:860px){.kc-steps{grid-template-columns:1fr}}
.kc-step{display:flex;gap:12px;align-items:flex-start}
.kc-step-n{width:30px;height:30px;border-radius:50%;background:var(--kc-primary-soft);color:var(--kc-primary);border:1px solid var(--kc-primary-border);display:flex;align-items:center;justify-content:center;font-weight:800;flex-shrink:0}

/* ---- notes ---- */
.kc-note{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;padding:10px 0;border-bottom:1px solid var(--kc-border)}
.kc-note:last-child{border-bottom:0}
.kc-note-meta{font-size:.8rem;color:var(--kc-text-3);display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.kc-note-text{margin:2px 0 0;font-size:.93rem;white-space:pre-wrap}

/* ---- plan builder ---- */
.kc-form-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:14px}
.kc-item-card{border:1px solid var(--kc-border);border-radius:var(--kc-r-lg);background:var(--kc-surface);overflow:hidden}
.kc-item-head{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;padding:14px 18px;background:var(--kc-surface-2);border-bottom:1px solid var(--kc-border)}
.kc-item-body{padding:18px;display:flex;flex-direction:column;gap:16px}
.kc-days{display:flex;gap:6px;flex-wrap:wrap}
.kc-day-btn{width:46px;padding:6px 0;border-radius:var(--kc-r-sm);border:1px solid var(--kc-border-strong);background:var(--kc-surface);color:var(--kc-text-2);font-weight:700;font-size:.84rem;cursor:pointer}
.kc-day-btn[aria-pressed="true"]{background:var(--kc-primary);border-color:var(--kc-primary);color:var(--kc-on-primary)}
.kc-high-contrast .kc-day-btn[aria-pressed="true"]{background:#fff;color:#000}
.kc-prog-row{display:grid;grid-template-columns:minmax(150px,1.3fr) repeat(4,minmax(70px,1fr)) auto;gap:10px;align-items:end;padding:10px;border:1px dashed var(--kc-border-strong);border-radius:var(--kc-r-md)}
.kc-builder-bar{position:sticky;bottom:12px;z-index:20;display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap;padding:14px 18px;border:1px solid var(--kc-border-strong);border-radius:var(--kc-r-md);background:var(--kc-surface);box-shadow:0 -10px 30px -18px rgba(0,0,0,.4)}

/* ---- report ---- */
.kc-report{display:flex;flex-direction:column;gap:22px}
.kc-sig{display:grid;grid-template-columns:1fr 1fr;gap:40px;margin-top:18px}
.kc-sig div{border-top:1px solid var(--kc-text-2);padding-top:6px;font-size:.82rem;color:var(--kc-text-2)}
.kc-print-only{display:none}

/* ---- small screens: the rail becomes a top bar ---- */
@media (max-width:900px){
  .kc-app{grid-template-columns:1fr}
  .kc-rail{position:static;height:auto;flex-direction:row;flex-wrap:wrap;align-items:center;gap:10px 16px;padding:12px 14px;border-right:0;border-bottom:1px solid var(--kc-border)}
  .kc-patient{display:none}
  .kc-nav{flex-direction:row;overflow-x:auto;width:100%;order:3;gap:4px}
  .kc-nav-item{width:auto;white-space:nowrap;padding:9px 12px}
  .kc-nav-item[aria-selected="true"]::before{left:10px;right:10px;top:auto;bottom:0;height:3px;width:auto;border-radius:3px 3px 0 0}
  .kc-rail-foot{margin:0 0 0 auto;flex-direction:row;border-top:0;padding:0;align-items:center}
  .kc-rail-foot .kc-label{display:none}
  .kc-content{padding:20px 16px 64px}
  .kc-h1{font-size:1.85rem}
  .kc-toast{left:16px;right:16px;top:12px;max-width:none}
}

/* ---- print: always light, no chrome ---- */
@media print{
  .kc-app.kc-theme-dark,.kc-app.kc-theme-auto,.kc-app.kc-high-contrast{${LIGHT}}
  .kc-app{display:block;background:#fff}
  .kc-rail,.kc-filter-bar,.kc-no-print,.kc-toast{display:none!important}
  .kc-content{padding:0;max-width:none}
  .kc-card,.kc-ledger,.kc-attn-item,.kc-dial{box-shadow:none;break-inside:avoid}
  .kc-print-only{display:block}
  .kc-table-scroll{overflow:visible}
  .kc-stack{gap:18px}
}
`;
