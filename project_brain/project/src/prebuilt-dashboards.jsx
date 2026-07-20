// Kaenal — Pre-built report dashboards
// Quality Overview, Inspection Performance, Compliance

function PrebuiltDashboards({ setRoute, setReport }) {
  const [active, setActive] = React.useState('quality');

  return (
    <div>
      <PageHeader
        title="Report Dashboards"
        description="Pre-built operational dashboards · Real-time data"
        actions={
          <>
            <button className="k-btn k-btn-secondary" onClick={() => kToast('Export started — dashboard.pdf')}><Icon name="download" size={14}/> Export PDF</button>
            <button className="k-btn k-btn-secondary" onClick={() => setRoute('reports')}><Icon name="copy" size={14}/> Custom builder</button>
            <button className="k-btn k-btn-primary" onClick={() => { setReport('new'); setRoute('report-builder'); }}>
              <Icon name="plus" size={14}/> New dashboard
            </button>
          </>
        }
      />

      {/* Tabs */}
      <div style={{ padding: '20px 28px 0', display: 'flex', gap: 4, borderBottom: '1px solid var(--border)' }}>
        {[
          { id: 'quality', label: 'Quality Overview', icon: 'check' },
          { id: 'inspection', label: 'Inspection Performance', icon: 'clipboard' },
          { id: 'compliance', label: 'Compliance', icon: 'shieldCheck' },
        ].map(t => (
          <button key={t.id} onClick={() => setActive(t.id)} style={{
            padding: '10px 16px', fontSize: 13, fontWeight: 500,
            borderBottom: active === t.id ? '2px solid var(--accent)' : '2px solid transparent',
            color: active === t.id ? 'var(--text)' : 'var(--text-muted)',
            marginBottom: -1, display: 'inline-flex', alignItems: 'center', gap: 6,
            border: 'none', background: 'none', cursor: 'pointer',
          }}>
            <Icon name={t.icon} size={14}/> {t.label}
          </button>
        ))}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, paddingBottom: 8 }}>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Period:</span>
          <Segmented size="sm" value="ytd" onChange={() => {}} options={[
            { value: 'mtd', label: 'MTD' },
            { value: 'qtd', label: 'QTD' },
            { value: 'ytd', label: 'YTD' },
            { value: '12m', label: '12M' },
          ]}/>
        </div>
      </div>

      <div style={{ padding: '20px 28px 28px' }}>
        {active === 'quality' && <QualityOverviewDash/>}
        {active === 'inspection' && <InspectionPerfDash/>}
        {active === 'compliance' && <ComplianceDash/>}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// QUALITY OVERVIEW
// ─────────────────────────────────────────────────────────────
function QualityOverviewDash() {
  return (
    <>
      {/* Hero KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 14, marginBottom: 16 }}>
        <HeroKPI label="Open NCRs" value="52" change="+8%" changeDir="up" color="#dc2626" sparkData={[38,42,40,45,44,48,46,50,48,51,49,52]}/>
        <HeroKPI label="Resolved YTD" value="217" change="+24%" changeDir="up" color="#22c55e" sparkData={[12,18,25,30,42,58,72,98,120,148,180,217]}/>
        <HeroKPI label="Avg time to resolve" value="6.2d" change="-1.8d" changeDir="down" color="#2563eb" sparkData={[9.4,8.8,8.2,7.9,7.5,7.0,6.8,6.5,6.4,6.3,6.2,6.2]}/>
        <HeroKPI label="Cost of quality" value="$184k" change="-12%" changeDir="down" color="#9333ea" sparkData={[220,215,210,205,200,198,195,190,188,186,184,184]}/>
        <HeroKPI label="Customer escapes" value="3" change="-2" changeDir="down" color="#16a34a" sparkData={[8,7,6,5,4,4,5,4,3,3,3,3]}/>
      </div>

      {/* Row 2 */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 14, marginBottom: 16 }}>
        <ChartCard title="NCR volume — last 12 months" subtitle="Created vs Resolved vs Open backlog">
          <NcrVolumeChart/>
        </ChartCard>
        <ChartCard title="By severity" subtitle="Currently open">
          <SeverityDonut/>
        </ChartCard>
      </div>

      {/* Row 3 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
        <ChartCard title="Top 5 recurring defect types" subtitle="Last 90 days">
          <RecurringDefectsBar/>
        </ChartCard>
        <ChartCard title="Cost of quality breakdown" subtitle="Prevention / Appraisal / Internal failure / External failure">
          <CoqBreakdown/>
        </ChartCard>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <ChartCard title="8D completion rate" subtitle="Of 8Ds closed within target">
          <Gauge percent={78} label="Within target"/>
        </ChartCard>
        <ChartCard title="MTBF improvement" subtitle="Mean time between failures, by cell">
          <MtbfBars/>
        </ChartCard>
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────
// INSPECTION PERFORMANCE
// ─────────────────────────────────────────────────────────────
function InspectionPerfDash() {
  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 16 }}>
        <HeroKPI label="Completed (YTD)" value="641" change="+18%" changeDir="up" color="#22c55e" sparkData={[40,52,68,84,102,140,180,228,290,360,460,641]}/>
        <HeroKPI label="Pass rate" value="94.2%" change="+1.4%" changeDir="up" color="#2563eb" sparkData={[91,91.5,92,92.4,92.8,93,93.3,93.6,93.8,94,94.1,94.2]}/>
        <HeroKPI label="Overdue inspections" value="5" change="-3" changeDir="down" color="#dc2626" sparkData={[12,11,10,9,8,9,8,7,7,6,6,5]}/>
        <HeroKPI label="Avg score" value="87/100" change="+2.1" changeDir="up" color="#9333ea" sparkData={[82,83,83,84,84,85,85,86,86,86,87,87]}/>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
        <ChartCard title="Completed vs Scheduled — last 12 months" subtitle="">
          <CompletedScheduledBar/>
        </ChartCard>
        <ChartCard title="Pass rate by area" subtitle="">
          <PassRateByArea/>
        </ChartCard>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
        <ChartCard title="Inspector workload" subtitle="Open assignments per inspector">
          <InspectorWorkload/>
        </ChartCard>
        <ChartCard title="Avg score by template (radar)" subtitle="">
          <RadarChart/>
        </ChartCard>
      </div>

      <ChartCard title="Overdue inspections" subtitle="Action needed">
        <OverdueTable/>
      </ChartCard>
    </>
  );
}

// ─────────────────────────────────────────────────────────────
// COMPLIANCE
// ─────────────────────────────────────────────────────────────
function ComplianceDash() {
  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 16 }}>
        <HeroKPI label="Certificates valid" value="14/16" change="+1" changeDir="up" color="#22c55e" sparkData={[10,11,12,12,13,13,14,14,14,14,14,14]}/>
        <HeroKPI label="Expiring < 90 days" value="3" change="+1" changeDir="up" color="#f59e0b" sparkData={[1,1,2,2,2,2,3,3,3,3,3,3]}/>
        <HeroKPI label="Open audit findings" value="8" change="-2" changeDir="down" color="#dc2626" sparkData={[15,14,13,12,11,10,11,10,9,9,8,8]}/>
        <HeroKPI label="Overall compliance score" value="91%" change="+3%" changeDir="up" color="#2563eb" sparkData={[85,86,86,87,87,88,89,89,90,90,91,91]}/>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
        <ChartCard title="Certificate status overview" subtitle="Valid / expiring / expired / not assessed">
          <CertStatusDonut/>
        </ChartCard>
        <ChartCard title="Compliance score by standard" subtitle="">
          <ComplianceByStandard/>
        </ChartCard>
      </div>

      <ChartCard title="Gap analysis — IATF 16949 clauses" subtitle="Conformance status by clause">
        <GapMatrix/>
      </ChartCard>

      <div style={{ marginTop: 16 }}>
        <ChartCard title="Upcoming certificate expirations" subtitle="Next 12 months">
          <CertExpirations/>
        </ChartCard>
      </div>
    </>
  );
}

// ─── Reusable atoms ───
function HeroKPI({ label, value, change, changeDir, color, sparkData }) {
  return (
    <div className="k-surface" style={{ padding: 16 }}>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, marginBottom: 6 }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
        <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.02em' }}>{value}</div>
        <div style={{ fontSize: 12, fontWeight: 600, color: changeDir === 'up' ? (color === '#dc2626' || color === '#f59e0b' ? '#dc2626' : '#22c55e') : (color === '#22c55e' ? '#dc2626' : '#22c55e') }}>
          {changeDir === 'up' ? '↑' : '↓'} {change}
        </div>
      </div>
      <Sparkline data={sparkData} color={color}/>
    </div>
  );
}

function Sparkline({ data, color = '#2563eb' }) {
  const max = Math.max(...data), min = Math.min(...data);
  const range = max - min || 1;
  const W = 200, H = 32;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * W},${H - ((v - min) / range) * (H - 4) - 2}`).join(' ');
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 32 }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth={1.5}/>
      <polyline points={`0,${H} ${pts} ${W},${H}`} fill={color} opacity={0.1}/>
    </svg>
  );
}

function ChartCard({ title, subtitle, children, action }) {
  return (
    <div className="k-surface" style={{ padding: 18 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
        <div>
          <h3 style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>{title}</h3>
          {subtitle && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{subtitle}</div>}
        </div>
        {action || (
          <button className="k-btn-plain" style={{ padding: 4 }} onClick={() => kToast('Widget options — resize, duplicate, or remove')}><Icon name="more" size={14}/></button>
        )}
      </div>
      {children}
    </div>
  );
}

// ─── Chart implementations ───
function NcrVolumeChart() {
  const data = NCR_TREND;
  const max = Math.max(...data.flatMap(d => [d.created, d.resolved, d.open]));
  const W = 600, H = 220, PAD_L = 30, PAD_B = 24;
  const x = i => PAD_L + (i / (data.length - 1)) * (W - PAD_L - 10);
  const y = v => H - PAD_B - (v / max) * (H - PAD_B - 16);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 220 }}>
      {[0.25, 0.5, 0.75, 1].map(t => (
        <line key={t} x1={PAD_L} x2={W - 10} y1={H - PAD_B - t * (H - PAD_B - 16)} y2={H - PAD_B - t * (H - PAD_B - 16)} stroke="var(--border)" strokeDasharray="2 4"/>
      ))}
      <polyline points={data.map((d, i) => `${x(i)},${y(d.created)}`).join(' ')} fill="none" stroke="#2563eb" strokeWidth={2}/>
      <polyline points={data.map((d, i) => `${x(i)},${y(d.resolved)}`).join(' ')} fill="none" stroke="#22c55e" strokeWidth={2}/>
      <polyline points={data.map((d, i) => `${x(i)},${y(d.open)}`).join(' ')} fill="none" stroke="#f59e0b" strokeWidth={2} strokeDasharray="4 2"/>
      {data.map((d, i) => (
        <g key={i}>
          <text x={x(i)} y={H - 6} textAnchor="middle" fontSize={10} fill="var(--text-muted)">{d.month}</text>
        </g>
      ))}
      <g transform={`translate(${PAD_L + 8}, 12)`}>
        {[['Created', '#2563eb'], ['Resolved', '#22c55e'], ['Open', '#f59e0b']].map(([l, c], i) => (
          <g key={l} transform={`translate(${i * 80}, 0)`}>
            <line x1={0} x2={12} y1={6} y2={6} stroke={c} strokeWidth={2}/>
            <text x={16} y={9} fontSize={10} fill="var(--text-muted)">{l}</text>
          </g>
        ))}
      </g>
    </svg>
  );
}

function SeverityDonut() {
  const data = RISK_DIST;
  const total = data.reduce((s, d) => s + d.value, 0);
  let acc = 0;
  const r = 70, r2 = 50, cx = 100, cy = 100;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
      <svg viewBox="0 0 200 200" style={{ width: 160, height: 160 }}>
        {data.map((d, i) => {
          const start = (acc / total) * Math.PI * 2 - Math.PI / 2; acc += d.value;
          const end = (acc / total) * Math.PI * 2 - Math.PI / 2;
          const large = end - start > Math.PI ? 1 : 0;
          const x1 = cx + r * Math.cos(start), y1 = cy + r * Math.sin(start);
          const x2 = cx + r * Math.cos(end), y2 = cy + r * Math.sin(end);
          const xi1 = cx + r2 * Math.cos(start), yi1 = cy + r2 * Math.sin(start);
          const xi2 = cx + r2 * Math.cos(end), yi2 = cy + r2 * Math.sin(end);
          return <path key={i} d={`M${x1},${y1} A${r},${r} 0 ${large} 1 ${x2},${y2} L${xi2},${yi2} A${r2},${r2} 0 ${large} 0 ${xi1},${yi1} Z`} fill={d.color}/>;
        })}
        <text x={cx} y={cy - 2} textAnchor="middle" fontSize={22} fontWeight={700} fill="var(--text)">{total}</text>
        <text x={cx} y={cy + 16} textAnchor="middle" fontSize={10} fill="var(--text-muted)">Open</text>
      </svg>
      <div style={{ flex: 1 }}>
        {data.map(d => (
          <div key={d.label} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, marginBottom: 5 }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: d.color }}/>
            <span style={{ flex: 1 }}>{d.label}</span>
            <span className="mono" style={{ fontWeight: 600 }}>{d.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function RecurringDefectsBar() {
  const data = [
    { label: 'Weld porosity', value: 47 },
    { label: 'Dimensional drift', value: 31 },
    { label: 'Paint defect', value: 24 },
    { label: 'Torque OOS', value: 18 },
    { label: 'Label missing', value: 12 },
  ];
  const max = data[0].value;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {data.map(d => (
        <div key={d.label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ width: 120, fontSize: 12, color: 'var(--text-muted)' }}>{d.label}</span>
          <div style={{ flex: 1, height: 18, background: 'var(--bg-subtle)', borderRadius: 'var(--r-sm)', overflow: 'hidden', position: 'relative' }}>
            <div style={{ width: `${(d.value / max) * 100}%`, height: '100%', background: 'linear-gradient(90deg, #dc2626, #ea580c)', borderRadius: 'var(--r-sm)' }}/>
          </div>
          <span className="mono" style={{ fontSize: 12, fontWeight: 600, width: 30, textAlign: 'right' }}>{d.value}</span>
        </div>
      ))}
    </div>
  );
}

function CoqBreakdown() {
  const data = [
    { label: 'Prevention', value: 48, color: '#22c55e' },
    { label: 'Appraisal', value: 36, color: '#2563eb' },
    { label: 'Internal failure', value: 72, color: '#f59e0b' },
    { label: 'External failure', value: 28, color: '#dc2626' },
  ];
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <div>
      <div style={{ display: 'flex', height: 24, borderRadius: 'var(--r-sm)', overflow: 'hidden', marginBottom: 14 }}>
        {data.map(d => (
          <div key={d.label} style={{ flexBasis: `${(d.value / total) * 100}%`, background: d.color, position: 'relative' }} title={d.label}/>
        ))}
      </div>
      {data.map(d => (
        <div key={d.label} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
          <span style={{ width: 12, height: 12, borderRadius: 3, background: d.color }}/>
          <span style={{ flex: 1, fontSize: 12.5 }}>{d.label}</span>
          <span className="mono" style={{ fontSize: 13, fontWeight: 600 }}>${d.value}k</span>
          <span style={{ fontSize: 11, color: 'var(--text-muted)', width: 40, textAlign: 'right' }}>{((d.value / total) * 100).toFixed(0)}%</span>
        </div>
      ))}
    </div>
  );
}

function Gauge({ percent, label }) {
  const angle = (percent / 100) * 180 - 90;
  const color = percent >= 80 ? '#22c55e' : percent >= 60 ? '#f59e0b' : '#dc2626';
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
      <svg viewBox="0 0 200 120" style={{ width: '100%', maxWidth: 280 }}>
        <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="var(--bg-subtle)" strokeWidth={20} strokeLinecap="round"/>
        <path d={`M 20 100 A 80 80 0 0 1 ${100 + Math.cos((angle * Math.PI) / 180) * 80} ${100 + Math.sin((angle * Math.PI) / 180) * 80}`}
          fill="none" stroke={color} strokeWidth={20} strokeLinecap="round"/>
        <text x={100} y={90} textAnchor="middle" fontSize={36} fontWeight={700} fill="var(--text)">{percent}%</text>
        <text x={100} y={110} textAnchor="middle" fontSize={11} fill="var(--text-muted)">{label}</text>
      </svg>
    </div>
  );
}

function MtbfBars() {
  const data = [
    { cell: 'Weld Cell 1', mtbf: 142, prev: 128 },
    { cell: 'Weld Cell 2', mtbf: 168, prev: 159 },
    { cell: 'Weld Cell 3', mtbf: 89, prev: 124 },
    { cell: 'Machining 1', mtbf: 204, prev: 198 },
    { cell: 'Paint Shop', mtbf: 156, prev: 142 },
  ];
  const max = Math.max(...data.map(d => Math.max(d.mtbf, d.prev)));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {data.map(d => (
        <div key={d.cell}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, marginBottom: 4 }}>
            <span>{d.cell}</span>
            <span className="mono"><span style={{ color: d.mtbf > d.prev ? '#22c55e' : '#dc2626' }}>{d.mtbf}h</span> <span style={{ color: 'var(--text-muted)' }}>(prev {d.prev}h)</span></span>
          </div>
          <div style={{ height: 6, background: 'var(--bg-subtle)', borderRadius: 3, position: 'relative' }}>
            <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${(d.prev / max) * 100}%`, background: 'var(--border-strong)', borderRadius: 3 }}/>
            <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${(d.mtbf / max) * 100}%`, background: d.mtbf > d.prev ? '#22c55e' : '#dc2626', borderRadius: 3, opacity: 0.85 }}/>
          </div>
        </div>
      ))}
    </div>
  );
}

function CompletedScheduledBar() {
  const data = [
    { m: 'Jan', s: 48, c: 44 },
    { m: 'Feb', s: 52, c: 50 },
    { m: 'Mar', s: 58, c: 54 },
    { m: 'Apr', s: 62, c: 58 },
    { m: 'May', s: 56, c: 52 },
  ];
  const max = Math.max(...data.map(d => d.s));
  const W = 500, H = 200, PAD_B = 24, PAD_L = 30;
  const bw = ((W - PAD_L - 10) / data.length) - 8;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 200 }}>
      {data.map((d, i) => {
        const x = PAD_L + i * (bw + 8) + 4;
        const hs = (d.s / max) * (H - PAD_B - 12);
        const hc = (d.c / max) * (H - PAD_B - 12);
        return (
          <g key={d.m}>
            <rect x={x} y={H - PAD_B - hs} width={bw / 2 - 2} height={hs} fill="var(--border-strong)" rx={2}/>
            <rect x={x + bw / 2 + 2} y={H - PAD_B - hc} width={bw / 2 - 2} height={hc} fill="#2563eb" rx={2}/>
            <text x={x + bw / 2} y={H - 8} textAnchor="middle" fontSize={11} fill="var(--text-muted)">{d.m}</text>
          </g>
        );
      })}
    </svg>
  );
}

function PassRateByArea() {
  const data = [
    { a: 'Plant A — Welding', p: 88 },
    { a: 'Plant A — Assembly', p: 96 },
    { a: 'Plant B — Machining', p: 94 },
    { a: 'Plant B — Paint', p: 91 },
    { a: 'Cleanroom', p: 98 },
    { a: 'Receiving', p: 85 },
  ];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {data.map(d => (
        <div key={d.a}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
            <span>{d.a}</span>
            <span className="mono" style={{ fontWeight: 600, color: d.p >= 95 ? '#22c55e' : d.p >= 90 ? '#f59e0b' : '#dc2626' }}>{d.p}%</span>
          </div>
          <div style={{ height: 8, background: 'var(--bg-subtle)', borderRadius: 4 }}>
            <div style={{ width: d.p + '%', height: '100%', background: d.p >= 95 ? '#22c55e' : d.p >= 90 ? '#f59e0b' : '#dc2626', borderRadius: 4 }}/>
          </div>
        </div>
      ))}
    </div>
  );
}

function InspectorWorkload() {
  const data = USERS.slice(0, 6).map((u, i) => ({ u, open: [12, 8, 6, 5, 4, 3][i] }));
  const max = data[0].open;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {data.map(d => (
        <div key={d.u.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Avatar user={d.u} size={26}/>
          <span style={{ width: 100, fontSize: 12, fontWeight: 500 }}>{d.u.name.split(' ')[0]}</span>
          <div style={{ flex: 1, height: 16, background: 'var(--bg-subtle)', borderRadius: 'var(--r-sm)' }}>
            <div style={{ width: `${(d.open / max) * 100}%`, height: '100%', background: d.u.color, borderRadius: 'var(--r-sm)', opacity: 0.85 }}/>
          </div>
          <span className="mono" style={{ fontSize: 12, fontWeight: 600, width: 24, textAlign: 'right' }}>{d.open}</span>
        </div>
      ))}
    </div>
  );
}

function RadarChart() {
  const data = [
    { label: 'Process Audit', value: 87 },
    { label: 'Safety Walk', value: 94 },
    { label: 'Incoming', value: 82 },
    { label: 'LPA', value: 91 },
    { label: '5S', value: 89 },
    { label: 'Cleanroom', value: 96 },
  ];
  const cx = 140, cy = 140, r = 100;
  const angle = (i) => (i / data.length) * Math.PI * 2 - Math.PI / 2;
  const pts = data.map((d, i) => {
    const a = angle(i);
    const dist = (d.value / 100) * r;
    return `${cx + Math.cos(a) * dist},${cy + Math.sin(a) * dist}`;
  }).join(' ');
  return (
    <svg viewBox="0 0 280 280" style={{ width: '100%', maxWidth: 280 }}>
      {[0.25, 0.5, 0.75, 1].map(t => {
        const grid = data.map((_, i) => {
          const a = angle(i);
          return `${cx + Math.cos(a) * r * t},${cy + Math.sin(a) * r * t}`;
        }).join(' ');
        return <polygon key={t} points={grid} fill="none" stroke="var(--border)" strokeWidth={1}/>;
      })}
      {data.map((d, i) => {
        const a = angle(i);
        return <line key={i} x1={cx} y1={cy} x2={cx + Math.cos(a) * r} y2={cy + Math.sin(a) * r} stroke="var(--border)" strokeWidth={1}/>;
      })}
      <polygon points={pts} fill="var(--accent)" fillOpacity={0.2} stroke="var(--accent)" strokeWidth={2}/>
      {data.map((d, i) => {
        const a = angle(i);
        const tx = cx + Math.cos(a) * (r + 16);
        const ty = cy + Math.sin(a) * (r + 16);
        return <text key={i} x={tx} y={ty} textAnchor="middle" fontSize={10} fill="var(--text-muted)" dy={4}>{d.label}</text>;
      })}
    </svg>
  );
}

function OverdueTable() {
  const data = INSPECTIONS.slice(0, 5);
  return (
    <table className="k-table" style={{ width: '100%' }}>
      <thead><tr><th>ID</th><th>Title</th><th>Inspector</th><th>Days overdue</th><th>Risk</th></tr></thead>
      <tbody>
        {data.map((ins, i) => (
          <tr key={ins.id}>
            <td><span style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5 }}>{ins.id}</span></td>
            <td>{ins.title}</td>
            <td><div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Avatar user={ins.inspectorId} size={20}/><span style={{ fontSize: 12 }}>{userById(ins.inspectorId).name.split(' ')[0]}</span></div></td>
            <td><span className="k-chip" style={{ background: 'rgba(220,38,38,0.10)', color: '#b91c1c' }}>{[2, 3, 5, 7, 9][i]} days</span></td>
            <td><RiskBadge risk={ins.risk}/></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function CertStatusDonut() {
  const data = [
    { l: 'Valid', v: 14, c: '#22c55e' },
    { l: 'Expiring < 90d', v: 3, c: '#f59e0b' },
    { l: 'Not assessed', v: 1, c: '#94a3b8' },
  ];
  return <SeverityDonutGeneric data={data}/>;
}

function SeverityDonutGeneric({ data }) {
  const total = data.reduce((s, d) => s + d.v, 0);
  let acc = 0;
  const r = 70, r2 = 50, cx = 100, cy = 100;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
      <svg viewBox="0 0 200 200" style={{ width: 160, height: 160 }}>
        {data.map((d, i) => {
          const start = (acc / total) * Math.PI * 2 - Math.PI / 2; acc += d.v;
          const end = (acc / total) * Math.PI * 2 - Math.PI / 2;
          const large = end - start > Math.PI ? 1 : 0;
          const x1 = cx + r * Math.cos(start), y1 = cy + r * Math.sin(start);
          const x2 = cx + r * Math.cos(end), y2 = cy + r * Math.sin(end);
          const xi1 = cx + r2 * Math.cos(start), yi1 = cy + r2 * Math.sin(start);
          const xi2 = cx + r2 * Math.cos(end), yi2 = cy + r2 * Math.sin(end);
          return <path key={i} d={`M${x1},${y1} A${r},${r} 0 ${large} 1 ${x2},${y2} L${xi2},${yi2} A${r2},${r2} 0 ${large} 0 ${xi1},${yi1} Z`} fill={d.c}/>;
        })}
        <text x={cx} y={cy - 2} textAnchor="middle" fontSize={22} fontWeight={700} fill="var(--text)">{total}</text>
        <text x={cx} y={cy + 16} textAnchor="middle" fontSize={10} fill="var(--text-muted)">Certs</text>
      </svg>
      <div style={{ flex: 1 }}>
        {data.map(d => (
          <div key={d.l} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, marginBottom: 5 }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: d.c }}/>
            <span style={{ flex: 1 }}>{d.l}</span>
            <span className="mono" style={{ fontWeight: 600 }}>{d.v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ComplianceByStandard() {
  const data = [
    { label: 'IATF 16949:2016', score: 92, color: '#22c55e' },
    { label: 'ISO 9001:2015', score: 96, color: '#22c55e' },
    { label: 'ISO 14001:2015', score: 88, color: '#22c55e' },
    { label: 'AS9100D', score: 84, color: '#f59e0b' },
    { label: 'FDA 21 CFR Part 11', score: 91, color: '#22c55e' },
    { label: 'OSHA', score: 76, color: '#f59e0b' },
  ];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {data.map(d => (
        <div key={d.label}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
            <span>{d.label}</span>
            <span className="mono" style={{ fontWeight: 600, color: d.color }}>{d.score}%</span>
          </div>
          <div style={{ height: 10, background: 'var(--bg-subtle)', borderRadius: 'var(--r-sm)' }}>
            <div style={{ width: d.score + '%', height: '100%', background: d.color, borderRadius: 'var(--r-sm)' }}/>
          </div>
        </div>
      ))}
    </div>
  );
}

function GapMatrix() {
  const clauses = ['4.1','4.2','4.4','5.1','5.2','6.1','6.2','7.1','7.2','7.5','8.1','8.3','8.4','8.5','8.6','8.7','9.1','9.2','9.3','10.2','10.3'];
  const status = ['c','c','c','c','c','m','c','c','c','c','c','m','c','M','c','c','p','c','c','m','c'];
  const colors = { c: '#22c55e', m: '#f59e0b', M: '#dc2626', p: '#94a3b8' };
  const tips = { c: 'Conformant', m: 'Minor NC', M: 'Major NC', p: 'Pending' };
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(11, 1fr)', gap: 4, marginBottom: 14 }}>
        {clauses.map((cl, i) => (
          <div key={cl} title={`§${cl} — ${tips[status[i]]}`} style={{
            padding: '8px 4px', borderRadius: 'var(--r-sm)',
            background: colors[status[i]] + '22', color: colors[status[i]],
            border: `1px solid ${colors[status[i]]}40`,
            textAlign: 'center', fontSize: 11, fontWeight: 600, cursor: 'pointer',
          }}>§{cl}</div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 14, fontSize: 11 }}>
        {Object.entries(tips).map(([k, l]) => (
          <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: colors[k] }}/>
            {l}
          </div>
        ))}
      </div>
    </div>
  );
}

function CertExpirations() {
  const data = [
    { name: 'IATF 16949:2016', issued: 'TÜV Rheinland', expires: '2026-06-15', months: 1, status: 'expiring' },
    { name: 'ISO 14001:2015', issued: 'DNV', expires: '2026-08-22', months: 3, status: 'expiring' },
    { name: 'Customer Approval (Volvo)', issued: 'Volvo Group', expires: '2026-11-30', months: 6, status: 'valid' },
    { name: 'Calibration cert — CMM #3', issued: 'Mitutoyo', expires: '2026-12-15', months: 7, status: 'valid' },
    { name: 'ISO 9001:2015', issued: 'BSI', expires: '2027-03-15', months: 10, status: 'valid' },
    { name: 'AS9100D', issued: 'NSF-ISR', expires: '2027-06-30', months: 13, status: 'valid' },
  ];
  return (
    <table className="k-table" style={{ width: '100%' }}>
      <thead><tr><th>Certificate</th><th>Issued by</th><th>Expires</th><th>Status</th><th></th></tr></thead>
      <tbody>
        {data.map((d, i) => (
          <tr key={i}>
            <td><div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Icon name="shieldCheck" size={14}/><span style={{ fontWeight: 500 }}>{d.name}</span></div></td>
            <td><span style={{ fontSize: 12 }}>{d.issued}</span></td>
            <td><span className="mono" style={{ fontSize: 12 }}>{d.expires}</span></td>
            <td>
              {d.months <= 3 ? (
                <span className="k-chip" style={{ background: 'rgba(245,158,11,0.10)', color: '#92400e' }}>Expires in {d.months}mo</span>
              ) : (
                <span className="k-chip" style={{ background: 'rgba(34,197,94,0.10)', color: '#15803d' }}>Valid · {d.months}mo</span>
              )}
            </td>
            <td><button className="k-btn-plain" style={{ padding: 6 }} title="Download" onClick={() => kToast('Download started — report.pdf')}><Icon name="download" size={13}/></button></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

Object.assign(window, { PrebuiltDashboards });
