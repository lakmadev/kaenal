// Kaenal — seed data (automotive manufacturing vertical)

const USERS = [
  { id: 'u1', name: 'Manjunath Kumar', initials: 'MK', role: 'Quality Manager', color: '#2563eb' },
  { id: 'u2', name: 'Anna Schmidt', initials: 'AS', role: 'Quality Engineer', color: '#db2777' },
  { id: 'u3', name: 'Thomas Müller', initials: 'TM', role: 'Production Lead', color: '#16a34a' },
  { id: 'u4', name: 'Priya Nair', initials: 'PN', role: 'Auditor', color: '#9333ea' },
  { id: 'u5', name: 'David Chen', initials: 'DC', role: 'Safety Officer', color: '#ea580c' },
  { id: 'u6', name: 'Lena Weber', initials: 'LW', role: 'Supplier Quality', color: '#0891b2' },
  { id: 'u7', name: 'Rafael Costa', initials: 'RC', role: 'Inspector', color: '#475569' },
];
const userById = (id) => USERS.find(u => u.id === id) || USERS[0];

const NCRS = [
  {
    id: 'NCR-2026-0089',
    title: 'Recurring weld porosity on Part #A-7742 (door hinge assembly)',
    source: 'inspection', sourceRef: 'INS-2026-0042',
    status: 'in_progress', priority: 'critical', risk: 'critical',
    category: 'Quality', area: 'Plant A — Weld Cell 3',
    ownerId: 'u2', createdBy: 'u7',
    due: '2026-04-22', createdAt: '2026-04-15T09:32:00',
    age: 4, sla: 'at_risk',
    eightDId: '8D-2026-0015',
    description: 'During routine process audit on Weld Cell 3, 7 of 120 hinge assemblies showed visible porosity at the A-pillar weld joint. Defect rate (5.8%) exceeds the 0.5% IATF threshold. Parts quarantined; line running containment.',
    rootCause: null,
    containment: [
      { id: 'c1', title: '100% visual inspection on Weld Cell 3 output', owner: 'u3', due: '2026-04-16', status: 'completed' },
      { id: 'c2', title: 'Quarantine 2,840 parts from last 48h', owner: 'u3', due: '2026-04-16', status: 'completed' },
      { id: 'c3', title: 'Notify customer (Tier-1 OEM) of potential escape', owner: 'u1', due: '2026-04-17', status: 'completed' },
      { id: 'c4', title: 'Re-certify welders on station 3B', owner: 'u2', due: '2026-04-20', status: 'in_progress' },
    ],
    corrective: [
      { id: 'cr1', title: 'Replace MIG nozzle + recalibrate wire feed speed', owner: 'u3', due: '2026-04-25', status: 'pending' },
    ],
  },
  { id: 'NCR-2026-0091', title: 'Torque wrench #TW-204 out of calibration (Line 2)', source: 'inspection', sourceRef: 'INS-2026-0042', status: 'assigned', priority: 'major', risk: 'high', category: 'Process', area: 'Plant A — Line 2', ownerId: 'u3', due: '2026-04-24', createdAt: '2026-04-15T10:05:00', age: 4, sla: 'on_track' },
  { id: 'NCR-2026-0088', title: 'Dimensional deviation on bracket B-0421 (+0.4mm)', source: 'inspection', status: 'resolved', priority: 'major', risk: 'medium', category: 'Quality', area: 'Plant B — Machining', ownerId: 'u2', due: '2026-04-18', createdAt: '2026-04-10T08:15:00', age: 9, sla: 'on_track' },
  { id: 'NCR-2026-0087', title: 'Fire extinguisher #FE-042 expired (Assembly Area B)', source: 'inspection', status: 'closed', priority: 'critical', risk: 'critical', category: 'Safety', area: 'Plant A — Assembly B', ownerId: 'u5', due: '2026-04-12', createdAt: '2026-04-10T14:30:00', age: 9, sla: 'on_track' },
  { id: 'NCR-2026-0086', title: 'PPE violation — safety glasses not worn (Line 4)', source: 'manual', status: 'closed', priority: 'minor', risk: 'low', category: 'Safety', area: 'Plant A — Line 4', ownerId: 'u5', due: '2026-04-20', createdAt: '2026-04-09T11:00:00', age: 10, sla: 'on_track' },
  { id: 'NCR-2026-0085', title: 'Supplier batch variation — wire grade ER70S-6', source: 'customer_complaint', status: 'in_progress', priority: 'major', risk: 'high', category: 'Supplier', area: 'Incoming Goods', ownerId: 'u6', due: '2026-04-21', createdAt: '2026-04-08T09:00:00', age: 11, sla: 'at_risk' },
  { id: 'NCR-2026-0084', title: 'Paint thickness below spec on hood panel (batch #H-884)', source: 'inspection', status: 'open', priority: 'major', risk: 'medium', category: 'Quality', area: 'Plant B — Paint Shop', ownerId: 'u2', due: '2026-04-23', createdAt: '2026-04-07T13:20:00', age: 12, sla: 'on_track' },
  { id: 'NCR-2026-0083', title: 'Missing traceability label on rack #R-117', source: 'inspection', status: 'assigned', priority: 'minor', risk: 'low', category: 'Process', area: 'Plant A — Shipping', ownerId: 'u7', due: '2026-05-06', createdAt: '2026-04-06T10:00:00', age: 13, sla: 'on_track' },
  { id: 'NCR-2026-0082', title: 'Spill containment pallet degraded (Chem Storage)', source: 'inspection', status: 'in_progress', priority: 'major', risk: 'high', category: 'Environmental', area: 'Plant A — Chem Storage', ownerId: 'u5', due: '2026-04-20', createdAt: '2026-04-05T15:45:00', age: 14, sla: 'breached' },
  { id: 'NCR-2026-0081', title: 'ESD mat resistance out of range — Electronics Sub-Assy', source: 'inspection', status: 'verified', priority: 'minor', risk: 'low', category: 'Process', area: 'Plant A — Electronics', ownerId: 'u3', due: '2026-04-19', createdAt: '2026-04-04T08:30:00', age: 15, sla: 'on_track' },
];

const INSPECTIONS = [
  { id: 'INS-2026-0042', title: 'Process Audit — Weld Cell 3 (Monthly)', template: 'IATF Process Audit v2.1', inspectorId: 'u7', status: 'completed', risk: 'critical', findings: 3, due: '2026-04-15', completed: '2026-04-15', score: 78, area: 'Plant A — Weld Cell 3' },
  { id: 'INS-2026-0043', title: 'Daily Line Safety Walk — Line 2', template: 'Daily Safety Walk', inspectorId: 'u5', status: 'completed', risk: 'low', findings: 1, due: '2026-04-18', completed: '2026-04-18', score: 96, area: 'Plant A — Line 2' },
  { id: 'INS-2026-0044', title: 'Incoming Goods — Batch #W-8821 (ER70S-6 wire)', template: 'Incoming Goods Inspection', inspectorId: 'u6', status: 'in_progress', risk: 'medium', findings: 0, due: '2026-04-19', area: 'Incoming Goods' },
  { id: 'INS-2026-0045', title: 'Layered Process Audit — Shift A', template: 'LPA — Supervisor', inspectorId: 'u3', status: 'scheduled', risk: null, findings: 0, due: '2026-04-20', area: 'Plant A — Line 3' },
  { id: 'INS-2026-0046', title: '5S Audit — Machining Cell 4', template: '5S Workplace Audit', inspectorId: 'u7', status: 'scheduled', risk: null, findings: 0, due: '2026-04-21', area: 'Plant B — Machining' },
  { id: 'INS-2026-0041', title: 'Customer Returns Analysis — April Week 2', template: 'Returns Teardown', inspectorId: 'u2', status: 'completed', risk: 'high', findings: 5, due: '2026-04-13', completed: '2026-04-14', score: 64, area: 'Quality Lab' },
  { id: 'INS-2026-0040', title: 'Fire Safety — Plant A Quarterly', template: 'Fire Safety Checklist', inspectorId: 'u5', status: 'completed', risk: 'medium', findings: 2, due: '2026-04-10', completed: '2026-04-10', score: 88, area: 'Plant A' },
  { id: 'INS-2026-0039', title: 'Paint Shop Environmental Controls', template: 'EHS Environmental', inspectorId: 'u5', status: 'completed', risk: 'low', findings: 0, due: '2026-04-08', completed: '2026-04-08', score: 98, area: 'Plant B — Paint Shop' },
  { id: 'INS-2026-0038', title: 'Supplier Audit — Precision Stamping GmbH', template: 'Supplier Audit — Tier 2', inspectorId: 'u6', status: 'completed', risk: 'medium', findings: 4, due: '2026-04-05', completed: '2026-04-06', score: 82, area: 'Off-site' },
  { id: 'INS-2026-0037', title: 'Layered Process Audit — Shift B', template: 'LPA — Supervisor', inspectorId: 'u3', status: 'completed', risk: 'low', findings: 1, due: '2026-04-04', completed: '2026-04-04', score: 94, area: 'Plant A — Line 3' },
];

// Inspection template used for detail view — a realistic IATF process audit
const INSPECTION_TEMPLATE = {
  id: 'iatf-process-audit-v2',
  name: 'IATF Process Audit v2.1',
  version: '2.1',
  industry: 'Automotive',
  maxScore: 100,
  sections: [
    {
      id: 's1', title: 'Process Control & Standards',
      items: [
        { id: 'i1', type: 'pass_fail', label: 'Current work instruction visible at station', required: true, triggerFinding: true },
        { id: 'i2', type: 'pass_fail', label: 'Process parameters match control plan', required: true, triggerFinding: true, findingSeverity: 'critical' },
        { id: 'i3', type: 'score', label: 'Operator training records current (rate 1–5)', required: true },
        { id: 'i4', type: 'pass_fail', label: 'PFMEA reviewed within last 12 months', required: true },
      ]
    },
    {
      id: 's2', title: 'Equipment & Tooling',
      items: [
        { id: 'i5', type: 'pass_fail', label: 'Torque tools within calibration date', required: true, triggerFinding: true, findingSeverity: 'major' },
        { id: 'i6', type: 'pass_fail', label: 'Weld parameters displayed & within spec', required: true, triggerFinding: true, findingSeverity: 'critical' },
        { id: 'i7', type: 'photo', label: 'Photo of fixture condition', required: false },
        { id: 'i8', type: 'pass_fail', label: 'Preventive maintenance current', required: true },
      ]
    },
    {
      id: 's3', title: 'Product Quality',
      items: [
        { id: 'i9', type: 'pass_fail', label: 'First piece inspection completed & documented', required: true },
        { id: 'i10', type: 'pass_fail', label: 'SPC charts current & in control', required: true, triggerFinding: true },
        { id: 'i11', type: 'pass_fail', label: 'Non-conforming material properly identified', required: true, triggerFinding: true, findingSeverity: 'major' },
        { id: 'i12', type: 'number', label: 'Defect rate last shift (%)', required: true },
      ]
    },
    {
      id: 's4', title: '5S & Safety',
      items: [
        { id: 'i13', type: 'pass_fail', label: 'Workplace clean & organized (5S)' },
        { id: 'i14', type: 'pass_fail', label: 'PPE worn correctly by all operators', triggerFinding: true },
        { id: 'i15', type: 'pass_fail', label: 'Emergency stops accessible & tested' },
        { id: 'i16', type: 'textarea', label: 'Observations & improvement opportunities' },
      ]
    }
  ]
};

// Pre-filled responses for INS-2026-0042 (the completed audit that generated NCRs)
const INSPECTION_RESPONSES = {
  i1: { value: 'pass' },
  i2: { value: 'fail', notes: 'Wire feed speed on Station 3B observed at 5.8 m/min vs. 6.5 m/min spec.', photos: 2 },
  i3: { value: 4 },
  i4: { value: 'pass' },
  i5: { value: 'fail', notes: 'Torque wrench TW-204 calibration due 2026-04-02. Last cert sticker shows 2025-09.', photos: 1 },
  i6: { value: 'fail', notes: 'Amperage at Station 3B drifting 8–12% over 4h window. Porosity visible on output.', photos: 3 },
  i7: { value: null, photos: 1 },
  i8: { value: 'pass' },
  i9: { value: 'pass' },
  i10: { value: 'pass' },
  i11: { value: 'pass' },
  i12: { value: 5.8 },
  i13: { value: 'pass' },
  i14: { value: 'pass' },
  i15: { value: 'pass' },
  i16: { value: 'Recommend increased audit frequency on Weld Cell 3 until parameter drift resolved. Operator Tomas Vogel raised concerns about shield gas regulator 2 weeks ago — follow up with facilities.' }
};

const FINDINGS = [
  { id: 'f1', itemId: 'i2', severity: 'critical', observation: 'Wire feed speed drift 10.8% below spec on Station 3B — correlates with porosity defects.', ncrId: 'NCR-2026-0089', photos: 2 },
  { id: 'f2', itemId: 'i5', severity: 'major', observation: 'Torque wrench TW-204 past calibration due date by 13 days.', ncrId: 'NCR-2026-0091', photos: 1 },
  { id: 'f3', itemId: 'i6', severity: 'critical', observation: 'Amperage drift on Station 3B — 8–12% over 4h window. Linked to same root cause as Finding #1.', ncrId: 'NCR-2026-0089', photos: 3 },
];

// The 8D for the big NCR
const EIGHT_D = {
  id: '8D-2026-0015',
  title: 'Recurring weld porosity on Part #A-7742',
  ncrId: 'NCR-2026-0089',
  status: 'active',
  currentStep: 4, // D4
  teamLeadId: 'u2',
  team: [
    { userId: 'u2', role: 'Team Lead' },
    { userId: 'u3', role: 'Production' },
    { userId: 'u7', role: 'Inspector' },
    { userId: 'u6', role: 'Supplier Quality' },
  ],
  championId: 'u1',
  startedAt: '2026-04-16',
  target: '2026-05-15',
  // Agentic provenance — D1–D4 were drafted by the AI from the linked NCR
  aiDraftedFrom: 'NCR-2026-0089',
  aiDraftedAt: '2026-04-16 09:12',
  aiModel: 'Kaenal Quality Copilot',
  // Side-rail: AI-proposed interim containment actions
  aiContainment: [
    { id: 'c1', title: 'Install inline shielding-gas flow sensor + low-flow alarm at Station 3B', rationale: 'Detects regulator drift in real time. This containment closed 8D-2025-0047 in 21 days.', impact: 'high' },
    { id: 'c2', title: '100% X-ray of A-pillar joints until root cause is verified', rationale: 'Current visual-only screen misses subsurface voids; raises detection to 100%.', impact: 'high' },
    { id: 'c3', title: 'Quarantine wire lot ER70S-6 #4471 pending incoming re-test', rationale: 'Lot introduced 2 days before defect onset; composition is edge-of-spec.', impact: 'med' },
    { id: 'c4', title: 'Daily regulator flow log on all Weld Cell 3 stations', rationale: 'Catches recurrence on sister stations before parts ship.', impact: 'med' },
  ],
  // Side-rail: similar past cases retrieved from the quality knowledge base
  similarCases: [
    { id: '8D-2025-0047', kind: '8d', title: 'Weld porosity — Station 2A regulator drift', match: 92, rootCause: 'Gas regulator past service interval', outcome: 'closed', closedIn: '21 days', capa: 'PM interval shortened to 18 mo' },
    { id: 'NCR-2026-0085', kind: 'ncr', title: 'ER70S-6 wire batch composition variation', match: 74, rootCause: 'Supplier composition at tolerance edge', outcome: 'active', closedIn: 'open', capa: 'Added incoming PMI verification' },
    { id: '8D-2024-0112', kind: '8d', title: 'Fillet weld voids — Weld Cell 4', match: 61, rootCause: 'Torch tip electrode wear', outcome: 'closed', closedIn: '34 days', capa: 'Added consumable tip-life counter' },
  ],
  steps: {
    D1: { complete: true, completedAt: '2026-04-16' },
    D2: { complete: true, completedAt: '2026-04-16',
      problemStatement: 'Since April 10, 2026, Part #A-7742 (door hinge assembly) from Weld Cell 3 has exhibited porosity at the A-pillar weld joint. Defect rate reached 5.8% on April 15 vs. the 0.5% IATF threshold. No defects observed on parallel Weld Cells 1, 2, or 4. Customer notified; containment active.',
      isIsNot: {
        what: { is: 'Porosity at A-pillar weld joint, Part #A-7742', isNot: 'Other weld joints on same part; other parts on same cell' },
        where: { is: 'Weld Cell 3, Station 3B', isNot: 'Cells 1, 2, 4; Station 3A' },
        when: { is: 'Since April 10, 2026 — all shifts', isNot: 'Before April 10; during PM windows' },
        howMuch: { is: '5.8% defect rate (peak); 2,840 parts quarantined', isNot: '<0.5% baseline; other parts unaffected' },
        who: { is: 'All 3 welders on Station 3B', isNot: 'Individual operator error' },
      },
      cost: 84000,
      quantity: 2840,
    },
    D3: { complete: true, completedAt: '2026-04-17',
      actions: [
        { title: '100% visual inspection at Station 3B output', owner: 'u3', status: 'completed' },
        { title: 'Quarantine 2,840 suspect parts', owner: 'u3', status: 'completed' },
        { title: 'Notify Tier-1 OEM customer', owner: 'u1', status: 'completed' },
        { title: 'Shift production to Weld Cell 1 for critical orders', owner: 'u3', status: 'completed' },
      ],
      effective: true,
    },
    D4: { complete: false, // current step
      tab: 'fivewhys',
      fiveWhys: [
        { why: 'Why is Part #A-7742 showing porosity at the A-pillar weld?', answer: 'Shielding gas coverage is insufficient during the weld cycle.' },
        { why: 'Why is shielding gas coverage insufficient?', answer: 'Gas flow rate is below the 18 L/min spec — measured at 13–14 L/min.' },
        { why: 'Why is gas flow below spec?', answer: 'Primary regulator on Station 3B is drifting under load.' },
        { why: 'Why is the regulator drifting?', answer: 'Regulator diaphragm worn — unit is 4 years old past its 3-year service interval.' },
        { why: '', answer: '' }, // next why to fill
      ],
      aiSuggestions: [
        { confidence: 85, cause: 'Shielding gas regulator drift on Station 3B', evidence: 'Wire feed speed and amperage drift correlate with intermittent gas flow. Regulator last serviced 4 years ago (3-year interval).', similar: '8D-2025-0047' },
        { confidence: 62, cause: 'Supplier batch variation — wire grade ER70S-6', evidence: 'New batch from alternate supplier introduced April 8. Batch composition within tolerance but at edge.', similar: 'NCR-2026-0085' },
        { confidence: 41, cause: 'Fixture wear (J-12)', evidence: 'Fixture #J-12 last calibrated 6 months ago — may affect joint geometry.', similar: null },
      ],
      rootCause: '',
    },
    D5: { complete: false, locked: true },
    D6: { complete: false, locked: true },
    D7: { complete: false, locked: true },
    D8: { complete: false, locked: true },
  },
};

// Dashboard chart data
const NCR_TREND = [
  { month: 'May', created: 22, resolved: 19, open: 8 },
  { month: 'Jun', created: 18, resolved: 21, open: 5 },
  { month: 'Jul', created: 25, resolved: 22, open: 8 },
  { month: 'Aug', created: 31, resolved: 26, open: 13 },
  { month: 'Sep', created: 28, resolved: 30, open: 11 },
  { month: 'Oct', created: 24, resolved: 27, open: 8 },
  { month: 'Nov', created: 19, resolved: 22, open: 5 },
  { month: 'Dec', created: 15, resolved: 17, open: 3 },
  { month: 'Jan', created: 27, resolved: 21, open: 9 },
  { month: 'Feb', created: 32, resolved: 28, open: 13 },
  { month: 'Mar', created: 29, resolved: 31, open: 11 },
  { month: 'Apr', created: 34, resolved: 25, open: 20 },
];

const RISK_DIST = [
  { label: 'Critical', value: 3, color: '#dc2626' },
  { label: 'High', value: 8, color: '#ea580c' },
  { label: 'Medium', value: 14, color: '#f59e0b' },
  { label: 'Low', value: 27, color: '#22c55e' },
];

const ACTIVITY = [
  { id: 'a1', type: '8d_step', actor: 'u2', action: 'advanced D4 on', target: '8D-2026-0015', time: '8m ago', icon: 'brain' },
  { id: 'a2', type: 'ncr_created', actor: 'u7', action: 'created', target: 'NCR-2026-0089', time: '1h ago', icon: 'alert' },
  { id: 'a3', type: 'inspection_completed', actor: 'u7', action: 'completed', target: 'INS-2026-0042', time: '1h ago', icon: 'clipboard' },
  { id: 'a4', type: 'ncr_assigned', actor: 'u1', action: 'assigned', target: 'NCR-2026-0091', time: '1h ago', icon: 'user' },
  { id: 'a5', type: 'doc_uploaded', actor: 'u4', action: 'uploaded evidence to', target: 'NCR-2026-0085', time: '3h ago', icon: 'doc' },
  { id: 'a6', type: 'inspection_completed', actor: 'u5', action: 'completed', target: 'INS-2026-0043', time: '4h ago', icon: 'clipboard' },
  { id: 'a7', type: 'ncr_closed', actor: 'u5', action: 'closed', target: 'NCR-2026-0087', time: '6h ago', icon: 'check' },
  { id: 'a8', type: 'comment', actor: 'u2', action: 'commented on', target: '8D-2026-0015', time: '8h ago', icon: 'chat' },
  { id: 'a9', type: 'inspection_started', actor: 'u6', action: 'started', target: 'INS-2026-0044', time: '10h ago', icon: 'play' },
];

// Risk heatmap: areas x categories
const HEATMAP = {
  rows: ['Safety', 'Quality', 'Process', 'Environmental', 'Supplier'],
  cols: ['Plant A — Weld', 'Plant A — Assy', 'Plant A — Paint', 'Plant B — Mach', 'Plant B — Paint', 'Incoming'],
  // severity 0-4 (low→critical)
  values: [
    [1, 0, 1, 0, 1, 0],
    [4, 1, 2, 2, 1, 1],
    [2, 1, 1, 1, 0, 0],
    [0, 0, 2, 0, 1, 0],
    [0, 0, 0, 0, 0, 3],
  ],
};

const EIGHT_D_LIST = [
  { id: '8D-2026-0015', title: 'Recurring weld porosity on Part #A-7742', ncrId: 'NCR-2026-0089', currentStep: 4, teamLeadId: 'u2', status: 'active', started: '2026-04-16', target: '2026-05-15' },
  { id: '8D-2026-0014', title: 'Paint adhesion failure — batch #H-884', ncrId: 'NCR-2026-0084', currentStep: 6, teamLeadId: 'u2', status: 'active', started: '2026-04-10', target: '2026-05-10' },
  { id: '8D-2026-0013', title: 'Dimensional drift — bracket B-0421', ncrId: 'NCR-2026-0088', currentStep: 8, teamLeadId: 'u2', status: 'completed', started: '2026-03-20', target: '2026-04-20' },
  { id: '8D-2026-0012', title: 'Torque wrench fleet calibration gap', ncrId: 'NCR-2026-0091', currentStep: 3, teamLeadId: 'u3', status: 'active', started: '2026-04-15', target: '2026-05-15' },
  { id: '8D-2026-0011', title: 'Supplier wire batch variation — ER70S-6', ncrId: 'NCR-2026-0085', currentStep: 5, teamLeadId: 'u6', status: 'active', started: '2026-04-09', target: '2026-05-09' },
];

Object.assign(window, {
  USERS, userById, NCRS, INSPECTIONS, INSPECTION_TEMPLATE, INSPECTION_RESPONSES,
  FINDINGS, EIGHT_D, EIGHT_D_LIST, NCR_TREND, RISK_DIST, ACTIVITY, HEATMAP,
});


// ─────────────────────────────────────────────────────────────
// AUDITS
// ─────────────────────────────────────────────────────────────
const AUDITS = [
  { id: 'AUD-2026-0021', title: 'IATF 16949:2016 Re-certification — Plant A', type: 'certification', standard: 'IATF 16949:2016', scope: ['Plant A — All Cells', 'QMS', 'Supplier Mgmt'], leadAuditorId: 'u4', auditTeam: ['u4','u2','u1'], auditeeIds: ['u3'], status: 'in_progress', phase: 'fieldwork', progress: 62, plannedStart: '2026-04-12', plannedEnd: '2026-04-20', started: '2026-04-12', findings: { major: 1, minor: 4, oppt: 3 }, capasOpen: 3, capasTotal: 5, location: 'Plant A — Detroit', durationDays: 5, nextActivity: 'Closing meeting · Apr 19, 2:00 PM', description: 'Triennial re-certification audit by external registrar (TÜV Rheinland). Full IATF 16949 scope including Customer Specific Requirements (CSRs).' },
  { id: 'AUD-2026-0020', title: 'Supplier Audit — Precision Stamping GmbH (Tier 2)', type: 'supplier', standard: 'IATF 16949 + CSR', scope: ['Stamping','Heat treatment','Plating'], leadAuditorId: 'u6', auditTeam: ['u6','u4'], auditeeIds: [], status: 'in_progress', phase: 'reporting', progress: 85, plannedStart: '2026-04-08', plannedEnd: '2026-04-10', started: '2026-04-08', completed: '2026-04-10', findings: { major: 0, minor: 2, oppt: 1 }, capasOpen: 2, capasTotal: 2, location: 'Frankfurt, DE (off-site)', durationDays: 3, nextActivity: 'Final report due · Apr 22', description: 'Annual surveillance audit at Tier-2 stamping supplier. Heat treatment and plating chemistry focus.' },
  { id: 'AUD-2026-0019', title: 'Layered Process Audit — Welding (Q2)', type: 'internal', standard: 'Internal LPA — IATF 8.3', scope: ['Plant A — Weld Cells 1–4'], leadAuditorId: 'u3', auditTeam: ['u3','u2','u7'], auditeeIds: ['u3'], status: 'planned', phase: 'planned', progress: 0, plannedStart: '2026-05-04', plannedEnd: '2026-05-08', findings: { major: 0, minor: 0, oppt: 0 }, capasOpen: 0, capasTotal: 0, location: 'Plant A — Welding', durationDays: 5, nextActivity: 'Opening meeting · May 4', description: 'Quarterly LPA on welding ops. 3 levels: Operator → Supervisor → Manager.' },
  { id: 'AUD-2026-0018', title: 'EHS — Environmental Compliance (Plant B)', type: 'internal', standard: 'ISO 14001:2015', scope: ['Plant B','Chemical mgmt','Waste streams'], leadAuditorId: 'u5', auditTeam: ['u5','u4'], auditeeIds: [], status: 'completed', phase: 'closed', progress: 100, plannedStart: '2026-03-22', plannedEnd: '2026-03-26', started: '2026-03-22', completed: '2026-03-26', findings: { major: 0, minor: 1, oppt: 4 }, capasOpen: 0, capasTotal: 1, location: 'Plant B — Chicago', durationDays: 5, nextActivity: '—', description: 'Annual ISO 14001 internal audit. One minor on SDS update cycle.' },
  { id: 'AUD-2026-0017', title: 'AS9100D Recertification Prep (gap analysis)', type: 'gap', standard: 'AS9100D', scope: ['Aerospace product line','Configuration mgmt'], leadAuditorId: 'u4', auditTeam: ['u4','u2'], auditeeIds: [], status: 'completed', phase: 'closed', progress: 100, plannedStart: '2026-02-15', plannedEnd: '2026-02-19', started: '2026-02-15', completed: '2026-02-19', findings: { major: 1, minor: 3, oppt: 2 }, capasOpen: 0, capasTotal: 4, location: 'Plant A — Aerospace cell', durationDays: 5, nextActivity: '—', description: 'Pre-recert gap analysis. One major (config record retention) — closed via CAPA-2026-0033.' },
  { id: 'AUD-2026-0016', title: 'Customer Audit — Volvo Group (announced)', type: 'customer', standard: 'Volvo PPAP', scope: ['Door hinge program','PPAP package'], leadAuditorId: 'u1', auditTeam: ['u1','u2','u3'], auditeeIds: ['u1','u2'], status: 'planned', phase: 'preparation', progress: 35, plannedStart: '2026-05-18', plannedEnd: '2026-05-19', findings: { major: 0, minor: 0, oppt: 0 }, capasOpen: 0, capasTotal: 0, location: 'Plant A — Conference Rm A', durationDays: 2, nextActivity: 'Pre-audit checklist · Apr 30', description: 'Customer-announced audit covering door hinge program (Part #A-7742). Volvo Quality + Engineering.' },
];

const AUDIT_CHECKLIST = [
  { id: 'q1', clause: '4.1', section: 'Context of organization', text: 'Has the organization determined external and internal issues relevant to its purpose?', status: 'conformant', notes: 'Reviewed strategic plan & SWOT. Documented in QMM Section 4.1.', evidence: 2 },
  { id: 'q2', clause: '4.4.1', section: 'QMS processes', text: 'Are QMS processes documented and interactions defined?', status: 'conformant', notes: 'Process map updated April 2026.', evidence: 1 },
  { id: 'q3', clause: '6.1', section: 'Risk & opportunities', text: 'Has the organization conducted risk analysis at process level?', status: 'minor_nc', notes: 'Risk register exists but 3 of 12 processes lack updated risk scoring.', evidence: 0, findingId: 'fnd-002' },
  { id: 'q4', clause: '7.5.3', section: 'Control of documented info', text: 'Are documents controlled (access, storage, retrieval, disposition)?', status: 'conformant', notes: 'EDMS in place; reviewed sample of 20 documents.', evidence: 3 },
  { id: 'q5', clause: '8.3', section: 'Design & Development', text: 'Is design output verified against design input?', status: 'minor_nc', notes: 'Design review records found but verification matrix incomplete on 2 of 5 sampled projects.', evidence: 1, findingId: 'fnd-003' },
  { id: 'q6', clause: '8.5.1', section: 'Production & service control', text: 'Are production processes operated under controlled conditions?', status: 'major_nc', notes: 'Weld Cell 3 — parameter drift not detected by SPC. See NCR-2026-0089.', evidence: 5, findingId: 'fnd-001', linkedNcr: 'NCR-2026-0089' },
  { id: 'q7', clause: '8.5.1.5', section: 'Total productive maintenance', text: 'Is TPM implemented for production equipment?', status: 'opportunity', notes: 'TPM works in machining; Welding uses reactive maintenance.', evidence: 0 },
  { id: 'q8', clause: '8.6', section: 'Release of products', text: 'Are products released only when verification activities are completed?', status: 'conformant', notes: 'PPAP records verified for current programs.', evidence: 2 },
  { id: 'q9', clause: '8.7', section: 'Control of nonconforming output', text: 'Are nonconforming outputs identified, segregated, and dispositioned?', status: 'conformant', notes: 'NCR system in place; reviewed 8 active NCRs and 12 closed.', evidence: 0 },
  { id: 'q10', clause: '9.1.3', section: 'Analysis and evaluation', text: 'Are quality data analyzed and used for management review?', status: 'pending', notes: '', evidence: 0 },
  { id: 'q11', clause: '10.2', section: 'Nonconformity & corrective action', text: 'Are corrective actions effective and verified?', status: 'pending', notes: '', evidence: 0 },
  { id: 'q12', clause: '10.3', section: 'Continual improvement', text: 'Is continual improvement demonstrated?', status: 'pending', notes: '', evidence: 0 },
];

const AUDIT_FINDINGS = [
  { id: 'fnd-001', auditId: 'AUD-2026-0021', clause: '8.5.1', severity: 'major', title: 'Process control on Weld Cell 3 inadequate', description: 'Wire feed and amperage drift on Station 3B not detected by current SPC monitoring. 5.8% defect rate (NCR-2026-0089).', capaId: 'CAPA-2026-0042', linkedNcr: 'NCR-2026-0089', dueDate: '2026-05-15', status: 'capa_open' },
  { id: 'fnd-002', auditId: 'AUD-2026-0021', clause: '6.1', severity: 'minor', title: 'Risk register incomplete (3 processes)', description: 'Process risk scoring missing for: Inbound logistics, Calibration management, Document control.', capaId: 'CAPA-2026-0043', dueDate: '2026-06-01', status: 'capa_open' },
  { id: 'fnd-003', auditId: 'AUD-2026-0021', clause: '8.3', severity: 'minor', title: 'Design verification matrix incomplete', description: '2 of 5 sampled D&D projects lack a complete verification matrix.', capaId: 'CAPA-2026-0044', dueDate: '2026-05-30', status: 'capa_open' },
];

const AUDIT_FREQUENCY = [
  { month: 'Jan', internal: 4, supplier: 1, customer: 0, certification: 0 },
  { month: 'Feb', internal: 5, supplier: 2, customer: 0, certification: 1 },
  { month: 'Mar', internal: 6, supplier: 1, customer: 1, certification: 0 },
  { month: 'Apr', internal: 4, supplier: 2, customer: 0, certification: 1 },
  { month: 'May', internal: 6, supplier: 3, customer: 1, certification: 0 },
  { month: 'Jun', internal: 5, supplier: 2, customer: 0, certification: 0 },
];

// ─────────────────────────────────────────────────────────────
// CAPA
// ─────────────────────────────────────────────────────────────
const CAPAS = [
  { id: 'CAPA-2026-0042', title: 'Weld parameter drift detection — implement closed-loop SPC', type: 'corrective', source: 'audit', sourceRef: 'AUD-2026-0021', findingId: 'fnd-001', linkedNcr: 'NCR-2026-0089', linked8d: '8D-2026-0015', status: 'in_progress', phase: 'action_plan', priority: 'critical', risk: 'critical', ownerId: 'u2', sponsorId: 'u1', teamIds: ['u2','u3','u7'], opened: '2026-04-17', dueDate: '2026-05-15', targetEffectiveness: '2026-08-15', daysOpen: 3, slaStatus: 'on_track', description: 'Implement closed-loop SPC on Weld Cell 3 with real-time parameter monitoring (gas flow, amperage, wire feed). Auto-stop on out-of-control signal.', rootCause: 'Shielding gas regulator drift on Station 3B caused by 4-year-old diaphragm past 3-year service interval. SPC system did not capture gas flow as a controlled parameter.', rcaMethod: '5_whys',
    actions: [
      { id: 'ca1', title: 'Replace gas regulator on all 4 stations of Weld Cell 3', owner: 'u3', due: '2026-04-25', status: 'in_progress', evidence: 0 },
      { id: 'ca2', title: 'Add gas flow + amperage to SPC monitoring (Cell 3)', owner: 'u2', due: '2026-05-05', status: 'pending', evidence: 0 },
      { id: 'ca3', title: 'Update PFMEA & control plan to include flow rate', owner: 'u2', due: '2026-05-08', status: 'pending', evidence: 0 },
      { id: 'ca4', title: 'Operator training — new monitoring & response', owner: 'u3', due: '2026-05-12', status: 'pending', evidence: 0 },
    ],
    effectivenessChecks: [
      { id: 'ec1', date: '2026-06-15', metric: 'Defect rate', target: '<0.5%', actual: null, result: 'pending' },
      { id: 'ec2', date: '2026-07-15', metric: 'Defect rate', target: '<0.5%', actual: null, result: 'pending' },
      { id: 'ec3', date: '2026-08-15', metric: 'Defect rate', target: '<0.5%', actual: null, result: 'pending' },
    ],
  },
  { id: 'CAPA-2026-0043', title: 'Complete process risk register (3 missing processes)', type: 'corrective', source: 'audit', sourceRef: 'AUD-2026-0021', findingId: 'fnd-002', status: 'in_progress', phase: 'action_plan', priority: 'medium', risk: 'medium', ownerId: 'u1', sponsorId: 'u1', teamIds: ['u1','u4'], opened: '2026-04-17', dueDate: '2026-06-01', daysOpen: 3, slaStatus: 'on_track', description: 'Complete process-level risk scoring for: Inbound logistics, Calibration management, Document control.',
    actions: [
      { id: 'ca1', title: 'Run risk workshop with process owners', owner: 'u4', due: '2026-05-08', status: 'pending', evidence: 0 },
      { id: 'ca2', title: 'Update risk register entries', owner: 'u1', due: '2026-05-22', status: 'pending', evidence: 0 },
      { id: 'ca3', title: 'Management review of updated register', owner: 'u1', due: '2026-05-30', status: 'pending', evidence: 0 },
    ],
  },
  { id: 'CAPA-2026-0041', title: 'Calibration management — torque tool fleet refresh', type: 'corrective', source: 'ncr', sourceRef: 'NCR-2026-0091', status: 'in_progress', phase: 'implementation', priority: 'high', risk: 'high', ownerId: 'u3', sponsorId: 'u1', teamIds: ['u3','u7'], opened: '2026-04-15', dueDate: '2026-05-08', daysOpen: 5, slaStatus: 'at_risk', description: 'Implement RFID-based calibration tracking for all 47 torque tools across plants. Auto-block tool issuance if calibration expired.',
    actions: [
      { id: 'ca1', title: 'Tag 47 tools with RFID', owner: 'u7', due: '2026-04-30', status: 'in_progress', evidence: 2 },
      { id: 'ca2', title: 'Integrate RFID gate at tool crib', owner: 'u3', due: '2026-05-05', status: 'pending', evidence: 0 },
      { id: 'ca3', title: 'Verify 100% block on expired tool', owner: 'u3', due: '2026-05-08', status: 'pending', evidence: 0 },
    ],
  },
  { id: 'CAPA-2026-0040', title: 'Preventive — extend TPM to Welding cells', type: 'preventive', source: 'audit', sourceRef: 'AUD-2026-0021', status: 'in_progress', phase: 'rca', priority: 'medium', risk: 'medium', ownerId: 'u3', sponsorId: 'u1', teamIds: ['u3','u2'], opened: '2026-04-18', dueDate: '2026-07-31', daysOpen: 2, slaStatus: 'on_track', description: 'Extend TPM from machining to welding cells. Currently reactive; targeting 80% planned PM by Q3.' },
  { id: 'CAPA-2026-0039', title: 'Paint adhesion — supplier primer spec update', type: 'corrective', source: '8d', sourceRef: '8D-2026-0014', linkedNcr: 'NCR-2026-0084', status: 'verification', phase: 'effectiveness', priority: 'high', risk: 'medium', ownerId: 'u2', sponsorId: 'u1', teamIds: ['u2','u6'], opened: '2026-03-15', dueDate: '2026-04-30', targetEffectiveness: '2026-07-30', daysOpen: 36, slaStatus: 'on_track', description: 'Updated primer spec with supplier; verifying adhesion improvement over 90 days.',
    effectivenessChecks: [
      { id: 'ec1', date: '2026-04-15', metric: 'Adhesion test', target: '≥4B (ASTM D3359)', actual: '4B', result: 'pass' },
      { id: 'ec2', date: '2026-05-15', metric: 'Adhesion test', target: '≥4B', actual: null, result: 'pending' },
      { id: 'ec3', date: '2026-06-15', metric: 'Adhesion test', target: '≥4B', actual: null, result: 'pending' },
    ],
  },
  { id: 'CAPA-2026-0038', title: 'Customer escape — incoming inspection upgrade', type: 'corrective', source: 'customer_complaint', status: 'completed', phase: 'closed', priority: 'critical', risk: 'critical', ownerId: 'u6', sponsorId: 'u1', teamIds: ['u6'], opened: '2026-02-08', dueDate: '2026-03-15', closedAt: '2026-03-12', daysOpen: 33, slaStatus: 'closed', description: 'Tier-1 customer received off-spec brackets — root cause: incoming inspection sample plan inadequate. Updated AQL from 1.5 to 0.65.' },
  { id: 'CAPA-2026-0037', title: 'Spill containment refresh program', type: 'preventive', source: 'inspection', sourceRef: 'INS-2026-0040', linkedNcr: 'NCR-2026-0082', status: 'in_progress', phase: 'implementation', priority: 'medium', risk: 'high', ownerId: 'u5', sponsorId: 'u5', teamIds: ['u5'], opened: '2026-03-10', dueDate: '2026-05-30', daysOpen: 41, slaStatus: 'on_track', description: 'Replace all 23 spill pallets older than 5 years across both plants. Add quarterly visual inspection to LPA.' },
  { id: 'CAPA-2026-0036', title: 'PPE compliance — visual indicators on lines', type: 'preventive', source: 'ncr', sourceRef: 'NCR-2026-0086', status: 'closed', phase: 'closed', priority: 'low', risk: 'low', ownerId: 'u5', sponsorId: 'u5', teamIds: ['u5'], opened: '2026-02-15', dueDate: '2026-03-30', closedAt: '2026-03-25', daysOpen: 38, slaStatus: 'closed', description: 'Installed visual PPE indicators (LED reminder boards) at line entry points.' },
];

const CAPA_TREND = [
  { month: 'Nov', opened: 8, closed: 6, avgDays: 42 },
  { month: 'Dec', opened: 6, closed: 9, avgDays: 38 },
  { month: 'Jan', opened: 11, closed: 7, avgDays: 45 },
  { month: 'Feb', opened: 9, closed: 10, avgDays: 41 },
  { month: 'Mar', opened: 12, closed: 11, avgDays: 36 },
  { month: 'Apr', opened: 14, closed: 8, avgDays: 38 },
];

// ─────────────────────────────────────────────────────────────
// NOTIFICATIONS
// ─────────────────────────────────────────────────────────────
const NOTIFICATIONS = [
  { id: 'n1', type: 'mention', read: false, time: 'just now', actorId: 'u2', title: '@you in 8D-2026-0015', body: 'Anna Schmidt mentioned you on the D4 root cause discussion.', target: { kind: '8d', id: '8D-2026-0015' }, icon: 'chat', color: '#2563eb' },
  { id: 'n2', type: 'sla_breach', read: false, time: '12m ago', actorId: null, title: 'CAPA approaching due date', body: 'CAPA-2026-0041 is 5 days from due date. Status: implementation.', target: { kind: 'capa', id: 'CAPA-2026-0041' }, icon: 'clock', color: '#dc2626' },
  { id: 'n3', type: 'assignment', read: false, time: '34m ago', actorId: 'u1', title: 'New CAPA assigned to you', body: 'Manjunath Kumar assigned CAPA-2026-0042 — Weld parameter drift.', target: { kind: 'capa', id: 'CAPA-2026-0042' }, icon: 'user', color: '#2563eb' },
  { id: 'n4', type: 'approval', read: false, time: '1h ago', actorId: 'u3', title: 'Document approval required', body: 'Thomas Müller submitted "Weld Cell 3 — Updated Control Plan v3.2" for your approval.', target: { kind: 'document', id: 'DOC-WI-203' }, icon: 'fileCheck', color: '#9333ea' },
  { id: 'n5', type: 'audit', read: false, time: '2h ago', actorId: 'u4', title: 'Audit finding requires CAPA', body: 'Priya Nair raised a major NC on AUD-2026-0021. CAPA required by May 15.', target: { kind: 'audit', id: 'AUD-2026-0021' }, icon: 'audit', color: '#ea580c' },
  { id: 'n6', type: 'comment', read: true, time: '3h ago', actorId: 'u1', title: 'New comment on NCR-2026-0089', body: '"Confirmed regulator replacement scheduled for tomorrow morning."', target: { kind: 'ncr', id: 'NCR-2026-0089' }, icon: 'chat', color: '#64748b' },
  { id: 'n7', type: 'status_change', read: true, time: '5h ago', actorId: 'u2', title: '8D advanced to D5', body: 'Anna Schmidt moved 8D-2026-0014 from D4 to D5 (Permanent Corrective Action).', target: { kind: '8d', id: '8D-2026-0014' }, icon: 'brain', color: '#6366f1' },
  { id: 'n8', type: 'sla_breach', read: true, time: '7h ago', actorId: null, title: 'NCR overdue', body: 'NCR-2026-0082 is 1 day overdue. Owner: David Chen.', target: { kind: 'ncr', id: 'NCR-2026-0082' }, icon: 'alert', color: '#dc2626' },
  { id: 'n9', type: 'inspection', read: true, time: '8h ago', actorId: 'u7', title: 'Inspection completed', body: 'Rafael Costa completed INS-2026-0042 with 3 findings.', target: { kind: 'inspection', id: 'INS-2026-0042' }, icon: 'clipboard', color: '#16a34a' },
  { id: 'n10', type: 'mention', read: true, time: 'yesterday', actorId: 'u4', title: '@you in audit checklist', body: 'Priya Nair tagged you on clause 9.1.3 evidence request.', target: { kind: 'audit', id: 'AUD-2026-0021' }, icon: 'audit', color: '#2563eb' },
  { id: 'n11', type: 'approval', read: true, time: 'yesterday', actorId: 'u6', title: 'Supplier audit report approved', body: 'Lena Weber approved your AUD-2026-0020 closing report.', target: { kind: 'audit', id: 'AUD-2026-0020' }, icon: 'check', color: '#16a34a' },
  { id: 'n12', type: 'training', read: true, time: '2d ago', actorId: null, title: 'Training due — IATF 16949 refresher', body: 'Annual refresher due by April 30.', target: { kind: 'training', id: 't1' }, icon: 'award', color: '#9333ea' },
];

// ─────────────────────────────────────────────────────────────
// COMMAND PALETTE
// ─────────────────────────────────────────────────────────────
const QUICK_ACTIONS = [
  { id: 'create-inspection', label: 'New inspection', kind: 'action', icon: 'clipboard', shortcut: 'I', action: 'create:inspection' },
  { id: 'create-ncr', label: 'New NCR', kind: 'action', icon: 'alert', shortcut: 'N', action: 'create:ncr' },
  { id: 'create-8d', label: 'Start 8D investigation', kind: 'action', icon: 'brain', shortcut: '8', action: 'create:8d' },
  { id: 'create-capa', label: 'New CAPA', kind: 'action', icon: 'capa', shortcut: 'C', action: 'create:capa' },
  { id: 'create-audit', label: 'Schedule audit', kind: 'action', icon: 'audit', shortcut: 'A', action: 'create:audit' },
  { id: 'create-doc', label: 'Upload document', kind: 'action', icon: 'doc', shortcut: 'D', action: 'create:document' },
  { id: 'goto-dashboard', label: 'Go to Dashboard', kind: 'nav', icon: 'dashboard', route: 'dashboard' },
  { id: 'goto-inspections', label: 'Go to Inspections', kind: 'nav', icon: 'clipboard', route: 'inspections' },
  { id: 'goto-ncr', label: 'Go to NCRs', kind: 'nav', icon: 'alert', route: 'ncr' },
  { id: 'goto-8d', label: 'Go to 8Ds', kind: 'nav', icon: 'brain', route: '8d' },
  { id: 'goto-capa', label: 'Go to CAPA', kind: 'nav', icon: 'capa', route: 'capa' },
  { id: 'goto-audits', label: 'Go to Audits', kind: 'nav', icon: 'audit', route: 'audits' },
  { id: 'goto-documents', label: 'Go to Documents', kind: 'nav', icon: 'doc', route: 'documents' },
  { id: 'goto-reports', label: 'Go to Reports', kind: 'nav', icon: 'reports', route: 'reports' },
  { id: 'goto-mobile', label: 'Go to Mobile App', kind: 'nav', icon: 'phone', route: 'mobile' },
  { id: 'goto-supplier', label: 'Go to Supplier Portal', kind: 'nav', icon: 'truck', route: 'supplier' },
  { id: 'goto-settings', label: 'Open Settings', kind: 'nav', icon: 'settings', route: 'settings' },
  { id: 'toggle-theme', label: 'Toggle dark mode', kind: 'action', icon: 'moon', action: 'toggle:theme' },
  { id: 'open-ai', label: 'Open AI Assistant', kind: 'action', icon: 'sparkles', shortcut: '/', action: 'open:ai' },
  { id: 'sign-out', label: 'Sign out', kind: 'action', icon: 'logout', action: 'auth:signout' },
];

Object.assign(window, {
  AUDITS, AUDIT_CHECKLIST, AUDIT_FINDINGS, AUDIT_FREQUENCY,
  CAPAS, CAPA_TREND,
  NOTIFICATIONS, QUICK_ACTIONS,
});
