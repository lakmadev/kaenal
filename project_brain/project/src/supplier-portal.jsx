// Supplier Portal — separate-feeling surface for external suppliers
// Distinct teal accent, top-nav layout (no sidebar), narrow scope of pages

const { useState: useSp } = React;

const SP_ACCENT = '#0d9488';
const SP_ACCENT_DARK = '#0f766e';
const SP_ACCENT_SOFT = '#ccfbf1';

const SP = {
  surface: '#ffffff', bg: '#f6fafa', text: '#0f172a', muted: '#64748b',
  border: '#e2e8f0', borderStrong: '#cbd5e1',
  warn: '#f59e0b', danger: '#dc2626', success: '#16a34a',
};

const SupplierTopNav = ({ active, onNav, onExit }) => (
  <div style={{
    background: SP.surface, borderBottom: `1px solid ${SP.border}`,
    boxShadow: '0 1px 0 rgba(15,23,42,0.02)',
  }}>
    {/* Strip */}
    <div style={{
      padding: '6px 24px', background: '#0f172a', color: 'white',
      display: 'flex', alignItems: 'center', gap: 16, fontSize: 11,
    }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, color: 'rgba(255,255,255,0.85)' }}>
        <Icon name="logo" size={13}/> KAENAL Supplier Portal
      </span>
      <span style={{ color: 'rgba(255,255,255,0.5)' }}>·</span>
      <span style={{ color: 'rgba(255,255,255,0.7)' }}>Acme Forging Inc. · Vendor #VEN-3041</span>
      <div style={{ flex: 1 }}/>
      <button onClick={onExit} style={{
        background: 'transparent', border: '1px solid rgba(255,255,255,0.18)', color: 'white',
        padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 500,
        display: 'inline-flex', alignItems: 'center', gap: 4,
      }}>
        <Icon name="arrowLeft" size={11}/> Back to Kaenal app
      </button>
    </div>
    {/* Main bar */}
    <div style={{
      padding: '10px 24px', display: 'flex', alignItems: 'center', gap: 24,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: `linear-gradient(135deg, ${SP_ACCENT}, ${SP_ACCENT_DARK})`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
          <Icon name="truck" size={18} stroke={2}/>
        </div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: '-0.01em' }}>Acme Forging</div>
          <div style={{ fontSize: 11, color: SP.muted }}>Supplier dashboard · Northeast Industrial</div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 4, marginLeft: 12 }}>
        {[
          { id: 'home', label: 'Overview', icon: 'home' },
          { id: 'ncrs', label: 'NCRs assigned', icon: 'alert', badge: 4 },
          { id: 'docs', label: 'Documents', icon: 'doc' },
          { id: 'capa', label: 'Corrective actions', icon: 'brain' },
          { id: 'score', label: 'Scorecard', icon: 'award' },
        ].map(i => (
          <button key={i.id} onClick={() => onNav(i.id)} style={{
            padding: '8px 12px', display: 'inline-flex', alignItems: 'center', gap: 6,
            background: active === i.id ? SP_ACCENT_SOFT : 'transparent',
            color: active === i.id ? SP_ACCENT_DARK : SP.text,
            borderRadius: 8, fontSize: 13, fontWeight: active === i.id ? 600 : 500,
            border: 'none',
          }}>
            <Icon name={i.icon} size={14} stroke={1.75}/>
            {i.label}
            {i.badge && (
              <span style={{
                background: '#dc2626', color: 'white', fontSize: 10, fontWeight: 700,
                padding: '1px 6px', borderRadius: 999, marginLeft: 2,
              }}>{i.badge}</span>
            )}
          </button>
        ))}
      </div>
      <div style={{ flex: 1 }}/>
      <button className="k-btn k-btn-ghost"><Icon name="bell" size={14}/></button>
      <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#0d9488', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700 }}>JM</div>
    </div>
  </div>
);

const SP_NCRS = [
  { id: 'NCR-2026-0184', title: 'Bracket weld bead inconsistent', severity: 'high', status: 'awaiting_capa', due: 'May 8', material: 'Steel forging — Lot ACM-2402', units: 12 },
  { id: 'NCR-2026-0179', title: 'Out-of-spec dimension on flange', severity: 'medium', status: 'in_review', due: 'May 12', material: 'Flange F-204', units: 6 },
  { id: 'NCR-2026-0171', title: 'Surface pitting on shaft batch', severity: 'high', status: 'capa_submitted', due: 'May 5', material: 'Shaft S-19', units: 24 },
  { id: 'NCR-2026-0162', title: 'Missing certificate of conformity', severity: 'low', status: 'awaiting_capa', due: 'May 10', material: 'All shipments WK-17', units: 0 },
];

const SP_StatBadge = ({ label, color, bg }) => (
  <span style={{
    padding: '2px 8px', borderRadius: 999, fontSize: 10, fontWeight: 700,
    background: bg, color, textTransform: 'uppercase', letterSpacing: '0.04em',
  }}>{label}</span>
);

const SupplierOverview = () => (
  <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
    {/* Welcome banner */}
    <div style={{
      padding: 20, borderRadius: 12,
      background: `linear-gradient(135deg, ${SP_ACCENT}, ${SP_ACCENT_DARK})`,
      color: 'white', display: 'flex', alignItems: 'center', gap: 20,
    }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 12, opacity: 0.85, marginBottom: 4, fontWeight: 500 }}>WELCOME BACK, JEN</div>
        <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.01em', marginBottom: 6 }}>Your shipments need attention.</div>
        <div style={{ fontSize: 13, opacity: 0.9 }}>4 NCRs awaiting your response, 1 due in 3 days. Your Q2 scorecard is at 96 — top tier.</div>
      </div>
      <div style={{
        width: 88, height: 88, borderRadius: '50%', background: 'rgba(255,255,255,0.16)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        backdropFilter: 'blur(8px)',
      }}>
        <div style={{ fontSize: 26, fontWeight: 700, lineHeight: 1 }}>96</div>
        <div style={{ fontSize: 9, opacity: 0.85, marginTop: 4 }}>QUALITY</div>
      </div>
    </div>

    {/* KPI grid */}
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
      {[
        { l: 'Open NCRs', v: '4', sub: '1 high · 1 due in 3d', color: '#dc2626' },
        { l: 'On-time delivery', v: '98%', sub: 'last 90 days', color: '#16a34a' },
        { l: 'PPM defect rate', v: '142', sub: 'target ≤ 200', color: '#16a34a' },
        { l: 'Open POs', v: '23', sub: '$1.2M total', color: SP_ACCENT },
      ].map(k => (
        <div key={k.l} className="k-surface" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ fontSize: 11, color: SP.muted, fontWeight: 600 }}>{k.l}</div>
          <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em', color: k.color }}>{k.v}</div>
          <div style={{ fontSize: 11, color: SP.muted }}>{k.sub}</div>
        </div>
      ))}
    </div>

    {/* Two column */}
    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 14 }}>
      {/* Open NCRs */}
      <div className="k-surface" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '14px 16px', borderBottom: `1px solid ${SP.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 14, fontWeight: 600 }}>NCRs assigned to you</div>
          <button style={{ fontSize: 12, color: SP_ACCENT, background: 'transparent', border: 'none', fontWeight: 500 }}>View all →</button>
        </div>
        {SP_NCRS.slice(0, 3).map(n => (
          <div key={n.id} style={{ padding: '14px 16px', borderBottom: `1px solid ${SP.border}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 11, color: SP.muted, fontWeight: 700 }}>{n.id}</span>
              <SP_StatBadge label={n.severity} color={n.severity === 'high' ? '#991b1b' : n.severity === 'medium' ? '#92400e' : '#475569'}
                bg={n.severity === 'high' ? '#fee2e2' : n.severity === 'medium' ? '#fef3c7' : '#e2e8f0'}/>
              {n.status === 'awaiting_capa' && <SP_StatBadge label="action needed" color="#7f1d1d" bg="#fee2e2"/>}
              {n.status === 'in_review' && <SP_StatBadge label="in review" color="#1e40af" bg="#dbeafe"/>}
              {n.status === 'capa_submitted' && <SP_StatBadge label="awaiting QA" color="#7c3aed" bg="#ede9fe"/>}
              <div style={{ flex: 1 }}/>
              <span style={{ fontSize: 11, color: SP.muted }}>Due {n.due}</span>
            </div>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>{n.title}</div>
            <div style={{ fontSize: 11.5, color: SP.muted, display: 'flex', gap: 12 }}>
              <span>{n.material}</span>
              {n.units > 0 && <><span>·</span><span>{n.units} units affected</span></>}
            </div>
            {n.status === 'awaiting_capa' && (
              <div style={{ marginTop: 10, display: 'flex', gap: 6 }}>
                <button style={{ padding: '6px 12px', background: SP_ACCENT, color: 'white', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600 }}>Submit 8D response</button>
                <button style={{ padding: '6px 12px', background: 'transparent', color: SP.muted, border: `1px solid ${SP.border}`, borderRadius: 6, fontSize: 12, fontWeight: 500 }}>Request extension</button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Activity */}
      <div className="k-surface" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '14px 16px', borderBottom: `1px solid ${SP.border}`, fontSize: 14, fontWeight: 600 }}>Recent activity</div>
        {[
          { who: 'Lin Wei (Kaenal QA)', what: 'reviewed your 8D response on NCR-2026-0171', when: '2h ago', icon: 'check', color: SP_ACCENT },
          { who: 'You', what: 'uploaded MTR for Lot ACM-2402', when: 'yesterday', icon: 'doc', color: '#6366f1' },
          { who: 'Sara Chen', what: 'added a comment to NCR-2026-0184', when: '2d ago', icon: 'msg', color: '#3b82f6' },
          { who: 'System', what: 'calculated Q2 scorecard — 96', when: '3d ago', icon: 'award', color: '#9333ea' },
        ].map((a, i, arr) => (
          <div key={i} style={{ padding: '12px 16px', borderBottom: i < arr.length - 1 ? `1px solid ${SP.border}` : 'none', display: 'flex', gap: 10 }}>
            <div style={{ width: 26, height: 26, borderRadius: 7, background: a.color + '18', color: a.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Icon name={a.icon} size={13}/>
            </div>
            <div style={{ flex: 1, fontSize: 12, lineHeight: 1.5 }}>
              <span style={{ fontWeight: 600 }}>{a.who}</span> {a.what}
              <div style={{ fontSize: 10.5, color: SP.muted, marginTop: 2 }}>{a.when}</div>
            </div>
          </div>
        ))}
      </div>
    </div>

    {/* Scorecard mini */}
    <div className="k-surface" style={{ padding: 18 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600 }}>Q2 2026 scorecard</div>
          <div style={{ fontSize: 11, color: SP.muted, marginTop: 2 }}>Across all categories · weighted</div>
        </div>
        <SP_StatBadge label="Tier 1 Preferred" color={SP_ACCENT_DARK} bg={SP_ACCENT_SOFT}/>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 14 }}>
        {[
          { l: 'Quality', v: 96, b: '#16a34a' },
          { l: 'Delivery', v: 98, b: '#16a34a' },
          { l: 'Cost', v: 88, b: '#16a34a' },
          { l: 'Responsiveness', v: 91, b: '#16a34a' },
          { l: 'Documentation', v: 84, b: '#f59e0b' },
        ].map(s => (
          <div key={s.l}>
            <div style={{ fontSize: 11, color: SP.muted, marginBottom: 6, fontWeight: 500 }}>{s.l}</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 6 }}>
              <span style={{ fontSize: 22, fontWeight: 700, color: s.b }}>{s.v}</span>
              <span style={{ fontSize: 11, color: SP.muted }}>/ 100</span>
            </div>
            <div style={{ height: 4, background: SP.bg, borderRadius: 999, overflow: 'hidden' }}>
              <div style={{ width: s.v + '%', height: '100%', background: s.b }}/>
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>
);

const SupplierNCRs = () => (
  <div style={{ padding: 24 }}>
    <div className="k-surface" style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{ padding: '16px 18px', borderBottom: `1px solid ${SP.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 600 }}>NCRs assigned to Acme Forging</div>
          <div style={{ fontSize: 12, color: SP.muted, marginTop: 2 }}>4 active · respond within SLA to keep your scorecard intact</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="k-btn k-btn-ghost"><Icon name="filter" size={14}/>Filter</button>
          <button className="k-btn k-btn-ghost"><Icon name="download" size={14}/>Export</button>
        </div>
      </div>
      <table className="k-table" style={{ width: '100%' }}>
        <thead>
          <tr>
            <th>NCR ID</th><th>Title</th><th>Severity</th><th>Status</th><th>Material / Lot</th><th>Units</th><th>Due</th><th></th>
          </tr>
        </thead>
        <tbody>
          {SP_NCRS.map(n => (
            <tr key={n.id}>
              <td><span className="mono" style={{ fontWeight: 600 }}>{n.id}</span></td>
              <td>{n.title}</td>
              <td><SP_StatBadge label={n.severity} color={n.severity === 'high' ? '#991b1b' : n.severity === 'medium' ? '#92400e' : '#475569'}
                bg={n.severity === 'high' ? '#fee2e2' : n.severity === 'medium' ? '#fef3c7' : '#e2e8f0'}/></td>
              <td>
                {n.status === 'awaiting_capa' && <SP_StatBadge label="action needed" color="#7f1d1d" bg="#fee2e2"/>}
                {n.status === 'in_review' && <SP_StatBadge label="in review" color="#1e40af" bg="#dbeafe"/>}
                {n.status === 'capa_submitted' && <SP_StatBadge label="awaiting QA" color="#7c3aed" bg="#ede9fe"/>}
              </td>
              <td style={{ fontSize: 12, color: SP.muted }}>{n.material}</td>
              <td className="mono">{n.units || '—'}</td>
              <td>{n.due}</td>
              <td><button style={{ padding: '4px 10px', background: SP_ACCENT_SOFT, color: SP_ACCENT_DARK, border: 'none', borderRadius: 6, fontSize: 11, fontWeight: 600 }}>Open</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

const SupplierDocs = () => (
  <div style={{ padding: 24 }}>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 16 }}>
      {[
        { l: 'Pending uploads', v: 3, c: '#f59e0b' },
        { l: 'Approved', v: 47, c: SP_ACCENT },
        { l: 'Expiring < 30d', v: 2, c: '#dc2626' },
      ].map(k => (
        <div key={k.l} className="k-surface" style={{ padding: 16 }}>
          <div style={{ fontSize: 12, color: SP.muted, fontWeight: 500 }}>{k.l}</div>
          <div style={{ fontSize: 26, fontWeight: 700, color: k.c, marginTop: 4 }}>{k.v}</div>
        </div>
      ))}
    </div>
    <div className="k-surface" style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{ padding: '14px 18px', borderBottom: `1px solid ${SP.border}`, fontSize: 14, fontWeight: 600 }}>Required documents</div>
      {[
        { name: 'ISO 9001:2015 Certificate', state: 'approved', exp: 'Expires Mar 2027', icon: 'shield' },
        { name: 'IATF 16949 Certificate', state: 'approved', exp: 'Expires Aug 2026', icon: 'shield' },
        { name: 'Material Test Report — Lot ACM-2402', state: 'pending', exp: 'Uploaded yesterday', icon: 'doc' },
        { name: 'PPAP Level 3 — Part B-1042', state: 'requested', exp: 'Due May 15', icon: 'doc' },
        { name: 'REACH/RoHS Compliance Statement', state: 'approved', exp: 'Expires Dec 2026', icon: 'doc' },
        { name: 'Insurance Certificate', state: 'expiring', exp: 'Expires May 28', icon: 'shield' },
      ].map((d, i, arr) => (
        <div key={d.name} style={{ padding: '12px 18px', borderBottom: i < arr.length - 1 ? `1px solid ${SP.border}` : 'none', display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 36, height: 36, borderRadius: 8, background: SP.bg, color: SP.muted, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name={d.icon} size={16}/>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 500 }}>{d.name}</div>
            <div style={{ fontSize: 11, color: SP.muted, marginTop: 2 }}>{d.exp}</div>
          </div>
          {d.state === 'approved' && <SP_StatBadge label="approved" color={SP_ACCENT_DARK} bg={SP_ACCENT_SOFT}/>}
          {d.state === 'pending' && <SP_StatBadge label="QA review" color="#7c3aed" bg="#ede9fe"/>}
          {d.state === 'requested' && <SP_StatBadge label="requested" color="#92400e" bg="#fef3c7"/>}
          {d.state === 'expiring' && <SP_StatBadge label="expiring soon" color="#991b1b" bg="#fee2e2"/>}
          <button style={{ padding: '6px 10px', background: 'transparent', color: SP_ACCENT, border: `1px solid ${SP.border}`, borderRadius: 6, fontSize: 11, fontWeight: 600 }}>
            {d.state === 'requested' || d.state === 'expiring' ? 'Upload' : 'View'}
          </button>
        </div>
      ))}
    </div>
  </div>
);

const SupplierCAPA = () => (
  <div style={{ padding: 24 }}>
    <div className="k-surface" style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{ padding: '16px 20px', borderBottom: `1px solid ${SP.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 14, color: SP.muted, fontWeight: 500 }}>NCR-2026-0184 · 8D response</div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>Bracket weld bead inconsistent</div>
        </div>
        <span style={{ padding: '4px 10px', background: '#fef3c7', color: '#92400e', borderRadius: 999, fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>D3 of 8 · Due May 8</span>
      </div>
      <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
        {[
          { d: 'D1', l: 'Team', s: 'done', desc: 'Cross-functional team identified · 4 members' },
          { d: 'D2', l: 'Problem description', s: 'done', desc: 'Porosity in weld bead on bracket SN-A2104, 12 units in lot ACM-2402' },
          { d: 'D3', l: 'Containment actions', s: 'active', desc: 'Quarantine remaining lot, halt outgoing shipments — needs your input' },
          { d: 'D4', l: 'Root cause analysis', s: 'pending', desc: '5-Why or fishbone — uses inputs from D2' },
          { d: 'D5', l: 'Corrective actions', s: 'pending' },
          { d: 'D6', l: 'Implementation', s: 'pending' },
          { d: 'D7', l: 'Preventive actions', s: 'pending' },
          { d: 'D8', l: 'Closure & recognition', s: 'pending' },
        ].map(s => (
          <div key={s.d} style={{
            display: 'flex', gap: 14, alignItems: 'flex-start',
            padding: 14,
            borderRadius: 10,
            border: `1px solid ${s.s === 'active' ? SP_ACCENT : SP.border}`,
            background: s.s === 'active' ? SP_ACCENT_SOFT : s.s === 'done' ? '#f0fdf4' : SP.surface,
          }}>
            <div style={{
              width: 32, height: 32, borderRadius: '50%',
              background: s.s === 'done' ? SP_ACCENT : s.s === 'active' ? 'white' : SP.bg,
              color: s.s === 'done' ? 'white' : s.s === 'active' ? SP_ACCENT : SP.muted,
              border: s.s === 'active' ? `2px solid ${SP_ACCENT}` : 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              fontSize: 12, fontWeight: 700,
            }}>
              {s.s === 'done' ? <Icon name="check" size={14} stroke={3}/> : s.d}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>{s.d} · {s.l}</div>
              {s.desc && <div style={{ fontSize: 12, color: SP.muted, lineHeight: 1.5 }}>{s.desc}</div>}
              {s.s === 'active' && (
                <div style={{ marginTop: 12, padding: 12, background: 'white', borderRadius: 8, border: `1px solid ${SP.border}` }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: SP.muted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Your response</div>
                  <textarea placeholder="Describe interim containment actions taken at your facility…" style={{ width: '100%', height: 80, padding: 10, border: `1px solid ${SP.border}`, borderRadius: 6, fontSize: 13, fontFamily: 'inherit', resize: 'vertical' }}/>
                  <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                    <button style={{ padding: '6px 14px', background: SP_ACCENT, color: 'white', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600 }}>Submit D3</button>
                    <button style={{ padding: '6px 14px', background: 'transparent', color: SP.muted, border: `1px solid ${SP.border}`, borderRadius: 6, fontSize: 12, fontWeight: 500 }}>Save draft</button>
                    <div style={{ flex: 1 }}/>
                    <button style={{ padding: '6px 10px', background: 'transparent', color: SP.muted, border: 'none', fontSize: 11, fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <Icon name="paperclip" size={11}/> Attach evidence
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>
);

const SupplierScore = () => (
  <div style={{ padding: 24, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
    <div className="k-surface" style={{ padding: 24, gridColumn: 'span 2' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
        <div style={{
          width: 110, height: 110, borderRadius: '50%',
          background: `conic-gradient(${SP_ACCENT} 0 ${96 * 3.6}deg, ${SP.bg} ${96 * 3.6}deg)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{ width: 88, height: 88, borderRadius: '50%', background: SP.surface, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ fontSize: 30, fontWeight: 700, color: SP_ACCENT }}>96</div>
            <div style={{ fontSize: 10, color: SP.muted, fontWeight: 600 }}>Q2 2026</div>
          </div>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Tier 1 Preferred Supplier</div>
          <div style={{ fontSize: 13, color: SP.muted, lineHeight: 1.5 }}>You're outperforming 87% of suppliers in this category. Documentation timeliness is your one improvement area — see breakdown below.</div>
          <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
            <SP_StatBadge label="↑ 4 from Q1" color="#166534" bg="#dcfce7"/>
            <SP_StatBadge label="2-year preferred" color={SP_ACCENT_DARK} bg={SP_ACCENT_SOFT}/>
          </div>
        </div>
      </div>
    </div>
    <div className="k-surface" style={{ padding: 18 }}>
      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 14 }}>Score breakdown</div>
      {[
        { l: 'Quality (PPM, NCR rate)', v: 96, w: 35 },
        { l: 'On-time delivery', v: 98, w: 25 },
        { l: 'Cost competitiveness', v: 88, w: 15 },
        { l: 'Responsiveness (NCR/CAPA SLA)', v: 91, w: 15 },
        { l: 'Documentation completeness', v: 84, w: 10 },
      ].map(c => (
        <div key={c.l} style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
            <span style={{ color: SP.muted }}>{c.l} <span style={{ fontSize: 10 }}>({c.w}%)</span></span>
            <span className="mono" style={{ fontWeight: 700, color: c.v >= 90 ? SP_ACCENT : c.v >= 80 ? '#f59e0b' : '#dc2626' }}>{c.v}</span>
          </div>
          <div style={{ height: 6, background: SP.bg, borderRadius: 999 }}>
            <div style={{ width: c.v + '%', height: '100%', background: c.v >= 90 ? SP_ACCENT : c.v >= 80 ? '#f59e0b' : '#dc2626', borderRadius: 999 }}/>
          </div>
        </div>
      ))}
    </div>
    <div className="k-surface" style={{ padding: 18 }}>
      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>4-quarter trend</div>
      <div style={{ fontSize: 11, color: SP.muted, marginBottom: 12 }}>Composite score Q3 2025 → Q2 2026</div>
      <svg viewBox="0 0 280 140" style={{ width: '100%', display: 'block' }}>
        {[88, 91, 92, 96].map((v, i, arr) => {
          const x = 30 + (i / (arr.length - 1)) * 220;
          const y = 130 - (v - 70) * 3.5;
          return (
            <g key={i}>
              {i > 0 && (() => {
                const px = 30 + ((i - 1) / (arr.length - 1)) * 220;
                const py = 130 - (arr[i - 1] - 70) * 3.5;
                return <line x1={px} y1={py} x2={x} y2={y} stroke={SP_ACCENT} strokeWidth="2.5"/>;
              })()}
              <circle cx={x} cy={y} r="6" fill="white" stroke={SP_ACCENT} strokeWidth="2.5"/>
              <text x={x} y={y - 12} textAnchor="middle" fontSize="11" fontWeight="700" fill={SP_ACCENT}>{v}</text>
              <text x={x} y={144} textAnchor="middle" fontSize="10" fill={SP.muted}>{['Q3 25', 'Q4 25', 'Q1 26', 'Q2 26'][i]}</text>
            </g>
          );
        })}
      </svg>
    </div>
  </div>
);

const SupplierPortal = ({ setRoute }) => {
  const [page, setPage] = useSp('home');
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 50,
      background: SP.bg, display: 'flex', flexDirection: 'column',
      overflowY: 'auto',
    }}>
      <SupplierTopNav active={page} onNav={setPage} onExit={() => setRoute('dashboard')}/>
      <div style={{ flex: 1 }}>
        {page === 'home' && <SupplierOverview/>}
        {page === 'ncrs' && <SupplierNCRs/>}
        {page === 'docs' && <SupplierDocs/>}
        {page === 'capa' && <SupplierCAPA/>}
        {page === 'score' && <SupplierScore/>}
      </div>
    </div>
  );
};

Object.assign(window, { SupplierPortal });
