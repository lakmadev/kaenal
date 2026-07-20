// Kaenal — Predictive Risk Dashboard
// Forecasts which production lines & suppliers are likely to generate NCs next
// quarter (leading indicators) + cross-tenant anonymized recurring failure modes.
// Predicted is rendered distinctly from actual everywhere: actual = solid slate,
// predicted = dashed amber with an 80% confidence fan.

const PRED_ACTUAL = '#94a3b8';   // muted slate — observed / actual
const PRED_FORE   = '#d97706';   // amber-600 — projected / predicted
const PRED_FORE_FILL = 'rgba(217,119,6,0.13)';

// ─────────────────────────────────────────────────────────────
// Forecast sparkline — actual (solid) → predicted (dashed) + conf band
// ─────────────────────────────────────────────────────────────
function ForecastSpark({ hist, fore, band = 0.22, width = 168, height = 52 }) {
  const padX = 5, padT = 7, padB = 9;
  const all = [...hist, ...fore];
  const n = all.length;
  const split = hist.length - 1;             // index of "now"

  const lo = [], hi = [];
  fore.forEach((v, i) => {
    const spread = band * ((i + 1) / fore.length) * Math.max(v, 1);
    lo.push(v - spread); hi.push(v + spread);
  });
  const bandHi = [hist[split], ...hi];
  const bandLo = [hist[split], ...lo];

  const vals = [...all, ...bandHi, ...bandLo, 0];
  const min = Math.min(...vals), max = Math.max(...vals);
  const range = max - min || 1;
  const x = i => padX + (i / (n - 1)) * (width - padX * 2);
  const y = v => padT + (1 - (v - min) / range) * (height - padT - padB);

  const actualPts = hist.map((v, i) => [x(i), y(v)]);
  const forePts = [[x(split), y(hist[split])], ...fore.map((v, i) => [x(split + 1 + i), y(v)])];
  const hiPts = bandHi.map((v, k) => [x(split + k), y(v)]);
  const loPts = bandLo.map((v, k) => [x(split + k), y(v)]);
  const bandPath =
    'M' + hiPts.map(p => p.join(',')).join(' L') +
    ' L' + loPts.slice().reverse().map(p => p.join(',')).join(' L') + ' Z';
  const toLine = pts => pts.map((p, i) => `${i ? 'L' : 'M'}${p[0]},${p[1]}`).join(' ');

  return (
    <svg width={width} height={height} style={{ display: 'block', flexShrink: 0 }}>
      {/* confidence fan */}
      <path d={bandPath} fill={PRED_FORE_FILL} stroke="none" />
      {/* now divider */}
      <line x1={x(split)} x2={x(split)} y1={padT - 3} y2={height - padB + 2}
        stroke="var(--border-strong)" strokeWidth="1" strokeDasharray="2 2" />
      {/* actual */}
      <path d={toLine(actualPts)} fill="none" stroke={PRED_ACTUAL} strokeWidth="1.75"
        strokeLinecap="round" strokeLinejoin="round" />
      {/* predicted */}
      <path d={toLine(forePts)} fill="none" stroke={PRED_FORE} strokeWidth="2"
        strokeDasharray="4 2.5" strokeLinecap="round" strokeLinejoin="round" />
      {/* now node (hollow) */}
      <circle cx={x(split)} cy={y(hist[split])} r="2.6" fill="var(--surface)" stroke={PRED_ACTUAL} strokeWidth="1.6" />
      {/* predicted terminal node (filled) */}
      <circle cx={forePts[forePts.length - 1][0]} cy={forePts[forePts.length - 1][1]} r="3.2" fill={PRED_FORE} />
    </svg>
  );
}

// Tiny rising/falling industry sparkline (single solid trend)
function MiniTrend({ data, color, width = 70, height = 24 }) {
  const min = Math.min(...data), max = Math.max(...data), range = max - min || 1;
  const pts = data.map((v, i) => [
    (i / (data.length - 1)) * (width - 4) + 2,
    height - 3 - ((v - min) / range) * (height - 6),
  ]);
  return (
    <svg width={width} height={height} style={{ display: 'block' }}>
      <path d={pts.map((p, i) => `${i ? 'L' : 'M'}${p[0]},${p[1]}`).join(' ')}
        fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="2.2" fill={color} />
    </svg>
  );
}

const PRED_LEVELS = {
  critical: { label: 'Critical', fg: '#b91c1c', bg: 'rgba(220,38,38,0.10)', dot: '#dc2626' },
  high:     { label: 'High',     fg: '#c2410c', bg: 'rgba(234,88,12,0.12)', dot: '#ea580c' },
  medium:   { label: 'Watch',    fg: '#b45309', bg: 'rgba(245,158,11,0.13)', dot: '#f59e0b' },
  low:      { label: 'Stable',   fg: '#15803d', bg: 'rgba(34,197,94,0.13)', dot: '#22c55e' },
};

// ─────────────────────────────────────────────────────────────
// DATA — forecasts (gradient-boosted NC volume model, synthetic)
// ─────────────────────────────────────────────────────────────
const FORECAST_LINES = [
  { id: 'L4',  name: 'Line 4 — Robotic weld', sub: 'VBR-3041 hub bracket', hist: [2,3,3,4,5,7], fore: [10,12], pred: 10, level: 'critical', conf: 88, driver: 'Cpk 0.84 ↓ · WE runs-rule active', route: 'spc' },
  { id: 'S3B', name: 'Station 3B — Fillet weld', sub: 'A-7742 hinge', hist: [4,5,4,6,6,8], fore: [9,10], pred: 9, level: 'high', conf: 82, driver: 'Gas-regulator drift · porosity 8D recurring', route: 'spc' },
  { id: 'L1',  name: 'Line 1 — Grinding', sub: 'BHS-12 surface finish', hist: [3,4,3,3,4,4], fore: [5,6], pred: 5, level: 'medium', conf: 71, driver: 'Wheel-dressing interval slipping', route: 'spc' },
  { id: 'L2',  name: 'Line 2 — CMM hub bore', sub: 'Roundness / MMC', hist: [3,2,3,2,2,3], fore: [3,2], pred: 3, level: 'medium', conf: 74, driver: '3 senior CMM operators retiring Q3', route: 'msa' },
  { id: 'L7',  name: 'Line 7 — Assembly torque', sub: 'F-204 fastener', hist: [2,2,1,2,1,1], fore: [1,1], pred: 1, level: 'low', conf: 79, driver: 'Auto-torque logging live · stable', route: 'spc' },
];

const FORECAST_SUPPLIERS = [
  { id: 'SUP-0203', name: 'Bharat Forge Wheels', sub: 'T-9384 hub · Tier 1', hist: [1,2,2,3,4,5], fore: [7,8], pred: 7, level: 'critical', conf: 86, driver: 'Field-failure cluster · 8D in flight' },
  { id: 'SUP-0188', name: 'Ningbo CastingWorks', sub: 'BHS-12 housing · Tier 2', hist: [3,3,4,4,5,5], fore: [6,7], pred: 6, level: 'high', conf: 80, driver: 'Porosity PPM ↑ · IATF cert expires Sep' },
  { id: 'SUP-0167', name: 'Continental Polymer', sub: 'IM-258 clip · Tier 2', hist: [2,2,3,3,3,4], fore: [5,5], pred: 5, level: 'high', conf: 77, driver: 'IATF cert expires Jun 18 — 17 days' },
  { id: 'SUP-0245', name: 'Wuhan Hsing Sheet Metal', sub: 'ER70S coil · raw', hist: [2,3,2,3,3,3], fore: [4,4], pred: 4, level: 'medium', conf: 70, driver: 'Inbound coil chemistry variance' },
  { id: 'SUP-0094', name: 'Aichi Kogyo Fasteners', sub: 'F-204 bolt · Tier 2', hist: [2,1,1,1,1,1], fore: [1,1], pred: 1, level: 'low', conf: 81, driver: 'SCAR closed · stable 6 months' },
];

const FAILURE_MODES = [
  { mode: 'Gas porosity in robotic fillet welds', cls: 'Weldments', sites: 41, qoq: 28, trend: [3,4,4,5,6,8,9], exposure: 'Station 3B · Line 4', expRoute: 'spc' },
  { mode: 'Die-cast aluminum gas inclusion', cls: 'Castings', sites: 38, qoq: 15, trend: [4,4,5,5,6,6,7], exposure: 'Ningbo · BHS-12', expRoute: 'supplier', expId: 'SUP-0188' },
  { mode: 'Hub-bore roundness drift after stylus wear', cls: 'Machined bearings', sites: 33, qoq: 19, trend: [2,3,3,4,4,5,6], exposure: 'Line 2 CMM', expRoute: 'msa' },
  { mode: 'Class 10.9 fastener hydrogen embrittlement', cls: 'Fasteners', sites: 27, qoq: 22, trend: [1,2,2,3,4,4,5], exposure: 'F-204 / F-205 (Aichi)', expRoute: 'supplier', expId: 'SUP-0094' },
  { mode: 'Injection-mould weld-line cracking on clips', cls: 'Polymer trim', sites: 24, qoq: 11, trend: [2,2,3,3,3,4,4], exposure: 'Continental · IM-258', expRoute: 'supplier', expId: 'SUP-0167' },
];

// ─────────────────────────────────────────────────────────────
// Leading-indicator row
// ─────────────────────────────────────────────────────────────
function LeadRow({ r, onOpen }) {
  const lv = PRED_LEVELS[r.level];
  const now = r.hist[r.hist.length - 1];
  const delta = r.pred - now;
  return (
    <button onClick={onOpen} style={{
      display: 'grid', gridTemplateColumns: '1fr 168px 92px', gap: 14, alignItems: 'center',
      width: '100%', textAlign: 'left', padding: '11px 12px', borderRadius: 'var(--r-md)',
      border: '1px solid var(--border)', background: 'var(--surface)', transition: 'all 120ms',
    }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-strong)'; e.currentTarget.style.background = 'var(--bg-subtle)'; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--surface)'; }}
    >
      {/* identity + driver */}
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: lv.dot, flexShrink: 0 }} />
          <span style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.name}</span>
          <span className="k-chip" style={{ background: lv.bg, color: lv.fg, flexShrink: 0 }}>{lv.label}</span>
        </div>
        <div style={{ fontSize: 11.5, color: 'var(--text-muted)', margin: '3px 0 0 15px' }}>{r.sub}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, margin: '6px 0 0 15px', fontSize: 11, color: 'var(--text-muted)' }}>
          <Icon name="zap" size={11} style={{ color: lv.dot }} />
          <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.driver}</span>
        </div>
      </div>
      {/* forecast spark */}
      <ForecastSpark hist={r.hist} fore={r.fore} />
      {/* predicted figure */}
      <div style={{ textAlign: 'right' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'flex-end', gap: 3 }}>
          <span className="mono" style={{ fontSize: 23, fontWeight: 700, color: PRED_FORE, lineHeight: 1 }}>{r.pred}</span>
          <span style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>NC</span>
        </div>
        <div style={{ fontSize: 9.5, color: 'var(--text-subtle)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, marginTop: 1 }}>predicted</div>
        <div className="mono" style={{ fontSize: 11, fontWeight: 600, marginTop: 3, color: delta > 0 ? '#c2410c' : delta < 0 ? '#15803d' : 'var(--text-muted)' }}>
          {delta > 0 ? '↑' : delta < 0 ? '↓' : '→'} {delta > 0 ? '+' : ''}{delta} vs now
        </div>
        <div style={{ fontSize: 10, color: 'var(--text-subtle)', marginTop: 2 }}>{r.conf}% conf.</div>
      </div>
    </button>
  );
}

// ─────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────
function PredictiveRisk({ setRoute, setSupplier, setNcr }) {
  const [horizon, setHorizon] = React.useState('q');

  const openLine = (r) => setRoute(r.route || 'spc');
  const openSupplier = (r) => { setSupplier(r.id); setRoute('supplier-detail'); };
  const openExposure = (m) => {
    if (m.expRoute === 'supplier' && m.expId) { setSupplier(m.expId); setRoute('supplier-detail'); }
    else setRoute(m.expRoute || 'spc');
  };

  const kpis = [
    { l: 'Predicted NCs · next Q', v: '64', sub: '48 this quarter', delta: '+33%', c: PRED_FORE, up: true },
    { l: 'Production lines flagged', v: '3', sub: 'of 9 lines', delta: '↑ rising', c: '#dc2626' },
    { l: 'Suppliers flagged', v: '4', sub: 'of 11 active', delta: '↑ rising', c: '#ea580c' },
    { l: 'Model confidence', v: '80%', sub: 'avg across forecasts', c: '#2563eb' },
    { l: 'Forecast accuracy', v: '91%', sub: 'last 4Q backtest', delta: 'MAPE 9%', c: '#16a34a' },
  ];

  return (
    <div className="fade-in">
      <PageHeader
        title="Predictive risk"
        description="Forward-looking NC forecasts for production lines and suppliers, plus anonymized failure-mode patterns trending across the industry cohort."
        actions={
          <>
            <Segmented size="sm" value={horizon} onChange={setHorizon} options={[
              { value: 'm', label: 'Next month' }, { value: 'q', label: 'Next quarter' }, { value: 'h', label: 'Next 2Q' },
            ]} />
            <button className="k-btn k-btn-ghost" onClick={() => kToast('Export started — forecast-pack.pdf')}><Icon name="download" size={13} /> Forecast pack</button>
            <button className="k-btn k-btn-primary" onClick={() => kToast('Model tuning requires the Intelligence admin role — request sent')}><Icon name="settings" size={13} /> Tune model</button>
          </>
        }
      />

      <div style={{ padding: '18px 28px 36px' }}>
        {/* KPI strip */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10, marginBottom: 16 }}>
          {kpis.map(k => (
            <div key={k.l} className="k-surface" style={{ padding: 13 }}>
              <div style={{ fontSize: 10.5, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.03em' }}>{k.l}</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 4 }}>
                <span className="mono" style={{ fontSize: 24, fontWeight: 700, color: k.c }}>{k.v}</span>
                {k.delta && <span className="mono" style={{ fontSize: 11, fontWeight: 600, color: k.up ? PRED_FORE : k.c }}>{k.delta}</span>}
              </div>
              <div style={{ fontSize: 10.5, color: 'var(--text-subtle)', marginTop: 1 }}>{k.sub}</div>
            </div>
          ))}
        </div>

        {/* Model banner + legend */}
        <div className="k-surface" style={{ padding: '12px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
            <span style={{ display: 'inline-flex', padding: 7, borderRadius: 8, background: 'var(--accent-soft)', color: 'var(--accent)' }}><Icon name="sparkles" size={15} /></span>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 12.5, fontWeight: 600 }}>NC-Forecast v3 · gradient-boosted</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Retrained weekly · features: SPC drift, PPM trend, audit findings, calibration-due, operator churn</div>
            </div>
          </div>
          {/* predicted-vs-actual legend */}
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 16, fontSize: 11, color: 'var(--text-muted)' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <svg width="22" height="8"><line x1="1" y1="4" x2="21" y2="4" stroke={PRED_ACTUAL} strokeWidth="2" /></svg> Actual
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <svg width="22" height="8"><line x1="1" y1="4" x2="21" y2="4" stroke={PRED_FORE} strokeWidth="2" strokeDasharray="4 2.5" /></svg> Predicted
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 16, height: 10, borderRadius: 2, background: PRED_FORE_FILL, border: `1px solid ${PRED_FORE}55` }} /> 80% band
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <svg width="10" height="12"><line x1="5" y1="0" x2="5" y2="12" stroke="var(--border-strong)" strokeWidth="1" strokeDasharray="2 2" /></svg> Now
            </span>
          </div>
        </div>

        {/* LEADING INDICATORS — two panels */}
        <div className="k-overline" style={{ marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Icon name="trending" size={13} style={{ color: 'var(--accent)' }} /> Leading indicators — likely to generate NCs next quarter
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 26 }}>
          <Card title="Production lines" desc="Ranked by predicted NC volume · next quarter">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {FORECAST_LINES.map(r => <LeadRow key={r.id} r={r} onOpen={() => openLine(r)} />)}
            </div>
          </Card>
          <Card title="Suppliers" desc="Ranked by predicted NC volume · next quarter">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {FORECAST_SUPPLIERS.map(r => <LeadRow key={r.id} r={r} onOpen={() => openSupplier(r)} />)}
            </div>
          </Card>
        </div>

        {/* RECURRING FAILURE MODES — cross-tenant anonymized */}
        <div className="k-surface" style={{ overflow: 'hidden' }}>
          <div style={{ padding: '16px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'flex-start', gap: 14, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 240 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                <span style={{ display: 'inline-flex', padding: 7, borderRadius: 8, background: 'rgba(124,58,237,0.10)', color: '#7c3aed' }}><Icon name="globe" size={15} /></span>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>Recurring failure modes</div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>Cross-tenant patterns rising across your industry cohort, matched to your exposure</div>
                </div>
              </div>
            </div>
            <span className="k-chip" style={{ background: 'rgba(124,58,237,0.10)', color: '#6d28d9', height: 24 }}>
              <Icon name="shield" size={11} /> Anonymized · differential privacy
            </span>
          </div>

          {/* privacy note */}
          <div style={{ padding: '10px 18px', background: 'var(--bg-subtle)', fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid var(--border)' }}>
            <Icon name="info" size={12} />
            Aggregated across <strong style={{ color: 'var(--text)' }}>312 anonymized sites</strong> in the Automotive Tier-1/2 cohort. No tenant is identifiable; counts are noised and k-anonymity ≥ 5 enforced.
          </div>

          <table className="k-table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th>Failure mode</th>
                <th>Component class</th>
                <th style={{ textAlign: 'center' }}>Industry trend</th>
                <th style={{ textAlign: 'right' }}>QoQ</th>
                <th>Prevalence</th>
                <th>Your exposure</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {FAILURE_MODES.map((m, i) => (
                <tr key={i}>
                  <td style={{ fontSize: 12.5, fontWeight: 600, maxWidth: 280 }}>{m.mode}</td>
                  <td><span className="k-chip" style={{ background: 'var(--bg-subtle)', color: 'var(--text-muted)', fontSize: 10.5 }}>{m.cls}</span></td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                      <MiniTrend data={m.trend} color="#7c3aed" />
                      <span className="k-chip" style={{ background: 'rgba(124,58,237,0.10)', color: '#6d28d9', fontSize: 9.5, letterSpacing: '0.02em' }}>trending industry-wide</span>
                    </div>
                  </td>
                  <td className="mono" style={{ textAlign: 'right', fontWeight: 700, color: '#c2410c' }}>+{m.qoq}%</td>
                  <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    <span className="mono" style={{ fontWeight: 700, color: 'var(--text)' }}>{m.sites}</span> sites
                  </td>
                  <td>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--accent)', fontWeight: 600 }}>
                      <Icon name="target" size={12} /> {m.exposure}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <button className="k-btn k-btn-ghost k-btn-sm" onClick={() => openExposure(m)}>
                      Review <Icon name="chevronRight" size={12} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { PredictiveRisk });
