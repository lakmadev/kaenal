// Kaenal — Supplier PPAP submissions list/detail + SCAR / Chargeback workflow

// ─────────────────────────────────────────────────────────────
// PPAP LIST — all submissions across suppliers
// ─────────────────────────────────────────────────────────────
function PpapSubmissionsList({ setRoute, setSupplier, setPpap }) {
  const [tab, setTab] = React.useState('active');
  const counts = {
    active: PPAP_SUBMISSIONS.filter(p => p.status === 'in_review' || p.status === 'pending' || p.status === 'changes_requested').length,
    approved: PPAP_SUBMISSIONS.filter(p => p.status === 'approved').length,
    rejected: PPAP_SUBMISSIONS.filter(p => p.status === 'rejected').length,
    all: PPAP_SUBMISSIONS.length,
  };
  const tabs = [
    { id: 'active', l: `Active (${counts.active})` },
    { id: 'approved', l: `Approved (${counts.approved})` },
    { id: 'rejected', l: `Rejected (${counts.rejected})` },
    { id: 'all', l: `All (${counts.all})` },
  ];
  let rows = PPAP_SUBMISSIONS;
  if (tab === 'active') rows = rows.filter(p => p.status === 'in_review' || p.status === 'pending' || p.status === 'changes_requested');
  if (tab === 'approved') rows = rows.filter(p => p.status === 'approved');
  if (tab === 'rejected') rows = rows.filter(p => p.status === 'rejected');

  return (
    <div>
      <PageHeader
        title="PPAP submissions"
        description="Production Part Approval Process — 18-element workpackages from suppliers. AIAG / Customer-Specific levels 1–5."
        actions={
          <>
            <button className="k-btn k-btn-ghost"><Icon name="download" size={13}/> Customer pack</button>
            <button className="k-btn k-btn-primary"><Icon name="plus" size={13}/> Request PPAP</button>
          </>
        }
      />
      <div style={{ padding: '20px 28px 32px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 18 }}>
          {[
            { l: 'In review', v: counts.active, c: '#f59e0b', s: '3 with changes requested' },
            { l: 'AI-predicted delays', v: 2, c: '#dc2626', s: 'Likely to miss customer date' },
            { l: 'Approved YTD', v: 38, c: '#16a34a', s: '92% first-time approval' },
            { l: 'Avg cycle time', v: '17d', c: 'var(--primary-700)', s: 'target ≤ 21d' },
          ].map(k => (
            <div key={k.l} className="k-surface" style={{ padding: 12 }}>
              <div style={{ fontSize: 10.5, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>{k.l}</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: k.c }}>{k.v}</div>
              <div style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>{k.s}</div>
            </div>
          ))}
        </div>

        <div className="k-tabs" style={{ marginBottom: 14 }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} className={`k-tab ${tab === t.id ? 'active' : ''}`}>{t.l}</button>
          ))}
        </div>

        <div className="k-surface" style={{ overflow: 'hidden' }}>
          <table className="k-table" style={{ width: '100%' }}>
            <thead>
              <tr><th>PPAP ID</th><th>Supplier</th><th>Part / Program</th><th>Level</th><th>Customer</th><th>Status</th><th>Due</th><th>Days open</th><th></th></tr>
            </thead>
            <tbody>
              {rows.map(p => {
                const supplier = SUPPLIERS.find(s => s.id === p.supplierId);
                return (
                  <tr key={p.id} onClick={() => { setPpap(p.id); setRoute('ppap-detail'); }} style={{ cursor: 'pointer' }}>
                    <td className="mono" style={{ fontSize: 11.5, color: 'var(--accent)' }}>{p.id}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {supplier && <SupplierLogo supplier={supplier} size={24}/>}
                        <span style={{ fontSize: 12.5, fontWeight: 600 }}>{p.supplierName}</span>
                      </div>
                    </td>
                    <td>
                      <div style={{ fontSize: 12.5, fontWeight: 500 }}>{p.part}</div>
                      <div style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>{p.programName}</div>
                    </td>
                    <td><span className="k-chip" style={{ background: 'var(--bg-subtle)' }}>Level {p.level}</span></td>
                    <td style={{ fontSize: 12 }}>{p.customer}</td>
                    <td><PpapStatusBadge status={p.status}/></td>
                    <td className="mono" style={{ fontSize: 11.5 }}>{p.dueDate}</td>
                    <td className="mono">{p.daysOpen}d</td>
                    <td><Icon name="chevronRight" size={14} style={{ color: 'var(--text-muted)' }}/></td>
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
// PPAP DETAIL — single submission with 18 elements
// ─────────────────────────────────────────────────────────────
function PpapDetail({ id, setRoute, setSupplier, settings }) {
  const p = PPAP_SUBMISSIONS.find(x => x.id === id) || PPAP_SUBMISSIONS[0];
  const supplier = SUPPLIERS.find(s => s.id === p.supplierId);
  const elements = p.elements || [];

  const completedCount = elements.filter(e => e.status === 'approved' || e.status === 'n_a').length;
  const totalCount = elements.length;
  const progress = totalCount ? (completedCount / totalCount) * 100 : 0;

  const aiVisible = settings?.ai !== 'quiet';

  return (
    <div>
      <PageHeader
        title={`${p.id} — ${p.part}`}
        description={`${p.programName} · ${p.supplierName} · Level ${p.level} · ${p.customer}`}
        actions={
          <>
            <button className="k-btn k-btn-ghost"><Icon name="download" size={13}/> Export PSW pack</button>
            <button className="k-btn k-btn-ghost"><Icon name="mail" size={13}/> Notify supplier</button>
            <button className="k-btn k-btn-primary"><Icon name="check" size={13}/> Approve PPAP</button>
          </>
        }
      />

      <div style={{ padding: '16px 28px 32px' }}>
        {/* Header strip */}
        <div className="k-surface" style={{ padding: 16, marginBottom: 16, display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 16, alignItems: 'center' }}>
          {supplier && <SupplierLogo supplier={supplier} size={48} rounded={10}/>}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <PpapStatusBadge status={p.status}/>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Submitted {p.submittedDate} · Due {p.dueDate} · {p.daysOpen}d open</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ flex: 1 }}>
                <div style={{ height: 10, background: 'var(--bg-subtle)', borderRadius: 5, overflow: 'hidden' }}>
                  <div style={{ width: `${progress}%`, height: '100%', background: 'linear-gradient(90deg, #16a34a, #22c55e)', transition: 'width 300ms' }}/>
                </div>
              </div>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{completedCount}/{totalCount} elements complete</span>
            </div>
          </div>
          <div>
            <button onClick={() => { setSupplier(supplier.id); setRoute('supplier-detail'); }} className="k-btn k-btn-secondary">
              <Icon name="building" size={13}/> Open supplier 360
            </button>
          </div>
        </div>

        {/* AI prediction */}
        {aiVisible && p.aiPrediction && (
          <div style={{ marginBottom: 16, padding: 14, background: p.aiPrediction.willMissDeadline ? 'rgba(220,38,38,0.04)' : 'rgba(34,197,94,0.04)', border: `1px solid ${p.aiPrediction.willMissDeadline ? 'rgba(220,38,38,0.25)' : 'rgba(34,197,94,0.25)'}`, borderRadius: 'var(--r-lg)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <Icon name="sparkles" size={14} style={{ color: p.aiPrediction.willMissDeadline ? '#dc2626' : '#16a34a' }}/>
              <strong style={{ fontSize: 12 }}>AI delivery prediction · confidence {p.aiPrediction.confidence}%</strong>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text)' }}>
              {p.aiPrediction.willMissDeadline ? (
                <>Likely to miss customer date by <strong>~{p.aiPrediction.daysLikelyOver} days.</strong> {p.aiPrediction.reasoning}</>
              ) : (
                <>On track to meet customer date. {p.aiPrediction.reasoning}</>
              )}
            </div>
          </div>
        )}

        {/* 18 elements grid */}
        <Card title="PPAP elements" desc="AIAG PPAP 4th ed. — 18 elements. Click an element to view evidence & approve.">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
            {elements.map(el => (
              <PpapElementRow key={el.id} el={el}/>
            ))}
          </div>
        </Card>

        {/* History */}
        <Card title="Activity history">
          {(p.history || []).length === 0 ? (
            <EmptyState icon="history" title="No activity yet"/>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {p.history.map((h, i) => {
                const u = h.actor === 'sys' ? null : userById(h.actor);
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 8, borderBottom: i < p.history.length - 1 ? '1px solid var(--border)' : 'none' }}>
                    {u ? <Avatar user={u} size={24}/> : <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--bg-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="bot" size={13} style={{ color: 'var(--text-muted)' }}/></div>}
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12.5 }}>
                        <strong>{u?.name || 'System'}</strong> · {h.action}
                      </div>
                    </div>
                    <span className="mono" style={{ fontSize: 11, color: 'var(--text-muted)' }}>{h.date}</span>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

const PpapElementRow = ({ el }) => {
  const statusMap = {
    approved: { icon: 'check', color: '#16a34a' },
    pending: { icon: 'clock', color: '#94a3b8' },
    in_review: { icon: 'eye', color: '#f59e0b' },
    changes_requested: { icon: 'edit', color: '#ea580c' },
    rejected: { icon: 'x', color: '#dc2626' },
    n_a: { icon: 'x', color: '#cbd5e1' },
  };
  const s = statusMap[el.status] || statusMap.pending;
  return (
    <div style={{ padding: 10, border: '1px solid var(--border)', borderRadius: 'var(--r-md)', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
      <div style={{
        width: 26, height: 26, borderRadius: '50%', background: s.color, color: 'white',
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        <Icon name={s.icon} size={13} stroke={3}/>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 10.5, color: 'var(--text-muted)', fontWeight: 600 }}>#{el.id}</span>
          <span style={{ fontSize: 12.5, fontWeight: 600 }}>{el.name}</span>
        </div>
        {el.comment && (
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, padding: 6, background: 'rgba(234,88,12,0.04)', borderLeft: '2px solid #ea580c', borderRadius: 3 }}>
            {el.comment}
          </div>
        )}
      </div>
      <PpapStatusBadge status={el.status}/>
    </div>
  );
};


// ─────────────────────────────────────────────────────────────
// SCAR / CHARGEBACK WORKFLOW
// ─────────────────────────────────────────────────────────────
function ScarWorkflow({ setRoute, setSupplier, setNcr, set8d }) {
  const [tab, setTab] = React.useState('active');
  const counts = {
    active: SCARS.filter(s => s.status !== 'closed').length,
    closed: SCARS.filter(s => s.status === 'closed').length,
    overdue: SCARS.filter(s => s.status === 'overdue').length,
    chargebacks: SCARS.length,
  };
  const totalCharge = SCARS.reduce((s, x) => s + x.chargebackAmount, 0);
  const pendingCharge = SCARS.filter(x => x.chargebackStatus === 'pending').reduce((s, x) => s + x.chargebackAmount, 0);

  const tabs = [
    { id: 'active', l: `Active (${counts.active})` },
    { id: 'overdue', l: `Overdue (${counts.overdue})` },
    { id: 'closed', l: `Closed (${counts.closed})` },
    { id: 'chargebacks', l: 'Chargebacks' },
  ];
  let rows = SCARS;
  if (tab === 'active') rows = rows.filter(s => s.status !== 'closed');
  if (tab === 'overdue') rows = rows.filter(s => s.status === 'overdue');
  if (tab === 'closed') rows = rows.filter(s => s.status === 'closed');

  return (
    <div>
      <PageHeader
        title="SCAR & chargebacks"
        description="Supplier Corrective Action Requests — 8D-style problem solving with the supplier. Auto-generated debit memos."
        actions={
          <>
            <button className="k-btn k-btn-ghost"><Icon name="download" size={13}/> Debit memo batch</button>
            <button className="k-btn k-btn-primary"><Icon name="alert" size={13}/> Raise SCAR</button>
          </>
        }
      />
      <div style={{ padding: '20px 28px 32px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 18 }}>
          {[
            { l: 'Active SCARs', v: counts.active, c: '#f59e0b', s: `${counts.overdue} overdue` },
            { l: 'Chargebacks YTD', v: '$' + (totalCharge / 1000).toFixed(0) + 'k', c: '#7c3aed', s: 'across ' + SCARS.length + ' SCARs' },
            { l: 'Pending recovery', v: '$' + (pendingCharge / 1000).toFixed(0) + 'k', c: '#dc2626', s: 'debit not yet issued' },
            { l: 'Avg closure time', v: '24d', c: 'var(--primary-700)', s: 'target ≤ 21d' },
          ].map(k => (
            <div key={k.l} className="k-surface" style={{ padding: 12 }}>
              <div style={{ fontSize: 10.5, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>{k.l}</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: k.c }}>{k.v}</div>
              <div style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>{k.s}</div>
            </div>
          ))}
        </div>

        <div className="k-tabs" style={{ marginBottom: 14 }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} className={`k-tab ${tab === t.id ? 'active' : ''}`}>{t.l}</button>
          ))}
        </div>

        {tab === 'chargebacks' ? <ChargebackTable scars={SCARS}/> : <ScarTable rows={rows} setRoute={setRoute} setSupplier={setSupplier} setNcr={setNcr} set8d={set8d}/>}
      </div>
    </div>
  );
}

const ScarTable = ({ rows, setRoute, setSupplier, setNcr, set8d }) => (
  <div className="k-surface" style={{ overflow: 'hidden' }}>
    <table className="k-table" style={{ width: '100%' }}>
      <thead>
        <tr>
          <th>SCAR</th><th>Supplier</th><th>Issue</th><th>8D progress</th><th>Severity</th><th>Linked</th><th>Due</th><th>Chargeback</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(s => {
          const supplier = SUPPLIERS.find(x => x.id === s.supplierId);
          return (
            <tr key={s.id} style={{ cursor: 'pointer' }}>
              <td className="mono" style={{ fontSize: 11.5, color: 'var(--accent)' }}>{s.id}</td>
              <td>
                <div onClick={() => { setSupplier(s.supplierId); setRoute('supplier-detail'); }}
                  style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {supplier && <SupplierLogo supplier={supplier} size={24}/>}
                  <span style={{ fontSize: 12.5, fontWeight: 600 }}>{s.supplierName}</span>
                </div>
              </td>
              <td>
                <div style={{ fontSize: 12.5, fontWeight: 500 }}>{s.title}</div>
                <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 2 }}>
                  {s.affectedLots} lots affected · raised {s.raisedDate}
                </div>
              </td>
              <td>
                <DSteps current={s.currentD}/>
              </td>
              <td>
                <span className="k-chip" style={{
                  background: s.severity === 'critical' ? 'rgba(220,38,38,0.10)' : s.severity === 'major' ? 'rgba(234,88,12,0.10)' : 'rgba(245,158,11,0.12)',
                  color: s.severity === 'critical' ? '#b91c1c' : s.severity === 'major' ? '#9a3412' : '#92400e',
                }}>{s.severity}</span>
              </td>
              <td>
                {s.linkedNcr && <div onClick={() => { setNcr(s.linkedNcr); setRoute('ncr-detail'); }}><EntityLink id={s.linkedNcr}/></div>}
                {s.linked8d && <div onClick={() => { set8d(s.linked8d); setRoute('8d-detail'); }}><EntityLink id={s.linked8d}/></div>}
                {!s.linkedNcr && !s.linked8d && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>—</span>}
              </td>
              <td className="mono" style={{ fontSize: 11.5, color: s.status === 'overdue' ? '#dc2626' : 'var(--text)' }}>
                {s.dueDate}
                <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{s.daysOpen}d open</div>
              </td>
              <td>
                <div style={{ fontWeight: 600, fontSize: 12.5, fontVariantNumeric: 'tabular-nums' }}>
                  ${s.chargebackAmount.toLocaleString()}
                </div>
                <ChargebackBadge status={s.chargebackStatus}/>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  </div>
);

const DSteps = ({ current }) => (
  <div style={{ display: 'flex', gap: 2 }}>
    {[1,2,3,4,5,6,7,8].map(d => (
      <div key={d}
        title={`D${d}`}
        style={{
          width: 16, height: 16, borderRadius: 3,
          background: d < current ? '#16a34a' : d === current ? '#f59e0b' : 'var(--bg-subtle)',
          color: d <= current ? 'white' : 'var(--text-muted)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 9, fontWeight: 700,
        }}>{d}</div>
    ))}
  </div>
);

const ChargebackBadge = ({ status }) => {
  const map = {
    pending: { l: 'Pending', bg: 'rgba(245,158,11,0.12)', fg: '#92400e' },
    debit_issued: { l: 'Debit issued', bg: 'rgba(99,102,241,0.10)', fg: '#4338ca' },
    closed: { l: 'Recovered', bg: 'rgba(34,197,94,0.10)', fg: 'var(--success-700)' },
    disputed: { l: 'Disputed', bg: 'rgba(220,38,38,0.10)', fg: '#b91c1c' },
  };
  const s = map[status] || map.pending;
  return <span className="k-chip" style={{ background: s.bg, color: s.fg, fontSize: 9.5, marginTop: 2 }}>{s.l}</span>;
};

const ChargebackTable = ({ scars }) => {
  return (
    <Card title="Chargeback ledger" desc="Auto-generated debit memos. Sync to ERP after approval.">
      <table className="k-table" style={{ width: '100%' }}>
        <thead>
          <tr>
            <th>Debit memo</th><th>Supplier</th><th>SCAR</th><th>Breakdown</th><th>Amount</th><th>Status</th>
          </tr>
        </thead>
        <tbody>
          {scars.map(s => (
            <tr key={s.id}>
              <td className="mono" style={{ fontSize: 11.5 }}>DM-{s.id.replace('SCAR-', '')}</td>
              <td style={{ fontSize: 12.5, fontWeight: 600 }}>{s.supplierName}</td>
              <td><EntityLink id={s.id}/></td>
              <td style={{ fontSize: 11 }}>
                <span style={{ color: 'var(--text-muted)' }}>Scrap </span><span className="mono">${Math.round(s.chargebackAmount * 0.4).toLocaleString()}</span>
                <span style={{ color: 'var(--text-muted)' }}> · Rework </span><span className="mono">${Math.round(s.chargebackAmount * 0.35).toLocaleString()}</span>
                <span style={{ color: 'var(--text-muted)' }}> · Freight </span><span className="mono">${Math.round(s.chargebackAmount * 0.25).toLocaleString()}</span>
              </td>
              <td style={{ fontWeight: 700, fontSize: 13, fontVariantNumeric: 'tabular-nums' }}>${s.chargebackAmount.toLocaleString()}</td>
              <td><ChargebackBadge status={s.chargebackStatus}/></td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
};


Object.assign(window, { PpapSubmissionsList, PpapDetail, ScarWorkflow });
