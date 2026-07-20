// Kaenal — Supplier Quality module
// SupplierList · SupplierDetail (360) · SupplierScorecards · SupplierRiskMatrix

// Risk tier color + label (A=preferred, B=approved, C=conditional, D=critical)
const RISK_TIER = {
  A: { label: 'A · Preferred', dot: '#16a34a', bg: 'rgba(34,197,94,0.10)', fg: '#15803d' },
  B: { label: 'B · Approved',  dot: '#3b82f6', bg: 'rgba(59,130,246,0.10)', fg: 'var(--primary-700)' },
  C: { label: 'C · Conditional', dot: '#f59e0b', bg: 'rgba(245,158,11,0.12)', fg: '#92400e' },
  D: { label: 'D · Critical',   dot: '#dc2626', bg: 'rgba(220,38,38,0.10)', fg: '#b91c1c' },
};

const RiskTierBadge = ({ tier, ai = false, confidence }) => {
  const t = RISK_TIER[tier] || RISK_TIER.B;
  return (
    <span className="k-chip" style={{ background: t.bg, color: t.fg, fontWeight: 600 }} title={ai ? `AI confidence ${confidence}%` : ''}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: t.dot }}/>
      {t.label}
      {ai && <Icon name="sparkles" size={10}/>}
    </span>
  );
};

// Supplier logo / monogram
const SupplierLogo = ({ supplier, size = 32, rounded = 6 }) => (
  <div style={{
    width: size, height: size, borderRadius: rounded, background: supplier.color,
    color: 'white', fontWeight: 700, fontSize: size * 0.32,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0, letterSpacing: '0.04em',
  }}>{supplier.code}</div>
);

// Small KPI value cell with target comparison + spark
const KpiCell = ({ value, target, lowerIsBetter = false, suffix = '', spark, mini = false }) => {
  const bad = lowerIsBetter ? value > target : value < target;
  const color = bad ? '#dc2626' : '#16a34a';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ fontWeight: 600, fontSize: mini ? 12 : 13, color, fontVariantNumeric: 'tabular-nums' }}>
        {typeof value === 'number' ? value.toLocaleString(undefined, { maximumFractionDigits: 1 }) : value}{suffix}
      </div>
      {spark && <MiniSpark data={spark} color={color}/>}
    </div>
  );
};

const MiniSpark = ({ data, color = 'var(--accent)', w = 56, h = 18 }) => {
  if (!data || data.length === 0) return null;
  const max = Math.max(...data), min = Math.min(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * h}`).join(' ');
  return (
    <svg width={w} height={h} style={{ display: 'block' }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
};


// ─────────────────────────────────────────────────────────────
// SUPPLIER LIST
// ─────────────────────────────────────────────────────────────
function SupplierList({ setRoute, setSupplier, openCreate, settings }) {
  const [tab, setTab] = React.useState('all');
  const [search, setSearch] = React.useState('');
  const [sort, setSort] = React.useState('spend');

  // tier counts
  const counts = { A: 0, B: 0, C: 0, D: 0 };
  SUPPLIERS.forEach(s => counts[s.riskTier]++);

  const tabs = [
    { id: 'all', l: `All (${SUPPLIERS.length})` },
    { id: 'A', l: `Preferred (${counts.A})` },
    { id: 'B', l: `Approved (${counts.B})` },
    { id: 'C', l: `Conditional (${counts.C})` },
    { id: 'D', l: `Critical (${counts.D})` },
    { id: 'flagged', l: 'Flagged (3)' },
  ];

  let rows = SUPPLIERS;
  if (tab !== 'all' && tab !== 'flagged') rows = rows.filter(s => s.riskTier === tab);
  if (tab === 'flagged') rows = rows.filter(s => s.flags?.some(f => f !== 'preferred' && f !== 'benchmark'));
  if (search) rows = rows.filter(s => (s.name + s.code + s.category + s.country).toLowerCase().includes(search.toLowerCase()));
  rows = [...rows].sort((a, b) => sort === 'spend' ? b.spendYtd - a.spendYtd : sort === 'risk' ? a.riskTier.localeCompare(b.riskTier) : sort === 'ppm' ? b.ppmYtd - a.ppmYtd : a.name.localeCompare(b.name));

  const totalSpend = SUPPLIERS.reduce((s, x) => s + x.spendYtd, 0);
  const totalCharge = SUPPLIERS.reduce((s, x) => s + x.chargebacksYtd, 0);

  return (
    <div>
      <PageHeader
        title="Suppliers"
        description="216 active suppliers across 9 categories. Heavy cross-links to NCRs, 8Ds, audits, ECNs, and complaints."
        actions={
          <>
            <button className="k-btn k-btn-ghost"><Icon name="download" size={13}/> Audit pack</button>
            <button className="k-btn k-btn-ghost" onClick={() => setRoute('suppliers-scorecards')}><Icon name="reports" size={13}/> Scorecards</button>
            <button className="k-btn k-btn-primary"><Icon name="plus" size={13}/> New supplier</button>
          </>
        }
      />

      <div style={{ padding: '20px 28px 32px' }}>
        {/* KPI strip */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10, marginBottom: 18 }}>
          {[
            { l: 'Active suppliers', v: '216', s: 'across 22 countries', c: 'var(--primary-700)' },
            { l: 'YTD spend', v: '$52.3M', s: '+8.2% vs LY', c: 'var(--text)' },
            { l: 'Average PPM', v: '124', s: 'target ≤ 75', c: '#f59e0b', flag: true },
            { l: 'Critical-tier', v: counts.D, s: '2 cert-expiring', c: '#dc2626' },
            { l: 'Chargebacks YTD', v: '$' + (totalCharge / 1000).toFixed(0) + 'k', s: '+$26k MoM', c: '#7c3aed' },
          ].map(k => (
            <div key={k.l} className="k-surface" style={{ padding: 12 }}>
              <div style={{ fontSize: 10.5, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>{k.l}</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: k.c }}>{k.v}</div>
              <div style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>{k.s}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="k-tabs" style={{ marginBottom: 14 }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} className={`k-tab ${tab === t.id ? 'active' : ''}`}>{t.l}</button>
          ))}
        </div>

        {/* Filter row */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center' }}>
          <input className="k-input" placeholder="Search by name, code, country, part…" value={search} onChange={e => setSearch(e.target.value)} style={{ flex: 1, maxWidth: 320, height: 32 }}/>
          <span style={{ marginLeft: 'auto', fontSize: 11.5, color: 'var(--text-muted)' }}>Sort by</span>
          <Segmented size="sm" value={sort} onChange={setSort} options={[
            { value: 'spend', label: 'Spend' }, { value: 'risk', label: 'Risk' }, { value: 'ppm', label: 'PPM' }, { value: 'name', label: 'Name' },
          ]}/>
        </div>

        {/* Supplier table */}
        <div className="k-surface" style={{ overflow: 'hidden' }}>
          <table className="k-table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th>Supplier</th>
                <th>Tier / Risk</th>
                <th>PPM</th>
                <th>OTD %</th>
                <th>OQE</th>
                <th>SCAR resp.</th>
                <th>Spend YTD</th>
                <th>Quality events</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map(s => {
                const events = (s.linkedNcrs?.length || 0) + (s.linked8ds?.length || 0) + (s.linkedComplaints?.length || 0);
                const isRaw = s.tier === 'Raw material';
                return (
                  <tr key={s.id} onClick={() => { setSupplier(s.id); setRoute('supplier-detail'); }} style={{ cursor: 'pointer' }}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <SupplierLogo supplier={s} size={32}/>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600 }}>{s.name}</div>
                          <div style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>
                            <span className="mono">{s.id}</span> · {s.country} · {s.category}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-start' }}>
                        <span className="k-chip" style={{ background: 'var(--bg-subtle)', fontSize: 10.5 }}>{s.tier}</span>
                        <RiskTierBadge tier={s.riskTier}/>
                      </div>
                    </td>
                    <td>
                      {isRaw
                        ? <KpiCell value={s.materialRejectsPercent} target={s.materialRejectsTarget} suffix="%" lowerIsBetter mini/>
                        : <KpiCell value={s.ppmYtd} target={s.ppmTarget} lowerIsBetter spark={s.ppmTrend} mini/>}
                    </td>
                    <td><KpiCell value={s.otdYtd} target={s.otdTarget} suffix="%" spark={s.otdTrend} mini/></td>
                    <td><KpiCell value={s.oqeYtd} target={s.oqeTarget} mini/></td>
                    <td>
                      <span style={{ fontWeight: 600, fontSize: 12.5, color: s.scarHours > s.scarTarget ? '#dc2626' : '#16a34a', fontVariantNumeric: 'tabular-nums' }}>
                        {s.scarHours}h
                      </span>
                      <span style={{ fontSize: 10.5, color: 'var(--text-muted)' }}> / {s.scarTarget}h</span>
                    </td>
                    <td style={{ fontWeight: 600, fontSize: 12.5, fontVariantNumeric: 'tabular-nums' }}>
                      ${(s.spendYtd / 1_000_000).toFixed(2)}M
                    </td>
                    <td>
                      {events > 0 ? (
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                          {s.linkedNcrs?.length > 0 && <span className="k-chip" style={{ background: 'rgba(220,38,38,0.08)', color: '#b91c1c', fontSize: 10 }}>{s.linkedNcrs.length} NCR</span>}
                          {s.linked8ds?.length > 0 && <span className="k-chip" style={{ background: 'rgba(99,102,241,0.10)', color: '#4338ca', fontSize: 10 }}>{s.linked8ds.length} 8D</span>}
                          {s.linkedComplaints?.length > 0 && <span className="k-chip" style={{ background: 'rgba(234,88,12,0.10)', color: '#9a3412', fontSize: 10 }}>{s.linkedComplaints.length} Comp</span>}
                        </div>
                      ) : (
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>—</span>
                      )}
                    </td>
                    <td>
                      <Icon name="chevronRight" size={14} className="" />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}


// ─────────────────────────────────────────────────────────────
// SUPPLIER DETAIL — Supplier 360
// ─────────────────────────────────────────────────────────────
function SupplierDetail({ id, setRoute, setSupplier, setNcr, set8d, setAudit, setCapa, settings }) {
  const s = SUPPLIERS.find(x => x.id === id) || SUPPLIERS[0];
  const [tab, setTab] = React.useState('overview');

  const isRaw = s.tier === 'Raw material';
  const aiVisible = settings?.ai !== 'quiet' || s.aiInsights?.some(i => i.kind === 'risk' || i.kind === 'anomaly');

  // related items (cross-references)
  const relatedNcrs = (s.linkedNcrs || []).map(id => NCRS.find(n => n.id === id)).filter(Boolean);
  const related8ds = (s.linked8ds || []).map(id => EIGHT_D_LIST.find(e => e.id === id)).filter(Boolean);
  const relatedAudits = (s.linkedAudits || []).map(id => AUDITS.find(a => a.id === id) || INSPECTIONS.find(i => i.id === id)).filter(Boolean);
  const relatedScars = SCARS.filter(sc => sc.supplierId === s.id);
  const relatedPpaps = PPAP_SUBMISSIONS.filter(p => p.supplierId === s.id);

  return (
    <div>
      <PageHeader
        title={s.name}
        description={`${s.id} · ${s.tier} · ${s.category} · ${s.city}, ${s.country}`}
        actions={
          <>
            <button className="k-btn k-btn-ghost"><Icon name="download" size={13}/> Scorecard PDF</button>
            <button className="k-btn k-btn-ghost"><Icon name="audit" size={13}/> Schedule audit</button>
            <button className="k-btn k-btn-primary"><Icon name="alert" size={13}/> Raise SCAR</button>
          </>
        }
      />

      <div style={{ padding: '16px 28px 32px' }}>
        {/* Header / 360 strip */}
        <div className="k-surface" style={{ padding: 18, marginBottom: 16, display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 18, alignItems: 'center' }}>
          <SupplierLogo supplier={s} size={64} rounded={12}/>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 6 }}>
              <RiskTierBadge tier={s.riskTier}/>
              {s.aiRiskTier !== s.riskTier && <RiskTierBadge tier={s.aiRiskTier} ai confidence={s.aiRiskConfidence}/>}
              {s.flags?.includes('preferred') && <span className="k-chip" style={{ background: 'rgba(34,197,94,0.10)', color: '#15803d' }}><Icon name="star" size={10}/> Preferred</span>}
              {s.flags?.includes('benchmark') && <span className="k-chip" style={{ background: 'rgba(99,102,241,0.10)', color: '#4338ca' }}>Benchmark</span>}
              {s.flags?.includes('cert-expiring') && <span className="k-chip" style={{ background: 'rgba(245,158,11,0.12)', color: '#92400e' }}><Icon name="clock" size={10}/> Cert expiring</span>}
              {s.flags?.includes('audit-overdue') && <span className="k-chip" style={{ background: 'rgba(220,38,38,0.10)', color: '#b91c1c' }}>Audit overdue</span>}
              {s.flags?.includes('no-iatf') && <span className="k-chip" style={{ background: 'rgba(220,38,38,0.10)', color: '#b91c1c' }}>No IATF cert</span>}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 14 }}>
              <Mini360 label={isRaw ? 'Reject %' : 'PPM (YTD)'} value={isRaw ? s.materialRejectsPercent + '%' : s.ppmYtd} target={isRaw ? '≤ ' + s.materialRejectsTarget + '%' : '≤ ' + s.ppmTarget} good={isRaw ? s.materialRejectsPercent <= s.materialRejectsTarget : s.ppmYtd <= s.ppmTarget}/>
              <Mini360 label="On-time delivery" value={s.otdYtd + '%'} target={'≥ ' + s.otdTarget + '%'} good={s.otdYtd >= s.otdTarget}/>
              <Mini360 label="OQE score" value={s.oqeYtd} target={'≥ ' + s.oqeTarget} good={s.oqeYtd >= s.oqeTarget}/>
              <Mini360 label="SCAR response" value={s.scarHours + 'h'} target={'≤ ' + s.scarTarget + 'h'} good={s.scarHours <= s.scarTarget}/>
              <Mini360 label="Spend YTD" value={'$' + (s.spendYtd / 1_000_000).toFixed(2) + 'M'} sub={`Charge: $${(s.chargebacksYtd / 1000).toFixed(1)}k`} good={s.chargebacksYtd < 10_000}/>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end', fontSize: 11.5, color: 'var(--text-muted)' }}>
            <div><Icon name="user" size={11}/> {s.contact.name} · {s.contact.role}</div>
            <div className="mono" style={{ fontSize: 11 }}>{s.contact.email}</div>
            <div>Contract since {s.contractStart}</div>
            <div>{s.iatfCert} · exp {s.certExpires}</div>
          </div>
        </div>

        {/* AI Insight banner */}
        {aiVisible && s.aiInsights?.length > 0 && (
          <div style={{ marginBottom: 16, padding: 14, background: 'linear-gradient(135deg, rgba(99,102,241,0.06), rgba(168,85,247,0.04))', border: '1px solid rgba(99,102,241,0.18)', borderRadius: 'var(--r-lg)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <Icon name="sparkles" size={14} style={{ color: '#6366f1' }}/>
              <strong style={{ fontSize: 12, color: 'var(--text)' }}>AI insights — confidence {s.aiRiskConfidence}%</strong>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(s.aiInsights.length, 3)}, 1fr)`, gap: 10 }}>
              {s.aiInsights.map((insight, i) => (
                <div key={i} style={{ padding: 10, background: 'var(--surface)', borderRadius: 6, display: 'flex', gap: 8 }}>
                  <Icon
                    name={insight.kind === 'positive' ? 'thumbsUp' : insight.kind === 'risk' ? 'alert' : insight.kind === 'anomaly' ? 'zap' : insight.kind === 'similar' ? 'users' : 'trending'}
                    size={14}
                    style={{ color: insight.kind === 'positive' ? '#16a34a' : insight.kind === 'risk' || insight.kind === 'anomaly' ? '#dc2626' : '#6366f1', flexShrink: 0, marginTop: 2 }}
                  />
                  <div style={{ fontSize: 11.5, lineHeight: 1.5 }}>{insight.text}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="k-tabs" style={{ marginBottom: 16 }}>
          {[
            { id: 'overview', l: 'Overview' },
            { id: 'scorecard', l: 'Scorecard' },
            { id: 'ppap', l: `PPAP (${(s.ppapPrograms || []).length + relatedPpaps.length})` },
            { id: 'events', l: `Quality events (${relatedNcrs.length + related8ds.length + relatedScars.length})` },
            { id: 'audits', l: `Audits (${relatedAudits.length})` },
            { id: 'parts', l: `Parts (${s.parts.length})` },
            { id: 'docs', l: 'Documents' },
          ].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} className={`k-tab ${tab === t.id ? 'active' : ''}`}>{t.l}</button>
          ))}
        </div>

        {tab === 'overview' && <SupplierOverviewTab s={s} relatedNcrs={relatedNcrs} related8ds={related8ds} relatedAudits={relatedAudits} relatedScars={relatedScars} setRoute={setRoute} setNcr={setNcr} set8d={set8d} setAudit={setAudit}/>}
        {tab === 'scorecard' && <SupplierScorecardDetail s={s} settings={settings}/>}
        {tab === 'ppap' && <SupplierPpapTab s={s} relatedPpaps={relatedPpaps} setRoute={setRoute}/>}
        {tab === 'events' && <SupplierEventsTab s={s} relatedNcrs={relatedNcrs} related8ds={related8ds} relatedScars={relatedScars} setRoute={setRoute} setNcr={setNcr} set8d={set8d}/>}
        {tab === 'audits' && <SupplierAuditsTab s={s} relatedAudits={relatedAudits} setRoute={setRoute} setAudit={setAudit}/>}
        {tab === 'parts' && <SupplierPartsTab s={s}/>}
        {tab === 'docs' && <SupplierDocsTab s={s}/>}
      </div>
    </div>
  );
}

const Mini360 = ({ label, value, target, sub, good }) => (
  <div>
    <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.04em' }}>{label}</div>
    <div style={{ fontSize: 20, fontWeight: 700, color: good ? '#15803d' : '#b91c1c', fontVariantNumeric: 'tabular-nums', marginTop: 2 }}>{value}</div>
    <div style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>{target || sub}</div>
  </div>
);


// ─── Overview tab ───
function SupplierOverviewTab({ s, relatedNcrs, related8ds, relatedAudits, relatedScars, setRoute, setNcr, set8d, setAudit }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>
      {/* LEFT: PPM trend + recent quality events */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Card title={s.tier === 'Raw material' ? 'Material rejects — 12 mo' : 'PPM trend — 12 mo'} desc={`Target: ${s.tier === 'Raw material' ? '≤ ' + s.materialRejectsTarget + '%' : '≤ ' + s.ppmTarget + ' ppm'}`}>
          {s.ppmTrend
            ? <BigSpark data={s.ppmTrend} target={s.ppmTarget} lowerIsBetter/>
            : <BigSpark data={[2.4, 2.2, 2.6, 2.1, 2.4, 2.0, 2.2, 2.6, 2.4, 2.2, 2.4, s.materialRejectsPercent || 0]} target={s.materialRejectsTarget || 0} lowerIsBetter suffix="%"/>
          }
        </Card>

        <Card title="Linked quality events" desc="NCRs, 8Ds, complaints, SCARs raised against this supplier">
          {relatedNcrs.length + related8ds.length + relatedScars.length === 0 ? (
            <EmptyState icon="check" title="No open events" body="This supplier has a clean record across all linked modules."/>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {relatedNcrs.map(n => (
                <EventRow key={n.id} kind="NCR" id={n.id} title={n.title}
                  meta={`${n.priority} · ${n.status}`}
                  onClick={() => { setNcr(n.id); setRoute('ncr-detail'); }}/>
              ))}
              {related8ds.map(e => (
                <EventRow key={e.id} kind="8D" id={e.id} title={e.title}
                  meta={`D${e.currentStep} · ${e.status}`}
                  onClick={() => { set8d(e.id); setRoute('8d-detail'); }}/>
              ))}
              {relatedScars.map(sc => (
                <EventRow key={sc.id} kind="SCAR" id={sc.id} title={sc.title}
                  meta={`${sc.severity} · D${sc.currentD} · ${sc.status.replace(/_/g, ' ')}`}
                  onClick={() => setRoute('suppliers-scar')}/>
              ))}
            </div>
          )}
        </Card>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <Card title="Audit history" desc={`Last: ${s.lastAudit} · Next: ${s.nextAudit}`}>
            {relatedAudits.length === 0 ? (
              <EmptyState icon="audit" title="No audits linked" body="Schedule a baseline audit."
                action={<button className="k-btn k-btn-secondary k-btn-sm">Schedule</button>}/>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {relatedAudits.map((a, i) => (
                  <div key={i} onClick={() => { setAudit && setAudit(a.id); setRoute(a.id.startsWith('AUD') ? 'audit-detail' : 'inspection-detail'); }}
                    style={{ padding: 8, border: '1px solid var(--border)', borderRadius: 'var(--r-md)', cursor: 'pointer', fontSize: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span className="mono" style={{ fontSize: 11, color: 'var(--accent)' }}>{a.id}</span>
                      <span style={{ fontWeight: 600 }}>{a.title}</span>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                      {a.standard || a.template} · score {a.score || '—'} · {a.completed || a.plannedEnd}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card title="Chargebacks (YTD)">
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 28, fontWeight: 700, color: '#7c3aed' }}>${(s.chargebacksYtd / 1000).toFixed(1)}k</span>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>across {relatedScars.length} SCARs</span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>Breakdown</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {[
                { l: 'Premium freight', v: Math.round(s.chargebacksYtd * 0.35) },
                { l: 'Rework labor', v: Math.round(s.chargebacksYtd * 0.42) },
                { l: 'Scrap', v: Math.round(s.chargebacksYtd * 0.18) },
                { l: 'Admin / handling', v: Math.round(s.chargebacksYtd * 0.05) },
              ].map(r => (
                <div key={r.l} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5 }}>
                  <span style={{ color: 'var(--text-muted)' }}>{r.l}</span>
                  <span className="mono" style={{ fontWeight: 600 }}>${r.v.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      {/* RIGHT: meta + actions */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Card title="Compliance posture">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <CompRow label="IATF 16949" value={s.iatfCert} ok={s.iatfCert !== '—'}/>
            <CompRow label="Environmental / health" value={s.isoCert} ok={true}/>
            <CompRow label="Cert expires" value={s.certExpires} ok={!s.flags?.includes('cert-expiring')}/>
            <CompRow label="Last audit" value={s.lastAudit} ok={s.lastAudit !== 'never'}/>
            <CompRow label="Next audit" value={s.nextAudit} ok={true}/>
          </div>
        </Card>

        <Card title="Parts supplied">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {s.parts.map(p => (
              <div key={p} style={{ padding: 8, background: 'var(--bg-subtle)', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Icon name="package" size={13} style={{ color: 'var(--accent)' }}/>
                <span className="mono" style={{ fontSize: 12, fontWeight: 500 }}>{p}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card title="Quick actions">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <button className="k-btn k-btn-secondary" style={{ justifyContent: 'flex-start' }}><Icon name="alert" size={12}/> Raise new SCAR</button>
            <button className="k-btn k-btn-secondary" style={{ justifyContent: 'flex-start' }}><Icon name="audit" size={12}/> Schedule audit</button>
            <button className="k-btn k-btn-secondary" style={{ justifyContent: 'flex-start' }}><Icon name="fileText" size={12}/> Request PPAP refresh</button>
            <button className="k-btn k-btn-secondary" style={{ justifyContent: 'flex-start' }}><Icon name="mail" size={12}/> Email Quality contact</button>
            <button className="k-btn k-btn-secondary" style={{ justifyContent: 'flex-start' }}><Icon name="download" size={12}/> Export scorecard PDF</button>
          </div>
        </Card>
      </div>
    </div>
  );
}

const CompRow = ({ label, value, ok }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 4 }}>
    <div style={{ width: 8, height: 8, borderRadius: '50%', background: ok ? '#22c55e' : '#dc2626', flexShrink: 0 }}/>
    <span style={{ fontSize: 11.5, color: 'var(--text-muted)', minWidth: 100 }}>{label}</span>
    <span style={{ fontSize: 12, fontWeight: 500, marginLeft: 'auto', textAlign: 'right' }}>{value}</span>
  </div>
);

const EventRow = ({ kind, id, title, meta, onClick }) => (
  <div onClick={onClick} style={{ padding: 10, border: '1px solid var(--border)', borderRadius: 'var(--r-md)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10 }}>
    <span className="k-chip" style={{
      background: kind === 'NCR' ? 'rgba(220,38,38,0.08)' : kind === '8D' ? 'rgba(99,102,241,0.10)' : 'rgba(234,88,12,0.10)',
      color: kind === 'NCR' ? '#b91c1c' : kind === '8D' ? '#4338ca' : '#9a3412',
      fontSize: 10, fontWeight: 700,
    }}>{kind}</span>
    <span className="mono" style={{ fontSize: 11.5, color: 'var(--accent)' }}>{id}</span>
    <span style={{ fontSize: 12.5, fontWeight: 500, flex: 1 }}>{title}</span>
    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{meta}</span>
    <Icon name="chevronRight" size={14} style={{ color: 'var(--text-muted)' }}/>
  </div>
);


// ─── Big spark with target line ───
const BigSpark = ({ data, target, lowerIsBetter, suffix = '' }) => {
  if (!data) return null;
  const w = 720, h = 140, pad = { l: 36, r: 8, t: 12, b: 22 };
  const xs = data.map((_, i) => pad.l + (i / (data.length - 1)) * (w - pad.l - pad.r));
  const all = [...data, target];
  const max = Math.max(...all) * 1.1, min = Math.min(...all, 0) * 0.9;
  const range = max - min || 1;
  const y = v => h - pad.b - ((v - min) / range) * (h - pad.t - pad.b);
  const pts = data.map((v, i) => `${xs[i]},${y(v)}`).join(' ');
  const months = ['May','Jun','Jul','Aug','Sep','Oct','Nov','Dec','Jan','Feb','Mar','Apr'];

  return (
    <svg width="100%" viewBox={`0 0 ${w} ${h}`} style={{ display: 'block' }}>
      {/* Target band */}
      <line x1={pad.l} x2={w - pad.r} y1={y(target)} y2={y(target)} stroke="#94a3b8" strokeWidth="1" strokeDasharray="4,3"/>
      <text x={w - pad.r} y={y(target) - 4} fontSize="10" fill="#64748b" textAnchor="end">Target {target}{suffix}</text>

      {/* Fill area */}
      <polyline points={`${xs[0]},${h - pad.b} ${pts} ${xs[xs.length - 1]},${h - pad.b}`} fill="rgba(37,99,235,0.08)" stroke="none"/>
      <polyline points={pts} fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>

      {/* Points */}
      {data.map((v, i) => {
        const bad = lowerIsBetter ? v > target : v < target;
        return <circle key={i} cx={xs[i]} cy={y(v)} r="3" fill={bad ? '#dc2626' : '#2563eb'}/>;
      })}

      {/* X labels */}
      {months.map((m, i) => i % 2 === 0 && (
        <text key={i} x={xs[i]} y={h - 6} fontSize="9.5" fill="#94a3b8" textAnchor="middle">{m}</text>
      ))}
    </svg>
  );
};


// ─── Scorecard tab — weighted KPI breakdown + radial ───
function SupplierScorecardDetail({ s, settings }) {
  const weights = settings?.supplierWeights || { ppm: 35, otd: 25, oqe: 25, scar: 15 };
  // Component scores (0-100)
  const ppmScore = s.tier === 'Raw material'
    ? Math.max(0, Math.min(100, 100 - (s.materialRejectsPercent / s.materialRejectsTarget) * 50))
    : Math.max(0, Math.min(100, 100 - (s.ppmYtd / Math.max(s.ppmTarget, 1)) * 50));
  const otdScore = Math.max(0, Math.min(100, 100 - (s.otdTarget - s.otdYtd) * 5));
  const oqeScore = Math.max(0, Math.min(100, s.oqeYtd));
  const scarScore = Math.max(0, Math.min(100, 100 - ((s.scarHours - s.scarTarget) / Math.max(s.scarTarget, 1)) * 50));
  const total = (ppmScore * weights.ppm + otdScore * weights.otd + oqeScore * weights.oqe + scarScore * weights.scar) / 100;

  const tier = total >= 85 ? 'A' : total >= 70 ? 'B' : total >= 50 ? 'C' : 'D';

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 16 }}>
      <Card title="Scorecard breakdown" desc="Weighted composite score across the 4 KPI axes (configurable in Tweaks)">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <ScoreBar label="PPM defects" weight={weights.ppm} score={ppmScore} actual={s.tier === 'Raw material' ? s.materialRejectsPercent + '%' : s.ppmYtd + ' ppm'} target={s.tier === 'Raw material' ? '≤ ' + s.materialRejectsTarget + '%' : '≤ ' + s.ppmTarget + ' ppm'}/>
          <ScoreBar label="On-time delivery" weight={weights.otd} score={otdScore} actual={s.otdYtd + '%'} target={'≥ ' + s.otdTarget + '%'}/>
          <ScoreBar label="Overall quality eval" weight={weights.oqe} score={oqeScore} actual={s.oqeYtd} target={'≥ ' + s.oqeTarget}/>
          <ScoreBar label="SCAR responsiveness" weight={weights.scar} score={scarScore} actual={s.scarHours + 'h'} target={'≤ ' + s.scarTarget + 'h'}/>
        </div>

        <div style={{ marginTop: 22, padding: 14, background: 'var(--bg-subtle)', borderRadius: 'var(--r-md)' }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, marginBottom: 4 }}>Composite score</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
            <span style={{ fontSize: 40, fontWeight: 800, color: RISK_TIER[tier].fg, fontVariantNumeric: 'tabular-nums' }}>{total.toFixed(1)}</span>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>/ 100</span>
            <span style={{ marginLeft: 'auto' }}><RiskTierBadge tier={tier}/></span>
          </div>
          <div style={{ marginTop: 8, fontSize: 11.5, color: 'var(--text-muted)' }}>
            Recalculated nightly from the last 90 days of activity. Adjust weights in <strong>Tweaks → Supplier scoring</strong>.
          </div>
        </div>
      </Card>

      <Card title="Performance radar" desc="Current vs. target for this category">
        <RadarMini supplier={s}/>
        <div style={{ marginTop: 16 }} className="k-overline">Peer comparison · {s.category}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6 }}>
          {SUPPLIERS.filter(x => x.category === s.category && x.id !== s.id).slice(0, 4).map(peer => (
            <div key={peer.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 6 }}>
              <SupplierLogo supplier={peer} size={22}/>
              <span style={{ fontSize: 12, flex: 1 }}>{peer.name}</span>
              <RiskTierBadge tier={peer.riskTier}/>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', minWidth: 50, textAlign: 'right' }} className="mono">{peer.ppmYtd || peer.materialRejectsPercent + '%'} ppm</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

const ScoreBar = ({ label, weight, score, actual, target }) => {
  const color = score >= 85 ? '#16a34a' : score >= 70 ? '#3b82f6' : score >= 50 ? '#f59e0b' : '#dc2626';
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
        <span style={{ fontSize: 12.5, fontWeight: 600 }}>{label}</span>
        <span style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>weight {weight}%</span>
        <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-muted)' }}>{actual} · target {target}</span>
        <span style={{ fontSize: 13, fontWeight: 700, color, fontVariantNumeric: 'tabular-nums', minWidth: 36, textAlign: 'right' }}>{score.toFixed(0)}</span>
      </div>
      <div style={{ height: 8, background: 'var(--bg-subtle)', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ width: `${score}%`, height: '100%', background: color, transition: 'width 300ms' }}/>
      </div>
    </div>
  );
};

const RadarMini = ({ supplier }) => {
  const axes = ['PPM','OTD','OQE','SCAR','PPAP'];
  const values = [
    Math.max(0, 100 - (supplier.ppmYtd / Math.max(supplier.ppmTarget, 1)) * 50),
    Math.min(100, supplier.otdYtd),
    supplier.oqeYtd,
    Math.max(0, 100 - ((supplier.scarHours - supplier.scarTarget) / Math.max(supplier.scarTarget, 1)) * 50),
    supplier.ppapPrograms?.length ? 88 : 60,
  ];
  const cx = 130, cy = 130, r = 86;
  const angle = i => (Math.PI * 2 * i) / axes.length - Math.PI / 2;
  const point = (i, v) => [cx + Math.cos(angle(i)) * (r * v / 100), cy + Math.sin(angle(i)) * (r * v / 100)];

  return (
    <svg width={260} height={260} viewBox="0 0 260 260">
      {[20, 40, 60, 80, 100].map(p => (
        <polygon key={p} points={axes.map((_, i) => point(i, p).join(',')).join(' ')} fill="none" stroke="var(--border)" strokeWidth="0.5"/>
      ))}
      {axes.map((a, i) => {
        const [x, y] = point(i, 110);
        return (
          <g key={a}>
            <line x1={cx} y1={cy} x2={point(i, 100)[0]} y2={point(i, 100)[1]} stroke="var(--border)" strokeWidth="0.5"/>
            <text x={x} y={y} fontSize="10" fill="var(--text-muted)" textAnchor="middle" dominantBaseline="middle">{a}</text>
          </g>
        );
      })}
      <polygon
        points={axes.map((_, i) => point(i, values[i]).join(',')).join(' ')}
        fill="rgba(37,99,235,0.15)" stroke="#2563eb" strokeWidth="1.5"
      />
      {axes.map((_, i) => {
        const [px, py] = point(i, values[i]);
        return <circle key={i} cx={px} cy={py} r="3" fill="#2563eb"/>;
      })}
    </svg>
  );
};


// ─── PPAP tab ───
function SupplierPpapTab({ s, relatedPpaps, setRoute }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
      <Card title="Active submissions" desc="In-flight PPAPs for this supplier">
        {relatedPpaps.length === 0 ? (
          <EmptyState icon="fileText" title="No active submissions"/>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {relatedPpaps.map(p => (
              <div key={p.id} onClick={() => setRoute('suppliers-ppap-detail')} style={{ padding: 12, border: '1px solid var(--border)', borderRadius: 'var(--r-md)', cursor: 'pointer' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="mono" style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 600 }}>{p.id}</span>
                  <PpapStatusBadge status={p.status}/>
                  <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-muted)' }}>Level {p.level} · {p.customer}</span>
                </div>
                <div style={{ fontSize: 13, fontWeight: 600, marginTop: 6 }}>{p.part} — {p.programName}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Submitted {p.submittedDate} · Due {p.dueDate} · {p.daysOpen}d open</div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card title="Approved programs" desc="Production-released PPAPs (historical)">
        {(s.ppapPrograms || []).length === 0 ? (
          <EmptyState icon="fileText" title="No PPAP records" body={s.tier === 'Raw material' ? 'Raw material suppliers use Certificate of Analysis instead.' : 'Awaiting first submission.'}/>
        ) : (
          <table className="k-table" style={{ width: '100%' }}>
            <thead><tr><th>Part</th><th>Level</th><th>Status</th><th>Date</th></tr></thead>
            <tbody>
              {(s.ppapPrograms || []).map((p, i) => (
                <tr key={i}>
                  <td className="mono" style={{ fontSize: 11.5 }}>{p.part}</td>
                  <td>Level {p.level}</td>
                  <td><PpapStatusBadge status={p.status}/></td>
                  <td style={{ fontSize: 11.5 }} className="mono">{p.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}

const PpapStatusBadge = ({ status }) => {
  const map = {
    approved: { l: 'Approved', bg: 'rgba(34,197,94,0.10)', fg: 'var(--success-700)' },
    in_review: { l: 'In review', bg: 'rgba(245,158,11,0.12)', fg: '#92400e' },
    pending: { l: 'Pending', bg: 'rgba(99,102,241,0.10)', fg: '#4338ca' },
    conditional: { l: 'Conditional', bg: 'rgba(245,158,11,0.12)', fg: '#92400e' },
    rejected: { l: 'Rejected', bg: 'rgba(220,38,38,0.10)', fg: '#b91c1c' },
    changes_requested: { l: 'Changes requested', bg: 'rgba(234,88,12,0.10)', fg: '#9a3412' },
    n_a: { l: 'N/A', bg: 'var(--bg-subtle)', fg: 'var(--text-muted)' },
  };
  const s = map[status] || map.pending;
  return <span className="k-chip" style={{ background: s.bg, color: s.fg, fontSize: 10.5 }}>{s.l}</span>;
};


// ─── Events tab — all NCRs, 8Ds, complaints, SCARs ───
function SupplierEventsTab({ s, relatedNcrs, related8ds, relatedScars, setRoute, setNcr, set8d }) {
  return (
    <Card title="Quality events timeline" desc="All cross-referenced items from NCR, 8D, Complaints, and SCAR modules">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {relatedNcrs.map(n => (
          <EventRow key={n.id} kind="NCR" id={n.id} title={n.title} meta={`Created ${n.createdAt?.slice(0, 10) || '—'} · ${n.status}`} onClick={() => { setNcr(n.id); setRoute('ncr-detail'); }}/>
        ))}
        {related8ds.map(e => (
          <EventRow key={e.id} kind="8D" id={e.id} title={e.title} meta={`D${e.currentStep} of 8 · ${e.status}`} onClick={() => { set8d(e.id); setRoute('8d-detail'); }}/>
        ))}
        {relatedScars.map(sc => (
          <EventRow key={sc.id} kind="SCAR" id={sc.id} title={sc.title} meta={`${sc.severity} · ${sc.status} · ${sc.daysOpen}d open · $${sc.chargebackAmount.toLocaleString()}`} onClick={() => setRoute('suppliers-scar')}/>
        ))}
        {relatedNcrs.length + related8ds.length + relatedScars.length === 0 && (
          <EmptyState icon="check" title="Clean record" body="No NCRs, 8Ds, complaints, or SCARs in the last 90 days."/>
        )}
      </div>
    </Card>
  );
}


// ─── Audits tab ───
function SupplierAuditsTab({ s, relatedAudits, setRoute, setAudit }) {
  return (
    <Card title="Audit & inspection history" desc={`Last audit: ${s.lastAudit} · Next due: ${s.nextAudit}`}>
      <table className="k-table" style={{ width: '100%' }}>
        <thead><tr><th>ID</th><th>Type</th><th>Standard / Template</th><th>Score</th><th>Findings</th><th>Date</th></tr></thead>
        <tbody>
          {relatedAudits.length === 0 && (
            <tr><td colSpan="6"><EmptyState icon="audit" title="No audits linked"/></td></tr>
          )}
          {relatedAudits.map((a, i) => (
            <tr key={i} onClick={() => { setAudit && setAudit(a.id); setRoute(a.id.startsWith('AUD') ? 'audit-detail' : 'inspection-detail'); }} style={{ cursor: 'pointer' }}>
              <td className="mono" style={{ fontSize: 11.5, color: 'var(--accent)' }}>{a.id}</td>
              <td>{a.type || 'Inspection'}</td>
              <td>{a.standard || a.template}</td>
              <td className="mono">{a.score || '—'}</td>
              <td>{a.findings ? (typeof a.findings === 'object' ? `${a.findings.major}M / ${a.findings.minor}m` : a.findings) : '0'}</td>
              <td className="mono" style={{ fontSize: 11.5 }}>{a.completed || a.plannedEnd}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

// ─── Parts tab ───
function SupplierPartsTab({ s }) {
  return (
    <Card title="Parts portfolio" desc={`${s.parts.length} parts shipped — ${s.partsPerMonth.toLocaleString()} ${s.partsUnit || 'units'}/mo`}>
      <table className="k-table" style={{ width: '100%' }}>
        <thead><tr><th>Part</th><th>Rev</th><th>Volume / mo</th><th>PPAP level</th><th>Last shipment</th><th>Status</th></tr></thead>
        <tbody>
          {s.parts.map((p, i) => (
            <tr key={p}>
              <td className="mono" style={{ fontSize: 12, fontWeight: 600 }}>{p}</td>
              <td>{['A','B','C','—'][i % 4]}</td>
              <td className="mono">{Math.round(s.partsPerMonth / s.parts.length).toLocaleString()}</td>
              <td>{s.ppapPrograms?.find(pp => pp.part === p) ? `Level ${s.ppapPrograms.find(pp => pp.part === p).level}` : '—'}</td>
              <td className="mono" style={{ fontSize: 11.5 }}>2026-04-18</td>
              <td><StatusBadge status="active"/></td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

// ─── Docs tab ───
function SupplierDocsTab({ s }) {
  return (
    <Card title="Supplier documents" desc="Certifications, signed agreements, audit reports">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
        {[
          { name: 'IATF 16949 certificate', date: s.certExpires, kind: 'cert', icon: 'shieldCheck' },
          { name: 'ISO 14001 certificate', date: s.certExpires, kind: 'cert', icon: 'shieldCheck' },
          { name: 'Signed quality agreement', date: s.contractStart, kind: 'contract', icon: 'fileText' },
          { name: 'NDA — current revision', date: s.contractStart, kind: 'contract', icon: 'lock' },
          { name: `Last audit report — ${s.lastAudit}`, date: s.lastAudit, kind: 'audit', icon: 'audit' },
          { name: 'Latest PPAP package', date: s.ppapPrograms?.[0]?.date || '—', kind: 'ppap', icon: 'package' },
        ].map((d, i) => (
          <div key={i} style={{ padding: 12, border: '1px solid var(--border)', borderRadius: 'var(--r-md)', display: 'flex', alignItems: 'center', gap: 10 }}>
            <Icon name={d.icon} size={20} style={{ color: 'var(--accent)' }}/>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600 }}>{d.name}</div>
              <div className="mono" style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>{d.date}</div>
            </div>
            <button className="k-btn k-btn-secondary k-btn-sm"><Icon name="download" size={11}/></button>
          </div>
        ))}
      </div>
    </Card>
  );
}


// ─────────────────────────────────────────────────────────────
// SUPPLIER SCORECARDS HUB
// ─────────────────────────────────────────────────────────────
function SupplierScorecards({ setRoute, setSupplier }) {
  return (
    <div>
      <PageHeader
        title="Supplier scorecards"
        description="Composite KPI scoring across the 216 active suppliers. Weights configurable in Tweaks."
        actions={
          <>
            <button className="k-btn k-btn-ghost"><Icon name="download" size={13}/> Export all</button>
            <button className="k-btn k-btn-primary"><Icon name="mail" size={13}/> Email to suppliers</button>
          </>
        }
      />
      <div style={{ padding: '20px 28px 32px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
          <Card title="Tier distribution" desc="216 suppliers · 90-day rolling composite">
            <TierBars/>
          </Card>
          <Card title="Spend at risk" desc="$ exposed to non-preferred tiers">
            <SpendAtRisk/>
          </Card>
        </div>

        <Card title="Top suppliers — composite score" desc="Click a row to open Supplier 360">
          <table className="k-table" style={{ width: '100%' }}>
            <thead><tr>
              <th>Supplier</th><th>Tier</th><th>PPM</th><th>OTD</th><th>OQE</th><th>SCAR</th><th>Composite</th><th>vs LM</th>
            </tr></thead>
            <tbody>
              {[...SUPPLIERS].sort((a, b) => a.riskTier.localeCompare(b.riskTier)).map(s => {
                const ppm = Math.min(100, s.tier === 'Raw material' ? Math.max(0, 100 - (s.materialRejectsPercent / s.materialRejectsTarget) * 50) : Math.max(0, 100 - (s.ppmYtd / Math.max(s.ppmTarget, 1)) * 50));
                const otd = Math.max(0, Math.min(100, 100 - (s.otdTarget - s.otdYtd) * 5));
                const oqe = Math.min(100, s.oqeYtd);
                const scar = Math.min(100, Math.max(0, 100 - ((s.scarHours - s.scarTarget) / Math.max(s.scarTarget, 1)) * 50));
                const comp = (ppm * 0.35 + otd * 0.25 + oqe * 0.25 + scar * 0.15);
                const delta = ((Math.random() - 0.5) * 6).toFixed(1);
                return (
                  <tr key={s.id} onClick={() => { setSupplier(s.id); setRoute('supplier-detail'); }} style={{ cursor: 'pointer' }}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <SupplierLogo supplier={s} size={26}/>
                        <span style={{ fontSize: 12.5, fontWeight: 600 }}>{s.name}</span>
                      </div>
                    </td>
                    <td><RiskTierBadge tier={s.riskTier}/></td>
                    <td><MiniBar v={ppm}/></td>
                    <td><MiniBar v={otd}/></td>
                    <td><MiniBar v={oqe}/></td>
                    <td><MiniBar v={scar}/></td>
                    <td>
                      <span style={{ fontWeight: 700, fontSize: 14, color: RISK_TIER[s.riskTier].fg, fontVariantNumeric: 'tabular-nums' }}>{comp.toFixed(1)}</span>
                    </td>
                    <td>
                      <span style={{ fontSize: 12, fontWeight: 600, color: parseFloat(delta) >= 0 ? '#16a34a' : '#dc2626', fontVariantNumeric: 'tabular-nums' }}>
                        {parseFloat(delta) >= 0 ? '▲' : '▼'} {Math.abs(parseFloat(delta))}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  );
}

const MiniBar = ({ v }) => {
  const color = v >= 85 ? '#16a34a' : v >= 70 ? '#3b82f6' : v >= 50 ? '#f59e0b' : '#dc2626';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{ width: 60, height: 6, background: 'var(--bg-subtle)', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ width: `${v}%`, height: '100%', background: color }}/>
      </div>
      <span style={{ fontSize: 11, fontWeight: 600, color, fontVariantNumeric: 'tabular-nums', minWidth: 26 }}>{v.toFixed(0)}</span>
    </div>
  );
};

const TierBars = () => {
  const counts = { A: 0, B: 0, C: 0, D: 0 };
  SUPPLIERS.forEach(s => counts[s.riskTier]++);
  const total = SUPPLIERS.length;
  // Synthetic to make 216 supplier population realistic
  const real = { A: 78, B: 102, C: 28, D: 8 };
  const realTotal = real.A + real.B + real.C + real.D;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {['A','B','C','D'].map(t => {
        const pct = (real[t] / realTotal) * 100;
        return (
          <div key={t}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
              <RiskTierBadge tier={t}/>
              <span style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{real[t]}</span>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', minWidth: 38, textAlign: 'right' }}>{pct.toFixed(1)}%</span>
            </div>
            <div style={{ height: 8, background: 'var(--bg-subtle)', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ width: `${pct}%`, height: '100%', background: RISK_TIER[t].dot }}/>
            </div>
          </div>
        );
      })}
    </div>
  );
};

const SpendAtRisk = () => {
  const segments = [
    { tier: 'A', spend: 28.4, color: '#22c55e' },
    { tier: 'B', spend: 18.2, color: '#3b82f6' },
    { tier: 'C', spend: 4.1, color: '#f59e0b' },
    { tier: 'D', spend: 1.6, color: '#dc2626' },
  ];
  const total = segments.reduce((s, x) => s + x.spend, 0);
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 14 }}>
        <span style={{ fontSize: 28, fontWeight: 700, color: '#dc2626', fontVariantNumeric: 'tabular-nums' }}>$5.7M</span>
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>at tiers C + D (10.9% of YTD spend)</span>
      </div>
      {/* Stacked bar */}
      <div style={{ display: 'flex', height: 18, borderRadius: 4, overflow: 'hidden', marginBottom: 10 }}>
        {segments.map(seg => (
          <div key={seg.tier} style={{ flex: seg.spend, background: seg.color, position: 'relative' }} title={`Tier ${seg.tier}: $${seg.spend}M`}/>
        ))}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {segments.map(seg => (
          <div key={seg.tier} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: seg.color }}/>
            <span style={{ color: 'var(--text-muted)' }}>Tier {seg.tier}</span>
            <span style={{ marginLeft: 'auto', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>${seg.spend}M</span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', minWidth: 50, textAlign: 'right' }}>{((seg.spend / total) * 100).toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
};


// ─────────────────────────────────────────────────────────────
// SUPPLIER RISK MATRIX
// ─────────────────────────────────────────────────────────────
function SupplierRiskMatrix({ setRoute, setSupplier, settings }) {
  // 2D plot: x = spend ($M, log scale), y = composite risk score (inverted)
  const [hover, setHover] = React.useState(null);
  const thresholds = settings?.riskThresholds || { A: 85, B: 70, C: 50 };

  return (
    <div>
      <PageHeader
        title="Supplier risk matrix"
        description="Spend vs. quality composite. Upper-right = high-risk + high-spend = priority. Configurable thresholds in Tweaks."
        actions={
          <>
            <button className="k-btn k-btn-ghost"><Icon name="filter" size={13}/> Filter</button>
            <button className="k-btn k-btn-primary"><Icon name="download" size={13}/> Risk pack</button>
          </>
        }
      />
      <div style={{ padding: '20px 28px 32px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 16 }}>
          <Card title="Risk × Spend bubble plot" desc="Each bubble = 1 supplier. Size = parts/month volume.">
            <RiskBubble suppliers={SUPPLIERS} onHover={setHover} onSelect={(id) => { setSupplier(id); setRoute('supplier-detail'); }} thresholds={thresholds}/>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 12, fontSize: 11, color: 'var(--text-muted)' }}>
              <span>Quadrants:</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 10, height: 10, background: 'rgba(220,38,38,0.20)' }}/> Critical (high spend, high risk)</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 10, height: 10, background: 'rgba(245,158,11,0.20)' }}/> Monitor</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 10, height: 10, background: 'rgba(34,197,94,0.20)' }}/> Healthy</span>
            </div>
          </Card>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Card title="Hovering">
              {hover ? (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <SupplierLogo supplier={hover} size={32}/>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{hover.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{hover.tier} · {hover.category}</div>
                    </div>
                  </div>
                  <RiskTierBadge tier={hover.riskTier}/>
                  <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6, fontSize: 11 }}>
                    <div><span style={{ color: 'var(--text-muted)' }}>Spend YTD</span><div className="mono" style={{ fontWeight: 600 }}>${(hover.spendYtd / 1_000_000).toFixed(2)}M</div></div>
                    <div><span style={{ color: 'var(--text-muted)' }}>PPM</span><div className="mono" style={{ fontWeight: 600 }}>{hover.ppmYtd || hover.materialRejectsPercent + '%'}</div></div>
                    <div><span style={{ color: 'var(--text-muted)' }}>OTD</span><div className="mono" style={{ fontWeight: 600 }}>{hover.otdYtd}%</div></div>
                    <div><span style={{ color: 'var(--text-muted)' }}>Chargebacks</span><div className="mono" style={{ fontWeight: 600 }}>${(hover.chargebacksYtd / 1000).toFixed(0)}k</div></div>
                  </div>
                </div>
              ) : (
                <div style={{ fontSize: 11.5, color: 'var(--text-muted)', textAlign: 'center', padding: '20px 0' }}>Hover a bubble to see details</div>
              )}
            </Card>

            <Card title="AI-flagged risks">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {SUPPLIERS.filter(s => s.aiInsights?.some(i => i.kind === 'risk' || i.kind === 'anomaly')).map(s => (
                  <div key={s.id} onClick={() => { setSupplier(s.id); setRoute('supplier-detail'); }} style={{ padding: 8, border: '1px solid rgba(220,38,38,0.25)', background: 'rgba(220,38,38,0.04)', borderRadius: 'var(--r-md)', cursor: 'pointer' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                      <Icon name="sparkles" size={12} style={{ color: '#6366f1' }}/>
                      <span style={{ fontSize: 12, fontWeight: 600 }}>{s.name}</span>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      {s.aiInsights.find(i => i.kind === 'risk' || i.kind === 'anomaly')?.text}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

const RiskBubble = ({ suppliers, onHover, onSelect, thresholds }) => {
  const w = 760, h = 440, pad = { l: 60, r: 24, t: 24, b: 40 };
  const composite = (s) => {
    const ppm = s.tier === 'Raw material' ? Math.max(0, 100 - (s.materialRejectsPercent / s.materialRejectsTarget) * 50) : Math.max(0, 100 - (s.ppmYtd / Math.max(s.ppmTarget, 1)) * 50);
    const otd = Math.max(0, Math.min(100, 100 - (s.otdTarget - s.otdYtd) * 5));
    return (ppm * 0.35 + otd * 0.25 + s.oqeYtd * 0.25 + Math.max(0, 100 - ((s.scarHours - s.scarTarget) / Math.max(s.scarTarget, 1)) * 50) * 0.15);
  };
  const xLog = (s) => Math.log10(s.spendYtd / 1000);
  const xs = suppliers.map(xLog);
  const xMin = Math.min(...xs) - 0.2, xMax = Math.max(...xs) + 0.2;
  const xRange = xMax - xMin;

  const px = (s) => pad.l + ((xLog(s) - xMin) / xRange) * (w - pad.l - pad.r);
  const py = (score) => pad.t + ((100 - score) / 100) * (h - pad.t - pad.b);
  const rad = (s) => Math.max(8, Math.min(28, Math.sqrt((s.partsPerMonth || 1000) / 1000) * 1.5));

  // Threshold lines
  const yA = py(thresholds.A), yB = py(thresholds.B), yC = py(thresholds.C);
  // Spend threshold (median)
  const medianSpend = [...xs].sort((a,b)=>a-b)[Math.floor(xs.length/2)];
  const xMid = pad.l + ((medianSpend - xMin) / xRange) * (w - pad.l - pad.r);

  return (
    <svg width="100%" viewBox={`0 0 ${w} ${h}`} style={{ display: 'block' }}>
      {/* Quadrant fills */}
      <rect x={xMid} y={pad.t} width={w - pad.r - xMid} height={yB - pad.t} fill="rgba(220,38,38,0.08)"/>
      <rect x={pad.l} y={pad.t} width={xMid - pad.l} height={yB - pad.t} fill="rgba(245,158,11,0.06)"/>
      <rect x={xMid} y={yB} width={w - pad.r - xMid} height={h - pad.b - yB} fill="rgba(245,158,11,0.06)"/>
      <rect x={pad.l} y={yB} width={xMid - pad.l} height={h - pad.b - yB} fill="rgba(34,197,94,0.06)"/>

      {/* Threshold horizontal lines (A/B/C cuts) */}
      {[yA, yB, yC].map((y, i) => (
        <g key={i}>
          <line x1={pad.l} x2={w - pad.r} y1={y} y2={y} stroke="var(--border)" strokeWidth="1" strokeDasharray="3,3"/>
          <text x={pad.l - 8} y={y + 3} fontSize="10" fill="var(--text-muted)" textAnchor="end">{['A','B','C'][i]}</text>
        </g>
      ))}

      {/* Median spend vertical */}
      <line x1={xMid} x2={xMid} y1={pad.t} y2={h - pad.b} stroke="var(--border)" strokeWidth="1" strokeDasharray="3,3"/>

      {/* Axes */}
      <line x1={pad.l} x2={w - pad.r} y1={h - pad.b} y2={h - pad.b} stroke="var(--border)"/>
      <line x1={pad.l} x2={pad.l} y1={pad.t} y2={h - pad.b} stroke="var(--border)"/>
      <text x={(w + pad.l - pad.r) / 2} y={h - 8} fontSize="11" fill="var(--text-muted)" textAnchor="middle">Spend (log scale, $k YTD →)</text>
      <text x={14} y={(h - pad.b + pad.t) / 2} fontSize="11" fill="var(--text-muted)" transform={`rotate(-90 14 ${(h - pad.b + pad.t) / 2})`} textAnchor="middle">Composite quality score ↑</text>

      {/* Bubbles */}
      {suppliers.map(s => {
        const score = composite(s);
        const r = rad(s);
        const c = RISK_TIER[s.riskTier].dot;
        return (
          <g key={s.id} onMouseEnter={() => onHover(s)} onMouseLeave={() => onHover(null)} onClick={() => onSelect(s.id)} style={{ cursor: 'pointer' }}>
            <circle cx={px(s)} cy={py(score)} r={r} fill={c} fillOpacity="0.4" stroke={c} strokeWidth="1.5"/>
            <text x={px(s)} y={py(score) + 3} fontSize="9" fill={c} fontWeight="700" textAnchor="middle">{s.code}</text>
          </g>
        );
      })}
    </svg>
  );
};


Object.assign(window, { SupplierList, SupplierDetail, SupplierScorecards, SupplierRiskMatrix, RISK_TIER, RiskTierBadge, SupplierLogo, MiniSpark, PpapStatusBadge });
