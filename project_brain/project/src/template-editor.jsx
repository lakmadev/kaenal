// Kaenal — Inspection Template Editor
// Drag-drop section/item builder with field type config

const FIELD_TYPES = [
  { id: 'pass_fail', label: 'Pass / Fail / N/A', icon: 'check', desc: 'Three-state binary check' },
  { id: 'yes_no', label: 'Yes / No', icon: 'check', desc: 'Boolean answer' },
  { id: 'score', label: 'Score (1–5 or 1–10)', icon: 'star', desc: 'Numeric rating' },
  { id: 'number', label: 'Number with unit', icon: 'hash', desc: 'Measurement with units' },
  { id: 'text', label: 'Short text', icon: 'edit', desc: 'Single-line text' },
  { id: 'textarea', label: 'Long text', icon: 'fileText', desc: 'Multi-line observation' },
  { id: 'select', label: 'Dropdown', icon: 'list', desc: 'Single choice from list' },
  { id: 'multi_select', label: 'Multi-select', icon: 'list', desc: 'Multiple choices' },
  { id: 'date', label: 'Date', icon: 'calendar', desc: 'Date picker' },
  { id: 'datetime', label: 'Date + time', icon: 'clock', desc: 'Date and time picker' },
  { id: 'photo', label: 'Photo capture', icon: 'camera', desc: 'Camera or gallery photo' },
  { id: 'signature', label: 'Signature', icon: 'pen', desc: 'Draw or type signature' },
  { id: 'section_header', label: 'Section header', icon: 'type', desc: 'Visual separator' },
  { id: 'info_text', label: 'Info block', icon: 'info', desc: 'Read-only guidance text' },
];

// Master data sources a dropdown can be LINKED to. In a real QMS these are
// governed reference lists / connected tables that stay in sync centrally,
// so an inspector always sees the current, approved set of values.
const MASTER_DATA_SOURCES = [
  { id: 'suppliers',    label: 'Suppliers',            icon: 'truck',    count: 142,  managedIn: 'Suppliers module',     sample: ['Bosch India Ltd', 'Sundram Fasteners', 'Endurance Technologies', 'Varroc Engineering'] },
  { id: 'parts',        label: 'Part numbers',         icon: 'package',  count: 1284, managedIn: 'Product / BOM master',  sample: ['A-7742 — Driveshaft Yoke', 'A-3310 — Mounting Bracket', 'B-1190 — Pinion Gear'] },
  { id: 'defect_codes', label: 'Defect codes',         icon: 'alert',    count: 64,   managedIn: 'Quality catalog',      sample: ['POR — Porosity', 'CRK — Crack', 'DIM — Dimensional', 'SUR — Surface finish'] },
  { id: 'equipment',    label: 'Equipment / Machines', icon: 'settings', count: 38,   managedIn: 'Asset register',       sample: ['Weld Cell 3 — Station 3B', 'CNC Lathe L-12', 'CMM Zeiss-02'] },
  { id: 'operators',    label: 'Operators',            icon: 'users',    count: 96,   managedIn: 'HR / Personnel',       sample: ['Liu Wei (E-4471)', 'Rafael Costa (E-2210)', 'Sarah Ahmed (E-3380)'] },
  { id: 'locations',    label: 'Plants / Locations',   icon: 'pin',      count: 7,    managedIn: 'Org settings',         sample: ['Pune-1', 'Pune-2', 'Detroit', 'Bratislava'] },
  { id: 'customers',    label: 'Customers',            icon: 'award',    count: 53,   managedIn: 'CRM connector',        sample: ['Volvo Group', 'Daimler Truck', 'Tata Motors', 'Ashok Leyland'] },
  { id: 'process_steps',label: 'Process steps',        icon: 'layers',   count: 120,  managedIn: 'Process library',      sample: ['OP-10 Cut', 'OP-20 Weld', 'OP-30 Machine', 'OP-40 Inspect'] },
];

// Text format presets → validation rule applied to short-text fields.
const TEXT_FORMATS = [
  { id: 'any',     label: 'Any text',        hint: 'No format restriction' },
  { id: 'serial',  label: 'Serial / Part #', hint: 'Letters, numbers, dashes (e.g. A-7742)' },
  { id: 'numeric', label: 'Numeric only',    hint: 'Digits only' },
  { id: 'email',   label: 'Email',           hint: 'name@company.com' },
  { id: 'url',     label: 'URL',             hint: 'https://…' },
];

// ─────────────────────────────────────────────────────────────
// CONDITIONAL LOGIC — plain-language When → Then rules
// A rule is authored ON its trigger field and points at one or more
// target fields. Actions: show / hide / require / disable.
//   rule = { id, field: triggerId, op, value, value2?, action, targets:[ids] }
// Rules live at template.rules[] so they can target fields in any section.
// ─────────────────────────────────────────────────────────────
const LOGIC_OPERATORS = {
  is:        { label: 'is',                 needsValue: true  },
  is_not:    { label: 'is not',             needsValue: true  },
  failed:    { label: 'fails (Fail / No)',  needsValue: false },
  gt:        { label: 'is greater than',    needsValue: true  },
  lt:        { label: 'is less than',       needsValue: true  },
  between:   { label: 'is between',         needsValue: true, needsValue2: true },
  answered:  { label: 'is answered',        needsValue: false },
  empty:     { label: 'is blank',           needsValue: false },
};

const LOGIC_ACTIONS = {
  show:    { label: 'Show',          icon: 'eye',    color: '#16a34a', verb: 'shown by' },
  hide:    { label: 'Hide',          icon: 'eyeOff', color: '#64748b', verb: 'hidden by' },
  require: { label: 'Make required', icon: 'alert',  color: '#d97706', verb: 'required by' },
  disable: { label: 'Lock (disable)',icon: 'lock',   color: '#b91c1c', verb: 'locked by' },
};

// Which operators make sense for a given trigger field type
function opsForType(type) {
  switch (type) {
    case 'pass_fail':    return ['is', 'is_not', 'failed', 'answered'];
    case 'yes_no':       return ['is', 'is_not', 'failed', 'answered'];
    case 'score':        return ['is', 'gt', 'lt', 'between', 'answered'];
    case 'number':       return ['gt', 'lt', 'between', 'is', 'answered'];
    case 'select':       return ['is', 'is_not', 'answered'];
    case 'multi_select': return ['is', 'answered'];
    case 'text':
    case 'textarea':     return ['answered', 'empty', 'is'];
    case 'date':
    case 'datetime':     return ['answered', 'empty'];
    case 'photo':
    case 'signature':    return ['answered', 'empty'];
    default:             return ['answered', 'empty'];
  }
}

// Discrete value choices for a trigger field, or null for free text/number input
function valueChoicesFor(item) {
  if (!item) return null;
  if (item.type === 'pass_fail') return ['Pass', 'Fail', 'N/A'];
  if (item.type === 'yes_no')    return ['Yes', 'No'];
  if (item.type === 'select' || item.type === 'multi_select') {
    if (item.optionsMode === 'linked') {
      const s = MASTER_DATA_SOURCES.find(x => x.id === item.optionsSource);
      return s ? s.sample : [];
    }
    return item.options && item.options.length ? item.options : [];
  }
  return null;
}

// Does one rule's condition currently hold, given the answer map?
// hiddenSet gates triggers: a rule whose own trigger is hidden never fires.
function ruleActive(rule, answers, hiddenSet) {
  if (hiddenSet && hiddenSet.has(rule.field)) return false;
  const v = answers[rule.field];
  const has = v != null && v !== '';
  const n = parseFloat(v);
  switch (rule.op) {
    case 'answered': return has;
    case 'empty':    return !has;
    case 'is':       return has && String(v) === String(rule.value);
    case 'is_not':   return has && String(v) !== String(rule.value);
    case 'failed':   return v === 'Fail' || v === 'No';
    case 'gt':       return has && !isNaN(n) && n > parseFloat(rule.value);
    case 'lt':       return has && !isNaN(n) && n < parseFloat(rule.value);
    case 'between':  return has && !isNaN(n) && n >= parseFloat(rule.value) && n <= parseFloat(rule.value2);
    default:         return false;
  }
}

// Resolve all rules against the current answers → which fields/sections are
// hidden / dynamically-required / disabled. Iterates to a fixpoint so
// chained reveals (A reveals B, B reveals C) settle correctly.
//
// Two rule scopes share the same trigger/condition shape:
//   • field rules  → targets are item ids       (show / hide / require / lock)
//   • section rules→ targets are section ids     (show / hide only)
// A hidden section folds ALL of its item ids into the hidden set, so progress,
// required-counting and trigger-gating all treat a skipped section as gone.
function evaluateLogic(template, answers) {
  const all = (template.rules || []).filter(r => r.field && r.targets && r.targets.length);
  const fieldRules   = all.filter(r => r.targetType !== 'section');
  const sectionRules = all.filter(r => r.targetType === 'section');

  // sectionId → [item ids]
  const sectionItems = {};
  template.sections.forEach(s => { sectionItems[s.id] = s.items.map(it => it.id); });

  // show-targets start hidden until their rule fires (fields and sections alike)
  const showFields = new Set();
  fieldRules.forEach(r => { if (r.action === 'show') r.targets.forEach(t => showFields.add(t)); });
  const showSections = new Set();
  sectionRules.forEach(r => { if (r.action === 'show') r.targets.forEach(t => showSections.add(t)); });

  let hidden = new Set(showFields);
  let hiddenSections = new Set(showSections);
  for (let pass = 0; pass < 8; pass++) {
    // Section visibility first (trigger-gated by the current hidden set)
    const nextSections = new Set(showSections);
    sectionRules.forEach(r => {
      if (!ruleActive(r, answers, hidden)) return;
      if (r.action === 'show') r.targets.forEach(t => nextSections.delete(t));
      if (r.action === 'hide') r.targets.forEach(t => nextSections.add(t));
    });
    // Field visibility
    const next = new Set(showFields);
    fieldRules.forEach(r => {
      if (!ruleActive(r, answers, hidden)) return;
      if (r.action === 'show') r.targets.forEach(t => next.delete(t));
      if (r.action === 'hide') r.targets.forEach(t => next.add(t));
    });
    // Fold every hidden section's items into the hidden set
    nextSections.forEach(sid => (sectionItems[sid] || []).forEach(id => next.add(id)));

    const sameF = next.size === hidden.size && [...next].every(x => hidden.has(x));
    const sameS = nextSections.size === hiddenSections.size && [...nextSections].every(x => hiddenSections.has(x));
    hidden = next; hiddenSections = nextSections;
    if (sameF && sameS) break;
  }

  const required = new Set(), disabled = new Set();
  fieldRules.forEach(r => {
    if (!ruleActive(r, answers, hidden)) return;
    if (r.action === 'require') r.targets.forEach(t => required.add(t));
    if (r.action === 'disable') r.targets.forEach(t => disabled.add(t));
  });
  return { hidden, hiddenSections, required, disabled };
}

const SAMPLE_TEMPLATES = [
  { id: 'iatf-process-audit-v2', name: 'IATF Process Audit', version: '2.1', industry: 'Automotive', items: 35, sections: 5, lastModified: '2026-04-12', uses: 142 },
  { id: 'iso-9001-mgmt-review', name: 'ISO 9001 Management Review', version: '1.0', industry: 'General', items: 22, sections: 4, lastModified: '2026-03-28', uses: 56 },
  { id: 'safety-walk-daily', name: 'Daily Safety Walk-Through', version: '3.4', industry: 'Manufacturing', items: 18, sections: 3, lastModified: '2026-04-08', uses: 312 },
  { id: 'fda-cleanroom', name: 'FDA Cleanroom Verification', version: '1.2', industry: 'Pharma', items: 64, sections: 8, lastModified: '2026-02-14', uses: 24 },
  { id: 'as9100-cm', name: 'AS9100D Configuration Mgmt', version: '2.0', industry: 'Aerospace', items: 41, sections: 6, lastModified: '2026-01-20', uses: 18 },
  { id: 'lpa-supervisor', name: 'Layered Process Audit — Supervisor', version: '4.1', industry: 'Automotive', items: 28, sections: 4, lastModified: '2026-04-02', uses: 89 },
];

// Default template structure for editor demo
const TEMPLATE_DRAFT_DEFAULT = {
  id: 'new-template',
  name: 'IATF Process Audit v2.1',
  description: 'Quarterly process audit for IATF 16949 compliance on weld and assembly cells',
  version: '2.1',
  industry: 'Automotive',
  scoring: { enabled: true, maxScore: 100, passingScore: 80, method: 'weighted_average' },
  sections: [
    {
      id: 's1', title: 'Process Control & Standards', weight: 25,
      items: [
        { id: 'i1', type: 'pass_fail', label: 'Current work instruction visible at station', required: true, triggerFinding: true },
        { id: 'i2', type: 'pass_fail', label: 'Process parameters match control plan', required: true, triggerFinding: true, findingSeverity: 'critical' },
        { id: 'i3', type: 'score', label: 'Operator training records current (rate 1–5)', required: true },
        { id: 'i4', type: 'pass_fail', label: 'PFMEA reviewed within last 12 months', required: true },
      ],
    },
    {
      id: 's2', title: 'Equipment & Tooling', weight: 25,
      items: [
        { id: 'i5', type: 'pass_fail', label: 'Torque tools within calibration date', required: true, triggerFinding: true, findingSeverity: 'major' },
        { id: 'i6', type: 'pass_fail', label: 'Weld parameters displayed & within spec', required: true, triggerFinding: true, findingSeverity: 'critical' },
        { id: 'i7', type: 'photo', label: 'Photo of fixture condition', required: false, mediaRequired: false },
        { id: 'i8', type: 'pass_fail', label: 'Preventive maintenance current', required: true },
      ],
    },
    {
      id: 's3', title: 'Product Quality', weight: 30,
      items: [
        { id: 'i9', type: 'pass_fail', label: 'First piece inspection completed & documented', required: true },
        { id: 'i10', type: 'pass_fail', label: 'SPC charts current & in control', required: true, triggerFinding: true },
        { id: 'i11', type: 'pass_fail', label: 'Non-conforming material properly identified', required: true, triggerFinding: true, findingSeverity: 'major' },
        { id: 'i12', type: 'number', label: 'Defect rate last shift (%)', required: true, unit: '%' },
        { id: 'i17', type: 'yes_no', label: 'Visual defect observed on part?', required: true },
        { id: 'i18', type: 'select', label: 'Defect code', optionsMode: 'linked', optionsSource: 'defect_codes' },
        { id: 'i19', type: 'photo', label: 'Photo of the defect', required: false },
        { id: 'i20', type: 'textarea', label: 'Containment action taken' },
      ],
    },
    {
      id: 's4', title: '5S & Safety', weight: 20,
      items: [
        { id: 'i13', type: 'pass_fail', label: 'Workplace clean & organized (5S)' },
        { id: 'i14', type: 'pass_fail', label: 'PPE worn correctly by all operators', triggerFinding: true },
        { id: 'i15', type: 'pass_fail', label: 'Emergency stops accessible & tested' },
        { id: 'i16', type: 'textarea', label: 'Observations & improvement opportunities' },
      ],
    },
    {
      // This whole section only applies when a defect was observed (see rule r4).
      id: 's5', title: 'Rework & Containment', weight: 0,
      items: [
        { id: 'i21', type: 'select', label: 'Disposition', optionsMode: 'manual', options: ['Rework', 'Scrap', 'Use-as-is', 'Return to supplier'], required: true },
        { id: 'i22', type: 'number', label: 'Quantity contained', unit: 'pcs' },
        { id: 'i23', type: 'pass_fail', label: 'Containment verified by supervisor', required: true, triggerFinding: true, findingSeverity: 'major' },
      ],
    },
  ],
  // Conditional logic rules (authored on the trigger field, point at targets)
  rules: [
    { id: 'r1', field: 'i17', op: 'is', value: 'Yes', action: 'show',    targets: ['i18', 'i19', 'i20'] },
    { id: 'r2', field: 'i17', op: 'is', value: 'Yes', action: 'require', targets: ['i18', 'i19'] },
    { id: 'r3', field: 'i6',  op: 'is', value: 'Fail', action: 'require', targets: ['i7'] },
    // Section-level skip logic: show the whole Rework & Containment section
    // only when the inspector reports a visual defect.
    { id: 'r4', field: 'i17', op: 'is', value: 'Yes', action: 'show', targetType: 'section', targets: ['s5'] },
  ],
};

function InspectionTemplatesList({ setRoute, setTemplate }) {
  return (
    <div>
      <PageHeader
        title="Inspection Templates"
        description="Reusable checklists, scoring rules, and field configurations"
        actions={
          <>
            <button className="k-btn k-btn-secondary" onClick={() => kToast('Choose a .json template file to import')}><Icon name="upload" size={14}/> Import JSON</button>
            <button className="k-btn k-btn-primary" onClick={() => { setTemplate('new'); setRoute('inspection-template-editor'); }}>
              <Icon name="plus" size={14}/> New template
            </button>
          </>
        }
      />

      <div style={{ padding: '20px 28px 0', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
        {[
          { label: 'Active templates', value: SAMPLE_TEMPLATES.length, color: '#2563eb', icon: 'clipboard' },
          { label: 'Total uses (YTD)', value: '641', color: '#16a34a', icon: 'check' },
          { label: 'Avg completion rate', value: '94%', color: '#9333ea', icon: 'reports' },
        ].map(k => (
          <div key={k.label} className="k-surface" style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: k.color + '18', color: k.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name={k.icon} size={20}/>
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>{k.label}</div>
              <div style={{ fontSize: 24, fontWeight: 700, lineHeight: 1.1 }}>{k.value}</div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ padding: '20px 28px 28px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 14 }}>
        {SAMPLE_TEMPLATES.map(t => (
          <div key={t.id} onClick={() => { setTemplate(t.id); setRoute('inspection-template-editor'); }}
            className="k-surface k-hoverable" style={{ padding: 18, cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--accent-soft)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="clipboard" size={20}/>
              </div>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)' }}>v{t.version}</span>
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>{t.name}</div>
              <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{t.industry} · {t.sections} sections · {t.items} items</div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8, borderTop: '1px solid var(--border)', fontSize: 11, color: 'var(--text-muted)' }}>
              <span><Icon name="history" size={11}/> {t.lastModified}</span>
              <span><Icon name="check" size={11}/> {t.uses} uses</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// TEMPLATE EDITOR — drag-drop builder
// ─────────────────────────────────────────────────────────────

// Demonstrates how the chosen scoring method turns per-section raw
// results into a single inspection score. Uses a deterministic sample
// result per section so the three methods produce visibly different
// numbers as the user switches the dropdown.
const SCORING_INFO = {
  sum: {
    label: 'Sum',
    blurb: 'Adds up raw points earned across every scored item. Section weights are ignored — every item counts equally.',
  },
  weighted_average: {
    label: 'Weighted average',
    blurb: 'Each section is scored as a %, then blended by its weight (% wt). Critical sections move the final score more.',
  },
  percentage: {
    label: 'Percentage',
    blurb: 'Total points earned ÷ total points possible, as a flat %. Section weights are ignored.',
  },
};

function computeExampleScore(template) {
  const sections = template.sections || [];
  // Deterministic sample: section i earns this fraction of its items' points.
  const sampleFrac = [0.92, 0.78, 1.0, 0.85, 0.7, 0.95];
  let earned = 0, possible = 0, weightedSum = 0, weightTotal = 0;
  sections.forEach((s, i) => {
    const pts = Math.max(s.items.length, 1) * 5; // 5 pts per item
    const frac = sampleFrac[i % sampleFrac.length];
    const secEarned = Math.round(pts * frac);
    earned += secEarned;
    possible += pts;
    const w = +s.weight || 0;
    weightedSum += (secEarned / pts) * 100 * w;
    weightTotal += w;
  });
  const method = template.scoring?.method || 'weighted_average';
  if (method === 'sum') return { value: `${earned} pts`, detail: `of ${possible} possible across all items` };
  if (method === 'percentage') return { value: `${Math.round((earned / (possible || 1)) * 100)}%`, detail: `${earned} ÷ ${possible} points` };
  const wa = weightTotal ? weightedSum / weightTotal : 0;
  return { value: `${Math.round(wa)}%`, detail: `weighted by section % wt (Σ ${weightTotal}%)` };
}

function InspectionTemplateEditor({ id, setRoute }) {
  const [template, setTemplate] = React.useState(TEMPLATE_DRAFT_DEFAULT);
  const [selectedItem, setSelectedItem] = React.useState({ sectionIdx: 0, itemIdx: 0 });
  const [mode, setMode] = React.useState('edit'); // edit | preview
  const [panelTab, setPanelTab] = React.useState('props'); // props | logic
  const [dragOver, setDragOver] = React.useState(null);
  const [toast, setToast] = React.useState(null);
  // Drag state for reordering: dragItem = {si, ii} | {section:true, si}
  const [dragItem, setDragItem] = React.useState(null);
  const [dropHint, setDropHint] = React.useState(null); // {si, ii} insert-before, or {si, end:true}, or {sectionAt}
  const [addMenu, setAddMenu] = React.useState(null); // sectionIdx with open quick-add menu
  const [sectionLogic, setSectionLogic] = React.useState(null); // section id with open skip-logic editor

  const showToast = (msg) => {
    setToast(msg);
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => setToast(null), 2600);
  };

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(template, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = (template.name || 'inspection-template').replace(/[^a-z0-9]+/gi, '-').toLowerCase() + '.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const publish = () => {
    showToast(`"${template.name}" published — v${(template.version || 1)} live`);
    setTimeout(() => setRoute('inspections-templates'), 1100);
  };

  const item = template.sections[selectedItem.sectionIdx]?.items[selectedItem.itemIdx];

  const updateItem = (patch) => {
    setTemplate(t => ({
      ...t,
      sections: t.sections.map((s, si) => si === selectedItem.sectionIdx ? {
        ...s,
        items: s.items.map((it, ii) => ii === selectedItem.itemIdx ? { ...it, ...patch } : it),
      } : s),
    }));
  };

  // ── Conditional-logic rule CRUD (rules authored on the selected field) ──
  const addRule = () => {
    if (!item) return;
    const ops = opsForType(item.type);
    const choices = valueChoicesFor(item);
    setTemplate(t => ({
      ...t,
      rules: [...(t.rules || []), {
        id: 'r' + Date.now(),
        field: item.id,
        op: ops[0],
        value: choices && choices.length ? choices[0] : '',
        value2: '',
        action: 'show',
        targets: [],
      }],
    }));
  };
  const updateRule = (rid, patch) => setTemplate(t => ({ ...t, rules: (t.rules || []).map(r => r.id === rid ? { ...r, ...patch } : r) }));
  const deleteRule = (rid) => setTemplate(t => ({ ...t, rules: (t.rules || []).filter(r => r.id !== rid) }));

  // ── Section-level skip logic (a rule whose target is a whole section) ──
  // Authored from the section header. Trigger is any field in the template;
  // default to the first eligible field so the row is immediately editable.
  const addSectionRule = (sectionId) => {
    setTemplate(t => {
      const triggers = [];
      t.sections.forEach(s => s.items.forEach(it => {
        if (it.type !== 'section_header' && it.type !== 'info_text') triggers.push(it);
      }));
      const trig = triggers[0];
      if (!trig) return t; // nothing to trigger on yet
      const ops = opsForType(trig.type);
      const choices = valueChoicesFor(trig);
      return {
        ...t,
        rules: [...(t.rules || []), {
          id: 'r' + Date.now(),
          field: trig.id,
          op: ops[0],
          value: choices && choices.length ? choices[0] : '',
          value2: '',
          action: 'hide',
          targetType: 'section',
          targets: [sectionId],
        }],
      };
    });
    setSectionLogic(sectionId);
  };

  const addItem = (sectionIdx, type, atIdx = null) => {
    const newItem = { id: 'i' + Date.now(), type, label: 'New ' + (FIELD_TYPES.find(f => f.id === type)?.label || 'item'), required: false };
    let landedIdx = 0;
    setTemplate(t => ({
      ...t,
      sections: t.sections.map((s, si) => {
        if (si !== sectionIdx) return s;
        const items = [...s.items];
        const idx = atIdx == null ? items.length : atIdx;
        landedIdx = idx;
        items.splice(idx, 0, newItem);
        return { ...s, items };
      }),
    }));
    setSelectedItem({ sectionIdx, itemIdx: landedIdx });
    setAddMenu(null);
  };

  const deleteItemAt = (si, ii) => {
    setTemplate(t => ({
      ...t,
      sections: t.sections.map((s, idx) => idx === si ? { ...s, items: s.items.filter((_, i) => i !== ii) } : s),
    }));
    setSelectedItem(sel => ({ sectionIdx: si, itemIdx: Math.max(0, (sel.sectionIdx === si && sel.itemIdx >= ii ? sel.itemIdx - 1 : sel.itemIdx)) }));
  };

  const deleteItem = () => deleteItemAt(selectedItem.sectionIdx, selectedItem.itemIdx);

  const duplicateItem = (si, ii) => {
    setTemplate(t => ({
      ...t,
      sections: t.sections.map((s, idx) => {
        if (idx !== si) return s;
        const items = [...s.items];
        const copy = { ...items[ii], id: 'i' + Date.now() };
        items.splice(ii + 1, 0, copy);
        return { ...s, items };
      }),
    }));
    setSelectedItem({ sectionIdx: si, itemIdx: ii + 1 });
  };

  // Reorder/move an item from one (si,ii) to an insertion point in target section
  const moveItem = (from, toSi, toIi) => {
    setTemplate(t => {
      const sections = t.sections.map(s => ({ ...s, items: [...s.items] }));
      const [moved] = sections[from.si].items.splice(from.ii, 1);
      let target = toIi == null ? sections[toSi].items.length : toIi;
      if (from.si === toSi && from.ii < target) target -= 1;
      target = Math.max(0, Math.min(target, sections[toSi].items.length));
      sections[toSi].items.splice(target, 0, moved);
      return { ...t, sections };
    });
    setSelectedItem({ sectionIdx: toSi, itemIdx: 0 });
  };

  const moveSection = (fromSi, toSi) => {
    if (fromSi === toSi) return;
    setTemplate(t => {
      const sections = [...t.sections];
      const [moved] = sections.splice(fromSi, 1);
      let target = toSi;
      if (fromSi < toSi) target -= 1;
      sections.splice(target, 0, moved);
      return { ...t, sections };
    });
  };

  const addSection = () => {
    const newSection = { id: 's' + Date.now(), title: 'New Section', weight: 0, items: [] };
    setTemplate(t => ({ ...t, sections: [...t.sections, newSection] }));
  };

  const totalItems = template.sections.reduce((acc, s) => acc + s.items.length, 0);

  // Map itemId -> { trigger, target } for inline logic badges on the canvas
  const ruleMeta = {};
  (template.rules || []).forEach(r => {
    if (r.field) (ruleMeta[r.field] = ruleMeta[r.field] || {}).trigger = true;
    (r.targets || []).forEach(t => { (ruleMeta[t] = ruleMeta[t] || {}).target = true; });
  });

  React.useEffect(() => {
    if (addMenu == null) return;
    const onDoc = () => setAddMenu(null);
    // defer so the opening click doesn't immediately close it
    const id = setTimeout(() => document.addEventListener('click', onDoc), 0);
    return () => { clearTimeout(id); document.removeEventListener('click', onDoc); };
  }, [addMenu]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 56px)' }}>
      {/* Header strip */}
      <div style={{ padding: '14px 28px', borderBottom: '1px solid var(--border)', background: 'var(--surface)', display: 'flex', alignItems: 'center', gap: 14 }}>
        <button onClick={() => setRoute('inspections-templates')} className="k-btn-plain" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-muted)' }}>
          <Icon name="arrowLeft" size={14}/> Templates
        </button>
        <div style={{ width: 1, height: 22, background: 'var(--border)' }}/>
        <input value={template.name} onChange={e => setTemplate(t => ({ ...t, name: e.target.value }))}
          style={{ fontSize: 16, fontWeight: 700, border: 'none', outline: 'none', background: 'transparent', flex: 1, color: 'var(--text)' }}/>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11.5, color: 'var(--text-muted)' }}>
          <span><Icon name="clipboard" size={11}/> {template.sections.length} sections · {totalItems} items</span>
        </div>
        <Segmented
          options={[
            { value: 'edit', label: 'Edit', icon: 'edit' },
            { value: 'preview', label: 'Preview', icon: 'eye' },
          ]}
          value={mode} onChange={setMode}
        />
        <button onClick={exportJson} className="k-btn k-btn-secondary"><Icon name="download" size={13}/> Export JSON</button>
        <button onClick={publish} className="k-btn k-btn-primary"><Icon name="check" size={13}/> Save & Publish</button>
      </div>

      {/* Body */}
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        {/* Left: field type palette */}
        {mode === 'edit' && (
          <div style={{ width: 220, borderRight: '1px solid var(--border)', background: 'var(--bg-subtle)', overflowY: 'auto', padding: 14 }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.06em', marginBottom: 10 }}>Field types</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {FIELD_TYPES.map(f => (
                <div key={f.id} draggable
                  onDragStart={(e) => e.dataTransfer.setData('field-type', f.id)}
                  style={{
                    padding: '8px 10px', background: 'var(--surface)',
                    border: '1px solid var(--border)', borderRadius: 'var(--r-sm)',
                    cursor: 'grab', display: 'flex', alignItems: 'center', gap: 8,
                    fontSize: 12, fontWeight: 500,
                  }}>
                  <Icon name={f.icon} size={13} className=""/>
                  <span style={{ flex: 1 }}>{f.label}</span>
                  <Icon name="grip" size={11} className=""/>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Middle: canvas */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 24, background: mode === 'preview' ? 'var(--bg)' : 'var(--bg-subtle)' }}>
          <div style={{ maxWidth: 720, margin: '0 auto' }}>
            {mode === 'preview' && <PreviewRunner template={template}/>}
            {mode === 'edit' && (
              <>
                {/* Template meta */}
                <div className="k-surface" style={{ padding: 16, marginBottom: 16 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                    <div>
                      <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>Version</label>
                      <input value={template.version} onChange={e => setTemplate(t => ({ ...t, version: e.target.value }))} className="k-input" style={{ height: 30, fontSize: 12.5 }}/>
                    </div>
                    <div>
                      <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>Industry</label>
                      <select value={template.industry} onChange={e => setTemplate(t => ({ ...t, industry: e.target.value }))} className="k-input" style={{ height: 30, fontSize: 12.5 }}>
                        <option>Automotive</option><option>Pharma</option><option>Aerospace</option><option>Food</option><option>General</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>Scoring</label>
                      <select value={template.scoring.method} onChange={e => setTemplate(t => ({ ...t, scoring: { ...t.scoring, method: e.target.value } }))} className="k-input" style={{ height: 30, fontSize: 12.5 }}>
                        <option value="sum">Sum</option><option value="weighted_average">Weighted average</option><option value="percentage">Percentage</option>
                      </select>
                    </div>
                  </div>
                  {/* Live explanation of what the chosen scoring method does */}
                  {(() => {
                    const info = SCORING_INFO[template.scoring.method] || SCORING_INFO.weighted_average;
                    const ex = computeExampleScore(template);
                    return (
                      <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 14 }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text)', marginBottom: 2 }}>How <span style={{ color: 'var(--accent)' }}>{info.label}</span> scores this inspection</div>
                          <div style={{ fontSize: 11.5, color: 'var(--text-muted)', lineHeight: 1.5 }}>{info.blurb}</div>
                        </div>
                        <div style={{ textAlign: 'right', flexShrink: 0, minWidth: 120 }}>
                          <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>Example result</div>
                          <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--accent)', lineHeight: 1.1 }}>{ex.value}</div>
                          <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{ex.detail}</div>
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* Sections */}
                {template.sections.map((section, si) => {
                  const isSecDragTarget = dropHint?.sectionAt === si;
                  const secRules = (template.rules || []).filter(r => r.targetType === 'section' && (r.targets || []).includes(section.id));
                  const logicOpen = sectionLogic === section.id;
                  return (
                  <div key={section.id}
                    onDragOver={(e) => {
                      if (dragItem?.section) { e.preventDefault(); setDropHint({ sectionAt: si }); }
                    }}
                    onDrop={(e) => {
                      if (dragItem?.section) { e.preventDefault(); moveSection(dragItem.si, si); setDragItem(null); setDropHint(null); }
                    }}
                    className="k-surface"
                    style={{
                      padding: 0, marginBottom: 14, overflow: 'visible',
                      boxShadow: isSecDragTarget ? '0 0 0 2px var(--accent)' : undefined,
                      opacity: dragItem?.section && dragItem.si === si ? 0.5 : 1,
                    }}>
                    {/* Section header */}
                    <div style={{ padding: '12px 14px', borderBottom: section.items.length ? '1px solid var(--border)' : 'none', display: 'flex', alignItems: 'center', gap: 10, background: 'var(--bg-subtle)', borderTopLeftRadius: 'var(--r-md)', borderTopRightRadius: 'var(--r-md)' }}>
                      <div
                        draggable
                        onDragStart={(e) => { setDragItem({ section: true, si }); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('section-move', String(si)); }}
                        onDragEnd={() => { setDragItem(null); setDropHint(null); }}
                        title="Drag to reorder section"
                        style={{ cursor: 'grab', display: 'flex', color: 'var(--text-muted)', padding: 2 }}>
                        <Icon name="grip" size={15}/>
                      </div>
                      <div style={{ width: 26, height: 26, borderRadius: 7, background: 'var(--accent)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800 }}>{si + 1}</div>
                      <input value={section.title}
                        onChange={e => setTemplate(t => ({ ...t, sections: t.sections.map((s, i) => i === si ? { ...s, title: e.target.value } : s) }))}
                        placeholder="Section title"
                        style={{ flex: 1, fontSize: 14.5, fontWeight: 700, border: 'none', outline: 'none', background: 'transparent', color: 'var(--text)' }}/>
                      <span style={{ fontSize: 10.5, color: 'var(--text-muted)', fontWeight: 600 }}>{section.items.length} {section.items.length === 1 ? 'field' : 'fields'}</span>
                      {secRules.length > 0 && (() => {
                        const onlyHide = secRules.every(r => r.action === 'hide');
                        const onlyShow = secRules.every(r => r.action === 'show');
                        const verb = onlyShow ? 'Shown when' : onlyHide ? 'Skipped when' : 'Conditional';
                        return (
                          <button onClick={() => setSectionLogic(logicOpen ? null : section.id)}
                            title="Edit section visibility" className="k-btn-plain"
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 9.5, fontWeight: 700, color: 'var(--accent)', background: 'var(--accent-soft)', padding: '3px 8px', borderRadius: 'var(--r-full)', whiteSpace: 'nowrap', border: 'none', cursor: 'pointer' }}>
                            <Icon name="gitBranch" size={10}/> {verb}
                          </button>
                        );
                      })()}
                      <div style={{ width: 1, height: 18, background: 'var(--border)' }}/>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <input type="number" value={section.weight} onChange={e => setTemplate(t => ({ ...t, sections: t.sections.map((s, i) => i === si ? { ...s, weight: +e.target.value } : s) }))}
                          style={{ width: 46, height: 26, padding: '0 6px', fontSize: 11, border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', textAlign: 'right', background: 'var(--surface)' }}/>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>% wt</span>
                      </div>
                      <button onClick={() => setSectionLogic(logicOpen ? null : section.id)} className="k-btn-plain"
                        style={{ padding: 5, color: logicOpen || secRules.length ? 'var(--accent)' : 'var(--text-muted)', background: logicOpen ? 'var(--accent-soft)' : 'transparent', borderRadius: 'var(--r-sm)' }}
                        title="Section visibility logic">
                        <Icon name="gitBranch" size={14}/>
                      </button>
                      <button onClick={() => setTemplate(t => ({ ...t, sections: t.sections.filter((_, i) => i !== si) }))} className="k-btn-plain" style={{ padding: 5, color: 'var(--text-muted)' }} title="Delete section">
                        <Icon name="trash" size={14}/>
                      </button>
                    </div>

                    {/* Section visibility / skip-logic editor */}
                    {logicOpen && (
                      <SectionLogicEditor
                        section={section}
                        template={template}
                        rules={secRules}
                        onAdd={() => addSectionRule(section.id)}
                        onUpdate={updateRule}
                        onDelete={deleteRule}
                        onClose={() => setSectionLogic(null)}
                      />
                    )}

                    {/* Items + drop zone */}
                    <div
                      onDragOver={(e) => {
                        if (dragItem?.section) return;
                        e.preventDefault();
                        // empty section or dropping below last item → append
                        if (!section.items.length) setDropHint({ si, ii: 0 });
                      }}
                      onDrop={(e) => {
                        if (dragItem?.section) return;
                        e.preventDefault();
                        const ft = e.dataTransfer.getData('field-type');
                        const target = (dropHint && dropHint.si === si) ? dropHint.ii : section.items.length;
                        if (ft) addItem(si, ft, target);
                        else if (dragItem) moveItem(dragItem, si, target);
                        setDragItem(null); setDropHint(null); setDragOver(null);
                      }}
                      style={{ padding: 8, minHeight: section.items.length ? undefined : 8 }}
                    >
                      {section.items.map((it, ii) => {
                        const sel = selectedItem.sectionIdx === si && selectedItem.itemIdx === ii;
                        const ft = FIELD_TYPES.find(f => f.id === it.type);
                        const dragging = dragItem && !dragItem.section && dragItem.si === si && dragItem.ii === ii;
                        const showLineBefore = dropHint && dropHint.si === si && dropHint.ii === ii;
                        return (
                          <React.Fragment key={it.id}>
                            {showLineBefore && <div style={{ height: 2, background: 'var(--accent)', borderRadius: 2, margin: '3px 4px' }}/>}
                            <div
                              draggable
                              onDragStart={(e) => { setDragItem({ si, ii }); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('item-move', `${si}:${ii}`); }}
                              onDragEnd={() => { setDragItem(null); setDropHint(null); }}
                              onDragOver={(e) => {
                                if (dragItem?.section) return;
                                e.preventDefault();
                                const r = e.currentTarget.getBoundingClientRect();
                                const before = e.clientY < r.top + r.height / 2;
                                setDropHint({ si, ii: before ? ii : ii + 1 });
                              }}
                              onClick={() => setSelectedItem({ sectionIdx: si, itemIdx: ii })}
                              className="te-item-row"
                              style={{
                                padding: '9px 10px', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 10,
                                background: sel ? 'var(--accent-soft)' : 'var(--surface)',
                                border: `1px solid ${sel ? 'var(--accent)' : 'var(--border)'}`,
                                borderRadius: 'var(--r-md)', cursor: 'pointer', opacity: dragging ? 0.4 : 1,
                                transition: 'border-color 120ms, background 120ms',
                              }}>
                              <span style={{ cursor: 'grab', display: 'flex', color: 'var(--text-faint, #94a3b8)' }} title="Drag to reorder"><Icon name="grip" size={13}/></span>
                              <div style={{ width: 26, height: 26, borderRadius: 7, flexShrink: 0, background: 'var(--accent-soft)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Icon name={ft?.icon || 'check'} size={13}/>
                              </div>
                              <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{it.label}</span>
                              {it.required && <span style={{ color: '#dc2626', fontSize: 15, lineHeight: 1 }} title="Required">*</span>}
                              {it.triggerFinding && <span style={{ fontSize: 9.5, fontWeight: 700, color: '#b91c1c', background: 'rgba(220,38,38,0.10)', padding: '2px 7px', borderRadius: 'var(--r-full)', whiteSpace: 'nowrap' }}>Auto-finding</span>}
                              {ruleMeta[it.id] && (
                                <span title={ruleMeta[it.id].trigger ? 'Triggers conditional logic' : 'Controlled by conditional logic'}
                                  style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 9.5, fontWeight: 700, color: 'var(--accent)', background: 'var(--accent-soft)', padding: '2px 7px', borderRadius: 'var(--r-full)', whiteSpace: 'nowrap' }}>
                                  <Icon name="gitBranch" size={10}/> {ruleMeta[it.id].trigger ? 'Logic' : 'Conditional'}
                                </span>
                              )}
                              <span style={{ fontSize: 10, color: 'var(--text-muted)', background: 'var(--bg-subtle)', padding: '2px 7px', borderRadius: 'var(--r-full)', fontWeight: 600, whiteSpace: 'nowrap' }}>{ft?.label}</span>
                              <div className="te-item-actions" style={{ display: 'flex', gap: 2, opacity: 0, transition: 'opacity 120ms' }}>
                                <button onClick={(e) => { e.stopPropagation(); duplicateItem(si, ii); }} className="k-btn-plain" style={{ padding: 4, color: 'var(--text-muted)' }} title="Duplicate"><Icon name="copy" size={13}/></button>
                                <button onClick={(e) => { e.stopPropagation(); deleteItemAt(si, ii); }} className="k-btn-plain" style={{ padding: 4, color: 'var(--text-muted)' }} title="Delete"><Icon name="trash" size={13}/></button>
                              </div>
                            </div>
                          </React.Fragment>
                        );
                      })}
                      {/* end-of-list drop line */}
                      {dropHint && dropHint.si === si && dropHint.ii === section.items.length && section.items.length > 0 && (
                        <div style={{ height: 2, background: 'var(--accent)', borderRadius: 2, margin: '3px 4px' }}/>
                      )}

                      {/* Quick add */}
                      <div style={{ position: 'relative', marginTop: section.items.length ? 4 : 0 }}>
                        <button onClick={() => setAddMenu(addMenu === si ? null : si)} style={{
                          width: '100%', padding: '9px', border: `1.5px dashed ${dragOver === si ? 'var(--accent)' : 'var(--border-strong)'}`,
                          borderRadius: 'var(--r-md)', background: dragOver === si ? 'var(--accent-soft)' : 'transparent',
                          color: 'var(--text-muted)', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                        }}>
                          <Icon name="plus" size={13}/> Add field {section.items.length ? '· or drag one here' : '· or drag from the left'}
                        </button>
                        {addMenu === si && (
                          <div style={{
                            position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 20,
                            background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)',
                            boxShadow: '0 12px 32px rgba(15,23,42,0.16)', padding: 6,
                            display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 3, maxHeight: 260, overflowY: 'auto',
                          }}>
                            {FIELD_TYPES.map(f => (
                              <button key={f.id} onClick={() => addItem(si, f.id)} style={{
                                display: 'flex', alignItems: 'center', gap: 8, padding: '8px 9px', borderRadius: 8,
                                border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left', fontSize: 12, color: 'var(--text)',
                              }}
                                onMouseEnter={ev => ev.currentTarget.style.background = 'var(--bg-subtle)'}
                                onMouseLeave={ev => ev.currentTarget.style.background = 'transparent'}>
                                <Icon name={f.icon} size={13} style={{ color: 'var(--accent)' }}/> {f.label}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  );
                })}

                <button onClick={addSection} style={{
                  width: '100%', padding: 14, border: '1.5px dashed var(--border-strong)',
                  borderRadius: 'var(--r-md)', background: 'transparent',
                  color: 'var(--text-muted)', fontSize: 13, fontWeight: 600,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, cursor: 'pointer',
                }}>
                  <Icon name="plus" size={14}/> Add section
                </button>
              </>
            )}
          </div>
        </div>

        {/* Right: item properties */}
        {mode === 'edit' && item && (
          <div style={{ width: 320, borderLeft: '1px solid var(--border)', background: 'var(--surface)', overflowY: 'auto', padding: 18 }}>
            {/* Panel tabs: Properties | Logic */}
            <div style={{ display: 'flex', gap: 4, padding: 3, background: 'var(--bg-subtle)', borderRadius: 'var(--r-md)', marginBottom: 14 }}>
              {[{ k: 'props', l: 'Properties', i: 'settings' }, { k: 'logic', l: 'Logic', i: 'gitBranch' }].map(o => {
                const on = panelTab === o.k;
                const ruleCount = o.k === 'logic' ? (template.rules || []).filter(r => r.field === item.id).length : 0;
                return (
                  <button key={o.k} onClick={() => setPanelTab(o.k)} style={{
                    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    padding: '7px 8px', fontSize: 12, fontWeight: 600, cursor: 'pointer', borderRadius: 'var(--r-sm)',
                    border: 'none', transition: 'all 120ms',
                    background: on ? 'var(--surface)' : 'transparent',
                    color: on ? 'var(--accent)' : 'var(--text-muted)',
                    boxShadow: on ? 'var(--shadow-xs)' : 'none',
                  }}>
                    <Icon name={o.i} size={13}/> {o.l}
                    {o.k === 'logic' && ruleCount > 0 && <span style={{ fontSize: 9.5, fontWeight: 800, background: 'var(--accent)', color: '#fff', borderRadius: 'var(--r-full)', padding: '0 5px', minWidth: 15, textAlign: 'center' }}>{ruleCount}</span>}
                  </button>
                );
              })}
            </div>

            {panelTab === 'props' && (<>
            <PropField label="Label">
              <textarea value={item.label} onChange={e => updateItem({ label: e.target.value })}
                className="k-input" rows={2} style={{ height: 'auto', padding: 8, fontSize: 12.5, resize: 'vertical', minHeight: 50 }}/>
            </PropField>

            <PropField label="Field type">
              <select value={item.type} onChange={e => updateItem({ type: e.target.value })} className="k-input" style={{ height: 30, fontSize: 12.5 }}>
                {FIELD_TYPES.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
              </select>
            </PropField>

            <PropToggle label="Required" value={item.required} onChange={v => updateItem({ required: v })}/>
            <PropToggle label="Auto-create finding on fail" value={item.triggerFinding} onChange={v => updateItem({ triggerFinding: v })}/>

            {item.triggerFinding && (
              <PropField label="Finding severity">
                <select value={item.findingSeverity || 'minor'} onChange={e => updateItem({ findingSeverity: e.target.value })} className="k-input" style={{ height: 30, fontSize: 12.5 }}>
                  <option value="minor">Minor</option><option value="major">Major</option><option value="critical">Critical</option>
                </select>
              </PropField>
            )}

            {(item.type === 'photo') && (
              <PropToggle label="Require photo on fail" value={item.mediaRequired} onChange={v => updateItem({ mediaRequired: v })}/>
            )}

            {(item.type === 'select' || item.type === 'multi_select') && (() => {
              const src = MASTER_DATA_SOURCES.find(s => s.id === item.optionsSource);
              const mode = item.optionsMode || 'manual';
              return (
                <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 10.5, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.06em', marginBottom: 8 }}>Choices</div>
                  {/* Source mode toggle */}
                  <div style={{ display: 'flex', gap: 4, padding: 3, background: 'var(--bg-subtle)', borderRadius: 'var(--r-md)', marginBottom: 10 }}>
                    {[{ k: 'manual', l: 'Manual list', i: 'list' }, { k: 'linked', l: 'Linked source', i: 'link' }].map(o => (
                      <button key={o.k} onClick={() => updateItem({ optionsMode: o.k })} style={{
                        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                        padding: '6px 8px', fontSize: 11.5, fontWeight: 600, cursor: 'pointer', borderRadius: 'var(--r-sm)',
                        border: 'none', transition: 'all 120ms',
                        background: mode === o.k ? 'var(--surface)' : 'transparent',
                        color: mode === o.k ? 'var(--accent)' : 'var(--text-muted)',
                        boxShadow: mode === o.k ? 'var(--shadow-xs)' : 'none',
                      }}><Icon name={o.i} size={12}/> {o.l}</button>
                    ))}
                  </div>

                  {mode === 'manual' && (
                    <PropField label="Options (one per line)">
                      <textarea value={(item.options || []).join('\n')} onChange={e => updateItem({ options: e.target.value.split('\n').filter(Boolean) })}
                        className="k-input" rows={4} placeholder={'Option 1\nOption 2\nOption 3'} style={{ height: 'auto', padding: 8, fontSize: 12.5, resize: 'vertical', minHeight: 70 }}/>
                    </PropField>
                  )}

                  {mode === 'linked' && (
                    <>
                      <PropField label="Linked data source">
                        <select value={item.optionsSource || ''} onChange={e => updateItem({ optionsSource: e.target.value })} className="k-input" style={{ height: 32, fontSize: 12.5 }}>
                          <option value="">Select a source…</option>
                          {MASTER_DATA_SOURCES.map(s => <option key={s.id} value={s.id}>{s.label} ({s.count})</option>)}
                        </select>
                      </PropField>
                      {src ? (
                        <div style={{ padding: 11, background: 'var(--accent-soft)', border: '1px solid color-mix(in srgb, var(--accent) 30%, transparent)', borderRadius: 'var(--r-md)', marginBottom: 10 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7 }}>
                            <Icon name={src.icon} size={14} style={{ color: 'var(--accent)' }}/>
                            <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text)' }}>{src.label}</span>
                            <span style={{ marginLeft: 'auto', fontSize: 10.5, color: 'var(--accent)', fontWeight: 700 }}>{src.count} values</span>
                          </div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
                            {src.sample.map(v => <span key={v} style={{ fontSize: 10.5, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-full)', padding: '2px 8px', color: 'var(--text)' }}>{v}</span>)}
                            <span style={{ fontSize: 10.5, color: 'var(--text-muted)', padding: '2px 4px' }}>+{Math.max(0, src.count - src.sample.length)} more</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10.5, color: 'var(--text-muted)' }}>
                            <Icon name="refresh" size={11}/> Stays in sync · managed in {src.managedIn}
                          </div>
                        </div>
                      ) : (
                        <div style={{ padding: 11, background: 'var(--bg-subtle)', border: '1px dashed var(--border-strong)', borderRadius: 'var(--r-md)', marginBottom: 10, fontSize: 11.5, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 7 }}>
                          <Icon name="link" size={13}/> Pick a governed list so inspectors always get current, approved values.
                        </div>
                      )}
                    </>
                  )}

                  <PropToggle label={'Allow "Other" (free text)'} value={item.allowOther} onChange={v => updateItem({ allowOther: v })}/>
                  {item.type === 'multi_select' && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 4 }}>
                      <PropField label="Min selections">
                        <input type="number" min="0" value={item.minSelect ?? ''} onChange={e => updateItem({ minSelect: e.target.value === '' ? undefined : +e.target.value })} className="k-input" placeholder="—" style={{ height: 30, fontSize: 12.5 }}/>
                      </PropField>
                      <PropField label="Max selections">
                        <input type="number" min="1" value={item.maxSelect ?? ''} onChange={e => updateItem({ maxSelect: e.target.value === '' ? undefined : +e.target.value })} className="k-input" placeholder="—" style={{ height: 30, fontSize: 12.5 }}/>
                      </PropField>
                    </div>
                  )}
                </div>
              );
            })()}

            {item.type === 'number' && (
              <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                <div style={{ fontSize: 10.5, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.06em', marginBottom: 8 }}>Measurement & validation</div>
                <PropField label="Unit">
                  <input value={item.unit || ''} onChange={e => updateItem({ unit: e.target.value })} className="k-input" placeholder="e.g. mm, °C, %" style={{ height: 30, fontSize: 12.5 }}/>
                </PropField>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <PropField label="Min (LSL)">
                    <input type="number" value={item.min ?? ''} onChange={e => updateItem({ min: e.target.value === '' ? undefined : +e.target.value })} className="k-input" placeholder="—" style={{ height: 30, fontSize: 12.5 }}/>
                  </PropField>
                  <PropField label="Max (USL)">
                    <input type="number" value={item.max ?? ''} onChange={e => updateItem({ max: e.target.value === '' ? undefined : +e.target.value })} className="k-input" placeholder="—" style={{ height: 30, fontSize: 12.5 }}/>
                  </PropField>
                </div>
                <PropField label="Target (optional)">
                  <input type="number" value={item.target ?? ''} onChange={e => updateItem({ target: e.target.value === '' ? undefined : +e.target.value })} className="k-input" placeholder="Nominal value" style={{ height: 30, fontSize: 12.5 }}/>
                </PropField>
                <PropToggle label="Flag out-of-spec as fail" value={item.flagOutOfRange} onChange={v => updateItem({ flagOutOfRange: v })}/>
                {(item.min != null || item.max != null) && (
                  <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Icon name="target" size={11}/> Spec: {item.min != null ? item.min : '−∞'} – {item.max != null ? item.max : '∞'}{item.unit ? ' ' + item.unit : ''}
                  </div>
                )}
              </div>
            )}

            {(item.type === 'text' || item.type === 'textarea') && (
              <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                <div style={{ fontSize: 10.5, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.06em', marginBottom: 8 }}>Validation</div>
                {item.type === 'text' && (
                  <PropField label="Format">
                    <select value={item.format || 'any'} onChange={e => updateItem({ format: e.target.value })} className="k-input" style={{ height: 30, fontSize: 12.5 }}>
                      {TEXT_FORMATS.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
                    </select>
                    <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 4 }}>{(TEXT_FORMATS.find(f => f.id === (item.format || 'any')) || {}).hint}</div>
                  </PropField>
                )}
                <PropField label="Max length (characters)">
                  <input type="number" min="0" value={item.maxLength ?? ''} onChange={e => updateItem({ maxLength: e.target.value === '' ? undefined : +e.target.value })} className="k-input" placeholder="No limit" style={{ height: 30, fontSize: 12.5 }}/>
                </PropField>
              </div>
            )}

            {(item.type === 'date' || item.type === 'datetime') && (
              <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                <div style={{ fontSize: 10.5, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.06em', marginBottom: 8 }}>Validation</div>
                <PropField label="Allowed range">
                  <select value={item.dateConstraint || 'any'} onChange={e => updateItem({ dateConstraint: e.target.value })} className="k-input" style={{ height: 30, fontSize: 12.5 }}>
                    <option value="any">Any date</option>
                    <option value="no_future">No future dates</option>
                    <option value="no_past">No past dates</option>
                    <option value="today">Today only</option>
                  </select>
                </PropField>
              </div>
            )}

            {item.type === 'score' && (
              <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                <div style={{ fontSize: 10.5, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.06em', marginBottom: 8 }}>Scale & validation</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <PropField label="Scale min">
                    <input type="number" value={item.scaleMin || 1} onChange={e => updateItem({ scaleMin: +e.target.value })} className="k-input" style={{ height: 30, fontSize: 12.5 }}/>
                  </PropField>
                  <PropField label="Scale max">
                    <input type="number" value={item.scaleMax || 5} onChange={e => updateItem({ scaleMax: +e.target.value })} className="k-input" style={{ height: 30, fontSize: 12.5 }}/>
                  </PropField>
                </div>
                <PropField label="Passing threshold (fail below)">
                  <input type="number" value={item.passThreshold ?? ''} onChange={e => updateItem({ passThreshold: e.target.value === '' ? undefined : +e.target.value })} className="k-input" placeholder="No threshold" style={{ height: 30, fontSize: 12.5 }}/>
                </PropField>
              </div>
            )}

            {item.type === 'photo' && (
              <PropField label="Minimum photos">
                <input type="number" min="0" value={item.minPhotos ?? ''} onChange={e => updateItem({ minPhotos: e.target.value === '' ? undefined : +e.target.value })} className="k-input" placeholder="Optional" style={{ height: 30, fontSize: 12.5 }}/>
              </PropField>
            )}

            <PropField label="Help text (optional)">
              <textarea value={item.description || ''} onChange={e => updateItem({ description: e.target.value })}
                className="k-input" rows={2} placeholder="Shown to the inspector under the question" style={{ height: 'auto', padding: 8, fontSize: 12.5, resize: 'vertical', minHeight: 50 }}/>
            </PropField>

            <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
              <button onClick={deleteItem} style={{ width: '100%', padding: '8px', background: 'rgba(220,38,38,0.08)', color: '#b91c1c', border: '1px solid rgba(220,38,38,0.2)', borderRadius: 'var(--r-sm)', fontSize: 12, fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                <Icon name="trash" size={12}/> Delete field
              </button>
            </div>
            </>)}

            {panelTab === 'logic' && (
              <LogicTab
                item={item}
                template={template}
                rules={(template.rules || []).filter(r => r.field === item.id)}
                incoming={(template.rules || []).filter(r => (r.targets || []).includes(item.id))}
                onAdd={addRule}
                onUpdate={updateRule}
                onDelete={deleteRule}
              />
            )}
          </div>
        )}
      </div>

      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 100,
          background: '#16a34a', color: 'white', padding: '11px 18px', borderRadius: 'var(--r-lg)',
          boxShadow: '0 10px 30px rgba(15,23,42,0.25)', display: 'flex', alignItems: 'center', gap: 9,
          fontSize: 13, fontWeight: 600,
        }}>
          <Icon name="check" size={15} stroke={3}/> {toast}
        </div>
      )}
    </div>
  );
}

function PropField({ label, children }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: 4 }}>{label}</label>
      {children}
    </div>
  );
}

function PropToggle({ label, value, onChange }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
      <span style={{ fontSize: 12.5 }}>{label}</span>
      <button onClick={() => onChange(!value)} style={{
        width: 32, height: 18, borderRadius: 9,
        background: value ? 'var(--accent)' : 'var(--border-strong)',
        border: 'none', cursor: 'pointer', position: 'relative', transition: 'background 120ms',
      }}>
        <div style={{
          position: 'absolute', top: 2, left: value ? 16 : 2,
          width: 14, height: 14, borderRadius: '50%', background: 'white',
          transition: 'left 120ms', boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
        }}/>
      </button>
    </div>
  );
}

function SectionLogicEditor({ section, template, rules, onAdd, onUpdate, onDelete, onClose }) {
  // Eligible triggers = every answerable field OUTSIDE this section.
  // (A field inside the section can't drive its own section's visibility —
  // hiding the section would hide the trigger, so we exclude them.)
  const triggers = [];
  template.sections.forEach(s => {
    if (s.id === section.id) return;
    s.items.forEach(it => {
      if (it.type !== 'section_header' && it.type !== 'info_text') triggers.push(it);
    });
  });

  return (
    <div style={{ padding: '13px 14px', borderBottom: '1px solid var(--border)', background: 'var(--accent-soft)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 9 }}>
        <span style={{ color: 'var(--accent)', display: 'inline-flex' }}><Icon name="gitBranch" size={14}/></span>
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>Section visibility</span>
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>— show or skip the whole section based on another answer</span>
        <button onClick={onClose} className="k-btn-plain" title="Close" style={{ marginLeft: 'auto', padding: 3, color: 'var(--text-muted)' }}><Icon name="x" size={13}/></button>
      </div>

      {triggers.length === 0 ? (
        <div style={{ fontSize: 11.5, color: 'var(--text-muted)', padding: '8px 0' }}>
          Add answerable fields in other sections first — section visibility is driven by an answer elsewhere in the form.
        </div>
      ) : (
        <>
          {rules.length === 0 && (
            <div style={{ fontSize: 11.5, color: 'var(--text-muted)', padding: '4px 0 10px' }}>
              This section always shows. Add a condition to show or skip it based on an answer.
            </div>
          )}
          {rules.map(r => (
            <SectionRuleRow key={r.id} rule={r} triggers={triggers} onUpdate={onUpdate} onDelete={onDelete}/>
          ))}

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 2 }}>
            <button onClick={onAdd} style={{
              padding: '7px 12px', border: '1.5px dashed color-mix(in srgb, var(--accent) 45%, transparent)',
              borderRadius: 'var(--r-md)', background: 'var(--surface)', color: 'var(--accent)',
              fontSize: 11.5, fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6,
            }}>
              <Icon name="plus" size={12}/> Add condition
            </button>
            {rules.length > 1 && (
              <span style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>Multiple conditions combine with <b>OR</b> — any match applies.</span>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function SectionRuleRow({ rule, triggers, onUpdate, onDelete }) {
  const trig = triggers.find(t => t.id === rule.field) || null;
  const ops = trig ? opsForType(trig.type) : ['answered', 'empty'];
  const opDef = LOGIC_OPERATORS[rule.op] || LOGIC_OPERATORS.answered;
  const choices = trig ? valueChoicesFor(trig) : null;

  const changeField = (id) => {
    const t = triggers.find(x => x.id === id);
    const newOps = t ? opsForType(t.type) : ['answered'];
    const newChoices = t ? valueChoicesFor(t) : null;
    const keepOp = newOps.includes(rule.op) ? rule.op : newOps[0];
    onUpdate(rule.id, { field: id, op: keepOp, value: newChoices && newChoices.length ? newChoices[0] : '', value2: '' });
  };

  const valueEditor = () => {
    if (!opDef.needsValue) return null;
    if (rule.op === 'between') {
      return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          <input type="number" value={rule.value ?? ''} onChange={e => onUpdate(rule.id, { value: e.target.value })} className="k-input" placeholder="min" style={{ height: 30, fontSize: 12, width: 64 }}/>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>and</span>
          <input type="number" value={rule.value2 ?? ''} onChange={e => onUpdate(rule.id, { value2: e.target.value })} className="k-input" placeholder="max" style={{ height: 30, fontSize: 12, width: 64 }}/>
        </span>
      );
    }
    if (choices && choices.length) {
      return (
        <select value={rule.value ?? ''} onChange={e => onUpdate(rule.id, { value: e.target.value })} className="k-input" style={{ height: 30, fontSize: 12, minWidth: 90 }}>
          {choices.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      );
    }
    const numeric = rule.op === 'gt' || rule.op === 'lt' || (trig && (trig.type === 'number' || trig.type === 'score'));
    return <input type={numeric ? 'number' : 'text'} value={rule.value ?? ''} onChange={e => onUpdate(rule.id, { value: e.target.value })} className="k-input" placeholder="value" style={{ height: 30, fontSize: 12, width: 110 }}/>;
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap', padding: '8px 10px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', marginBottom: 8 }}>
      <select value={rule.action} onChange={e => onUpdate(rule.id, { action: e.target.value })} className="k-input"
        style={{ height: 30, fontSize: 12, fontWeight: 700, width: 78, color: rule.action === 'show' ? '#16a34a' : '#64748b' }}>
        <option value="show">Show</option>
        <option value="hide">Skip</option>
      </select>
      <span style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>this section when</span>
      <select value={rule.field} onChange={e => changeField(e.target.value)} className="k-input" style={{ height: 30, fontSize: 12, flex: '1 1 150px', minWidth: 130, fontWeight: 600 }}>
        {!trig && <option value={rule.field}>(field removed)</option>}
        {triggers.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
      </select>
      <select value={rule.op} onChange={e => onUpdate(rule.id, { op: e.target.value })} className="k-input" style={{ height: 30, fontSize: 12, width: 'auto', minWidth: 92 }}>
        {ops.map(o => <option key={o} value={o}>{LOGIC_OPERATORS[o].label}</option>)}
      </select>
      {valueEditor()}
      <button onClick={() => onDelete(rule.id)} className="k-btn-plain" title="Delete condition" style={{ marginLeft: 'auto', padding: 4, color: 'var(--text-muted)' }}>
        <Icon name="trash" size={13}/>
      </button>
    </div>
  );
}

function LogicTab({ item, template, rules, incoming, onAdd, onUpdate, onDelete }) {
  // Flat list of every OTHER targetable field (exclude self + display-only blocks)
  const flatFields = [];
  template.sections.forEach(s => s.items.forEach(it => {
    if (it.id !== item.id && it.type !== 'section_header' && it.type !== 'info_text')
      flatFields.push({ id: it.id, label: it.label, type: it.type, section: s.title });
  }));
  const labelOf = (id) => {
    for (const s of template.sections) { const f = s.items.find(x => x.id === id); if (f) return f.label; }
    return id;
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: 9, padding: 12, background: 'var(--accent-soft)', border: '1px solid color-mix(in srgb, var(--accent) 22%, transparent)', borderRadius: 'var(--r-md)', marginBottom: 14 }}>
        <span style={{ color: 'var(--accent)', flexShrink: 0, marginTop: 1, display: 'inline-flex' }}><Icon name="gitBranch" size={15}/></span>
        <div style={{ fontSize: 11.5, color: 'var(--text)', lineHeight: 1.5 }}>
          Rules run live as the inspector fills the form. <b>When this field</b> answers a certain way, <b>show</b>, <b>hide</b>, <b>require</b> or <b>lock</b> other fields. Test them in <b>Preview</b>.
        </div>
      </div>

      <div style={{ fontSize: 10.5, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.06em', marginBottom: 8 }}>
        When &ldquo;{item.label || 'this field'}&rdquo; &hellip;
      </div>

      {rules.length === 0 && (
        <div style={{ padding: 14, border: '1px dashed var(--border-strong)', borderRadius: 'var(--r-md)', textAlign: 'center', fontSize: 11.5, color: 'var(--text-muted)', marginBottom: 10 }}>
          No rules yet. Add one to drive other fields from this answer.
        </div>
      )}

      {rules.map(r => (
        <RuleCard key={r.id} rule={r} trigger={item} fields={flatFields} labelOf={labelOf} onUpdate={onUpdate} onDelete={onDelete}/>
      ))}

      <button onClick={onAdd} style={{
        width: '100%', padding: 10, marginTop: 4, border: '1.5px dashed var(--border-strong)',
        borderRadius: 'var(--r-md)', background: 'transparent', color: 'var(--accent)',
        fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
      }}>
        <Icon name="plus" size={13}/> Add rule
      </button>

      {incoming.length > 0 && (
        <div style={{ marginTop: 18, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
          <div style={{ fontSize: 10.5, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.06em', marginBottom: 8 }}>This field is controlled by</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {incoming.map(r => {
              const a = LOGIC_ACTIONS[r.action] || LOGIC_ACTIONS.show;
              const op = LOGIC_OPERATORS[r.op] || {};
              return (
                <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', background: 'var(--bg-subtle)', borderRadius: 'var(--r-sm)', fontSize: 11.5 }}>
                  <span style={{ color: a.color, flexShrink: 0, display: 'inline-flex' }}><Icon name={a.icon} size={12}/></span>
                  <span style={{ color: 'var(--text)' }}>
                    <b>{a.verb}</b> &ldquo;{labelOf(r.field)}&rdquo; {op.label}{op.needsValue ? ` ${r.value}` : ''}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function RuleCard({ rule, trigger, fields, labelOf, onUpdate, onDelete }) {
  const [pickOpen, setPickOpen] = React.useState(false);
  const ops = opsForType(trigger.type);
  const opDef = LOGIC_OPERATORS[rule.op] || LOGIC_OPERATORS.answered;
  const choices = valueChoicesFor(trigger);
  const action = LOGIC_ACTIONS[rule.action] || LOGIC_ACTIONS.show;
  const targets = rule.targets || [];

  const toggleTarget = (id) => {
    const next = targets.includes(id) ? targets.filter(x => x !== id) : [...targets, id];
    onUpdate(rule.id, { targets: next });
  };

  const valueEditor = () => {
    if (!opDef.needsValue) return null;
    if (rule.op === 'between') {
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <input type="number" value={rule.value ?? ''} onChange={e => onUpdate(rule.id, { value: e.target.value })} className="k-input" placeholder="min" style={{ height: 30, fontSize: 12, flex: 1 }}/>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>and</span>
          <input type="number" value={rule.value2 ?? ''} onChange={e => onUpdate(rule.id, { value2: e.target.value })} className="k-input" placeholder="max" style={{ height: 30, fontSize: 12, flex: 1 }}/>
        </div>
      );
    }
    if (choices && choices.length) {
      return (
        <select value={rule.value ?? ''} onChange={e => onUpdate(rule.id, { value: e.target.value })} className="k-input" style={{ height: 30, fontSize: 12 }}>
          {choices.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      );
    }
    const numeric = rule.op === 'gt' || rule.op === 'lt' || trigger.type === 'number' || trigger.type === 'score';
    return <input type={numeric ? 'number' : 'text'} value={rule.value ?? ''} onChange={e => onUpdate(rule.id, { value: e.target.value })} className="k-input" placeholder="value" style={{ height: 30, fontSize: 12 }}/>;
  };

  const summaryVal = rule.op === 'between' ? `${rule.value || '?'}\u2013${rule.value2 || '?'}` : (rule.value || '?');

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--r-md)', padding: 12, marginBottom: 10, background: 'var(--surface)', position: 'relative' }}>
      <button onClick={() => onDelete(rule.id)} className="k-btn-plain" title="Delete rule" style={{ position: 'absolute', top: 8, right: 8, padding: 4, color: 'var(--text-muted)' }}>
        <Icon name="x" size={13}/>
      </button>

      <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>If</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 12 }}>
        <select value={rule.op} onChange={e => onUpdate(rule.id, { op: e.target.value })} className="k-input" style={{ height: 30, fontSize: 12 }}>
          {ops.map(o => <option key={o} value={o}>{LOGIC_OPERATORS[o].label}</option>)}
        </select>
        {valueEditor()}
      </div>

      <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Then</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        <select value={rule.action} onChange={e => onUpdate(rule.id, { action: e.target.value })} className="k-input" style={{ height: 30, fontSize: 12 }}>
          {Object.entries(LOGIC_ACTIONS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>

        <div style={{ position: 'relative' }}>
          <button onClick={() => setPickOpen(o => !o)} style={{
            width: '100%', minHeight: 30, padding: '5px 9px', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)',
            background: 'var(--surface)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap', fontSize: 12, textAlign: 'left',
          }}>
            {targets.length === 0 && <span style={{ color: 'var(--text-muted)' }}>Select fields&hellip;</span>}
            {targets.map(id => (
              <span key={id} style={{ display: 'inline-flex', alignItems: 'center', fontSize: 11, background: 'var(--accent-soft)', color: 'var(--accent)', padding: '1px 7px', borderRadius: 'var(--r-full)', fontWeight: 600, maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{labelOf(id)}</span>
            ))}
            <span style={{ marginLeft: 'auto', color: 'var(--text-muted)', display: 'inline-flex' }}><Icon name="chevronDown" size={12}/></span>
          </button>
          {pickOpen && (
            <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 30, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', boxShadow: '0 12px 32px rgba(15,23,42,0.18)', maxHeight: 220, overflowY: 'auto', padding: 5 }}>
              {fields.length === 0 && <div style={{ padding: 10, fontSize: 11.5, color: 'var(--text-muted)' }}>No other fields to target.</div>}
              {fields.map(f => {
                const on = targets.includes(f.id);
                return (
                  <button key={f.id} onClick={() => toggleTarget(f.id)} style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '7px 8px', borderRadius: 6,
                    border: 'none', background: on ? 'var(--accent-soft)' : 'transparent', cursor: 'pointer', textAlign: 'left',
                  }}>
                    <span style={{ width: 15, height: 15, borderRadius: 4, border: `1.5px solid ${on ? 'var(--accent)' : 'var(--border-strong)'}`, background: on ? 'var(--accent)' : 'transparent', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {on && <Icon name="check" size={10} stroke={3}/>}
                    </span>
                    <span style={{ flex: 1, fontSize: 12, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.label}</span>
                    <span style={{ fontSize: 9.5, color: 'var(--text-muted)', flexShrink: 0 }}>{f.section}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div style={{ marginTop: 10, paddingTop: 9, borderTop: '1px dashed var(--border)', fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5 }}>
        <span style={{ color: action.color, display: 'inline-flex', verticalAlign: '-2px', marginRight: 3 }}><Icon name={action.icon} size={11}/></span>
        When this field {opDef.label}{opDef.needsValue ? ` \u201c${summaryVal}\u201d` : ''}, <b style={{ color: action.color }}>{action.label.toLowerCase()}</b> {targets.length ? targets.map(labelOf).join(', ') : '(no targets yet)'}.
      </div>
    </div>
  );
}

function PreviewRunner({ template }) {
  const accentInfo = { Automotive: '#2563eb', Pharma: '#7c3aed', Aerospace: '#0891b2', Food: '#16a34a', General: '#475569' };
  const accent = accentInfo[template.industry] || '#2563eb';
  const [answers, setAnswers] = React.useState({});
  const setAnswer = (id, v) => setAnswers(a => ({ ...a, [id]: v }));
  const logic = React.useMemo(() => evaluateLogic(template, answers), [template, answers]);
  const targetSet = React.useMemo(() => new Set((template.rules || []).flatMap(r => r.targets || [])), [template]);
  const isAnswered = (it) => { const v = answers[it.id]; return v != null && v !== ''; };
  const visibleItems = template.sections.flatMap(s => s.items).filter(it => !logic.hidden.has(it.id));
  const totalItems = visibleItems.length;
  const answered = visibleItems.filter(isAnswered).length;
  const pct = totalItems ? Math.round((answered / totalItems) * 100) : 0;

  return (
    <div className="k-surface" style={{ padding: 0, overflow: 'hidden', boxShadow: '0 8px 28px rgba(15,23,42,0.10)' }}>
      {/* Accent header band */}
      <div style={{ background: `linear-gradient(135deg, ${accent}, ${accent}cc)`, color: 'white', padding: '20px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: 700, opacity: 0.85 }}>Inspector view</div>
          <div style={{ fontSize: 11, fontWeight: 600, background: 'rgba(255,255,255,0.18)', padding: '3px 10px', borderRadius: 'var(--r-full)' }}>{template.industry}</div>
        </div>
        <h2 style={{ fontSize: 20, fontWeight: 800, margin: 0, letterSpacing: '-0.01em' }}>{template.name}</h2>
        <div style={{ display: 'flex', gap: 14, marginTop: 6, fontSize: 12, opacity: 0.9 }}>
          <span>v{template.version}</span>
          <span>·</span>
          <span>{template.sections.length} sections</span>
          <span>·</span>
          <span>{totalItems} checks</span>
        </div>
        {/* Progress */}
        <div style={{ marginTop: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontWeight: 600, marginBottom: 5, opacity: 0.95 }}>
            <span>{answered} of {totalItems} completed</span>
            <span>{pct}%</span>
          </div>
          <div style={{ height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.25)', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${pct}%`, background: 'white', borderRadius: 3, transition: 'width 200ms' }}/>
          </div>
        </div>
      </div>

      <div style={{ padding: 24 }}>
        {template.sections.map((section, si) => {
          const vis = section.items.filter(it => !logic.hidden.has(it.id));
          if (!vis.length) return null;
          return (
          <div key={section.id} style={{ marginBottom: 22 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <div style={{ width: 26, height: 26, borderRadius: 8, background: accent, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800 }}>{si + 1}</div>
              <h3 style={{ margin: 0, fontSize: 14.5, fontWeight: 700, flex: 1 }}>{section.title}</h3>
              {!!section.weight && <span style={{ fontSize: 10.5, fontWeight: 700, color: accent, background: `${accent}14`, padding: '3px 9px', borderRadius: 'var(--r-full)' }}>{section.weight}% wt</span>}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {vis.map(item => <PreviewItem key={item.id} item={item} accent={accent} value={answers[item.id]} onChange={v => setAnswer(item.id, v)} forceRequired={logic.required.has(item.id)} disabled={logic.disabled.has(item.id)} conditional={targetSet.has(item.id)}/>)}
            </div>
          </div>
          );
        })}

        <div style={{ paddingTop: 16, borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 12, color: 'var(--text-muted)', flex: 1 }}>{pct === 100 ? 'All checks complete — ready to submit.' : `${totalItems - answered} checks remaining`}</span>
          <button className="k-btn k-btn-secondary">Save draft</button>
          <button className="k-btn k-btn-primary" style={{ background: accent, borderColor: accent }}><Icon name="check" size={13}/> Complete inspection</button>
        </div>
      </div>
    </div>
  );
}

function PreviewItem({ item, accent = '#2563eb', value, onChange, forceRequired, disabled, conditional }) {
  // Semantic color-coded choice button
  const Choice = ({ label, tone, sel }) => {
    const tones = {
      pass: { bg: '#16a34a', soft: '#16a34a14', fg: '#15803d' },
      fail: { bg: '#dc2626', soft: '#dc262614', fg: '#b91c1c' },
      neutral: { bg: '#64748b', soft: '#64748b14', fg: '#475569' },
    };
    const c = tones[tone] || tones.neutral;
    return (
      <button onClick={() => onChange(label)} style={{
        flex: 1, height: 36, fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
        borderRadius: 'var(--r-sm)', transition: 'all 120ms',
        border: `1.5px solid ${sel ? c.bg : 'var(--border)'}`,
        background: sel ? c.bg : c.soft,
        color: sel ? 'white' : c.fg,
      }}>{label}</button>
    );
  };

  return (
    <div style={{
      padding: 14, borderRadius: 'var(--r-md)', background: 'var(--surface)',
      border: `1px solid ${value != null ? `${accent}40` : 'var(--border)'}`,
      borderLeft: `3px solid ${disabled ? 'var(--border-strong)' : (value != null ? accent : 'var(--border-strong)')}`,
      transition: 'border-color 120ms, opacity 120ms',
      opacity: disabled ? 0.6 : 1, pointerEvents: disabled ? 'none' : 'auto',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 10 }}>
        <div style={{ flex: 1, fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
          {item.label} {(item.required || forceRequired) && <span style={{ color: '#dc2626' }}>*</span>}
        </div>
        {conditional && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 9.5, fontWeight: 700, color: accent, background: `${accent}14`, padding: '2px 7px', borderRadius: 'var(--r-full)', whiteSpace: 'nowrap' }}><Icon name="gitBranch" size={10}/> Conditional</span>}
        {disabled && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 9.5, fontWeight: 700, color: '#b91c1c', background: 'rgba(220,38,38,0.10)', padding: '2px 7px', borderRadius: 'var(--r-full)', whiteSpace: 'nowrap' }}><Icon name="lock" size={10}/> Locked</span>}
        {!disabled && forceRequired && !item.required && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 9.5, fontWeight: 700, color: '#d97706', background: 'rgba(217,119,6,0.12)', padding: '2px 7px', borderRadius: 'var(--r-full)', whiteSpace: 'nowrap' }}>Required now</span>}
        {item.triggerFinding && <span style={{ fontSize: 9.5, fontWeight: 700, color: '#b91c1c', background: 'rgba(220,38,38,0.10)', padding: '2px 7px', borderRadius: 'var(--r-full)', whiteSpace: 'nowrap' }}>Auto-finding</span>}
      </div>
      {item.description && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: -4, marginBottom: 10, lineHeight: 1.5 }}>{item.description}</div>}

      {item.type === 'pass_fail' && (
        <div style={{ display: 'flex', gap: 8 }}>
          <Choice label="Pass" tone="pass" sel={value === 'Pass'}/>
          <Choice label="Fail" tone="fail" sel={value === 'Fail'}/>
          <Choice label="N/A" tone="neutral" sel={value === 'N/A'}/>
        </div>
      )}
      {item.type === 'yes_no' && (
        <div style={{ display: 'flex', gap: 8 }}>
          <Choice label="Yes" tone="pass" sel={value === 'Yes'}/>
          <Choice label="No" tone="fail" sel={value === 'No'}/>
        </div>
      )}
      {item.type === 'score' && (
        <div style={{ display: 'flex', gap: 6 }}>
          {[1,2,3,4,5].map(n => {
            const scale = ['#dc2626', '#f59e0b', '#eab308', '#84cc16', '#16a34a'];
            const sel = value === n;
            return (
              <button key={n} onClick={() => onChange(n)} style={{
                width: 42, height: 38, fontSize: 14, fontWeight: 700, cursor: 'pointer',
                borderRadius: 'var(--r-sm)', transition: 'all 120ms',
                border: `1.5px solid ${sel ? scale[n-1] : 'var(--border)'}`,
                background: sel ? scale[n-1] : `${scale[n-1]}10`,
                color: sel ? 'white' : scale[n-1],
              }}>{n}</button>
            );
          })}
        </div>
      )}
      {(item.type === 'text' || item.type === 'textarea') && (
        <div>
          <textarea value={value || ''} maxLength={item.maxLength || undefined}
            onChange={e => onChange(e.target.value || undefined)} className="k-input" placeholder="Type response…"
            rows={item.type === 'text' ? 1 : 3} style={{ height: 'auto', padding: 8, fontSize: 12.5 }}/>
          {(item.maxLength || (item.type === 'text' && item.format && item.format !== 'any')) && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-muted)', marginTop: 3 }}>
              <span>{item.type === 'text' && item.format && item.format !== 'any' ? (TEXT_FORMATS.find(f => f.id === item.format) || {}).hint : ''}</span>
              {item.maxLength && <span>{(value || '').length}/{item.maxLength}</span>}
            </div>
          )}
        </div>
      )}
      {item.type === 'number' && (() => {
        const num = value === undefined || value === '' ? null : +value;
        const out = num != null && ((item.min != null && num < item.min) || (item.max != null && num > item.max));
        return (
          <div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <input type="number" value={value ?? ''} onChange={e => onChange(e.target.value === '' ? undefined : e.target.value)} className="k-input"
                style={{ height: 34, flex: 1, fontSize: 12.5, borderColor: out ? '#dc2626' : undefined, color: out ? '#b91c1c' : undefined }}/>
              {item.unit && <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>{item.unit}</span>}
            </div>
            {(item.min != null || item.max != null || item.target != null) && (
              <div style={{ fontSize: 10.5, marginTop: 4, color: out ? '#b91c1c' : 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 5, fontWeight: out ? 700 : 400 }}>
                <Icon name={out ? 'alert' : 'target'} size={11}/>
                {out ? 'Out of spec' : 'Spec'}: {item.min != null ? item.min : '−∞'} – {item.max != null ? item.max : '∞'}{item.unit ? ' ' + item.unit : ''}{item.target != null ? ` · target ${item.target}` : ''}
                {out && item.flagOutOfRange && <span style={{ marginLeft: 4, background: 'rgba(220,38,38,0.12)', padding: '1px 6px', borderRadius: 'var(--r-full)' }}>auto-fail</span>}
              </div>
            )}
          </div>
        );
      })()}
      {item.type === 'photo' && (
        <button onClick={() => onChange('captured')} style={{
          width: '100%', height: 64, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, cursor: 'pointer',
          borderRadius: 'var(--r-md)', border: `1.5px dashed ${value ? accent : 'var(--border-strong)'}`,
          background: value ? `${accent}10` : 'var(--bg-subtle)', color: value ? accent : 'var(--text-muted)', fontWeight: 600,
        }}>
          <Icon name="camera" size={20}/>
          <span style={{ fontSize: 11 }}>{value ? 'Photo attached ✓' : 'Tap to capture or upload'}</span>
        </button>
      )}
      {(item.type === 'select' || item.type === 'multi_select') && (() => {
        const linked = item.optionsMode === 'linked';
        const src = linked ? MASTER_DATA_SOURCES.find(s => s.id === item.optionsSource) : null;
        let opts = linked ? (src?.sample || []) : (item.options && item.options.length ? item.options : ['Option 1', 'Option 2']);
        if (item.allowOther) opts = [...opts, 'Other…'];
        return (
          <div>
            {src && (
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 10, color: 'var(--accent)', background: 'var(--accent-soft)', padding: '2px 8px', borderRadius: 'var(--r-full)', marginBottom: 6, fontWeight: 600 }}>
                <Icon name={src.icon} size={10}/> {src.label} · {src.count} values
              </div>
            )}
            <select value={value || ''} onChange={e => onChange(e.target.value || undefined)} className="k-input" style={{ height: 34, fontSize: 12.5 }}>
              <option value="">{linked && !src ? 'No source linked' : 'Select…'}</option>
              {opts.map(o => <option key={o}>{o}</option>)}
              {linked && src && <option disabled>+{Math.max(0, src.count - (src.sample?.length || 0))} more…</option>}
            </select>
          </div>
        );
      })()}
      {(item.type === 'date' || item.type === 'datetime') && (() => {
        const today = new Date().toISOString().slice(0, 10);
        const c = item.dateConstraint;
        const min = c === 'no_past' || c === 'today' ? today : undefined;
        const max = c === 'no_future' || c === 'today' ? today : undefined;
        return (
          <div>
            <input type={item.type === 'datetime' ? 'datetime-local' : 'date'} value={value || ''} min={min} max={max}
              onChange={e => onChange(e.target.value || undefined)} className="k-input" style={{ height: 34, fontSize: 12.5 }}/>
            {c && c !== 'any' && (
              <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 4 }}>
                {c === 'no_future' ? 'No future dates allowed' : c === 'no_past' ? 'No past dates allowed' : 'Today only'}
              </div>
            )}
          </div>
        );
      })()}
      {item.type === 'signature' && (
        <button onClick={() => onChange('signed')} style={{
          width: '100%', padding: 16, borderRadius: 'var(--r-md)', cursor: 'pointer', textAlign: 'center',
          border: `1.5px dashed ${value ? accent : 'var(--border-strong)'}`,
          background: value ? `${accent}10` : 'var(--bg-subtle)', color: value ? accent : 'var(--text-muted)',
        }}>
          <Icon name="pen" size={20}/>
          <div style={{ fontSize: 12, fontWeight: 600, marginTop: 2 }}>{value ? 'Signed ✓' : 'Sign here'}</div>
        </button>
      )}
    </div>
  );
}

Object.assign(window, { InspectionTemplatesList, InspectionTemplateEditor, FIELD_TYPES, SAMPLE_TEMPLATES });
