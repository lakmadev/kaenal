// Kaenal — Schedule calendar view for Inspections + Audits

// ── iCal / calendar-sync helpers ─────────────────────────────
function icsEscape(s = '') { return String(s).replace(/[\\;,]/g, m => '\\' + m).replace(/\n/g, '\\n'); }
function icsAddDay(dateStr) { const d = new Date(dateStr + 'T00:00:00'); d.setDate(d.getDate() + 1); return d.toISOString().slice(0, 10); }
function buildICS(events) {
  const stamp = '20260512T090000Z';
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Kaenal//QMS Schedule//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:Kaenal QMS Schedule'];
  events.forEach(ev => {
    lines.push('BEGIN:VEVENT');
    lines.push('UID:' + ev.id + '@kaenal.qms');
    lines.push('DTSTAMP:' + stamp);
    lines.push('DTSTART;VALUE=DATE:' + ev.date.replace(/-/g, ''));
    lines.push('DTEND;VALUE=DATE:' + icsAddDay(ev.endDate || ev.date).replace(/-/g, ''));
    lines.push('SUMMARY:' + icsEscape((ev.type === 'audit' ? '[Audit] ' : '[Inspection] ') + ev.title));
    if (ev.location) lines.push('LOCATION:' + icsEscape(ev.location));
    lines.push('CATEGORIES:' + (ev.type === 'audit' ? 'AUDIT' : 'INSPECTION'));
    lines.push('STATUS:CONFIRMED');
    lines.push('END:VEVENT');
  });
  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}
function downloadICS(events) {
  const blob = new Blob([buildICS(events)], { type: 'text/calendar' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'kaenal-schedule.ics';
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

const FEED_URL = 'https://app.kaenal.io/cal/precision-auto/qa-team.ics?key=9f3a-tkm2';

function CalendarSyncMenu({ events, onClose }) {
  const ref = React.useRef(null);
  const [copied, setCopied] = React.useState(false);
  const [connected, setConnected] = React.useState(() => {
    try { return JSON.parse(localStorage.getItem('kaenal-cal-connected') || '{}'); } catch { return {}; }
  });
  const setConn = (k) => setConnected(c => {
    const next = { ...c, [k]: !c[k] };
    try { localStorage.setItem('kaenal-cal-connected', JSON.stringify(next)); } catch {}
    return next;
  });
  React.useEffect(() => {
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    const id = setTimeout(() => document.addEventListener('mousedown', onDoc), 0);
    document.addEventListener('keydown', onKey);
    return () => { clearTimeout(id); document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey); };
  }, [onClose]);
  const copy = () => {
    try { navigator.clipboard?.writeText(FEED_URL)?.catch(() => {}); } catch {}
    setCopied(true); setTimeout(() => setCopied(false), 1800);
  };
  const providers = [
    { k: 'google', label: 'Google Calendar', color: '#1a73e8', letter: 'G' },
    { k: 'outlook', label: 'Microsoft Outlook', color: '#0a66c2', letter: 'O' },
    { k: 'apple', label: 'Apple Calendar', color: '#1d1d1f', letter: '' },
  ];
  return (
    <div ref={ref} style={{
      position: 'absolute', top: 'calc(100% + 8px)', right: 0, width: 380, zIndex: 40,
      background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)',
      boxShadow: '0 16px 40px rgba(15,23,42,0.20)', padding: 16,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <Icon name="refresh" size={15} style={{ color: 'var(--accent)' }}/>
        <span style={{ fontSize: 14, fontWeight: 700, whiteSpace: 'nowrap' }}>Sync this schedule</span>
        <button onClick={onClose} className="k-btn-plain" style={{ marginLeft: 'auto', padding: 4 }}><Icon name="x" size={14}/></button>
      </div>
      <p style={{ fontSize: 11.5, color: 'var(--text-muted)', margin: '0 0 14px', lineHeight: 1.5 }}>
        Assigned inspections and audits appear in your own calendar and update automatically when items are scheduled or moved.
      </p>

      {/* Subscribe feed */}
      <div style={{ fontSize: 10.5, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700, marginBottom: 7 }}>Subscribe (auto-syncing)</div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
        <input readOnly value={FEED_URL} onFocus={e => e.target.select()} className="k-input"
          style={{ flex: 1, height: 34, fontSize: 11.5, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}/>
        <button onClick={copy} className="k-btn k-btn-secondary" style={{ height: 34, whiteSpace: 'nowrap' }}>
          <Icon name={copied ? 'check' : 'copy'} size={13}/> {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 5 }}>
        <Icon name="link" size={11}/> Read-only iCal feed — paste into “Add calendar from URL”.
      </div>

      {/* One-click connect */}
      <div style={{ fontSize: 10.5, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700, marginBottom: 7 }}>One-click connect</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
        {providers.map(p => {
          const on = !!connected[p.k];
          return (
            <button key={p.k} onClick={() => setConn(p.k)} style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '9px 11px', cursor: 'pointer',
              background: on ? 'rgba(34,197,94,0.07)' : 'var(--surface)',
              border: `1px solid ${on ? 'rgba(34,197,94,0.4)' : 'var(--border)'}`, borderRadius: 'var(--r-md)', textAlign: 'left',
            }}>
              <div style={{ width: 26, height: 26, borderRadius: 6, background: p.color, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800 }}>
                {p.letter || <Icon name="calendar" size={14}/>}
              </div>
              <span style={{ flex: 1, fontSize: 12.5, fontWeight: 600 }}>{p.label}</span>
              {on
                ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#15803d', fontWeight: 700 }}><Icon name="check" size={13} stroke={3}/> Connected</span>
                : <span style={{ fontSize: 11.5, color: 'var(--accent)', fontWeight: 600 }}>Connect</span>}
            </button>
          );
        })}
      </div>

      {/* One-time export */}
      <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
        <button onClick={() => downloadICS(events)} className="k-btn k-btn-secondary" style={{ width: '100%', justifyContent: 'center' }}>
          <Icon name="download" size={13}/> Download .ics (one-time export · {events.length} events)
        </button>
      </div>
    </div>
  );
}

function ScheduleView({ setRoute, setInspection, setAudit, openCreate }) {
  const [view, setView] = React.useState('month'); // month | week | day
  const [filter, setFilter] = React.useState('all'); // all | inspections | audits
  const [syncOpen, setSyncOpen] = React.useState(false);
  const [currentDate, setCurrentDate] = React.useState(new Date(2026, 4, 12)); // May 12, 2026

  // Combine inspections and audits as calendar events
  const events = React.useMemo(() => {
    const evs = [];
    if (filter === 'all' || filter === 'inspections') {
      INSPECTIONS.forEach(ins => {
        evs.push({
          id: ins.id, type: 'inspection',
          title: ins.title, date: ins.due,
          status: ins.status, location: ins.area,
          ownerId: ins.inspectorId, color: '#2563eb', risk: ins.risk,
        });
      });
      // Add some scheduled future inspections
      [
        { id: 'INS-2026-0510', title: 'Plant A — Line 3 Weekly Safety Walk', date: '2026-05-13', status: 'scheduled', area: 'Plant A', inspectorId: 'u7' },
        { id: 'INS-2026-0511', title: 'Incoming Goods — Steel Coils Batch QA-9', date: '2026-05-14', status: 'scheduled', area: 'Receiving', inspectorId: 'u6' },
        { id: 'INS-2026-0512', title: 'Forklift Pre-Shift Inspection', date: '2026-05-15', status: 'scheduled', area: 'Logistics', inspectorId: 'u3' },
        { id: 'INS-2026-0513', title: 'Press Shop Calibration Check', date: '2026-05-15', status: 'scheduled', area: 'Press shop', inspectorId: 'u7' },
        { id: 'INS-2026-0514', title: 'Welding Cell 3 Process Audit', date: '2026-05-18', status: 'scheduled', area: 'Weld Cell 3', inspectorId: 'u4' },
        { id: 'INS-2026-0515', title: 'Cleanroom Suite B Particle Count', date: '2026-05-20', status: 'scheduled', area: 'Cleanroom', inspectorId: 'u6' },
        { id: 'INS-2026-0516', title: 'Monthly LPA — Welding', date: '2026-05-22', status: 'scheduled', area: 'Welding', inspectorId: 'u3' },
        { id: 'INS-2026-0517', title: 'Quarterly 5S Audit — Machining', date: '2026-05-25', status: 'scheduled', area: 'Machining', inspectorId: 'u7' },
        { id: 'INS-2026-0518', title: 'PPE Compliance — Floor Walk', date: '2026-05-27', status: 'scheduled', area: 'All Lines', inspectorId: 'u5' },
        { id: 'INS-2026-0519', title: 'Recurring Welding Daily Check', date: '2026-05-13', status: 'scheduled', area: 'Welding', inspectorId: 'u3', recurring: true },
        { id: 'INS-2026-0520', title: 'Recurring Welding Daily Check', date: '2026-05-14', status: 'scheduled', area: 'Welding', inspectorId: 'u3', recurring: true },
        { id: 'INS-2026-0521', title: 'Recurring Welding Daily Check', date: '2026-05-15', status: 'scheduled', area: 'Welding', inspectorId: 'u3', recurring: true },
      ].forEach(ins => {
        evs.push({ ...ins, type: 'inspection', color: '#2563eb' });
      });
    }
    if (filter === 'all' || filter === 'audits') {
      AUDITS.forEach(a => {
        evs.push({
          id: a.id, type: 'audit',
          title: a.title, date: a.plannedStart, endDate: a.plannedEnd,
          status: a.status, location: a.location,
          ownerId: a.leadAuditorId, color: '#ea580c',
          auditType: a.type, duration: a.durationDays,
        });
      });
    }
    return evs;
  }, [filter]);

  const month = currentDate.toLocaleString('en-US', { month: 'long', year: 'numeric' });

  return (
    <div>
      <PageHeader
        title="Schedule"
        description="Inspections, audits, and recurring quality activities"
        actions={
          <>
            <div style={{ position: 'relative' }}>
              <button className="k-btn k-btn-secondary" onClick={() => setSyncOpen(o => !o)} aria-expanded={syncOpen}>
                <Icon name="refresh" size={14}/> Sync calendar
              </button>
              {syncOpen && <CalendarSyncMenu events={events} onClose={() => setSyncOpen(false)}/>}
            </div>
            <button className="k-btn k-btn-primary" onClick={() => openCreate && openCreate('inspection')}>
              <Icon name="plus" size={14}/> Schedule item
            </button>
          </>
        }
      />

      <div style={{ padding: '20px 28px 0', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))}
            className="k-btn-icon k-btn-secondary"><Icon name="chevronLeft" size={14}/></button>
          <button onClick={() => setCurrentDate(new Date(2026, 4, 12))} className="k-btn k-btn-secondary" style={{ fontSize: 12 }}>Today</button>
          <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))}
            className="k-btn-icon k-btn-secondary"><Icon name="chevronRight" size={14}/></button>
        </div>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, letterSpacing: '-0.01em' }}>{month}</h2>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Segmented
            options={[
              { value: 'all', label: 'All' },
              { value: 'inspections', label: 'Inspections' },
              { value: 'audits', label: 'Audits' },
            ]}
            value={filter} onChange={setFilter}
          />
          <Segmented
            options={[
              { value: 'month', label: 'Month' },
              { value: 'week', label: 'Week' },
              { value: 'list', label: 'List' },
            ]}
            value={view} onChange={setView}
          />
        </div>
      </div>

      {/* Legend */}
      <div style={{ padding: '12px 28px 0', display: 'flex', alignItems: 'center', gap: 14, fontSize: 11 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 10, height: 10, borderRadius: 2, background: '#2563eb' }}/> Inspection
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 10, height: 10, borderRadius: 2, background: '#ea580c' }}/> Audit
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 10, height: 10, borderRadius: 2, background: '#22c55e' }}/> Completed
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 10, height: 10, borderRadius: 2, background: '#dc2626' }}/> Overdue
        </div>
        <span style={{ marginLeft: 'auto', color: 'var(--text-muted)' }}>{events.length} events this month</span>
      </div>

      <div style={{ padding: '14px 28px 28px' }}>
        {view === 'month' && <MonthGrid currentDate={currentDate} events={events} onEventClick={(ev) => {
          if (ev.type === 'inspection') { setInspection(ev.id); setRoute('inspection-detail'); }
          else { setAudit(ev.id); setRoute('audit-detail'); }
        }}/>}
        {view === 'week' && <WeekGrid currentDate={currentDate} events={events} onEventClick={(ev) => {
          if (ev.type === 'inspection') { setInspection(ev.id); setRoute('inspection-detail'); }
          else { setAudit(ev.id); setRoute('audit-detail'); }
        }}/>}
        {view === 'list' && <ListView events={events} setRoute={setRoute} setInspection={setInspection} setAudit={setAudit}/>}
      </div>
    </div>
  );
}

function MonthGrid({ currentDate, events, onEventClick }) {
  const year = currentDate.getFullYear(), month = currentDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = '2026-05-12';
  const weeks = [];
  let week = [];

  // Pad with prev month
  for (let i = 0; i < firstDay; i++) {
    const d = new Date(year, month, -firstDay + i + 1);
    week.push({ date: d, otherMonth: true });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month, d);
    week.push({ date, otherMonth: false });
    if (week.length === 7) { weeks.push(week); week = []; }
  }
  while (week.length > 0 && week.length < 7) {
    const last = week[week.length - 1].date;
    week.push({ date: new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1), otherMonth: true });
  }
  if (week.length) weeks.push(week);

  const dateKey = (d) => d.toISOString().slice(0, 10);
  const eventsByDate = events.reduce((acc, e) => {
    const k = e.date;
    if (!acc[k]) acc[k] = [];
    acc[k].push(e);
    return acc;
  }, {});

  return (
    <div className="k-surface" style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', borderBottom: '1px solid var(--border)', background: 'var(--bg-subtle)' }}>
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d, i) => (
          <div key={d} style={{ padding: '10px 12px', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'center', borderLeft: i > 0 ? '1px solid var(--border)' : 'none' }}>{d}</div>
        ))}
      </div>
      {weeks.map((wk, wi) => (
        <div key={wi} style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', borderBottom: wi < weeks.length - 1 ? '1px solid var(--border)' : 'none' }}>
          {wk.map((day, di) => {
            const k = dateKey(day.date);
            const dayEvents = eventsByDate[k] || [];
            const isToday = k === today;
            return (
              <div key={di} style={{
                minHeight: 120, padding: 8, borderLeft: di > 0 ? '1px solid var(--border)' : 'none',
                background: isToday ? 'var(--accent-soft)' : day.otherMonth ? 'var(--bg-subtle)' : 'var(--surface)',
                opacity: day.otherMonth ? 0.5 : 1, position: 'relative',
                minWidth: 0, overflow: 'hidden',
              }}>
                <div style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  width: 24, height: 24, borderRadius: '50%',
                  background: isToday ? 'var(--accent)' : 'transparent',
                  color: isToday ? 'white' : 'var(--text)',
                  fontSize: 12, fontWeight: isToday ? 700 : 500, marginBottom: 6,
                }}>{day.date.getDate()}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {dayEvents.slice(0, 3).map(ev => (
                    <button key={ev.id} onClick={() => onEventClick(ev)} style={{
                      background: ev.color + '18', color: ev.color,
                      border: 'none', borderLeft: `3px solid ${ev.color}`,
                      padding: '3px 6px', borderRadius: 3,
                      fontSize: 10.5, fontWeight: 500, textAlign: 'left', cursor: 'pointer',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }} title={ev.title}>
                      {ev.title}
                    </button>
                  ))}
                  {dayEvents.length > 3 && (
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 500, padding: '2px 6px' }}>+ {dayEvents.length - 3} more</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function WeekGrid({ currentDate, events, onEventClick }) {
  const year = currentDate.getFullYear(), month = currentDate.getMonth();
  const today = new Date(2026, 4, 12); // May 12
  const startOfWeek = new Date(today.getFullYear(), today.getMonth(), today.getDate() - today.getDay());
  const days = Array.from({ length: 7 }, (_, i) => new Date(startOfWeek.getFullYear(), startOfWeek.getMonth(), startOfWeek.getDate() + i));
  const hours = Array.from({ length: 11 }, (_, i) => 7 + i); // 7am to 5pm

  const eventsByDate = events.reduce((acc, e) => {
    if (!acc[e.date]) acc[e.date] = [];
    acc[e.date].push({ ...e, hour: 8 + (acc[e.date].length % 8) });
    return acc;
  }, {});

  return (
    <div className="k-surface" style={{ padding: 0, overflow: 'auto' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '60px repeat(7, minmax(0, 1fr))', borderBottom: '1px solid var(--border)', background: 'var(--bg-subtle)', position: 'sticky', top: 0, zIndex: 1 }}>
        <div/>
        {days.map((d, i) => {
          const isToday = d.toISOString().slice(0, 10) === '2026-05-12';
          return (
            <div key={i} style={{ padding: '10px 12px', textAlign: 'center', borderLeft: '1px solid var(--border)' }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>{['SUN','MON','TUE','WED','THU','FRI','SAT'][i]}</div>
              <div style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                width: 28, height: 28, borderRadius: '50%',
                background: isToday ? 'var(--accent)' : 'transparent',
                color: isToday ? 'white' : 'var(--text)',
                fontSize: 14, fontWeight: 700, marginTop: 2,
              }}>{d.getDate()}</div>
            </div>
          );
        })}
      </div>
      {hours.map(h => (
        <div key={h} style={{ display: 'grid', gridTemplateColumns: '60px repeat(7, minmax(0, 1fr))', borderBottom: '1px solid var(--border)', minHeight: 64 }}>
          <div style={{ padding: '4px 8px', fontSize: 10.5, color: 'var(--text-muted)', textAlign: 'right' }}>{h}:00</div>
          {days.map((d, di) => {
            const k = d.toISOString().slice(0, 10);
            const dayEvents = (eventsByDate[k] || []).filter(e => e.hour === h);
            return (
              <div key={di} style={{ borderLeft: '1px solid var(--border)', padding: 3, position: 'relative' }}>
                {dayEvents.map(ev => (
                  <button key={ev.id} onClick={() => onEventClick(ev)} style={{
                    width: '100%', background: ev.color + '18', color: ev.color,
                    border: `1px solid ${ev.color}40`, borderLeft: `3px solid ${ev.color}`,
                    padding: '4px 6px', borderRadius: 4, marginBottom: 2,
                    fontSize: 10.5, fontWeight: 500, textAlign: 'left', cursor: 'pointer',
                  }} title={ev.title}>
                    <div style={{ fontWeight: 700, fontSize: 10 }}>{h}:00</div>
                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.title}</div>
                  </button>
                ))}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function ListView({ events, setRoute, setInspection, setAudit }) {
  const grouped = events
    .sort((a, b) => a.date.localeCompare(b.date))
    .reduce((acc, ev) => {
      if (!acc[ev.date]) acc[ev.date] = [];
      acc[ev.date].push(ev);
      return acc;
    }, {});

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {Object.entries(grouped).map(([date, evs]) => {
        const d = new Date(date);
        return (
          <div key={date}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 8, padding: '0 4px' }}>
              <span style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.01em' }}>{d.getDate()}</span>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{d.toLocaleString('en-US', { weekday: 'long', month: 'short' })}</span>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 'auto' }}>{evs.length} item{evs.length !== 1 ? 's' : ''}</span>
            </div>
            <div className="k-surface" style={{ padding: 0, overflow: 'hidden' }}>
              {evs.map(ev => {
                const owner = userById(ev.ownerId);
                return (
                  <div key={ev.id} onClick={() => {
                    if (ev.type === 'inspection') { setInspection(ev.id); setRoute('inspection-detail'); }
                    else { setAudit(ev.id); setRoute('audit-detail'); }
                  }} style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
                    <div style={{ width: 4, height: 36, background: ev.color, borderRadius: 2 }}/>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 2 }}>{ev.title}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        <span style={{ fontFamily: 'var(--font-mono)' }}>{ev.id}</span> · {ev.location || 'No location'}
                      </div>
                    </div>
                    <span className="k-chip" style={{ background: ev.color + '18', color: ev.color, textTransform: 'capitalize' }}>{ev.type}</span>
                    <Avatar user={owner} size={24}/>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

Object.assign(window, { ScheduleView });
