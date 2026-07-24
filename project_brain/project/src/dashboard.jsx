// Kaenal — Customizable Dashboard with drag-drop, presets, and widget library

const { useState: useStateD, useRef: useRefD, useEffect: useEffectD } = React;

// ——— Chart primitives ———
const Sparkline = ({ data, color = 'var(--accent)', width = 100, height = 32 }) => {
  const max = Math.max(...data), min = Math.min(...data);
  const range = max - min || 1;
  const points = data.map((v, i) => [
    (i / (data.length - 1)) * width,
    height - ((v - min) / range) * (height - 4) - 2,
  ]);
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0]},${p[1]}`).join(' ');
  const area = `${path} L${width},${height} L0,${height} Z`;
  return (
    <svg width={width} height={height} style={{ display: 'block' }}>
      <path d={area} fill={color} opacity="0.1" />
      <path d={path} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
};

const LineChart = ({ data, series, height = 220 }) => {
  const padL = 40, padR = 12, padT = 12, padB = 28;
  const width = 600;
  const allVals = series.flatMap(s => data.map(d => d[s.key]));
  const max = Math.ceil(Math.max(...allVals) / 5) * 5;
  const x = (i) => padL + (i / (data.length - 1)) * (width - padL - padR);
  const y = (v) => padT + (1 - (v) / (max)) * (height - padT - padB);
  const yTicks = [0, max * 0.5, max];
  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', display: 'block' }}>
      {yTicks.map((t, i) => (
        <g key={i}>
          <line x1={padL} x2={width - padR} y1={y(t)} y2={y(t)} stroke="var(--border)"/>
          <text x={padL - 8} y={y(t) + 4} fontSize="10" fill="var(--text-subtle)" textAnchor="end">{Math.round(t)}</text>
        </g>
      ))}
      {data.map((d, i) => (
        <text key={i} x={x(i)} y={height - 8} fontSize="10" fill="var(--text-subtle)" textAnchor="middle">{d.month}</text>
      ))}
      {series.map(s => {
        const pts = data.map((d, i) => [x(i), y(d[s.key])]);
        const path = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0]},${p[1]}`).join(' ');
        const last = pts[pts.length - 1];
        return (
          <g key={s.key}>
            <path d={path} fill="none" stroke={s.color} strokeWidth={s.emphasis ? 2 : 1.5} strokeLinecap="round" strokeLinejoin="round"/>
            <circle cx={last[0]} cy={last[1]} r="2.5" fill={s.color}/>
          </g>
        );
      })}
    </svg>
  );
};

const DonutChart = ({ data, size = 180 }) => {
  const total = data.reduce((s, d) => s + d.value, 0);
  const cx = size / 2, cy = size / 2, r = size / 2 - 12, r2 = r - 22;
  let acc = 0;
  const arcs = data.map(d => {
    const start = (acc / total) * Math.PI * 2 - Math.PI / 2;
    acc += d.value;
    const end = (acc / total) * Math.PI * 2 - Math.PI / 2;
    const large = end - start > Math.PI ? 1 : 0;
    const x1 = cx + r * Math.cos(start), y1 = cy + r * Math.sin(start);
    const x2 = cx + r * Math.cos(end), y2 = cy + r * Math.sin(end);
    const xi1 = cx + r2 * Math.cos(start), yi1 = cy + r2 * Math.sin(start);
    const xi2 = cx + r2 * Math.cos(end), yi2 = cy + r2 * Math.sin(end);
    return { d: `M${x1},${y1} A${r},${r} 0 ${large} 1 ${x2},${y2} L${xi2},${yi2} A${r2},${r2} 0 ${large} 0 ${xi1},${yi1} Z`, color: d.color };
  });
  return (
    <svg width={size} height={size}>
      {arcs.map((a, i) => <path key={i} d={a.d} fill={a.color}/>)}
      <text x={cx} y={cy - 2} textAnchor="middle" fontSize="22" fontWeight="700" fill="var(--text)">{total}</text>
      <text x={cx} y={cy + 14} textAnchor="middle" fontSize="10" fill="var(--text-muted)" style={{ letterSpacing: '0.05em', textTransform: 'uppercase' }}>OPEN NCRS</text>
    </svg>
  );
};

const BarChart = ({ data, color = 'var(--accent)' }) => {
  const max = Math.max(...data.map(d => d.value));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {data.map((d, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12 }}>
          <div style={{ width: 80, color: 'var(--text-muted)', fontWeight: 500 }}>{d.label}</div>
          <div style={{ flex: 1, height: 16, background: 'var(--bg-subtle)', borderRadius: 'var(--r-sm)', overflow: 'hidden', position: 'relative' }}>
            <div style={{ width: `${(d.value / max) * 100}%`, height: '100%', background: d.color || color, borderRadius: 'var(--r-sm)' }}/>
          </div>
          <div className="mono" style={{ width: 32, textAlign: 'right', fontWeight: 600 }}>{d.value}</div>
        </div>
      ))}
    </div>
  );
};

// ——— Widget shell ———
const Widget = ({ title, subtitle, action, children, editing, onRemove, onResize, size, dragHandlers, dragging }) => (
  <div className={`k-surface ${dragging ? 'k-widget-dragging' : ''}`} style={{
    padding: 0, overflow: 'hidden',
    display: 'flex', flexDirection: 'column',
    transition: 'all 200ms',
    position: 'relative',
  }} {...dragHandlers}>
    <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
        {editing && (
          <span className="k-widget-handle" style={{ color: 'var(--text-muted)', cursor: 'grab', display: 'flex' }}>
            <Icon name="grip" size={14}/>
          </span>
        )}
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.2 }}>{title}</div>
          {subtitle && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{subtitle}</div>}
        </div>
      </div>
      {editing ? (
        <div style={{ display: 'flex', gap: 4 }}>
          {onResize && (
            <button onClick={onResize} className="k-btn-icon k-btn-plain k-btn-sm"
              title="Resize" style={{ height: 26, width: 26 }}>
              <Icon name={size === 'wide' ? 'chevronLeft' : 'chevronRight'} size={13}/>
            </button>
          )}
          <button onClick={onRemove} className="k-btn-icon k-btn-plain k-btn-sm"
            title="Remove" style={{ height: 26, width: 26, color: 'var(--danger-600)' }}>
            <Icon name="x" size={13}/>
          </button>
        </div>
      ) : action}
    </div>
    <div style={{ flex: 1, minHeight: 0 }}>{children}</div>
  </div>
);

// ——— Widget definitions ———
const WIDGET_REGISTRY = {
  kpi_inspections: {
    label: 'Open Inspections', size: 'small',
    icon: 'clipboard', color: '#2563eb',
    description: 'KPI card with sparkline trend',
    render: () => <KPIWidget icon="clipboard" label="Open Inspections" value="14" trend="+12%" trendDir="up" accent="#2563eb" spark={[6,8,7,10,9,11,10,12,11,13,12,14]}/>,
  },
  kpi_ncrs: {
    label: 'Open NCRs', size: 'small',
    icon: 'alert', color: '#ea580c',
    description: 'KPI card with sparkline trend',
    render: () => <KPIWidget icon="alert" label="Open NCRs" value="52" trend="+8%" trendDir="up" accent="#ea580c" spark={[38,42,40,45,44,48,46,50,48,51,49,52]}/>,
  },
  kpi_8ds: {
    label: 'Active 8Ds', size: 'small',
    icon: 'brain', color: '#6366f1',
    description: 'KPI card with sparkline trend',
    render: () => <KPIWidget icon="brain" label="Active 8Ds" value="7" trend="-14%" trendDir="down" accent="#6366f1" spark={[9,10,11,10,9,8,9,8,7,8,7,7]}/>,
  },
  kpi_overdue: {
    label: 'Overdue', size: 'small',
    icon: 'clock', color: '#dc2626',
    description: 'Items past due date',
    render: () => <KPIWidget icon="clock" label="Overdue Items" value="5" trend="+2" trendDir="up" accent="#dc2626" spark={[2,3,2,4,3,5,4,6,4,5,4,5]}/>,
  },
  kpi_passrate: {
    label: 'Inspection Pass Rate', size: 'small',
    icon: 'check', color: '#16a34a',
    description: 'Percent passed this week',
    render: () => <KPIWidget icon="check" label="Pass Rate (7d)" value="94%" trend="+2%" trendDir="down" accent="#16a34a" spark={[88,89,91,90,92,93,94,92,93,94,93,94]}/>,
  },
  kpi_copq: {
    label: 'Cost of Poor Quality', size: 'small',
    icon: 'reports', color: '#9333ea',
    description: 'Quality-related cost trend',
    render: () => <KPIWidget icon="reports" label="COPQ (MTD)" value="$48k" trend="-6%" trendDir="down" accent="#9333ea" spark={[55,52,50,53,49,51,48,46,49,47,48,48]}/>,
  },
  ncr_trend: {
    label: 'NCR Trend', size: 'wide', defaultSize: 'wide',
    icon: 'reports', color: '#3b82f6',
    description: 'Created vs resolved over 12 months',
    render: () => <NCRTrendWidget/>,
  },
  risk_dist: {
    label: 'Risk Distribution', size: 'half',
    icon: 'alert', color: '#f59e0b',
    description: 'Severity breakdown of open NCRs',
    render: () => <RiskDistWidget/>,
  },
  activity: {
    label: 'Recent Activity', size: 'half',
    icon: 'clock', color: '#64748b',
    description: 'Live feed of team actions',
    render: (ctx) => <ActivityWidget ctx={ctx}/>,
  },
  assignments: {
    label: 'My Assignments', size: 'half',
    icon: 'user', color: '#2563eb',
    description: 'Items owned by current user',
    render: (ctx) => <AssignmentsWidget ctx={ctx}/>,
  },
  heatmap: {
    label: 'Risk Heatmap', size: 'half',
    icon: 'layers', color: '#dc2626',
    description: 'Severity by area × category',
    render: () => <HeatmapWidget/>,
  },
  compliance: {
    label: 'Compliance Posture', size: 'half',
    icon: 'shield', color: '#16a34a',
    description: 'ISO / IATF / FDA readiness',
    render: () => <ComplianceWidget/>,
  },
  pareto: {
    label: 'Top Defect Pareto', size: 'half',
    icon: 'reports', color: '#ea580c',
    description: 'Most frequent defect categories',
    render: () => <ParetoWidget/>,
  },
  pipeline_8d: {
    label: '8D Pipeline', size: 'half',
    icon: 'brain', color: '#6366f1',
    description: 'D0 → D8 funnel',
    render: () => <PipelineWidget/>,
  },
  supplier_score: {
    label: 'Supplier Scorecard', size: 'half',
    icon: 'truck', color: '#0d9488',
    description: 'Top 5 suppliers by quality',
    render: () => <SupplierWidget/>,
  },
  inspector_load: {
    label: 'Inspector Workload', size: 'half',
    icon: 'user', color: '#9333ea',
    description: 'Open items per inspector',
    render: () => <InspectorLoadWidget/>,
  },
  ai_insights: {
    label: 'AI Insights', size: 'half',
    icon: 'sparkles', color: '#a855f7',
    description: 'Suggestions based on recent data',
    render: () => <AIInsightsWidget/>,
  },
};

// ——— Layout presets ———
const PRESETS = {
  default: {
    label: 'Default',
    description: 'Balanced view set by your admin',
    icon: 'home',
    layout: ['kpi_inspections', 'kpi_ncrs', 'kpi_8ds', 'kpi_overdue', 'ncr_trend', 'risk_dist', 'activity', 'assignments', 'heatmap', 'compliance'],
  },
  executive: {
    label: 'Executive',
    description: 'High-level KPIs and trends',
    icon: 'award',
    layout: ['kpi_ncrs', 'kpi_copq', 'kpi_passrate', 'kpi_overdue', 'ncr_trend', 'risk_dist', 'compliance', 'supplier_score'],
  },
  qa_manager: {
    label: 'QA Manager',
    description: 'Day-to-day quality operations',
    icon: 'clipboard',
    layout: ['kpi_ncrs', 'kpi_8ds', 'kpi_passrate', 'kpi_overdue', 'ncr_trend', 'pareto', 'activity', 'assignments', 'heatmap', 'pipeline_8d', 'ai_insights'],
  },
  inspector: {
    label: 'Inspector',
    description: 'Field-focused, my work',
    icon: 'user',
    layout: ['kpi_inspections', 'kpi_passrate', 'kpi_overdue', 'assignments', 'activity'],
  },
  plant_lead: {
    label: 'Plant Lead',
    description: 'Site-level operations',
    icon: 'factory',
    layout: ['kpi_inspections', 'kpi_ncrs', 'kpi_overdue', 'kpi_copq', 'heatmap', 'inspector_load', 'pareto', 'activity', 'compliance'],
  },
};

// ——— Individual widget components ———
const KPIWidget = ({ icon, label, value, trend, trendDir, spark, accent }) => (
  <div style={{ padding: '18px 16px 16px', display: 'flex', flexDirection: 'column', gap: 10, height: '100%', justifyContent: 'space-between' }}>
    <div style={{ fontSize: 40, fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1, fontVariantNumeric: 'tabular-nums', color: 'var(--text)' }}>{value}</div>
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-muted)' }}>
      <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--text)' }}>{trendDir === 'up' ? '↑' : '↓'} {trend}</span>
      <span style={{ color: 'var(--text-subtle)' }}>vs prior 30d</span>
    </div>
  </div>
);

const NCRTrendWidget = () => (
  <div style={{ padding: 16 }}>
    <div style={{ display: 'flex', gap: 16, fontSize: 11, fontWeight: 500, marginBottom: 6, color: 'var(--text-muted)' }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 12, height: 2, background: 'var(--text)', borderRadius: 2 }}/>Created</span>
      <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 12, height: 2, background: 'var(--text-subtle)', borderRadius: 2 }}/>Resolved</span>
      <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 12, height: 2, background: '#d97706', borderRadius: 2 }}/>Open</span>
    </div>
    <LineChart data={NCR_TREND} series={[
      { key: 'created', color: 'var(--text)' },
      { key: 'resolved', color: 'var(--text-subtle)' },
      { key: 'open', color: '#d97706', emphasis: true },
    ]} height={200}/>
  </div>
);

const SEVERITY_INK = { Critical: '#b91c1c', High: '#c2410c', Medium: '#b45309', Low: '#3f6212' };
const RiskDistWidget = () => {
  const total = RISK_DIST.reduce((s, r) => s + r.value, 0);
  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span style={{ fontSize: 30, fontWeight: 700, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>{total}</span>
        <span className="k-overline">Open NCRs by severity</span>
      </div>
      <div style={{ display: 'flex', height: 8, borderRadius: 'var(--r-sm)', overflow: 'hidden', gap: 1.5 }}>
        {RISK_DIST.map(r => (
          <div key={r.label} title={`${r.label}: ${r.value}`} style={{ flex: r.value, background: SEVERITY_INK[r.label] || r.color }}/>
        ))}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
        {RISK_DIST.map(r => (
          <div key={r.label} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: SEVERITY_INK[r.label] || r.color, flexShrink: 0 }}/>
            <span style={{ flex: 1, color: 'var(--text-muted)' }}>{r.label}</span>
            <span className="mono" style={{ fontWeight: 600, color: 'var(--text)' }}>{r.value}</span>
            <span className="mono" style={{ fontSize: 11, color: 'var(--text-subtle)', width: 34, textAlign: 'right' }}>{Math.round((r.value / total) * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
};

const ActivityWidget = ({ ctx }) => (
  <div style={{ padding: '4px 0', maxHeight: 320, overflowY: 'auto' }}>
    {ACTIVITY.slice(0, 6).map(a => {
      const u = userById(a.actor);
      return (
        <div key={a.id} style={{ display: 'flex', gap: 10, padding: '8px 14px', alignItems: 'flex-start' }}>
          <Avatar user={u} size={26}/>
          <div style={{ flex: 1, fontSize: 12.5, lineHeight: 1.45 }}>
            <span style={{ fontWeight: 600 }}>{u.name}</span>{' '}
            <span style={{ color: 'var(--text-muted)' }}>{a.action}</span>{' '}
            <EntityLink id={a.target} onClick={() => {
              if (!ctx) return;
              if (a.target.startsWith('NCR')) { ctx.setNcr(a.target); ctx.setRoute('ncr-detail'); }
              else if (a.target.startsWith('8D')) { ctx.set8d(a.target); ctx.setRoute('8d-detail'); }
              else if (a.target.startsWith('INS')) { ctx.setInspection(a.target); ctx.setRoute('inspection-detail'); }
            }}/>
            <div style={{ fontSize: 10.5, color: 'var(--text-subtle)', marginTop: 2 }}>{a.time}</div>
          </div>
        </div>
      );
    })}
  </div>
);

const AssignmentsWidget = ({ ctx }) => (
  <div style={{ padding: '4px 0', maxHeight: 320, overflowY: 'auto' }}>
    {NCRS.filter(n => n.ownerId === 'u2').slice(0, 4).map(n => (
      <button key={n.id} onClick={() => { if (ctx) { ctx.setNcr(n.id); ctx.setRoute('ncr-detail'); } }}
        style={{
          display: 'block', width: '100%', padding: '10px 16px',
          borderBottom: '1px solid var(--border)', textAlign: 'left',
        }}
        onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-subtle)'}
        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
      >
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
          <span className="mono" style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>{n.id}</span>
          <PriorityBadge priority={n.priority}/>
          <StatusBadge status={n.status}/>
        </div>
        <div style={{ fontSize: 12.5, fontWeight: 500, marginBottom: 2 }}>{n.title}</div>
        <div style={{ fontSize: 10.5, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 12 }}>
          <span>Due {n.due}</span><span>·</span><span>{n.area}</span>
        </div>
      </button>
    ))}
  </div>
);

const HeatmapWidget = () => (
  <div style={{ padding: 16 }}>
    <div className="k-heatmap-grid" style={{ display: 'grid', gridTemplateColumns: `80px repeat(${HEATMAP.cols.length}, 1fr)`, gap: 3, fontSize: 10 }}>
      <div/>
      {HEATMAP.cols.map(c => (
        <div key={c} style={{ fontSize: 9, color: 'var(--text-muted)', textAlign: 'center', padding: '0 2px', writingMode: 'vertical-rl', transform: 'rotate(180deg)', height: 50 }}>{c}</div>
      ))}
      {HEATMAP.rows.map((row, ri) => (
        <React.Fragment key={row}>
          <div className="k-heatmap-rowlabel" style={{ fontSize: 11, color: 'var(--text-muted)', alignSelf: 'center', fontWeight: 500 }}>{row}</div>
          {HEATMAP.values[ri].map((v, ci) => {
            const colors = ['#e2e8f0', '#fef3c7', '#fed7aa', '#fecaca', '#fca5a5'];
            const fg = ['#94a3b8', '#92400e', '#9a3412', '#991b1b', '#7f1d1d'];
            return (
              <div key={ci} title={`${row} × ${HEATMAP.cols[ci]}: ${v}`}
                style={{
                  height: 28, background: colors[v], color: fg[v],
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  borderRadius: 4, fontSize: 10, fontWeight: 600,
                }}>
                {v > 0 ? v : ''}
              </div>
            );
          })}
        </React.Fragment>
      ))}
    </div>
  </div>
);

const ComplianceWidget = () => {
  const items = [
    { label: 'ISO 9001:2015', score: 94, color: '#16a34a' },
    { label: 'IATF 16949', score: 88, color: '#16a34a' },
    { label: 'FDA 21 CFR 820', score: 76, color: '#f59e0b' },
    { label: 'AS9100D', score: 91, color: '#16a34a' },
  ];
  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
      {items.map(c => (
        <div key={c.label}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
            <span style={{ fontWeight: 500 }}>{c.label}</span>
            <span className="mono" style={{ color: c.color, fontWeight: 600 }}>{c.score}%</span>
          </div>
          <div style={{ height: 6, background: 'var(--bg-subtle)', borderRadius: 'var(--r-sm)', overflow: 'hidden' }}>
            <div style={{ width: `${c.score}%`, height: '100%', background: c.color, borderRadius: 'var(--r-sm)' }}/>
          </div>
        </div>
      ))}
    </div>
  );
};

const ParetoWidget = () => (
  <div style={{ padding: 16 }}>
    <BarChart data={[
      { label: 'Weld defect', value: 24, color: '#ea580c' },
      { label: 'Dimensional', value: 18, color: '#f59e0b' },
      { label: 'Surface', value: 14, color: '#eab308' },
      { label: 'Material', value: 9, color: '#3b82f6' },
      { label: 'Assembly', value: 6, color: '#6366f1' },
      { label: 'Other', value: 4, color: '#94a3b8' },
    ]}/>
  </div>
);

const PipelineWidget = () => {
  const stages = [
    { l: 'D0–D1', v: 12, c: '#ddd6fe' },
    { l: 'D2', v: 9, c: '#c4b5fd' },
    { l: 'D3', v: 7, c: '#a78bfa' },
    { l: 'D4', v: 5, c: '#8b5cf6' },
    { l: 'D5', v: 4, c: '#7c3aed' },
    { l: 'D6', v: 3, c: '#6d28d9' },
    { l: 'D7–D8', v: 2, c: '#5b21b6' },
  ];
  const max = stages[0].v;
  return (
    <div style={{ padding: 16, display: 'flex', alignItems: 'flex-end', gap: 4, height: 180 }}>
      {stages.map(s => (
        <div key={s.l} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: s.c, fontVariantNumeric: 'tabular-nums' }}>{s.v}</div>
          <div style={{ width: '100%', height: `${(s.v / max) * 130}px`, background: s.c, borderRadius: '4px 4px 0 0' }}/>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 500 }}>{s.l}</div>
        </div>
      ))}
    </div>
  );
};

const SupplierWidget = () => (
  <div style={{ padding: '8px 0' }}>
    {[
      { name: 'Acme Forging', score: 96, trend: 'up' },
      { name: 'Apex Plastics', score: 92, trend: 'flat' },
      { name: 'Nexus Steel', score: 88, trend: 'down' },
      { name: 'Crown Bearings', score: 84, trend: 'up' },
      { name: 'Vega Castings', score: 71, trend: 'down' },
    ].map((s, i) => (
      <div key={s.name} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 16px', borderBottom: i < 4 ? '1px solid var(--border)' : 'none' }}>
        <div style={{ width: 26, height: 26, borderRadius: 'var(--r-sm)', background: 'var(--bg-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
          <Icon name="truck" size={14}/>
        </div>
        <div style={{ flex: 1, fontSize: 12.5, fontWeight: 500 }}>{s.name}</div>
        <div className="mono" style={{ fontSize: 13, fontWeight: 600,
          color: s.score >= 90 ? 'var(--success-600)' : s.score >= 80 ? 'var(--warn-600)' : 'var(--danger-600)' }}>{s.score}</div>
        <Icon name={s.trend === 'up' ? 'arrowUp' : s.trend === 'down' ? 'arrowDown' : 'check'} size={12}
          style={{ color: s.trend === 'up' ? 'var(--success-600)' : s.trend === 'down' ? 'var(--danger-600)' : 'var(--text-muted)' }}/>
      </div>
    ))}
  </div>
);

const InspectorLoadWidget = () => (
  <div style={{ padding: 16 }}>
    <BarChart data={[
      { label: 'Lin Wei', value: 8, color: '#dc2626' },
      { label: 'Sara Chen', value: 6, color: '#f59e0b' },
      { label: 'Marco T.', value: 5, color: '#f59e0b' },
      { label: 'Aria K.', value: 3, color: '#16a34a' },
      { label: 'Diego R.', value: 2, color: '#16a34a' },
    ]}/>
  </div>
);

const AIInsightsWidget = () => (
  <div style={{ padding: '8px 0', display: 'flex', flexDirection: 'column' }}>
    {[
      { icon: 'alert', color: '#dc2626', txt: <><strong>Plant A — Line 3</strong> shows a 28% spike in weld-bead NCRs vs last 30d. Likely root cause: torch wire feed (similar to NCR-0118).</> },
      { icon: 'zap', color: '#9333ea', txt: <>Welder #14 has 4 open NCRs — recommend a TIG re-cert audit before peak shift Tuesday.</> },
      { icon: 'thumbsUp', color: '#16a34a', txt: <>Containment on 8D-0015 is on track — corrective action D5 ready for QA approval.</> },
    ].map((it, i) => (
      <div key={i} style={{ display: 'flex', gap: 10, padding: '10px 14px', borderBottom: i < 2 ? '1px solid var(--border)' : 'none' }}>
        <div style={{
          width: 26, height: 26, borderRadius: 'var(--r-sm)',
          background: it.color + '18', color: it.color, flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon name={it.icon} size={13} stroke={2}/>
        </div>
        <div style={{ fontSize: 12, lineHeight: 1.5 }}>{it.txt}</div>
      </div>
    ))}
  </div>
);

// ——— Widget catalog (add panel) ———
const WidgetCatalog = ({ onAdd, onClose, currentLayout }) => (
  <div onClick={onClose} style={{
    position: 'fixed', inset: 0, zIndex: 90,
    background: 'rgba(15,23,42,0.4)', backdropFilter: 'blur(4px)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  }}>
    <div onClick={(e) => e.stopPropagation()} style={{
      width: 720, maxWidth: '90vw', maxHeight: '80vh',
      background: 'var(--surface)', borderRadius: 'var(--r-xl)',
      boxShadow: 'var(--shadow-xl)', overflow: 'hidden', display: 'flex', flexDirection: 'column',
    }}>
      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 600 }}>Add widget</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Pick from {Object.keys(WIDGET_REGISTRY).length} available widgets</div>
        </div>
        <button onClick={onClose} className="k-btn-icon k-btn-plain"><Icon name="x" size={16}/></button>
      </div>
      <div style={{ padding: 16, overflowY: 'auto', display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
        {Object.entries(WIDGET_REGISTRY).map(([k, w]) => {
          const inLayout = currentLayout.includes(k);
          return (
            <button key={k} onClick={() => !inLayout && onAdd(k)} disabled={inLayout}
              style={{
                padding: 14, textAlign: 'left',
                background: inLayout ? 'var(--bg-subtle)' : 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--r-md)',
                opacity: inLayout ? 0.6 : 1, cursor: inLayout ? 'not-allowed' : 'pointer',
                display: 'flex', gap: 12, alignItems: 'flex-start',
                transition: 'all 120ms',
              }}
              onMouseEnter={(e) => { if (!inLayout) e.currentTarget.style.borderColor = w.color; }}
              onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--border)'}
            >
              <div style={{
                width: 32, height: 32, borderRadius: 'var(--r-md)',
                background: w.color + '18', color: w.color, flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Icon name={w.icon} size={16} stroke={1.75}/>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>{w.label}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.4 }}>{w.description}</div>
              </div>
              {inLayout && <span className="k-chip" style={{ background: 'var(--bg-subtle)', color: 'var(--text-muted)', height: 20, fontSize: 10 }}>Added</span>}
            </button>
          );
        })}
      </div>
    </div>
  </div>
);

// ——— Preset selector ———
const PresetSelector = ({ open, current, onPick, onClose }) => {
  if (!open) return null;
  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 90,
      background: 'rgba(15,23,42,0.4)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: 600, maxWidth: '90vw', background: 'var(--surface)',
        borderRadius: 'var(--r-xl)', boxShadow: 'var(--shadow-xl)', overflow: 'hidden',
      }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontSize: 16, fontWeight: 600 }}>Choose a layout preset</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Tailored views for different roles. You can customize after applying.</div>
        </div>
        <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {Object.entries(PRESETS).map(([k, p]) => (
            <button key={k} onClick={() => { onPick(k); onClose(); }}
              style={{
                padding: 14, display: 'flex', gap: 14, alignItems: 'center',
                background: current === k ? 'var(--accent-soft)' : 'var(--surface)',
                border: '1px solid ' + (current === k ? 'var(--accent)' : 'var(--border)'),
                borderRadius: 'var(--r-md)', textAlign: 'left',
                transition: 'all 120ms',
              }}
              onMouseEnter={(e) => { if (current !== k) e.currentTarget.style.background = 'var(--bg-subtle)'; }}
              onMouseLeave={(e) => { if (current !== k) e.currentTarget.style.background = 'var(--surface)'; }}
            >
              <div style={{
                width: 38, height: 38, borderRadius: 'var(--r-md)',
                background: 'var(--accent-soft)', color: 'var(--accent)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Icon name={p.icon} size={18} stroke={1.75}/>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 2 }}>{p.label}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{p.description} · {p.layout.length} widgets</div>
              </div>
              {current === k && <Icon name="check" size={16} stroke={2.5} style={{ color: 'var(--accent)' }}/>}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

// ——— Main Dashboard ———
const Dashboard = ({ setRoute, setNcr, set8d, setInspection, openCreate }) => {
  const [editing, setEditing] = useStateD(false);
  const [preset, setPreset] = useStateD(() => localStorage.getItem('k_preset') || 'default');
  const [layout, setLayout] = useStateD(() => {
    const saved = localStorage.getItem('k_layout');
    if (saved) return JSON.parse(saved);
    return PRESETS[preset].layout;
  });
  const [sizes, setSizes] = useStateD(() => JSON.parse(localStorage.getItem('k_sizes') || '{}'));
  const [showCatalog, setShowCatalog] = useStateD(false);
  const [showPresets, setShowPresets] = useStateD(false);
  const [draggedIdx, setDraggedIdx] = useStateD(null);
  const [dragOverIdx, setDragOverIdx] = useStateD(null);

  const persist = (next, nextSizes) => {
    setLayout(next);
    localStorage.setItem('k_layout', JSON.stringify(next));
    if (nextSizes) {
      setSizes(nextSizes);
      localStorage.setItem('k_sizes', JSON.stringify(nextSizes));
    }
  };

  const applyPreset = (k) => {
    setPreset(k);
    localStorage.setItem('k_preset', k);
    persist(PRESETS[k].layout, {});
  };

  const removeWidget = (id) => persist(layout.filter(x => x !== id));
  const addWidget = (id) => { persist([...layout, id]); setShowCatalog(false); };
  const toggleSize = (id) => {
    const w = WIDGET_REGISTRY[id];
    const cur = sizes[id] || w.size;
    const nextSize = cur === 'small' ? 'half' : cur === 'half' ? 'wide' : cur === 'wide' ? 'full' : 'small';
    persist(layout, { ...sizes, [id]: nextSize });
  };

  // ——— Drag handlers ———
  const onDragStart = (idx) => (e) => {
    setDraggedIdx(idx);
    e.dataTransfer.effectAllowed = 'move';
  };
  const onDragOver = (idx) => (e) => {
    e.preventDefault();
    if (draggedIdx === null || idx === draggedIdx) return;
    setDragOverIdx(idx);
  };
  const onDragEnd = () => { setDraggedIdx(null); setDragOverIdx(null); };
  const onDrop = (idx) => (e) => {
    e.preventDefault();
    if (draggedIdx === null || idx === draggedIdx) return;
    const next = [...layout];
    const [moved] = next.splice(draggedIdx, 1);
    next.splice(idx, 0, moved);
    persist(next);
    setDraggedIdx(null); setDragOverIdx(null);
  };

  const sizeToCols = { small: 3, half: 6, wide: 8, full: 12 };

  return (
    <div className="fade-in">
      <PageHeader
        title="Dashboard"
        description={editing ? 'Edit mode — drag widgets to rearrange, click + to add' : `${PRESETS[preset]?.label || 'Custom'} layout · ${layout.length} widgets`}
        actions={
          <>
            <button onClick={() => setShowPresets(true)} className="k-btn k-btn-ghost">
              <Icon name="presets" size={14}/> Presets
            </button>
            {!editing ? (
              <button onClick={() => setEditing(true)} className="k-btn k-btn-ghost">
                <Icon name="edit" size={14}/> Customize
              </button>
            ) : (
              <>
                <button onClick={() => setShowCatalog(true)} className="k-btn k-btn-ghost">
                  <Icon name="plus" size={14}/> Add widget
                </button>
                <button onClick={() => setEditing(false)} className="k-btn k-btn-primary">
                  <Icon name="check" size={14}/> Done
                </button>
              </>
            )}
            <button className="k-btn k-btn-ghost" onClick={() => kToast('Export started — dashboard-snapshot.pdf')}><Icon name="download" size={14}/>Export</button>
          </>
        }
      />

      <div style={{ padding: '20px 28px 28px', display: 'flex', flexDirection: 'column', gap: 20 }}>
      {editing && (
        <div style={{
          padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12,
          background: 'var(--accent-soft)', border: '1px solid var(--accent)',
          borderRadius: 'var(--r-md)', color: 'var(--accent)',
        }}>
          <Icon name="info" size={16}/>
          <div style={{ fontSize: 13, flex: 1 }}>
            <strong>Edit mode active.</strong> Drag widgets by the grip handle to rearrange. Use the chevron to resize. Use + to add from the catalog.
          </div>
        </div>
      )}

      {/* Grid */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 16,
        gridAutoRows: 'minmax(160px, auto)',
      }}>
        {layout.map((id, i) => {
          const w = WIDGET_REGISTRY[id];
          if (!w) return null;
          const sz = sizes[id] || w.defaultSize || w.size;
          const cols = sizeToCols[sz] || 6;
          const isDropTarget = dragOverIdx === i && draggedIdx !== i;
          return (
            <div key={id}
              style={{ gridColumn: `span ${cols}`, position: 'relative' }}
              className={isDropTarget ? 'k-widget-drop-target' : ''}
              onDragOver={editing ? onDragOver(i) : undefined}
              onDrop={editing ? onDrop(i) : undefined}
            >
              <div draggable={editing} onDragStart={editing ? onDragStart(i) : undefined} onDragEnd={editing ? onDragEnd : undefined}>
                <Widget
                  title={w.label}
                  subtitle={editing ? `${cols}/12 cols` : null}
                  editing={editing}
                  size={sz}
                  onRemove={() => removeWidget(id)}
                  onResize={() => toggleSize(id)}
                  dragging={draggedIdx === i}
                >
                  {w.render({ setRoute, setNcr, set8d, setInspection })}
                </Widget>
              </div>
            </div>
          );
        })}

        {editing && (
          <button onClick={() => setShowCatalog(true)} style={{
            gridColumn: 'span 6',
            minHeight: 160, border: '2px dashed var(--border-strong)',
            borderRadius: 'var(--r-xl)', background: 'transparent',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8,
            color: 'var(--text-muted)', fontSize: 13, fontWeight: 500,
            cursor: 'pointer', transition: 'all 150ms',
          }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-strong)'; e.currentTarget.style.color = 'var(--text-muted)'; }}
          >
            <Icon name="plus" size={20}/>
            <span>Add widget</span>
          </button>
        )}
      </div>
      </div>

      {showCatalog && <WidgetCatalog onAdd={addWidget} onClose={() => setShowCatalog(false)} currentLayout={layout}/>}
      <PresetSelector open={showPresets} current={preset} onPick={applyPreset} onClose={() => setShowPresets(false)}/>
    </div>
  );
};

Object.assign(window, { Dashboard });
