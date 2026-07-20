// Kaenal — AI Governance
// Per-tenant model selection, AI usage controls, audit trail,
// PII redaction policies, cost tracking, red-team/eval results

const MODELS = [
  { id: 'claude-opus-4', vendor: 'Anthropic', family: 'Claude', name: 'Claude Opus 4', tier: 'frontier',
    color: '#cc785c', region: 'us-east-1', context: '200K', priceIn: 15.00, priceOut: 75.00,
    use: 'Root cause, 8D narratives, complex audit summaries' },
  { id: 'claude-sonnet-4', vendor: 'Anthropic', family: 'Claude', name: 'Claude Sonnet 4', tier: 'balanced',
    color: '#cc785c', region: 'us-east-1', context: '200K', priceIn: 3.00, priceOut: 15.00,
    use: 'Default — NCR drafts, doc Q&A, suggestions', active: true },
  { id: 'claude-haiku-4', vendor: 'Anthropic', family: 'Claude', name: 'Claude Haiku 4.5', tier: 'fast',
    color: '#cc785c', region: 'us-east-1', context: '200K', priceIn: 0.80, priceOut: 4.00,
    use: 'Inline autocomplete, classification, redaction' },
  { id: 'gpt-4-1', vendor: 'OpenAI', family: 'GPT', name: 'GPT-4.1', tier: 'frontier',
    color: '#10a37f', region: 'eu-west-1', context: '128K', priceIn: 5.00, priceOut: 20.00,
    use: 'Disabled by region policy' },
  { id: 'gemini-2-5-pro', vendor: 'Google', family: 'Gemini', name: 'Gemini 2.5 Pro', tier: 'frontier',
    color: '#4285f4', region: 'eu-west-3', context: '1M', priceIn: 2.50, priceOut: 10.00,
    use: 'Large doc + image bundles' },
  { id: 'kaenal-qms-v2', vendor: 'Kaenal', family: 'In-house', name: 'Kaenal-QMS v2 (fine-tuned)', tier: 'specialist',
    color: '#2563eb', region: 'ap-south-1', context: '32K', priceIn: 0.40, priceOut: 1.60,
    use: 'IATF-tuned; CAPA, FMEA hints. Private weights — never leaves Kaenal VPC.', active: true, private: true },
  { id: 'mistral-large-2', vendor: 'Mistral', family: 'Mistral', name: 'Mistral Large 2', tier: 'balanced',
    color: '#fa5400', region: 'eu-west-3', context: '128K', priceIn: 2.00, priceOut: 6.00,
    use: 'EU-residency fallback' },
];

const ROUTING_RULES = [
  { id: 'r1', when: 'Workspace user is in EU plant (Bratislava)', then: 'mistral-large-2', why: 'EU data residency — no transatlantic transfer', active: true, hits: 8420 },
  { id: 'r2', when: 'Document classification = "Customer Proprietary"', then: 'kaenal-qms-v2', why: 'Customer-data clause: in-house weights only', active: true, hits: 1247 },
  { id: 'r3', when: 'Field contains supplier IP or pricing', then: 'kaenal-qms-v2', why: 'Commercial sensitivity', active: true, hits: 392 },
  { id: 'r4', when: 'Inline autocomplete in NCR / 8D forms', then: 'claude-haiku-4', why: 'Latency-critical, low cost', active: true, hits: 47832 },
  { id: 'r5', when: 'Audit prep packet generation', then: 'claude-opus-4', why: 'Highest accuracy on long-form synthesis', active: true, hits: 84 },
  { id: 'r6', when: 'Everything else', then: 'claude-sonnet-4', why: 'Default model', active: true, hits: 39214, fallback: true },
];

function AIGovernanceHub() {
  const [tab, setTab] = React.useState('controls');
  const tabs = [
    { id: 'controls', label: 'Data controls', icon: 'shield' },
    { id: 'models', label: 'Models & routing', icon: 'brain' },
    { id: 'redaction', label: 'PII redaction', icon: 'eye' },
    { id: 'audit', label: 'AI audit trail', icon: 'history' },
    { id: 'cost', label: 'Cost & budgets', icon: 'fileText' },
    { id: 'evals', label: 'Evals & red-team', icon: 'target' },
  ];

  return (
    <div>
      <PageHeader
        title="AI Governance"
        description="Control which models touch which data, who can use AI features, and how to prove what happened — every prompt logged, every cent attributed."
        actions={
          <>
            <button className="k-btn k-btn-ghost" onClick={() => kToast('Export started — ai-governance-policy.pdf')}><Icon name="download" size={13}/> Export policy</button>
            <button className="k-btn k-btn-primary" onClick={() => kToast('Policy saved — effective immediately for all workspaces')}><Icon name="check" size={13}/> Save policy</button>
          </>
        }
      />
      <div style={{ padding: '20px 28px 0' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
          {[
            { l: 'AI calls (24h)', v: '54,118', s: '+12% wow', c: '#2563eb', i: 'sparkles' },
            { l: 'Spend MTD', v: '$1,847', s: 'of $5,000 budget', c: '#16a34a', i: 'fileText' },
            { l: 'PII redactions', v: '3,242', s: '100% pre-egress', c: '#7c3aed', i: 'shield' },
            { l: 'Eval pass rate', v: '94.2%', s: 'last regression', c: '#0d9488', i: 'target' },
          ].map(k => (
            <div key={k.l} className="k-surface" style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 38, height: 38, borderRadius: 8, background: k.c + '18', color: k.c, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon name={k.i} size={18}/>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 10.5, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>{k.l}</div>
                <div style={{ fontSize: 22, fontWeight: 700, lineHeight: 1.1 }}>{k.v}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{k.s}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="k-tabs" style={{ marginBottom: 20 }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} className={`k-tab ${tab === t.id ? 'active' : ''}`}>
              <Icon name={t.icon} size={13}/> {t.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding: '0 28px 32px', maxWidth: 1080 }}>
        {tab === 'controls' && <AIDataControls/>}
        {tab === 'models' && <AIModels/>}
        {tab === 'redaction' && <AIRedaction/>}
        {tab === 'audit' && <AIAuditTrail/>}
        {tab === 'cost' && <AICost/>}
        {tab === 'evals' && <AIEvals/>}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Data controls
// ─────────────────────────────────────────────────────────────
function AIDataControls() {
  return (
    <>
      <Card title="Where AI is allowed" desc="Per-surface kill switch. Off means the feature is hidden from the UI entirely.">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
          {[
            { l: 'Root-cause suggestions on NCRs', on: true, sub: 'Fishbone + 5-Why drafts' },
            { l: '8D narrative drafting', on: true, sub: 'D1–D8 phase prose' },
            { l: 'Inline autocomplete in forms', on: true, sub: 'Tab-to-accept across all forms' },
            { l: 'Document Q&A drawer', on: true, sub: 'Ask questions about controlled docs' },
            { l: 'Inspection photo classification', on: true, sub: 'Defect category from operator photo' },
            { l: 'Audit prep packet generation', on: true, sub: 'Auto-collect evidence by clause' },
            { l: 'Customer email drafting', on: false, sub: 'OFF — legal pending review' },
            { l: 'Supplier-facing AI (portal)', on: false, sub: 'OFF — never expose internal corpora' },
            { l: 'Voice transcription (mobile)', on: true, sub: 'Whisper, EU-routed' },
            { l: 'Translation (cross-plant comms)', on: true, sub: '12 languages enabled' },
          ].map(s => (
            <div key={s.l} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12, border: '1px solid var(--border)', borderRadius: 'var(--r-md)' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{s.l}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{s.sub}</div>
              </div>
              <Toggle on={s.on}/>
            </div>
          ))}
        </div>
      </Card>

      <Card title="Data classes" desc="Whether each data class may be sent to an LLM. Field-level enforcement.">
        <table style={{ width: '100%' }}>
          <thead><tr style={{ borderBottom: '1px solid var(--border)' }}>
            <th style={{ textAlign: 'left', padding: '8px 0', fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Class</th>
            <th style={{ textAlign: 'left', padding: '8px 0', fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Example</th>
            <th style={{ textAlign: 'left', padding: '8px 0', fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>External LLM</th>
            <th style={{ textAlign: 'left', padding: '8px 0', fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>In-house only</th>
          </tr></thead>
          <tbody>
            {[
              { c: 'Public', ex: 'Standard names, IATF clause text', l1: 'Allowed', l2: 'Allowed' },
              { c: 'Internal', ex: 'Inspection results, NCR titles', l1: 'Allowed', l2: 'Allowed' },
              { c: 'Confidential', ex: 'CAPA root cause, supplier ratings', l1: 'Redacted', l2: 'Allowed', warn: true },
              { c: 'Restricted', ex: 'PII, employee data, badge IDs', l1: 'Tokenized', l2: 'Tokenized', critical: true },
              { c: 'Customer Proprietary', ex: 'OEM drawings, customer NCR text', l1: 'Blocked', l2: 'Allowed', critical: true },
              { c: 'Supplier Confidential', ex: 'PPAP, supplier pricing', l1: 'Blocked', l2: 'Allowed', critical: true },
              { c: 'Regulated (PHI/PCI)', ex: 'Medical, payment data', l1: 'Blocked', l2: 'Blocked', critical: true },
            ].map(r => (
              <tr key={r.c} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '12px 0', fontSize: 13, fontWeight: 600 }}>{r.c}</td>
                <td style={{ padding: '12px 0', fontSize: 11.5, color: 'var(--text-muted)' }}>{r.ex}</td>
                <td style={{ padding: '12px 0' }}>
                  <span className="k-chip" style={{
                    background: r.l1 === 'Allowed' ? 'var(--success-100)' : r.l1 === 'Blocked' ? 'rgba(220,38,38,0.10)' : 'rgba(245,158,11,0.12)',
                    color: r.l1 === 'Allowed' ? 'var(--success-700)' : r.l1 === 'Blocked' ? '#b91c1c' : '#92400e',
                  }}>{r.l1}</span>
                </td>
                <td style={{ padding: '12px 0' }}>
                  <span className="k-chip" style={{
                    background: r.l2 === 'Allowed' ? 'var(--success-100)' : r.l2 === 'Blocked' ? 'rgba(220,38,38,0.10)' : 'rgba(245,158,11,0.12)',
                    color: r.l2 === 'Allowed' ? 'var(--success-700)' : r.l2 === 'Blocked' ? '#b91c1c' : '#92400e',
                  }}>{r.l2}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card title="Training & retention">
        <Row label="Allow vendor to train on our prompts" hint="Anthropic & OpenAI commercial APIs are no-train by default — we keep it that way.">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Toggle on={false}/>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Off · Enterprise no-train DPAs signed with all vendors</span>
          </div>
        </Row>
        <Row label="Prompt + response retention" hint="Stored in your VPC for audit. After this, only hash + metadata kept.">
          <Segmented value="90d" onChange={() => {}} options={[
            { value: '30d', label: '30 days' },
            { value: '90d', label: '90 days' },
            { value: '1y', label: '1 year' },
            { value: '7y', label: '7 years (full audit)' },
          ]}/>
        </Row>
        <Row label="Customer opt-out from AI features" hint="When set, those users see no AI controls anywhere">
          <button className="k-btn k-btn-secondary k-btn-sm" onClick={() => kToast('Opt-out list — 4 users excluded from all AI features')}><Icon name="users" size={12}/> Manage opt-out list (4 users)</button>
        </Row>
        <Row label="Per-tenant key for prompts at rest" hint="Encrypts stored prompt/response with your KMS key"><Toggle on={true}/></Row>
      </Card>

      <Card title="Human review thresholds" desc="When AI output requires a human approver before it commits">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[
            { l: 'Disposition recommendation (scrap / use-as-is)', who: 'Always requires Quality Manager', sev: 'high' },
            { l: '8D phase D4–D5 (root cause + corrective action)', who: 'Always requires Quality Engineer review', sev: 'high' },
            { l: 'NCR severity classification', who: 'Auto-commit when confidence ≥ 0.85', sev: 'med' },
            { l: 'Document summary on closed records', who: 'Auto-commit', sev: 'low' },
            { l: 'Translated supplier reply', who: 'Auto-commit', sev: 'low' },
          ].map(r => (
            <div key={r.l} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', background: 'var(--bg-subtle)', borderRadius: 'var(--r-md)' }}>
              <div style={{ width: 4, height: 32, borderRadius: 2, background: r.sev === 'high' ? '#dc2626' : r.sev === 'med' ? '#f59e0b' : '#22c55e' }}/>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12.5, fontWeight: 600 }}>{r.l}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{r.who}</div>
              </div>
              <button className="k-btn k-btn-secondary k-btn-sm" onClick={() => kToast('Rule opened for editing')}>Edit</button>
            </div>
          ))}
        </div>
      </Card>
    </>
  );
}

// ─────────────────────────────────────────────────────────────
// Model selection + routing
// ─────────────────────────────────────────────────────────────
function AIModels() {
  return (
    <>
      <Card title="Available models" desc="Curated set of approved providers. Disabled models cannot be invoked even with override.">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
          {MODELS.map(m => (
            <div key={m.id} style={{
              padding: 14, border: m.active ? '2px solid var(--accent)' : '1px solid var(--border)',
              borderRadius: 'var(--r-md)',
              background: m.active ? 'var(--accent-soft)' : 'var(--surface)',
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 8 }}>
                <div style={{ width: 36, height: 36, borderRadius: 8, background: m.color, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 11 }}>
                  {m.vendor[0]}{m.family[0]}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                    {m.name}
                    {m.private && <span className="k-chip" style={{ background: 'rgba(37,99,235,0.12)', color: '#2563eb', fontSize: 9 }}>VPC-private</span>}
                  </div>
                  <div style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>{m.vendor} · {m.region} · {m.context} ctx</div>
                </div>
                <Toggle on={m.active}/>
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: 8 }}>{m.use}</div>
              <div style={{ display: 'flex', gap: 14, fontSize: 10.5, color: 'var(--text-muted)' }}>
                <span><span className="mono">${m.priceIn.toFixed(2)}</span> /M in</span>
                <span><span className="mono">${m.priceOut.toFixed(2)}</span> /M out</span>
                <span className="k-chip mono" style={{ marginLeft: 'auto', background: 'var(--bg-subtle)', fontSize: 9 }}>{m.tier}</span>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card title="Routing rules" desc="First match wins. Rules let you route by content class, region, surface, or override per workspace."
        footer={<button className="k-btn k-btn-primary"><Icon name="plus" size={13}/> Add rule</button>}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {ROUTING_RULES.map((r, i) => {
            const model = MODELS.find(m => m.id === r.then);
            return (
              <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderTop: i ? '1px solid var(--border)' : 'none' }}>
                <div style={{ width: 22, height: 22, borderRadius: 4, background: 'var(--bg-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)' }}>{i + 1}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12.5 }}>
                    <strong>When</strong> {r.when}
                  </div>
                  <div style={{ fontSize: 12, marginTop: 3, color: 'var(--text-muted)' }}>
                    <strong style={{ color: 'var(--text)' }}>→ Use</strong>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '1px 6px', marginLeft: 4, marginRight: 4, borderRadius: 4, background: (model?.color || '#666') + '18', color: model?.color || 'var(--text)' }}>
                      <span style={{ width: 5, height: 5, borderRadius: '50%', background: model?.color || 'var(--text-muted)' }}/>
                      {model?.name}
                    </span>
                    — {r.why}
                  </div>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }} className="mono">{r.hits.toLocaleString()} hits</div>
                {r.fallback && <span className="k-chip" style={{ background: 'var(--bg-subtle)', fontSize: 10 }}>Fallback</span>}
                <button className="k-btn-plain" style={{ padding: 6 }}><Icon name="more" size={13}/></button>
              </div>
            );
          })}
        </div>
      </Card>

      <Card title="Fallback chain" desc="If a model is unavailable or rate-limited, try these in order">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {['claude-sonnet-4', 'claude-haiku-4', 'mistral-large-2', 'kaenal-qms-v2'].map((id, i, a) => {
            const m = MODELS.find(x => x.id === id);
            return (
              <React.Fragment key={id}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px', border: `1px solid ${m.color}40`, borderRadius: 6, background: m.color + '12' }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: m.color }}/>
                  <span style={{ fontSize: 12, fontWeight: 600 }}>{m.name}</span>
                </div>
                {i < a.length - 1 && <Icon name="arrowRight" size={12} style={{ color: 'var(--text-subtle)' }}/>}
              </React.Fragment>
            );
          })}
        </div>
        <div style={{ marginTop: 12, fontSize: 11.5, color: 'var(--text-muted)' }}>
          Median failover trigger: 2× upstream timeout (8s) or HTTP 5xx. Health snapshots every 30s.
        </div>
      </Card>
    </>
  );
}

// ─────────────────────────────────────────────────────────────
// PII Redaction
// ─────────────────────────────────────────────────────────────
function AIRedaction() {
  return (
    <>
      <div style={{ padding: 16, marginBottom: 18, background: 'linear-gradient(135deg, #1e3a8a, #4c1d95)', color: 'white', borderRadius: 'var(--r-lg)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 48, height: 48, borderRadius: 10, background: 'rgba(255,255,255,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="shield" size={22}/>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 16, fontWeight: 700 }}>PII pipeline — pre-egress</div>
            <div style={{ fontSize: 12, opacity: 0.85, marginTop: 2 }}>
              Every prompt passes through redaction before leaving the Kaenal VPC. Detector model runs in-region.
              <span className="mono" style={{ background: 'rgba(255,255,255,0.12)', padding: '1px 6px', borderRadius: 4, marginLeft: 8 }}>p50 18ms · p99 64ms</span>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 24, fontWeight: 700 }}>3,242</div>
            <div style={{ fontSize: 10, opacity: 0.7 }}>redactions / 24h</div>
          </div>
        </div>
      </div>

      <Card title="Detector patterns" desc="Patterns matched and the action taken before egress">
        <table className="k-table" style={{ width: '100%' }}>
          <thead><tr><th>Pattern</th><th>Detector</th><th>Action</th><th>24h hits</th><th>Confidence</th></tr></thead>
          <tbody>
            {[
              { p: 'Email address', d: 'Regex + NER', a: 'Replace [EMAIL_001]', h: 1842, c: 99.8 },
              { p: 'Phone number (international)', d: 'libphonenumber', a: 'Replace [PHONE_001]', h: 487, c: 99.4 },
              { p: 'Indian Aadhaar', d: 'Verhoeff checksum', a: 'Block — reject prompt', h: 4, c: 100, block: true },
              { p: 'US SSN', d: 'Format + checksum', a: 'Block — reject prompt', h: 0, c: 100, block: true },
              { p: 'Employee badge ID', d: 'Org pattern P-\\d{6}', a: 'Tokenize (HMAC)', h: 247, c: 100 },
              { p: 'IP address (private + public)', d: 'Regex', a: 'Replace [IP_001]', h: 312, c: 100 },
              { p: 'Credit card', d: 'Luhn check', a: 'Block — reject prompt', h: 0, c: 100, block: true },
              { p: 'Date of birth', d: 'NER (en, hi, de, sk)', a: 'Replace [DOB]', h: 28, c: 96.4 },
              { p: 'Person name (high-confidence)', d: 'NER + roster cross-check', a: 'Replace [PERSON_n]', h: 1247, c: 92.4 },
              { p: 'Customer drawing number', d: 'Org pattern', a: 'Tokenize', h: 184, c: 98.1 },
              { p: 'Supplier code', d: 'ERP roster', a: 'Tokenize', h: 92, c: 99.4 },
            ].map((d, i) => (
              <tr key={i}>
                <td style={{ fontWeight: 600, fontSize: 13 }}>{d.p}</td>
                <td className="mono" style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{d.d}</td>
                <td>
                  <span className="k-chip" style={{
                    background: d.block ? 'rgba(220,38,38,0.10)' : 'rgba(124,58,237,0.10)',
                    color: d.block ? '#b91c1c' : '#7c3aed',
                  }}>{d.a}</span>
                </td>
                <td className="mono" style={{ fontSize: 12 }}>{d.h.toLocaleString()}</td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 60, height: 4, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${d.c}%`, background: d.c >= 99 ? '#22c55e' : d.c >= 95 ? '#f59e0b' : '#dc2626' }}/>
                    </div>
                    <span className="mono" style={{ fontSize: 11 }}>{d.c}%</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card title="Preview — redaction in action">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <div className="k-overline" style={{ marginBottom: 6 }}>Original</div>
            <div style={{ padding: 14, background: 'var(--bg-subtle)', borderRadius: 'var(--r-md)', fontSize: 12.5, lineHeight: 1.6, fontFamily: 'var(--font-mono)' }}>
              Operator <mark style={{ background: '#fde68a', padding: '0 3px', borderRadius: 2 }}>Sarah Ahmed</mark> (badge <mark style={{ background: '#fde68a', padding: '0 3px', borderRadius: 2 }}>P-184729</mark>) reported a porosity defect at <mark style={{ background: '#fde68a', padding: '0 3px', borderRadius: 2 }}>14:22</mark> on weld station 4. Customer drawing <mark style={{ background: '#fde68a', padding: '0 3px', borderRadius: 2 }}>VOL-AX-9384</mark>. Contact: <mark style={{ background: '#fde68a', padding: '0 3px', borderRadius: 2 }}>sarah.ahmed@precision-auto.com</mark>.
            </div>
          </div>
          <div>
            <div className="k-overline" style={{ marginBottom: 6 }}>What the LLM sees</div>
            <div style={{ padding: 14, background: 'var(--bg-subtle)', borderRadius: 'var(--r-md)', fontSize: 12.5, lineHeight: 1.6, fontFamily: 'var(--font-mono)' }}>
              Operator <mark style={{ background: '#bbf7d0', padding: '0 3px', borderRadius: 2 }}>[PERSON_1]</mark> (badge <mark style={{ background: '#bbf7d0', padding: '0 3px', borderRadius: 2 }}>[BADGE_a39f]</mark>) reported a porosity defect at <mark style={{ background: '#bbf7d0', padding: '0 3px', borderRadius: 2 }}>[TIME_001]</mark> on weld station 4. Customer drawing <mark style={{ background: '#bbf7d0', padding: '0 3px', borderRadius: 2 }}>[DRAWING_2c1e]</mark>. Contact: <mark style={{ background: '#bbf7d0', padding: '0 3px', borderRadius: 2 }}>[EMAIL_1]</mark>.
            </div>
          </div>
        </div>
        <div style={{ marginTop: 12, padding: 10, background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.25)', borderRadius: 'var(--r-md)', fontSize: 11.5, display: 'flex', gap: 8, alignItems: 'center' }}>
          <Icon name="check" size={13} stroke={2.5} style={{ color: 'var(--success-600)' }}/>
          Reverse map kept in-VPC for 24h so AI replies can be rehydrated for the operator who asked.
        </div>
      </Card>

      <Card title="False-positive review queue">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {[
            { sample: '"BMW E46 chassis batch …"', flagged: 'BMW E46', as: 'Person', verdict: 'pending' },
            { sample: '"DPMO trending up at line 4"', flagged: 'DPMO', as: 'Acronym', verdict: 'cleared' },
            { sample: '"Operator Anita confirmed rework"', flagged: 'Anita', as: 'Person', verdict: 'confirmed-pii' },
          ].map((r, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: 'var(--bg-subtle)', borderRadius: 6, fontSize: 12 }}>
              <span className="mono" style={{ flex: 1, fontSize: 11.5, color: 'var(--text-muted)' }}>{r.sample}</span>
              <span className="k-chip" style={{ background: 'rgba(245,158,11,0.12)', color: '#92400e', fontSize: 10 }}>Flagged: {r.flagged}</span>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>as {r.as}</span>
              {r.verdict === 'pending' && (
                <>
                  <button className="k-btn k-btn-secondary k-btn-sm" style={{ height: 22, padding: '0 8px', fontSize: 11 }}>Not PII</button>
                  <button className="k-btn k-btn-primary k-btn-sm" style={{ height: 22, padding: '0 8px', fontSize: 11 }}>Confirm</button>
                </>
              )}
              {r.verdict === 'cleared' && <span style={{ fontSize: 11, color: 'var(--success-600)' }}>✓ Cleared</span>}
              {r.verdict === 'confirmed-pii' && <span style={{ fontSize: 11, color: '#b91c1c' }}>Confirmed PII</span>}
            </div>
          ))}
        </div>
      </Card>
    </>
  );
}

// ─────────────────────────────────────────────────────────────
// AI audit trail
// ─────────────────────────────────────────────────────────────
function AIAuditTrail() {
  const [selected, setSelected] = React.useState(0);
  const events = [
    { t: '14:22:08', who: 'u-priya', surf: 'NCR-2026-0142 · Root cause assistant', model: 'claude-sonnet-4', tokensIn: 1842, tokensOut: 412, cost: '$0.012', latencyMs: 1247, redactions: 3, verdict: 'accepted', context: 'NCR draft, weld porosity defect on Line 4' },
    { t: '14:21:47', who: 'u-marcus', surf: 'Document Q&A · Welding Process Control Plan v4.3', model: 'claude-sonnet-4', tokensIn: 18402, tokensOut: 184, cost: '$0.058', latencyMs: 2847, redactions: 0, verdict: 'viewed' },
    { t: '14:20:12', who: 'u-system', surf: 'Audit prep packet · AUD-2026-0021', model: 'claude-opus-4', tokensIn: 84200, tokensOut: 12420, cost: '$2.193', latencyMs: 18420, redactions: 47, verdict: 'completed' },
    { t: '14:19:55', who: 'u-sarah', surf: 'Inline autocomplete · NCR title field', model: 'claude-haiku-4', tokensIn: 240, tokensOut: 18, cost: '$0.0002', latencyMs: 184, redactions: 0, verdict: 'rejected' },
    { t: '14:18:32', who: 'u-jorge', surf: 'Translation · Supplier reply (DE → EN)', model: 'kaenal-qms-v2', tokensIn: 412, tokensOut: 384, cost: '$0.0008', latencyMs: 240, redactions: 1, verdict: 'accepted' },
    { t: '14:17:08', who: 'u-priya', surf: 'Photo classification · Inspection 0342', model: 'claude-haiku-4', tokensIn: 1240, tokensOut: 42, cost: '$0.0012', latencyMs: 487, redactions: 0, verdict: 'auto-accepted' },
    { t: '14:14:22', who: 'u-david', surf: 'NCR-2026-0140 · Disposition recommendation', model: 'claude-sonnet-4', tokensIn: 2840, tokensOut: 624, cost: '$0.018', latencyMs: 1842, redactions: 2, verdict: 'overridden', warn: true },
    { t: '14:12:08', who: 'u-anita', surf: 'Mobile voice transcription', model: 'whisper-large-v3', tokensIn: 0, tokensOut: 0, cost: '$0.006', latencyMs: 2400, redactions: 1, verdict: 'accepted', audio: true },
    { t: '14:08:42', who: 'u-marcus', surf: 'NCR-2026-0141 · 8D D4 narrative', model: 'claude-sonnet-4', tokensIn: 4820, tokensOut: 1240, cost: '$0.033', latencyMs: 3284, redactions: 4, verdict: 'edited-accepted' },
    { t: '14:04:18', who: 'u-system', surf: 'Routing rule fired · r1 (EU residency)', model: 'mistral-large-2', tokensIn: 1840, tokensOut: 412, cost: '$0.006', latencyMs: 1240, redactions: 2, verdict: 'completed' },
  ];
  const ev = events[selected];

  const VerdictBadge = ({ v }) => {
    const map = {
      accepted: ['Accepted', 'var(--success-100)', 'var(--success-700)'],
      'auto-accepted': ['Auto-accepted', 'var(--success-100)', 'var(--success-700)'],
      'edited-accepted': ['Edited + accepted', 'rgba(245,158,11,0.12)', '#92400e'],
      rejected: ['Rejected', 'rgba(100,116,139,0.15)', 'var(--text-muted)'],
      overridden: ['Overridden by user', 'rgba(220,38,38,0.10)', '#b91c1c'],
      viewed: ['Viewed', 'rgba(37,99,235,0.10)', '#1d4ed8'],
      completed: ['Completed', 'var(--success-100)', 'var(--success-700)'],
    };
    const [l, bg, fg] = map[v] || ['', '', ''];
    return <span className="k-chip" style={{ background: bg, color: fg, fontSize: 10 }}>{l}</span>;
  };

  return (
    <>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <input className="k-input" placeholder="Search prompts, users, surfaces…" style={{ flex: 1 }}/>
        <select className="k-input" defaultValue="all" style={{ width: 160 }}><option value="all">All models</option></select>
        <select className="k-input" defaultValue="24h" style={{ width: 140 }}>
          <option>Last 24 hours</option><option>Last 7 days</option><option>Last 30 days</option>
        </select>
        <button className="k-btn k-btn-ghost"><Icon name="download" size={13}/> Export</button>
      </div>

      <div className="k-surface" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', overflow: 'hidden' }}>
        <div style={{ borderRight: '1px solid var(--border)', maxHeight: 600, overflowY: 'auto' }}>
          {events.map((e, i) => (
            <button key={i} onClick={() => setSelected(i)} style={{
              display: 'block', width: '100%', textAlign: 'left', padding: '12px 14px',
              borderBottom: '1px solid var(--border)',
              background: selected === i ? 'var(--accent-soft)' : 'transparent',
              borderLeft: selected === i ? '3px solid var(--accent)' : '3px solid transparent',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <span className="mono" style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>{e.t}</span>
                {e.warn && <Icon name="alert" size={11} style={{ color: '#f59e0b' }}/>}
                <VerdictBadge v={e.verdict}/>
              </div>
              <div style={{ fontSize: 12.5, fontWeight: 500, marginBottom: 2 }}>{e.surf}</div>
              <div style={{ display: 'flex', gap: 8, fontSize: 10.5, color: 'var(--text-muted)' }}>
                <span className="mono">{e.model}</span>
                <span>·</span>
                <span>{(e.tokensIn + e.tokensOut).toLocaleString()} tok</span>
                <span>·</span>
                <span>{e.cost}</span>
              </div>
            </button>
          ))}
        </div>

        <div style={{ padding: 18, maxHeight: 600, overflowY: 'auto' }}>
          <div className="k-overline" style={{ marginBottom: 8 }}>Event {selected + 1} of {events.length}</div>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>{ev.surf}</div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
            <Detail k="Timestamp" v={`2026-05-19 ${ev.t} IST`}/>
            <Detail k="User" v={ev.who === 'u-system' ? 'System' : userById(ev.who.replace('u-', ''))?.name || ev.who}/>
            <Detail k="Model" v={ev.model}/>
            <Detail k="Latency" v={`${ev.latencyMs} ms`}/>
            <Detail k="Tokens in" v={ev.tokensIn.toLocaleString()}/>
            <Detail k="Tokens out" v={ev.tokensOut.toLocaleString()}/>
            <Detail k="Cost" v={ev.cost}/>
            <Detail k="Redactions" v={ev.redactions}/>
          </div>

          <div className="k-overline" style={{ marginBottom: 6 }}>Prompt (post-redaction)</div>
          <div style={{ padding: 12, background: 'var(--bg-subtle)', borderRadius: 6, fontSize: 11.5, fontFamily: 'var(--font-mono)', lineHeight: 1.55, marginBottom: 14, whiteSpace: 'pre-wrap' }}>
{`Role: quality_engineer
Surface: ncr_root_cause
Context:
- NCR ID: NCR-2026-0142
- Severity: high
- Defect class: weld_porosity
- Operator: [PERSON_1]
- Line: weld_4
- Customer drawing: [DRAWING_2c1e]
- Measured value: 4.2mm penetration (spec 5.0-7.0)

Task: Suggest 3 candidate root causes with likelihood and supporting evidence from process control plan v4.3.`}
          </div>

          <div className="k-overline" style={{ marginBottom: 6 }}>Response (truncated)</div>
          <div style={{ padding: 12, background: 'var(--bg-subtle)', borderRadius: 6, fontSize: 11.5, lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>
{`Candidate root causes (ranked by likelihood):

1. Wire feed speed drift (~62%) — PCP §3.2 specifies 4.8 m/min ± 0.3. Recent CMM trend on station 4 shows penetration walking down 0.6mm over 47 hours, consistent with feed-speed calibration drift.

2. Shield gas mix off-spec (~22%) — argon/CO₂ ratio…

3. Joint preparation gap (~16%) — pre-weld inspection records…

Recommend: Verify wire-feed calibration on station 4 first (PCP §3.2.1 procedure). Estimated containment …`}
          </div>

          <div style={{ marginTop: 14, padding: 10, background: ev.warn ? 'rgba(245,158,11,0.08)' : 'var(--bg-subtle)', borderRadius: 'var(--r-md)', display: 'flex', gap: 8, alignItems: 'center', fontSize: 11.5 }}>
            <Icon name={ev.warn ? 'alert' : 'info'} size={13} style={{ color: ev.warn ? '#f59e0b' : 'var(--text-muted)' }}/>
            {ev.warn
              ? <span><strong>User overrode AI</strong> — they entered a different disposition. Reviewed by Quality Manager next shift.</span>
              : <span>Tamper-evident chain — entry hash <span className="mono">0x8a7b…2c93</span> appended to immutable log.</span>}
          </div>
        </div>
      </div>
    </>
  );
}

function Detail({ k, v }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, marginBottom: 2 }}>{k}</div>
      <div style={{ fontSize: 12.5, fontWeight: 500 }} className="mono">{v}</div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Cost & budgets
// ─────────────────────────────────────────────────────────────
function AICost() {
  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12, marginBottom: 16 }}>
        <Card title="Monthly spend by model" desc="May 2026 · MTD">
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 200, padding: '20px 0' }}>
            {[
              { d: 1, c: 84, h: 0.22 }, { d: 2, c: 92, h: 0.28 }, { d: 3, c: 78, h: 0.18 },
              { d: 4, c: 110, h: 0.35 }, { d: 5, c: 124, h: 0.42 }, { d: 6, c: 134, h: 0.45 },
              { d: 7, c: 88, h: 0.24 }, { d: 8, c: 84, h: 0.22 }, { d: 9, c: 96, h: 0.30 },
              { d: 10, c: 110, h: 0.35 }, { d: 11, c: 142, h: 0.52 }, { d: 12, c: 168, h: 0.65 },
              { d: 13, c: 148, h: 0.58 }, { d: 14, c: 92, h: 0.28 }, { d: 15, c: 86, h: 0.24 },
              { d: 16, c: 132, h: 0.48 }, { d: 17, c: 158, h: 0.62 }, { d: 18, c: 184, h: 0.78 },
              { d: 19, c: 134, h: 0.46 },
            ].map(d => (
              <div key={d.d} style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                <div style={{ display: 'flex', flexDirection: 'column-reverse' }}>
                  <div style={{ height: 0, position: 'relative', textAlign: 'center', fontSize: 9, color: 'var(--text-muted)', marginTop: 4 }}>{d.d}</div>
                  <div style={{ background: '#cc785c', height: d.c * d.h * 0.5 }}/>
                  <div style={{ background: '#7c3aed', height: d.c * 0.4 }}/>
                  <div style={{ background: '#2563eb', height: d.c * 0.3 }}/>
                </div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 16, fontSize: 11.5, marginTop: 8 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 10, height: 10, background: '#cc785c', borderRadius: 2 }}/> Claude Sonnet ($1,247)</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 10, height: 10, background: '#7c3aed', borderRadius: 2 }}/> Claude Opus ($318)</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 10, height: 10, background: '#2563eb', borderRadius: 2 }}/> In-house ($282)</span>
          </div>
        </Card>

        <Card title="Budget">
          <div style={{ marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
              <span style={{ fontSize: 28, fontWeight: 700 }}>$1,847</span>
              <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>of $5,000 MTD</span>
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>Projected month-end: $3,012 · Under by $1,988</div>
            <div style={{ height: 8, background: 'var(--bg-subtle)', borderRadius: 4, marginTop: 10, overflow: 'hidden' }}>
              <div style={{ width: '37%', height: '100%', background: 'var(--success-500)' }}/>
            </div>
          </div>
          <Row label="Monthly cap"><div style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ fontSize: 12 }}>$</span><input type="number" defaultValue={5000} className="k-input" style={{ width: 100 }}/></div></Row>
          <Row label="Alert at"><Segmented size="sm" value="80" onChange={() => {}} options={[{value:'50',label:'50%'},{value:'80',label:'80%'},{value:'95',label:'95%'}]}/></Row>
          <Row label="Hard limit"><Toggle on={true}/></Row>
        </Card>
      </div>

      <Card title="Per-team chargeback" desc="Attribute AI spend to department for monthly reconciliation"
        footer={<button className="k-btn k-btn-ghost"><Icon name="download" size={13}/> Export GL journal (May 2026)</button>}>
        <table className="k-table" style={{ width: '100%' }}>
          <thead><tr><th>Team / cost center</th><th>Calls (MTD)</th><th>Tokens</th><th>Spend</th><th>vs. Budget</th><th>Top surface</th></tr></thead>
          <tbody>
            {[
              { team: 'Quality — Pune-1', cc: 'CC-4101', calls: '18,420', tokens: '24.8M', spend: '$684', vs: 92, surf: 'NCR root-cause' },
              { team: 'Quality — Chennai-2', cc: 'CC-4102', calls: '12,840', tokens: '18.4M', spend: '$487', vs: 78, surf: '8D drafting' },
              { team: 'Quality — Detroit Aluminum', cc: 'CC-4201', calls: '8,420', tokens: '12.4M', spend: '$324', vs: 65, surf: 'Audit packet' },
              { team: 'Engineering', cc: 'CC-5101', calls: '4,820', tokens: '6.8M', spend: '$142', vs: 47, surf: 'Doc Q&A' },
              { team: 'Supply Chain', cc: 'CC-3101', calls: '3,240', tokens: '4.2M', spend: '$104', vs: 110, surf: 'Translation', over: true },
              { team: 'Compliance', cc: 'CC-2101', calls: '2,840', tokens: '8.4M', spend: '$184', vs: 92, surf: 'Audit packet' },
            ].map(t => (
              <tr key={t.team}>
                <td>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{t.team}</div>
                  <div className="mono" style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>{t.cc}</div>
                </td>
                <td className="mono">{t.calls}</td>
                <td className="mono">{t.tokens}</td>
                <td className="mono" style={{ fontWeight: 600 }}>{t.spend}</td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 80, height: 4, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
                      <div style={{ width: `${Math.min(t.vs, 100)}%`, height: '100%', background: t.over ? '#dc2626' : t.vs > 90 ? '#f59e0b' : '#22c55e' }}/>
                    </div>
                    <span className="mono" style={{ fontSize: 11 }}>{t.vs}%</span>
                  </div>
                </td>
                <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t.surf}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card title="Top spenders (users)">
        <table className="k-table" style={{ width: '100%' }}>
          <thead><tr><th>User</th><th>Calls MTD</th><th>Spend</th><th>Avg latency</th><th>Acceptance</th></tr></thead>
          <tbody>
            {[
              { u: 'u-priya', calls: '8,420', spend: '$184', lat: '1.8s', acc: 84 },
              { u: 'u-marcus', calls: '6,240', spend: '$142', lat: '2.1s', acc: 78 },
              { u: 'u-sarah', calls: '4,820', spend: '$96', lat: '1.6s', acc: 92 },
              { u: 'u-david', calls: '3,240', spend: '$68', lat: '2.4s', acc: 64 },
              { u: 'u-jorge', calls: '2,840', spend: '$48', lat: '1.4s', acc: 87 },
            ].map(r => {
              const u = userById(r.u.replace('u-', ''));
              return (
                <tr key={r.u}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Avatar user={r.u.replace('u-', '')} size={26}/>
                      <span style={{ fontSize: 13, fontWeight: 500 }}>{u?.name}</span>
                    </div>
                  </td>
                  <td className="mono">{r.calls}</td>
                  <td className="mono" style={{ fontWeight: 600 }}>{r.spend}</td>
                  <td className="mono">{r.lat}</td>
                  <td>
                    <span className="k-chip" style={{ background: r.acc >= 80 ? 'var(--success-100)' : 'rgba(245,158,11,0.12)', color: r.acc >= 80 ? 'var(--success-700)' : '#92400e' }}>{r.acc}%</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </>
  );
}

// ─────────────────────────────────────────────────────────────
// Evals & red-team
// ─────────────────────────────────────────────────────────────
function AIEvals() {
  return (
    <>
      <Card title="Evaluation suite" desc="Run on every model upgrade and weekly drift check">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 14 }}>
          {[
            { l: 'Overall pass rate', v: '94.2%', c: '#16a34a', t: '+1.4 vs baseline' },
            { l: 'Hallucination rate', v: '2.4%', c: '#16a34a', t: 'Target ≤ 3%' },
            { l: 'PII leakage', v: '0.0%', c: '#16a34a', t: '12,400 cases tested' },
            { l: 'Refusal accuracy', v: '98.8%', c: '#16a34a', t: 'Refuses what it should' },
          ].map(k => (
            <div key={k.l} style={{ padding: 14, background: 'var(--bg-subtle)', borderRadius: 'var(--r-md)' }}>
              <div style={{ fontSize: 10.5, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>{k.l}</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: k.c, marginTop: 4 }}>{k.v}</div>
              <div style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>{k.t}</div>
            </div>
          ))}
        </div>

        <table className="k-table" style={{ width: '100%' }}>
          <thead><tr><th>Eval set</th><th>Cases</th><th>Last run</th><th>Pass</th><th>Trend (12 wk)</th></tr></thead>
          <tbody>
            {[
              { n: 'IATF clause Q&A — factuality', cases: 240, last: '2h ago', pass: 96.2, trend: [92,93,94,93,95,96,95,96,97,96,96.5,96.2] },
              { n: 'NCR root cause — coherence', cases: 184, last: '6h ago', pass: 91.4, trend: [88,89,90,91,92,91,90,92,93,91,92,91.4] },
              { n: 'PII pre-egress (red-team)', cases: 1240, last: 'Yesterday', pass: 100, trend: [99,99.5,99.8,100,100,100,100,100,100,100,100,100] },
              { n: 'Refusal — prohibited categories', cases: 420, last: 'Yesterday', pass: 98.8, trend: [95,96,97,98,98,99,98,99,98.5,98.8,98.8,98.8] },
              { n: 'Hallucination harness (closed Q)', cases: 824, last: '3 days ago', pass: 94.6, trend: [90,91,92,93,93,94,94,95,94,94.5,94.6,94.6] },
              { n: 'Tone & professionalism', cases: 184, last: '3 days ago', pass: 89.2, trend: [82,84,86,87,87,88,89,90,89,89.5,89,89.2] },
              { n: 'Translation fidelity (12 languages)', cases: 1200, last: '1 week ago', pass: 93.4, trend: [88,89,90,91,92,93,93.5,94,93.5,93,93.4,93.4] },
              { n: 'Mathematical reasoning (Cpk, Cp)', cases: 84, last: '1 week ago', pass: 87.0, trend: [82,83,84,85,86,86,87,88,87.5,87,87,87], warn: true },
            ].map(r => (
              <tr key={r.n}>
                <td style={{ fontSize: 13, fontWeight: 500 }}>{r.n}</td>
                <td className="mono" style={{ fontSize: 12 }}>{r.cases.toLocaleString()}</td>
                <td style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{r.last}</td>
                <td>
                  <span className="k-chip" style={{ background: r.pass >= 95 ? 'var(--success-100)' : r.pass >= 90 ? 'rgba(245,158,11,0.12)' : 'rgba(220,38,38,0.10)', color: r.pass >= 95 ? 'var(--success-700)' : r.pass >= 90 ? '#92400e' : '#b91c1c' }}>{r.pass.toFixed(1)}%</span>
                </td>
                <td>
                  <Sparkline data={r.trend} color={r.warn ? '#f59e0b' : '#16a34a'}/>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card title="Recent red-team campaigns" desc="Adversarial prompts run against the production stack to find failure modes">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[
            { id: 'rt-2026-09', name: 'Prompt-injection in supplier replies', date: 'May 12, 2026', findings: '0 critical, 3 medium, 12 low', verdict: 'mitigated', who: 'Internal AppSec' },
            { id: 'rt-2026-08', name: 'PII extraction via inspection notes', date: 'Apr 28, 2026', findings: '0 critical, 0 medium, 4 low', verdict: 'mitigated', who: 'Internal AppSec' },
            { id: 'rt-2026-07', name: 'Customer-name leakage in 8D summaries', date: 'Apr 14, 2026', findings: '1 critical (patched), 2 medium', verdict: 'mitigated', who: 'HackerOne' },
            { id: 'rt-2026-06', name: 'Cross-tenant prompt confusion', date: 'Mar 30, 2026', findings: '0 critical, 0 medium', verdict: 'mitigated', who: 'External — Trail of Bits' },
            { id: 'rt-2026-05', name: 'Jailbreak — bypassing disposition rules', date: 'Mar 16, 2026', findings: '0 critical, 1 medium (patched)', verdict: 'mitigated', who: 'Internal AppSec' },
          ].map(c => (
            <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12, border: '1px solid var(--border)', borderRadius: 'var(--r-md)' }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(124,58,237,0.10)', color: '#7c3aed', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="target" size={16}/>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{c.name}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{c.date} · {c.who} · {c.findings}</div>
              </div>
              <span className="k-chip" style={{ background: 'var(--success-100)', color: 'var(--success-700)' }}>
                <Icon name="check" size={10} stroke={3}/> Mitigated
              </span>
              <button className="k-btn k-btn-secondary k-btn-sm"><Icon name="fileText" size={11}/> Report</button>
            </div>
          ))}
        </div>
      </Card>

      <Card title="Open issues from evals" desc="Things on our list to fix">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {[
            { sev: 'med', what: 'Cpk arithmetic drifts ~2% on multi-modal distributions', owner: 'AI Platform team', eta: 'Sprint 47 · ~2 wks' },
            { sev: 'low', what: 'Translation: DE → EN occasionally uses "scrap" for German "Ausschuss" instead of preferred "reject"', owner: 'Linguistics ops', eta: 'Sprint 48' },
            { sev: 'low', what: 'Tone eval marks some Indian-English phrasings as "informal" — false negative', owner: 'AI Platform', eta: 'Sprint 49' },
          ].map((r, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: 'var(--bg-subtle)', borderRadius: 'var(--r-md)' }}>
              <span className="k-chip" style={{
                background: r.sev === 'med' ? 'rgba(245,158,11,0.12)' : 'rgba(100,116,139,0.15)',
                color: r.sev === 'med' ? '#92400e' : 'var(--text-muted)',
              }}>{r.sev.toUpperCase()}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13 }}>{r.what}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{r.owner} · ETA {r.eta}</div>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </>
  );
}

function Sparkline({ data, color = '#16a34a' }) {
  const min = Math.min(...data), max = Math.max(...data);
  const range = max - min || 1;
  const w = 80, h = 24;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * h}`).join(' ');
  return (
    <svg width={w} height={h} style={{ display: 'block' }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5"/>
      <circle cx={w} cy={h - ((data[data.length-1] - min) / range) * h} r="2" fill={color}/>
    </svg>
  );
}

Object.assign(window, { AIGovernanceHub });
