// src/pqe.jsx — Predictive Quality Engine (Pillar 1)
// AI risk scoring on parts & designs during development.
// Detects quality problems BEFORE they reach production.

// ── Level config ─────────────────────────────────────────────
const PQE_LEVELS = {
  critical: { label: 'Critical', fg: '#b91c1c', bg: 'rgba(220,38,38,0.10)', dot: '#dc2626', border: 'rgba(220,38,38,0.2)' },
  high:     { label: 'High',     fg: '#c2410c', bg: 'rgba(234,88,12,0.10)', dot: '#ea580c', border: 'rgba(234,88,12,0.2)' },
  medium:   { label: 'Medium',   fg: '#92400e', bg: 'rgba(245,158,11,0.10)', dot: '#f59e0b', border: 'rgba(245,158,11,0.2)' },
  low:      { label: 'Low',      fg: '#15803d', bg: 'rgba(34,197,94,0.10)', dot: '#22c55e', border: 'rgba(34,197,94,0.2)' },
};
const pqeColor  = s => s >= 81 ? '#dc2626' : s >= 61 ? '#ea580c' : s >= 31 ? '#f59e0b' : '#22c55e';
const pqeLevel  = s => s >= 81 ? 'critical' : s >= 61 ? 'high' : s >= 31 ? 'medium' : 'low';
const stageCfg  = {
  'Concept':            { bg: '#f0f9ff', fg: '#0369a1', border: '#bae6fd' },
  'DFM Review':         { bg: '#eff6ff', fg: '#1d4ed8', border: '#bfdbfe' },
  'Design Validation':  { bg: '#faf5ff', fg: '#7c3aed', border: '#ddd6fe' },
  'Process Validation': { bg: '#fff7ed', fg: '#c2410c', border: '#fed7aa' },
  'PPAP':               { bg: '#f0fdf4', fg: '#15803d', border: '#bbf7d0' },
};

// ── SVG Ring Gauge ────────────────────────────────────────────
function PQEGauge({ score, size = 120 }) {
  const r = (size / 2) * 0.70;
  const cx = size / 2, cy = size / 2;
  const circ = 2 * Math.PI * r;
  const arc  = circ * 0.75;
  const fill = arc * (score / 100);
  const color = pqeColor(score);
  const lv = PQE_LEVELS[pqeLevel(score)];
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: 'block', flexShrink: 0 }}>
      <g transform={`rotate(135 ${cx} ${cy})`}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--border)" strokeWidth={size * 0.072}
          strokeDasharray={`${arc} ${circ}`} strokeLinecap="round" />
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={size * 0.072}
          strokeDasharray={`${fill} ${circ}`} strokeLinecap="round" style={{ transition: 'stroke-dasharray 600ms ease' }} />
      </g>
      <text x={cx} y={cy + 2} textAnchor="middle" dominantBaseline="middle"
        fill={color} fontSize={size * 0.30} fontWeight="800" fontFamily="inherit">{score}</text>
      <text x={cx} y={cy + size * 0.225} textAnchor="middle"
        fill="var(--text-muted)" fontSize={size * 0.112} fontWeight="600" fontFamily="inherit">{lv.label}</text>
    </svg>
  );
}

// ── Category score bar ────────────────────────────────────────
function CatBar({ label, score, icon }) {
  const color = pqeColor(score);
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>
          <Icon name={icon} size={12} />{label}
        </div>
        <span className="mono" style={{ fontSize: 12, fontWeight: 700, color }}>{score}</span>
      </div>
      <div style={{ height: 5, borderRadius: 99, background: 'var(--border)', overflow: 'hidden' }}>
        <div style={{ width: `${score}%`, height: '100%', borderRadius: 99, background: color,
          transition: 'width 700ms cubic-bezier(0.4,0,0.2,1)' }} />
      </div>
    </div>
  );
}

// ── Risk Score inline badge ───────────────────────────────────
function PQEScoreBadge({ score }) {
  const lv = PQE_LEVELS[pqeLevel(score)];
  const color = pqeColor(score);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span className="mono" style={{ fontSize: 18, fontWeight: 800, color, lineHeight: 1 }}>{score}</span>
      <span className="k-chip" style={{ background: lv.bg, color: lv.fg, border: `1px solid ${lv.border}` }}>
        {lv.label}
      </span>
    </div>
  );
}

// ── FM probability bar ────────────────────────────────────────
function ProbBar({ value, max = 50 }) {
  const color = value >= 30 ? '#dc2626' : value >= 20 ? '#ea580c' : value >= 12 ? '#f59e0b' : '#22c55e';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ flex: 1, height: 5, borderRadius: 99, background: 'var(--border)', overflow: 'hidden' }}>
        <div style={{ width: `${(value / max) * 100}%`, height: '100%', background: color, borderRadius: 99 }} />
      </div>
      <span className="mono" style={{ fontSize: 11, fontWeight: 700, color, minWidth: 28, textAlign: 'right' }}>{value}%</span>
    </div>
  );
}

// ── Stage pill ────────────────────────────────────────────────
function StagePill({ stage }) {
  const c = stageCfg[stage] || { bg: 'var(--bg-subtle)', fg: 'var(--text-muted)', border: 'var(--border)' };
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 9px', borderRadius: 99,
      fontSize: 11, fontWeight: 600, background: c.bg, color: c.fg, border: `1px solid ${c.border}` }}>
      {stage}
    </span>
  );
}

// ── Factor row ────────────────────────────────────────────────
function FactorRow({ text, sev }) {
  const colors = {
    critical: { dot: '#dc2626', bg: 'rgba(220,38,38,0.06)', border: 'rgba(220,38,38,0.15)' },
    high:     { dot: '#ea580c', bg: 'rgba(234,88,12,0.06)', border: 'rgba(234,88,12,0.15)' },
    medium:   { dot: '#f59e0b', bg: 'rgba(245,158,11,0.06)', border: 'rgba(245,158,11,0.15)' },
    low:      { dot: '#22c55e', bg: 'rgba(34,197,94,0.06)', border: 'rgba(34,197,94,0.15)' },
  };
  const c = colors[sev] || colors.medium;
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '8px 10px',
      background: c.bg, border: `1px solid ${c.border}`, borderRadius: 6, fontSize: 12.5, color: 'var(--text)', marginBottom: 5 }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: c.dot, flexShrink: 0, marginTop: 5 }} />
      {text}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// DATA
// ────────────────────────────────────────────────────────────────────────────
const PQE_DATA = [
  {
    id: 'PQE-2026-001', part: 'Brake Caliper Housing', partNo: 'BCH-KS4-AL',
    program: 'K-Series Hatchback', stage: 'DFM Review', score: 78, ppm: 412, conf: 82,
    engineer: 'Priya Nair', assessed: 'Jun 5, 2026',
    topRisk: 'New casting supplier — no PPQ history',
    linkedFmea: 'FMEA-2026-0012', openEcns: 4,
    cats: { design: 72, process: 68, supplier: 91, historical: 74 },
    factors: {
      design: [
        { t: '4 open ECNs since DFM submission', s: 'high' },
        { t: 'Hydraulic bore tolerance tightened ±0.03mm → ±0.015mm', s: 'high' },
        { t: 'New sealing face geometry — no predecessor data', s: 'medium' },
      ],
      process: [
        { t: 'Die-casting Cpk simulation: 1.04 at bore diameter (target 1.33)', s: 'critical' },
        { t: 'Post-cast machining step added — not in original PFMEA', s: 'high' },
      ],
      supplier: [
        { t: 'Ningbo CastingWorks: first caliper housing for this platform', s: 'critical' },
        { t: 'PPAP Level 3 not yet initiated (DFM approval block)', s: 'critical' },
        { t: 'IATF 16949 cert renewed — 3 minor findings still open', s: 'medium' },
      ],
      historical: [
        { t: 'BCH-K2 (predecessor): 3 NCRs for gas porosity in FY2024', s: 'high' },
        { t: 'Geometry similarity score vs. BCH-K2: 82%', s: 'high' },
        { t: 'Industry PPM for Al die-cast calipers: 380 avg (above your 2025 target of 200)', s: 'medium' },
      ],
    },
    modes: [
      { fm: 'Gas porosity in casting walls', mech: 'Die-cast Al inclusion — Ningbo process', prob: 38, sev: 8, det: 7, riskRpn: 212, addressed: false },
      { fm: 'Hydraulic bore undersized on batch', mech: 'Tooling wear rate at high-volume casting', prob: 25, sev: 9, det: 5, riskRpn: 178, addressed: false },
      { fm: 'Surface pit on piston sealing face', mech: 'Sand inclusion in die surface', prob: 19, sev: 7, det: 6, riskRpn: 95, addressed: true },
    ],
    recs: [
      { p: 1, action: 'Require PPAP Level 3 from Ningbo CastingWorks before DFM gate sign-off', owner: 'Supplier Quality', due: 'Jun 25', cat: 'Supplier' },
      { p: 2, action: 'Run 30-piece First Article with 100% X-ray CT scan for porosity', owner: 'Priya Nair', due: 'Jun 28', cat: 'Process' },
      { p: 3, action: 'Add bore Cpk study (n=50) to DV plan; reconfirm ≥1.33 before DV exit', owner: 'Priya Nair', due: 'Jul 5', cat: 'Design' },
      { p: 4, action: 'Update PFMEA to include new post-cast machining step', owner: 'Process Eng', due: 'Jun 22', cat: 'Process' },
    ],
    historical: [
      { part: 'BCH-K2-AL', program: 'K-Series 2024', predScore: 62, actualPpm: 318, ncrs: 3, outcome: 'warning' },
      { part: 'BCH-K3-AL', program: 'K-Series 2025', predScore: 44, actualPpm: 156, ncrs: 1, outcome: 'ok' },
      { part: 'BCH-SUV1', program: 'SUV-R 2023', predScore: 81, actualPpm: 510, ncrs: 5, outcome: 'fail' },
    ],
  },
  {
    id: 'PQE-2026-002', part: 'EPS Column ECU Bracket', partNo: 'ECU-BR-EPS22',
    program: 'T6-EV Platform', stage: 'Design Validation', score: 88, ppm: 680, conf: 84,
    engineer: 'Arjun Mehta', assessed: 'Jun 6, 2026',
    topRisk: 'DFMEA RPN >200 on 2 unaddressed FMs · ±0.02mm tolerance first-of-kind',
    linkedFmea: 'FMEA-2026-0018', openEcns: 7,
    cats: { design: 91, process: 76, supplier: 82, historical: 88 },
    factors: {
      design: [
        { t: '7 open ECNs since DFM freeze — design not yet stable', s: 'critical' },
        { t: 'Locating pin tolerance tightened ±0.05mm → ±0.02mm (first-of-kind)', s: 'critical' },
        { t: 'DFMEA: 2 failure modes with RPN >200 not yet actioned', s: 'critical' },
        { t: 'New weld joint geometry — no historical production data in-house', s: 'high' },
      ],
      process: [
        { t: 'Cpk simulation at critical feature: 0.94 (target 1.33) — process not capable', s: 'critical' },
        { t: 'New robotic welding fixture — not yet qualified or run-at-rate tested', s: 'high' },
        { t: 'EV thermal environment: operating temp 20°C higher than ICE predecessor', s: 'medium' },
      ],
      supplier: [
        { t: 'Precision Stamping GmbH: first EV variant bracket — ICE data only', s: 'high' },
        { t: 'PPAP not yet initiated (required before DV phase exit)', s: 'high' },
        { t: 'IATF 16949 cert: renewed Mar 2026 — 4 minor findings still open', s: 'medium' },
      ],
      historical: [
        { t: 'ECU-BR-ICE21 (predecessor): 3 NCRs during DV phase in 2024', s: 'critical' },
        { t: 'Geometry similarity to past failed brackets: 78%', s: 'high' },
        { t: 'EPS brackets industry-wide: avg PPM 340 — above your programme target of 150', s: 'medium' },
      ],
    },
    modes: [
      { fm: 'Fatigue crack at weld toe (thermal cycling)', mech: 'EV thermal + road vibration — new load case', prob: 34, sev: 9, det: 7, riskRpn: 214, addressed: false },
      { fm: 'Thread strip on M6 mounting holes', mech: 'Assembly line overtorque — no poka-yoke yet', prob: 28, sev: 7, det: 5, riskRpn: 140, addressed: false },
      { fm: 'Dimensional drift at ECU locating pins', mech: 'Datum shift during welding sequence', prob: 22, sev: 8, det: 6, riskRpn: 131, addressed: false },
      { fm: 'Coating delamination at mounting face', mech: 'Insufficient surface prep for EV thermal environment', prob: 16, sev: 6, det: 8, riskRpn: 88, addressed: true },
    ],
    recs: [
      { p: 1, action: 'Action both DFMEA RPNs >200 before DV test start — gate blocked until resolved', owner: 'Arjun Mehta', due: 'Jun 18', cat: 'Design' },
      { p: 2, action: 'Re-run tolerance stack-up with ±0.02mm spec; confirm Cpk ≥1.33 via simulation before DV', owner: 'Arjun Mehta', due: 'Jun 20', cat: 'Design' },
      { p: 3, action: 'Initiate PPAP with Precision Stamping GmbH immediately (blocking DV exit)', owner: 'Supplier Quality', due: 'Jun 25', cat: 'Supplier' },
      { p: 4, action: 'Qualify new robotic welding fixture on 30-piece first article run before DV build', owner: 'Process Eng', due: 'Jul 8', cat: 'Process' },
      { p: 5, action: 'Review ECU-BR-ICE21 NCR root causes; confirm all addressed in ECU-BR-EPS22 design', owner: 'Arjun Mehta', due: 'Jun 15', cat: 'Historical' },
    ],
    historical: [
      { part: 'ECU-BR-ICE21', program: 'K-Series ICE 2024', predScore: 71, actualPpm: 318, ncrs: 3, outcome: 'warning' },
      { part: 'ECU-BR-HEV19', program: 'K-Hybrid 2022', predScore: 55, actualPpm: 124, ncrs: 1, outcome: 'ok' },
      { part: 'CTRL-BR-SUV20', program: 'SUV-R ICE 2023', predScore: 82, actualPpm: 445, ncrs: 5, outcome: 'fail' },
    ],
  },
  {
    id: 'PQE-2026-003', part: 'Fuel Injector Nozzle Assembly', partNo: 'FIN-T6-EV',
    program: 'T6-EV Platform', stage: 'Process Validation', score: 34, ppm: 98, conf: 88,
    engineer: 'Suresh Iyengar', assessed: 'Jun 4, 2026',
    topRisk: 'Nozzle tip flow spec tightened +15% — PV capability study not yet complete',
    linkedFmea: 'FMEA-2026-0009', openEcns: 2,
    cats: { design: 38, process: 45, supplier: 22, historical: 31 },
    factors: {
      design: [{ t: 'Flow spec tightened +15% via ECN-2026-0031 — PV samples used old spec', s: 'medium' }],
      process: [{ t: 'Cpk for nozzle tip diameter not yet calculated on PV run (pending)', s: 'medium' }, { t: 'New precision grinding station — first PV build', s: 'medium' }],
      supplier: [{ t: 'Incumbent supplier (Aichi Precision): stable — 5 years delivery record', s: 'low' }],
      historical: [{ t: 'FIN-T5 predecessor: 1 NCR in PV (flow rate), resolved quickly', s: 'low' }],
    },
    modes: [
      { fm: 'Flow rate out-of-spec at nozzle tip', mech: 'New flow spec without updated process capability study', prob: 21, sev: 8, det: 4, riskRpn: 112, addressed: false },
      { fm: 'Micro-leak at high-pressure seal ring', mech: 'Dimensional tolerance at 350 bar operating pressure', prob: 12, sev: 9, det: 3, riskRpn: 88, addressed: true },
    ],
    recs: [
      { p: 1, action: 'Complete flow rate Cpk study with 50-piece PV sample under new spec before PV sign-off', owner: 'Suresh Iyengar', due: 'Jun 22', cat: 'Process' },
      { p: 2, action: 'Update DFMEA to reflect tightened flow specification from ECN-2026-0031', owner: 'Suresh Iyengar', due: 'Jun 28', cat: 'Design' },
    ],
    historical: [
      { part: 'FIN-T5', program: 'T5 Platform 2024', predScore: 41, actualPpm: 118, ncrs: 1, outcome: 'ok' },
      { part: 'FIN-T4', program: 'T4 Platform 2022', predScore: 28, actualPpm: 64, ncrs: 0, outcome: 'ok' },
    ],
  },
  {
    id: 'PQE-2026-004', part: 'Transmission Output Shaft', partNo: 'TOS-8G-AT',
    program: 'AWD-5 Crossover', stage: 'DFM Review', score: 62, ppm: 224, conf: 79,
    engineer: 'Vikram Desai', assessed: 'Jun 3, 2026',
    topRisk: 'Gear grinding tolerance tightened + Cpk simulation 1.02 at critical journal diameter',
    linkedFmea: 'FMEA-2026-0015', openEcns: 5,
    cats: { design: 58, process: 74, supplier: 55, historical: 61 },
    factors: {
      design: [{ t: 'Bearing journal tolerance tightened ±0.006mm → ±0.003mm for NVH', s: 'high' }, { t: '5 open ECNs since DFM submission', s: 'medium' }],
      process: [{ t: 'Cpk simulation at journal: 1.02 — below 1.33 capability target', s: 'critical' }, { t: 'Carburizing batch cycle variation ±8°C observed in gauge R&R study', s: 'high' }],
      supplier: [{ t: 'Gear grinding sub-contracted to new vendor for this platform', s: 'high' }],
      historical: [{ t: 'TOS-7G predecessor: 2 NCRs for roundness drift in DV (2023)', s: 'medium' }],
    },
    modes: [
      { fm: 'Out-of-roundness at bearing journal', mech: 'Grinding wheel wear rate over production batch', prob: 29, sev: 8, det: 6, riskRpn: 174, addressed: false },
      { fm: 'Spline form error under full AWD torque', mech: 'Hob tool deflection at high feed rate', prob: 24, sev: 9, det: 5, riskRpn: 162, addressed: false },
      { fm: 'Insufficient case hardness depth', mech: 'Batch carburizing cycle temperature variation', prob: 18, sev: 8, det: 7, riskRpn: 101, addressed: false },
    ],
    recs: [
      { p: 1, action: 'Run full MSA on journal roundness measurement — gauge R&R must be <10% before DV', owner: 'Vikram Desai', due: 'Jun 24', cat: 'Process' },
      { p: 2, action: 'Increase grinding wheel inspection frequency during PV: every 50 parts (not 200)', owner: 'Process Eng', due: 'Jul 1', cat: 'Process' },
      { p: 3, action: 'Commission new gear grinding vendor qualification — Ppk 1.67 required', owner: 'Supplier Quality', due: 'Jul 10', cat: 'Supplier' },
    ],
    historical: [
      { part: 'TOS-7G-AT', program: 'K-Series AT 2023', predScore: 55, actualPpm: 198, ncrs: 2, outcome: 'warning' },
      { part: 'TOS-6G-MT', program: 'K-Series MT 2021', predScore: 38, actualPpm: 105, ncrs: 1, outcome: 'ok' },
    ],
  },
  {
    id: 'PQE-2026-005', part: 'Differential Crown Gear', partNo: 'DCG-R5-AWD',
    program: 'AWD-5 Crossover', stage: 'Design Validation', score: 51, ppm: 178, conf: 76,
    engineer: 'Kavya Reddy', assessed: 'Jun 2, 2026',
    topRisk: 'Modified tooth profile for NVH — no prior production data on new geometry',
    linkedFmea: 'FMEA-2026-0014', openEcns: 3,
    cats: { design: 61, process: 48, supplier: 44, historical: 52 },
    factors: {
      design: [{ t: 'Lead crown modification to tooth profile for NVH — untested in production', s: 'high' }, { t: 'Contact ratio analysis with FEA not yet completed', s: 'medium' }],
      process: [{ t: 'Gear lapping process adjusted for new profile — capability not confirmed', s: 'medium' }],
      supplier: [{ t: 'Incumbent gear supplier: stable record but new profile requires retooling', s: 'medium' }],
      historical: [{ t: 'DCG-R4: 1 NCR for NVH at 80km/h resolved via lead crown adjustment (2023)', s: 'medium' }],
    },
    modes: [
      { fm: 'Gear tooth contact fatigue (surface pitting)', mech: 'New tooth profile — contact stress distribution unvalidated', prob: 26, sev: 8, det: 8, riskRpn: 112, addressed: false },
      { fm: 'NVH above 65dB target at 80km/h', mech: 'Lead crown modification insufficient or over-corrected', prob: 20, sev: 5, det: 7, riskRpn: 70, addressed: false },
    ],
    recs: [
      { p: 1, action: 'Complete full gear contact ratio FEA analysis before DV sign-off', owner: 'Kavya Reddy', due: 'Jun 30', cat: 'Design' },
      { p: 2, action: 'Add 100-hour accelerated durability test cycle to DV plan', owner: 'Kavya Reddy', due: 'Jul 15', cat: 'Design' },
    ],
    historical: [
      { part: 'DCG-R4-AWD', program: 'AWD-4 2023', predScore: 48, actualPpm: 158, ncrs: 1, outcome: 'ok' },
      { part: 'DCG-R3-AWD', program: 'AWD-3 2021', predScore: 31, actualPpm: 88, ncrs: 0, outcome: 'ok' },
    ],
  },
  {
    id: 'PQE-2026-006', part: 'Door Hinge Reinforcement Plate', partNo: 'DRP-K4-ST',
    program: 'K-Series Hatchback', stage: 'PPAP', score: 22, ppm: 54, conf: 91,
    engineer: 'Priya Nair', assessed: 'Jun 6, 2026',
    topRisk: 'No significant risks — stable design, mature supplier, minor weld spatter observation',
    linkedFmea: 'FMEA-2026-0008', openEcns: 1,
    cats: { design: 18, process: 24, supplier: 20, historical: 26 },
    factors: {
      design: [{ t: 'Minor cosmetic ECN — no functional change to geometry', s: 'low' }],
      process: [{ t: 'Weld spatter observed on sealing surface in 2 PPAP samples — monitor', s: 'medium' }],
      supplier: [{ t: 'Tata Shilpa Stampings: 5-year incumbent — zero NCRs in past 18 months', s: 'low' }],
      historical: [{ t: 'DRP-K3 predecessor: zero NCRs in production (2022–2024)', s: 'low' }],
    },
    modes: [
      { fm: 'Weld spatter on door seal mating face', mech: 'Welding parameter drift — not functional risk', prob: 14, sev: 3, det: 9, riskRpn: 18, addressed: true },
    ],
    recs: [
      { p: 1, action: 'Monitor weld spatter in first 500 production pieces; set SPC alert at >2 occurrences/lot', owner: 'Priya Nair', due: 'Jun 30', cat: 'Process' },
    ],
    historical: [
      { part: 'DRP-K3-ST', program: 'K-Series 2022', predScore: 19, actualPpm: 38, ncrs: 0, outcome: 'ok' },
    ],
  },
  {
    id: 'PQE-2026-007', part: 'Seat Belt Pretensioner Cylinder', partNo: 'SBP-TX5-SC',
    program: 'SUV-R Pro', stage: 'Concept', score: 71, ppm: 356, conf: 71,
    engineer: 'Mohit Sharma', assessed: 'Jun 1, 2026',
    topRisk: 'Safety-critical (IATF SC) · new pyrotechnic supplier · low design maturity at concept',
    linkedFmea: 'FMEA-2026-0021', openEcns: 9,
    cats: { design: 65, process: 62, supplier: 84, historical: 72 },
    factors: {
      design: [
        { t: 'Safety-critical (SC) designation — IATF 16949 Annex E applies, SC DFMEA not started', s: 'critical' },
        { t: '9 open ECNs — concept not yet frozen', s: 'high' },
        { t: 'Cylinder wall thickness TBD — structural analysis outstanding', s: 'high' },
      ],
      process: [{ t: 'Pyrotechnic assembly process: special process qualification required', s: 'high' }, { t: 'No validated manufacturing process at concept stage', s: 'medium' }],
      supplier: [
        { t: 'New pyrotechnic charge supplier — no IATF qualification or PPQ history', s: 'critical' },
        { t: 'Tier-2 for igniter: first-time use — long-lead qualification', s: 'high' },
      ],
      historical: [
        { t: 'SBP-TX4 (predecessor): 2 NCRs in DV for cold-soak misfire — root cause seal design', s: 'high' },
        { t: 'Industry recall data: pretensioner failures in cold climate — public record', s: 'high' },
      ],
    },
    modes: [
      { fm: 'Pyro charge misfire under cold-soak (-40°C)', mech: 'Moisture ingress — seal design not yet defined', prob: 31, sev: 10, det: 8, riskRpn: 240, addressed: false },
      { fm: 'Cylinder wall rupture above max actuation pressure', mech: 'Wall thickness TBD — overpressure path unknown', prob: 22, sev: 10, det: 9, riskRpn: 198, addressed: false },
      { fm: 'Incorrect cable pull force — passenger injury risk', mech: 'Mass/inertia distribution not finalised at concept', prob: 18, sev: 9, det: 8, riskRpn: 144, addressed: false },
    ],
    recs: [
      { p: 1, action: 'Commission independent SC safety review board before concept freeze', owner: 'Mohit Sharma', due: 'Jun 28', cat: 'Design' },
      { p: 2, action: 'Begin SC DFMEA immediately — do not defer to DFM phase (IATF requirement)', owner: 'Mohit Sharma', due: 'Jun 20', cat: 'Design' },
      { p: 3, action: 'Qualify new pyrotechnic supplier: Ppk ≥1.67 mandatory (SC component)', owner: 'Supplier Quality', due: 'Jul 15', cat: 'Supplier' },
      { p: 4, action: 'Conduct cold-soak seal design review referencing SBP-TX4 NCR root cause', owner: 'Mohit Sharma', due: 'Jun 22', cat: 'Historical' },
    ],
    historical: [
      { part: 'SBP-TX4-SC', program: 'SUV-R 2024', predScore: 68, actualPpm: 298, ncrs: 2, outcome: 'warning' },
      { part: 'SBP-TX3-SC', program: 'SUV-R 2022', predScore: 52, actualPpm: 178, ncrs: 1, outcome: 'ok' },
    ],
  },
  {
    id: 'PQE-2026-008', part: 'Active Suspension Control Arm', partNo: 'ASCA-R6-AL',
    program: 'SUV-R Pro', stage: 'DFM Review', score: 83, ppm: 518, conf: 80,
    engineer: 'Mohit Sharma', assessed: 'Jun 6, 2026',
    topRisk: '23% more components than predecessor · untested Al alloy grade · 2 new suppliers',
    linkedFmea: 'FMEA-2026-0022', openEcns: 6,
    cats: { design: 86, process: 79, supplier: 88, historical: 78 },
    factors: {
      design: [
        { t: 'New 6082-T6 aluminium alloy — fatigue data at KAENAL: zero (industry data only)', s: 'critical' },
        { t: '23% higher component count than ASCA-R5 predecessor', s: 'high' },
        { t: 'Dissimilar-metal corrosion path (Al arm + steel sub-frame bolt) — coating spec TBD', s: 'high' },
        { t: '6 open ECNs — design not frozen at DFM stage', s: 'medium' },
      ],
      process: [
        { t: 'Bushing press-fit: interference zone outside incumbent tooling capability', s: 'critical' },
        { t: 'New welding process for Al-alloy — no qualified procedure in plant', s: 'high' },
      ],
      supplier: [
        { t: '2 new suppliers introduced for arm casting and bushing — concurrent qualification risk', s: 'critical' },
        { t: 'Neither new supplier has PPAP history for active suspension components', s: 'high' },
      ],
      historical: [
        { t: 'ASCA-R5 DV: 3 NCRs (bushing walkout, Al weld crack, corrosion), all in DV phase', s: 'critical' },
        { t: 'Active suspension control arms: highest PPM category in plant (avg 480 in 2024)', s: 'high' },
      ],
    },
    modes: [
      { fm: 'Control arm fracture at ball joint housing', mech: 'New Al alloy — fatigue S-N curve not validated at operating loads', prob: 33, sev: 10, det: 7, riskRpn: 231, addressed: false },
      { fm: 'Press-fit bushing walkout under lateral load', mech: 'Interface tolerance on new supplier tooling — Cpk 0.91', prob: 27, sev: 8, det: 6, riskRpn: 174, addressed: false },
      { fm: 'Electrolytic corrosion at Al–steel interface', mech: 'Dissimilar metal galvanic coupling — coating spec outstanding', prob: 22, sev: 7, det: 7, riskRpn: 108, addressed: false },
      { fm: 'Wheel camber drift exceeding ±0.3° at 100k km', mech: 'Bushing rubber compliance creep over service life', prob: 18, sev: 6, det: 8, riskRpn: 86, addressed: false },
    ],
    recs: [
      { p: 1, action: 'Commission fatigue analysis on 6082-T6 alloy before DFM approval — block gate', owner: 'Mohit Sharma', due: 'Jun 22', cat: 'Design' },
      { p: 2, action: 'Limit to 1 new supplier for this DFM phase — reassess dual-source strategy', owner: 'Supplier Quality', due: 'Jun 18', cat: 'Supplier' },
      { p: 3, action: 'Define Al–steel corrosion protection spec in ECN before design freeze', owner: 'Mohit Sharma', due: 'Jun 25', cat: 'Design' },
      { p: 4, action: 'Qualify Al welding procedure: WPS + PQR required before DV build', owner: 'Process Eng', due: 'Jul 10', cat: 'Process' },
    ],
    historical: [
      { part: 'ASCA-R5-AL', program: 'SUV-R 2024', predScore: 77, actualPpm: 480, ncrs: 3, outcome: 'fail' },
      { part: 'ASCA-R4-ST', program: 'SUV-R 2022 (steel)', predScore: 39, actualPpm: 112, ncrs: 1, outcome: 'ok' },
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// LIST VIEW
// ─────────────────────────────────────────────────────────────────────────────
function PQEList({ onSelect }) {
  const [search, setSearch] = React.useState('');
  const [filterProgram, setFilterProgram] = React.useState('all');
  const [filterStage, setFilterStage] = React.useState('all');
  const [filterLevel, setFilterLevel] = React.useState('all');
  const [sort, setSort] = React.useState('score-desc');

  const programs = [...new Set(PQE_DATA.map(d => d.program))];
  const stages   = [...new Set(PQE_DATA.map(d => d.stage))];

  const filtered = PQE_DATA.filter(d => {
    if (search && !d.part.toLowerCase().includes(search.toLowerCase()) &&
        !d.partNo.toLowerCase().includes(search.toLowerCase()) &&
        !d.program.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterProgram !== 'all' && d.program !== filterProgram) return false;
    if (filterStage   !== 'all' && d.stage   !== filterStage)   return false;
    if (filterLevel   !== 'all' && pqeLevel(d.score) !== filterLevel) return false;
    return true;
  }).sort((a, b) => {
    if (sort === 'score-desc') return b.score - a.score;
    if (sort === 'score-asc')  return a.score - b.score;
    if (sort === 'ppm-desc')   return b.ppm - a.ppm;
    return 0;
  });

  const critCount = PQE_DATA.filter(d => d.score >= 81).length;
  const highCount = PQE_DATA.filter(d => d.score >= 61 && d.score < 81).length;
  const avgScore  = Math.round(PQE_DATA.reduce((s, d) => s + d.score, 0) / PQE_DATA.length);
  const avgPpm    = Math.round(PQE_DATA.reduce((s, d) => s + d.ppm, 0) / PQE_DATA.length);

  const kpis = [
    { l: 'Active Assessments', v: PQE_DATA.length, sub: '8 parts / designs', icon: 'clipboard', c: 'var(--accent)' },
    { l: 'Critical Risk', v: critCount, sub: 'Immediate action required', icon: 'alert', c: '#dc2626' },
    { l: 'High Risk', v: highCount, sub: 'Action before gate exit', icon: 'trending', c: '#ea580c' },
    { l: 'Avg Risk Score', v: avgScore, sub: '/ 100 across portfolio', icon: 'target', c: pqeColor(avgScore) },
    { l: 'Avg Predicted PPM', v: avgPpm, sub: 'Portfolio weighted', icon: 'reports', c: '#7c3aed' },
  ];

  return (
    <div className="fade-in">
      <PageHeader
        title="Predictive Quality Engine"
        description="AI risk scoring for parts and assemblies during development. Surfaces quality risk before it reaches production."
        actions={
          <>
            <button className="k-btn k-btn-ghost" onClick={() => kToast('Export started — quality-engine-summary.pdf')}><Icon name="download" size={13} /> Export</button>
            <button className="k-btn k-btn-primary" onClick={() => kToast('New assessment queued — results in ~2 min')}><Icon name="sparkles" size={13} /> New Assessment</button>
          </>
        }
      />

      <div style={{ padding: '18px 28px 40px' }}>

        {/* AI model banner */}
        <div className="k-surface" style={{ padding: '12px 16px', marginBottom: 16,
          display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ padding: 8, borderRadius: 8, background: 'var(--accent-soft)', color: 'var(--accent)', display: 'inline-flex' }}>
              <Icon name="sparkles" size={15} />
            </span>
            <div>
              <div style={{ fontSize: 12.5, fontWeight: 600 }}>PQEngine v2.1 · Gradient-boosted ensemble model</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Retrained monthly · Features: DFMEA RPN trends, spec delta, supplier Cpk, ECN velocity, historical geometry similarity</div>
            </div>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 12, alignItems: 'center', fontSize: 11.5, color: 'var(--text-muted)', flexWrap: 'wrap' }}>
            <span><strong style={{ color: 'var(--text)' }}>89%</strong> backtest accuracy (last 6 programmes)</span>
            <span style={{ color: 'var(--border-strong)' }}>|</span>
            <span>Last trained: <strong style={{ color: 'var(--text)' }}>Jun 5, 2026</strong></span>
            <span style={{ color: 'var(--border-strong)' }}>|</span>
            <span className="k-chip" style={{ background: 'rgba(22,163,74,0.10)', color: '#15803d', height: 22, fontSize: 10.5 }}>
              <Icon name="check" size={10} /> AI Governance: Approved
            </span>
          </div>
        </div>

        {/* KPI strip */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 10, marginBottom: 20 }}>
          {kpis.map(k => (
            <div key={k.l} className="k-surface" style={{ padding: '13px 14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 6 }}>
                <Icon name={k.icon} size={13} style={{ color: k.c }} />
                <span style={{ fontSize: 10.5, color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.03em', textTransform: 'uppercase' }}>{k.l}</span>
              </div>
              <span className="mono" style={{ fontSize: 26, fontWeight: 800, color: k.c, lineHeight: 1 }}>{k.v}</span>
              <div style={{ fontSize: 10.5, color: 'var(--text-subtle)', marginTop: 2 }}>{k.sub}</div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 200, maxWidth: 280 }}>
            <Icon name="search" size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-subtle)', pointerEvents: 'none' }} />
            <input className="k-input" placeholder="Search part, no., or program…" value={search}
              onChange={e => setSearch(e.target.value)} style={{ paddingLeft: 30 }} />
          </div>
          <select className="k-input" style={{ width: 'auto', flex: 'none' }} value={filterProgram} onChange={e => setFilterProgram(e.target.value)}>
            <option value="all">All programs</option>
            {programs.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <select className="k-input" style={{ width: 'auto', flex: 'none' }} value={filterStage} onChange={e => setFilterStage(e.target.value)}>
            <option value="all">All stages</option>
            {stages.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select className="k-input" style={{ width: 'auto', flex: 'none' }} value={filterLevel} onChange={e => setFilterLevel(e.target.value)}>
            <option value="all">All risk levels</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
          <select className="k-input" style={{ width: 'auto', flex: 'none', marginLeft: 'auto' }} value={sort} onChange={e => setSort(e.target.value)}>
            <option value="score-desc">Score: high → low</option>
            <option value="score-asc">Score: low → high</option>
            <option value="ppm-desc">PPM: high → low</option>
          </select>
        </div>

        {/* Table */}
        <div className="k-surface" style={{ overflow: 'hidden' }}>
          <table className="k-table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th style={{ minWidth: 220 }}>Part / Assembly</th>
                <th>Program</th>
                <th>Stage</th>
                <th style={{ textAlign: 'center' }}>Risk Score</th>
                <th style={{ textAlign: 'right' }}>Pred. PPM</th>
                <th style={{ minWidth: 220 }}>Top Risk Factor</th>
                <th style={{ textAlign: 'center' }}>Conf.</th>
                <th>Assessed</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(d => {
                const lv = PQE_LEVELS[pqeLevel(d.score)];
                const color = pqeColor(d.score);
                return (
                  <tr key={d.id} style={{ cursor: 'pointer' }} onClick={() => onSelect(d.id)}>
                    <td>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{d.part}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-subtle)', marginTop: 1, fontFamily: 'var(--font-mono)' }}>{d.partNo} · {d.id}</div>
                    </td>
                    <td style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>{d.program}</td>
                    <td><StagePill stage={d.stage} /></td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                        <span className="mono" style={{ fontSize: 20, fontWeight: 800, color, lineHeight: 1 }}>{d.score}</span>
                        <span className="k-chip" style={{ background: lv.bg, color: lv.fg, border: `1px solid ${lv.border}`, fontSize: 10 }}>{lv.label}</span>
                      </div>
                    </td>
                    <td className="mono" style={{ textAlign: 'right', fontWeight: 700, color, fontSize: 13 }}>{d.ppm.toLocaleString()}</td>
                    <td style={{ fontSize: 12, color: 'var(--text-muted)', maxWidth: 240 }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                        <Icon name="zap" size={11} style={{ color: lv.dot, marginTop: 2, flexShrink: 0 }} />
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 220 }}>{d.topRisk}</span>
                      </div>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span className="mono" style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>{d.conf}%</span>
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{d.assessed}</td>
                    <td>
                      <button className="k-btn k-btn-ghost k-btn-sm" onClick={e => { e.stopPropagation(); onSelect(d.id); }}>
                        View <Icon name="chevronRight" size={12} />
                      </button>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={9} style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-subtle)', fontSize: 13 }}>
                  No assessments match your filters.
                </td></tr>
              )}
            </tbody>
          </table>
        </div>

      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DETAIL VIEW
// ─────────────────────────────────────────────────────────────────────────────
function PQEDetail({ id, onBack, setRoute }) {
  const d = PQE_DATA.find(x => x.id === id) || PQE_DATA[0];
  const [tab, setTab] = React.useState('overview');
  const lv = PQE_LEVELS[pqeLevel(d.score)];

  const catIcons = { design: 'pen', process: 'tool', supplier: 'truck', historical: 'clock' };
  const catLabels = { design: 'Design & Spec', process: 'Process Capability', supplier: 'Supplier Readiness', historical: 'Historical Similarity' };
  const catOrder = ['design', 'process', 'supplier', 'historical'];

  return (
    <div className="fade-in">
      {/* Sub-header */}
      <div style={{ padding: '14px 28px', borderBottom: '1px solid var(--border)', background: 'var(--surface)',
        display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <button className="k-btn k-btn-ghost k-btn-sm" onClick={onBack}>
          <Icon name="chevronLeft" size={13} /> All Assessments
        </button>
        <span style={{ color: 'var(--border-strong)' }}>·</span>
        <div>
          <span className="mono" style={{ fontSize: 11.5, color: 'var(--text-muted)', fontWeight: 600 }}>{d.id}</span>
          <span style={{ fontSize: 11.5, color: 'var(--text-subtle)', margin: '0 6px' }}>·</span>
          <span style={{ fontSize: 11.5, color: 'var(--text-subtle)' }}>{d.program}</span>
        </div>
        <span className="k-chip" style={{ background: lv.bg, color: lv.fg, border: `1px solid ${lv.border}` }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: lv.dot, display: 'inline-block' }} />
          {lv.label} Risk
        </span>
        {d.score >= 81 && (
          <span className="k-chip" style={{ background: 'rgba(220,38,38,0.10)', color: '#b91c1c', border: '1px solid rgba(220,38,38,0.25)' }}>
            <Icon name="alert" size={10} /> Gate blocked
          </span>
        )}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button className="k-btn k-btn-ghost k-btn-sm"><Icon name="refresh" size={13} /> Reassess</button>
          <button className="k-btn k-btn-ghost k-btn-sm"><Icon name="download" size={13} /> Export Report</button>
          <button className="k-btn k-btn-primary k-btn-sm"><Icon name="alert" size={13} /> Raise CAPA</button>
        </div>
      </div>

      {/* Two-column layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 0, minHeight: 'calc(100vh - 168px)' }}>

        {/* MAIN */}
        <div style={{ borderRight: '1px solid var(--border)', overflow: 'auto' }}>
          {/* Part title */}
          <div style={{ padding: '22px 28px 0' }}>
            <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.01em', marginBottom: 3 }}>{d.part}</div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 18 }}>
              <span className="mono" style={{ fontSize: 12, color: 'var(--text-subtle)' }}>{d.partNo}</span>
              <StagePill stage={d.stage} />
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Engineer: <strong>{d.engineer}</strong></span>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Assessed: {d.assessed}</span>
            </div>
          </div>

          {/* Tabs */}
          <div className="k-tabs" style={{ padding: '0 28px', marginBottom: 0 }}>
            {[
              { id: 'overview', label: 'Overview', icon: 'dashboard' },
              { id: 'modes', label: 'Failure Modes', icon: 'alert', badge: d.modes.filter(m => !m.addressed).length },
              { id: 'factors', label: 'Contributing Factors', icon: 'zap' },
              { id: 'historical', label: 'Historical', icon: 'clock' },
              { id: 'recs', label: 'Recommendations', icon: 'check', badge: d.recs.length },
            ].map(t => (
              <button key={t.id} className={`k-tab ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>
                <Icon name={t.icon} size={13} /> {t.label}
                {t.badge ? <span className="k-chip" style={{ background: tab === t.id ? 'var(--accent-soft)' : 'var(--bg-subtle)', color: tab === t.id ? 'var(--accent)' : 'var(--text-muted)', height: 18, fontSize: 10, padding: '0 6px' }}>{t.badge}</span> : null}
              </button>
            ))}
          </div>

          <div style={{ padding: '24px 28px 40px' }}>

            {/* ── OVERVIEW TAB ── */}
            {tab === 'overview' && (
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: 24, marginBottom: 24, alignItems: 'start' }}>
                  {/* Gauge */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                    <PQEGauge score={d.score} size={128} />
                    <div style={{ textAlign: 'center' }}>
                      <div className="mono" style={{ fontSize: 14, fontWeight: 700, color: pqeColor(d.score) }}>{d.ppm} PPM</div>
                      <div style={{ fontSize: 10.5, color: 'var(--text-subtle)', marginTop: 2 }}>Predicted defect rate</div>
                      <div style={{ fontSize: 10.5, color: 'var(--text-subtle)' }}>{d.conf}% model confidence</div>
                    </div>
                  </div>
                  {/* Category scores */}
                  <div>
                    <div className="k-overline" style={{ marginBottom: 12 }}>Score breakdown by category</div>
                    {catOrder.map(k => (
                      <CatBar key={k} label={catLabels[k]} score={d.cats[k]} icon={catIcons[k]} />
                    ))}
                  </div>
                </div>

                {/* AI narrative */}
                <div style={{ background: 'var(--accent-soft)', border: '1px solid rgba(37,99,235,0.2)', borderRadius: 8, padding: '14px 16px', marginBottom: 20 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <span style={{ padding: 6, background: 'rgba(37,99,235,0.12)', borderRadius: 6, color: 'var(--accent)', display: 'inline-flex' }}><Icon name="sparkles" size={13} /></span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)' }}>AI Assessment · PQEngine v2.1</span>
                    <span style={{ fontSize: 10.5, color: 'var(--text-subtle)', marginLeft: 4 }}>Confidence: {d.conf}%</span>
                  </div>
                  <p style={{ fontSize: 12.5, color: 'var(--text)', lineHeight: 1.7, margin: 0 }}>
                    <strong>{d.part}</strong> ({d.partNo}) on the <strong>{d.program}</strong> programme is assessed at risk score <strong style={{ color: pqeColor(d.score) }}>{d.score}/100</strong> ({PQE_LEVELS[pqeLevel(d.score)].label}).
                    The primary driver is <em>{d.topRisk}</em>.
                    Of the {d.modes.length} predicted failure modes, <strong>{d.modes.filter(m => !m.addressed).length} remain unaddressed</strong>.
                    The model predicts <strong>{d.ppm} PPM</strong> if the part enters production in its current state.
                    {d.score >= 81 ? ' This score triggers an automatic Design Gate block — progression requires resolution of Critical items.' : ' Recommend addressing High-priority actions before the next development gate.'}
                  </p>
                </div>

                {/* Top 2 failure modes preview */}
                <div className="k-overline" style={{ marginBottom: 10 }}>Top predicted failure modes</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {d.modes.filter(m => !m.addressed).slice(0, 2).map((m, i) => (
                    <div key={i} className="k-surface" style={{ padding: '12px 14px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 600 }}>{m.fm}</div>
                          <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 3 }}>{m.mech}</div>
                        </div>
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          <div className="mono" style={{ fontSize: 15, fontWeight: 800, color: pqeColor(m.prob * 2), lineHeight: 1 }}>RPN {m.riskRpn}</div>
                          <div style={{ fontSize: 10, color: 'var(--text-subtle)', marginTop: 1 }}>Predicted</div>
                        </div>
                      </div>
                      <div style={{ marginTop: 8 }}>
                        <ProbBar value={m.prob} />
                      </div>
                    </div>
                  ))}
                </div>
                <button className="k-btn k-btn-plain k-btn-sm" style={{ marginTop: 10 }} onClick={() => setTab('modes')}>
                  View all {d.modes.length} failure modes <Icon name="chevronRight" size={12} />
                </button>
              </div>
            )}

            {/* ── FAILURE MODES TAB ── */}
            {tab === 'modes' && (
              <div>
                <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span className="k-chip" style={{ background: 'rgba(220,38,38,0.10)', color: '#b91c1c' }}>
                    {d.modes.filter(m => !m.addressed).length} unaddressed
                  </span>
                  <span className="k-chip" style={{ background: 'rgba(22,163,74,0.10)', color: '#15803d' }}>
                    {d.modes.filter(m => m.addressed).length} addressed
                  </span>
                </div>
                <div className="k-surface" style={{ overflow: 'hidden' }}>
                  <table className="k-table" style={{ width: '100%' }}>
                    <thead>
                      <tr>
                        <th>Failure Mode</th>
                        <th>Predicted Mechanism</th>
                        <th style={{ textAlign: 'center' }}>Probability</th>
                        <th style={{ textAlign: 'center' }}>Sev</th>
                        <th style={{ textAlign: 'center' }}>Det</th>
                        <th style={{ textAlign: 'right' }}>Pred. RPN</th>
                        <th style={{ textAlign: 'center' }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {d.modes.map((m, i) => (
                        <tr key={i} style={{ opacity: m.addressed ? 0.55 : 1 }}>
                          <td style={{ fontWeight: 600, fontSize: 12.5 }}>{m.fm}</td>
                          <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{m.mech}</td>
                          <td style={{ width: 140 }}><ProbBar value={m.prob} /></td>
                          <td style={{ textAlign: 'center' }}>
                            <span className="mono" style={{ fontWeight: 700, color: m.sev >= 9 ? '#dc2626' : m.sev >= 7 ? '#ea580c' : 'var(--text)', fontSize: 13 }}>{m.sev}</span>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <span className="mono" style={{ fontSize: 12, color: 'var(--text-muted)' }}>{m.det}</span>
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <span className="mono" style={{ fontWeight: 800, color: m.addressed ? 'var(--text-subtle)' : pqeColor(m.riskRpn / 2.5), fontSize: 14 }}>{m.riskRpn}</span>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            {m.addressed
                              ? <span className="k-chip" style={{ background: 'rgba(22,163,74,0.10)', color: '#15803d' }}>Addressed</span>
                              : <span className="k-chip" style={{ background: 'rgba(220,38,38,0.10)', color: '#b91c1c' }}>Open</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div style={{ marginTop: 12, fontSize: 11, color: 'var(--text-subtle)', display: 'flex', gap: 16 }}>
                  <span>Sev = Severity (1–10) · Det = Detection difficulty (1–10 · 10 = hardest to detect)</span>
                  <span>Predicted RPN = Probability × Severity × Detection (model-estimated)</span>
                </div>
              </div>
            )}

            {/* ── FACTORS TAB ── */}
            {tab === 'factors' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                {catOrder.map(k => (
                  <div key={k} className="k-surface" style={{ padding: '16px 18px', overflow: 'hidden' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                      <span style={{ padding: 7, borderRadius: 7, background: 'var(--accent-soft)', color: 'var(--accent)', display: 'inline-flex' }}>
                        <Icon name={catIcons[k]} size={13} />
                      </span>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700 }}>{catLabels[k]}</div>
                      </div>
                      <span className="mono" style={{ marginLeft: 'auto', fontSize: 15, fontWeight: 800, color: pqeColor(d.cats[k]) }}>{d.cats[k]}</span>
                    </div>
                    <div style={{ height: 4, borderRadius: 99, background: 'var(--border)', marginBottom: 12, overflow: 'hidden' }}>
                      <div style={{ width: `${d.cats[k]}%`, height: '100%', borderRadius: 99, background: pqeColor(d.cats[k]) }} />
                    </div>
                    <div>
                      {(d.factors[k] || []).map((f, i) => <FactorRow key={i} text={f.t} sev={f.s} />)}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ── HISTORICAL TAB ── */}
            {tab === 'historical' && (
              <div>
                <div style={{ marginBottom: 16, padding: '12px 14px', background: 'var(--bg-subtle)', borderRadius: 8, border: '1px solid var(--border)', fontSize: 12.5, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                  <strong style={{ color: 'var(--text)' }}>How this score was informed:</strong> PQEngine compared {d.part} to {d.historical.length} geometrically similar parts from KAENAL's historical record. Outcome and NCR data from those parts contributes to the historical similarity score of <strong style={{ color: pqeColor(d.cats.historical) }}>{d.cats.historical}/100</strong>.
                </div>
                <div className="k-surface" style={{ overflow: 'hidden' }}>
                  <table className="k-table">
                    <thead>
                      <tr>
                        <th>Historical Part</th>
                        <th>Programme</th>
                        <th style={{ textAlign: 'center' }}>Predicted Score</th>
                        <th style={{ textAlign: 'right' }}>Actual PPM</th>
                        <th style={{ textAlign: 'center' }}>NCRs raised</th>
                        <th style={{ textAlign: 'center' }}>Outcome</th>
                      </tr>
                    </thead>
                    <tbody>
                      {d.historical.map((h, i) => {
                        const outcomeMap = {
                          ok:      { label: 'On target', bg: 'rgba(22,163,74,0.10)', fg: '#15803d' },
                          warning: { label: 'Above target', bg: 'rgba(245,158,11,0.10)', fg: '#92400e' },
                          fail:    { label: 'Significant NCRs', bg: 'rgba(220,38,38,0.10)', fg: '#b91c1c' },
                        };
                        const o = outcomeMap[h.outcome];
                        return (
                          <tr key={i}>
                            <td style={{ fontWeight: 600, fontSize: 12.5 }}>{h.part}</td>
                            <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{h.program}</td>
                            <td style={{ textAlign: 'center' }}>
                              <span className="mono" style={{ fontWeight: 700, color: pqeColor(h.predScore), fontSize: 14 }}>{h.predScore}</span>
                            </td>
                            <td className="mono" style={{ textAlign: 'right', fontWeight: 700, fontSize: 13, color: h.actualPpm > 300 ? '#dc2626' : h.actualPpm > 150 ? '#ea580c' : '#16a34a' }}>{h.actualPpm}</td>
                            <td style={{ textAlign: 'center' }}>
                              <span className="mono" style={{ fontSize: 13, fontWeight: 700, color: h.ncrs > 2 ? '#dc2626' : h.ncrs > 0 ? '#ea580c' : '#16a34a' }}>{h.ncrs}</span>
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              <span className="k-chip" style={{ background: o.bg, color: o.fg }}>{o.label}</span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ── RECOMMENDATIONS TAB ── */}
            {tab === 'recs' && (
              <div>
                <div style={{ marginBottom: 14, fontSize: 12.5, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                  {d.recs.length} actions generated by PQEngine. Resolve in priority order to reduce risk score below the gate threshold.
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {d.recs.map((r, i) => {
                    const catColors = { Design: { bg: '#eff6ff', fg: '#1d4ed8', border: '#bfdbfe' }, Process: { bg: '#fff7ed', fg: '#c2410c', border: '#fed7aa' }, Supplier: { bg: '#f0fdf4', fg: '#15803d', border: '#bbf7d0' }, Historical: { bg: '#faf5ff', fg: '#7c3aed', border: '#ddd6fe' } };
                    const cc = catColors[r.cat] || catColors.Design;
                    return (
                      <div key={i} className="k-surface" style={{ padding: '14px 16px', display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                        <div style={{ width: 28, height: 28, borderRadius: '50%', background: i === 0 ? '#dc2626' : i === 1 ? '#ea580c' : 'var(--bg-subtle)', color: i <= 1 ? 'white' : 'var(--text-muted)', display: 'grid', placeItems: 'center', fontSize: 11, fontWeight: 800, flexShrink: 0 }}>
                          {r.p}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6, lineHeight: 1.4 }}>{r.action}</div>
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                            <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>Owner: <strong style={{ color: 'var(--text)' }}>{r.owner}</strong></span>
                            <span style={{ color: 'var(--border-strong)' }}>·</span>
                            <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>Due: <strong style={{ color: 'var(--text)' }}>{r.due}</strong></span>
                            <span style={{ display: 'inline-flex', padding: '2px 8px', borderRadius: 99, fontSize: 10.5, fontWeight: 600, background: cc.bg, color: cc.fg, border: `1px solid ${cc.border}` }}>{r.cat}</span>
                          </div>
                        </div>
                        <button className="k-btn k-btn-ghost k-btn-sm" style={{ flexShrink: 0 }}>Create task</button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* SIDEBAR */}
        <div style={{ padding: '20px 20px', display: 'flex', flexDirection: 'column', gap: 18, overflowY: 'auto' }}>
          {/* Score summary */}
          <div className="k-surface" style={{ padding: '16px', textAlign: 'center' }}>
            <PQEGauge score={d.score} size={110} />
            <div style={{ marginTop: 8 }}>
              <div className="mono" style={{ fontSize: 22, fontWeight: 800, color: pqeColor(d.score), lineHeight: 1 }}>{d.ppm} PPM</div>
              <div style={{ fontSize: 11, color: 'var(--text-subtle)', marginTop: 2 }}>Predicted defect rate</div>
            </div>
            <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {catOrder.map(k => (
                <div key={k} style={{ padding: '6px 8px', background: 'var(--bg-subtle)', borderRadius: 6 }}>
                  <div style={{ fontSize: 9.5, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-subtle)', marginBottom: 2 }}>{catLabels[k].split(' ')[0]}</div>
                  <span className="mono" style={{ fontSize: 14, fontWeight: 800, color: pqeColor(d.cats[k]) }}>{d.cats[k]}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Metadata */}
          <div className="k-surface" style={{ padding: '14px 16px' }}>
            <div className="k-overline" style={{ marginBottom: 12 }}>Part Details</div>
            {[
              { l: 'Part Number', v: d.partNo, mono: true },
              { l: 'Programme', v: d.program },
              { l: 'Dev. Stage', v: <StagePill stage={d.stage} /> },
              { l: 'Engineer', v: d.engineer },
              { l: 'Last Assessed', v: d.assessed },
              { l: 'Confidence', v: `${d.conf}%`, mono: true },
            ].map(row => (
              <div key={row.l} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, gap: 8 }}>
                <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{row.l}</span>
                {typeof row.v === 'string'
                  ? <span style={{ fontSize: 12, fontWeight: 600, textAlign: 'right', ...(row.mono ? { fontFamily: 'var(--font-mono)' } : {}) }}>{row.v}</span>
                  : row.v}
              </div>
            ))}
          </div>

          {/* Linked artefacts */}
          <div className="k-surface" style={{ padding: '14px 16px' }}>
            <div className="k-overline" style={{ marginBottom: 12 }}>Linked Artefacts</div>
            <button className="k-btn k-btn-ghost k-btn-sm" style={{ width: '100%', marginBottom: 6, justifyContent: 'flex-start' }}
              onClick={() => setRoute('fmea')}>
              <Icon name="brain" size={12} /> {d.linkedFmea}
            </button>
            <div style={{ fontSize: 11, color: 'var(--text-subtle)', marginBottom: 6, marginTop: 2 }}>
              {d.openEcns} open Engineering Changes
            </div>
            <button className="k-btn k-btn-ghost k-btn-sm" style={{ width: '100%', justifyContent: 'flex-start' }}
              onClick={() => setRoute('ecn')}>
              <Icon name="gitBranch" size={12} /> View ECNs ({d.openEcns})
            </button>
          </div>

          {/* Model info */}
          <div className="k-surface" style={{ padding: '14px 16px' }}>
            <div className="k-overline" style={{ marginBottom: 10 }}>Model</div>
            <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>PQEngine v2.1</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.6 }}>
              Gradient-boosted ensemble<br />
              Trained: Jun 5, 2026<br />
              Backtest accuracy: 89%<br />
              MAPE: 11%
            </div>
            <button className="k-btn k-btn-plain k-btn-sm" style={{ marginTop: 8, paddingLeft: 0 }} onClick={() => setRoute('ai-governance')}>
              AI Governance <Icon name="chevronRight" size={12} />
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MODULE ROOT
// ─────────────────────────────────────────────────────────────────────────────
function PQEModule({ setRoute }) {
  const [selectedId, setSelectedId] = React.useState(() => localStorage.getItem('k_pqe') || null);

  const select = (id) => {
    setSelectedId(id);
    localStorage.setItem('k_pqe', id);
  };
  const back = () => {
    setSelectedId(null);
    localStorage.removeItem('k_pqe');
  };

  if (selectedId) return <PQEDetail id={selectedId} onBack={back} setRoute={setRoute} />;
  return <PQEList onSelect={select} />;
}

Object.assign(window, { PQEModule });
