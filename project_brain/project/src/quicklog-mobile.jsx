// Kaenal — Phase 1 "Zero-Friction" Quick-Log · Mobile field-capture screens
// Three screens that demonstrate the multimedia capture story:
//   1. Quick-Log sheet (voice → transcript → AI structure, all on one screen)
//   2. Tap-to-annotate photo editor
//   3. Auto-captured context (geolocation, QR asset, shift, batch)

const QLM = {
  primary: '#2563eb',
  primaryDark: '#1e40af',
  bg: '#f6f8fb',
  surface: '#ffffff',
  text: '#0f172a',
  muted: '#64748b',
  subtle: '#94a3b8',
  border: '#e6eaf0',
  borderStrong: '#cbd5e1',
  success: '#16a34a',
  warn: '#f59e0b',
  danger: '#dc2626',
  violet: '#7c3aed',
};

const QLChip = ({ children, bg, fg, mono }) => (
  <span style={{
    display: 'inline-flex', alignItems: 'center', gap: 4,
    padding: '3px 8px', borderRadius: 999, fontSize: 11, fontWeight: 600,
    background: bg, color: fg, fontFamily: mono ? 'ui-monospace, monospace' : 'inherit',
    whiteSpace: 'nowrap',
  }}>{children}</span>
);

// ——— Screen 1: Quick-Log capture sheet ———
const QLScreen_Capture = () => (
  <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: QLM.bg, color: QLM.text, fontFamily: '-apple-system, system-ui, sans-serif' }}>
    {/* App bar */}
    <div style={{ padding: '10px 16px 12px', background: QLM.surface, borderBottom: `1px solid ${QLM.border}` }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, fontWeight: 600, color: QLM.muted }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: QLM.success, boxShadow: `0 0 0 3px ${QLM.success}22` }}/>
          Plant A · Weld Cell 3
        </div>
        <button style={{ background: 'none', border: 'none', padding: 4, color: QLM.muted }}>
          <Icon name="x" size={20}/>
        </button>
      </div>
      <div style={{ fontSize: 23, fontWeight: 800, letterSpacing: '-0.02em', marginTop: 6 }}>Quick-Log</div>
      <div style={{ fontSize: 12, color: QLM.muted, marginTop: 1 }}>Say it, snap it, done. No forms.</div>
    </div>

    {/* Body */}
    <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Transcribed voice note */}
      <div style={{ background: QLM.surface, border: `1px solid ${QLM.border}`, borderRadius: 14, padding: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <span style={{ width: 26, height: 26, borderRadius: '50%', background: QLM.primary, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="mic" size={13} stroke={2}/>
          </span>
          <span style={{ fontSize: 12.5, fontWeight: 700 }}>Voice note</span>
          <QLChip bg="#eef2f7" fg={QLM.muted} mono>0:14</QLChip>
          <div style={{ flex: 1 }}/>
          <QLChip bg="#dcfce7" fg="#166534">Transcribed</QLChip>
        </div>
        {/* mini waveform */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 2.5, height: 20, marginBottom: 10 }}>
          {[6,11,5,14,9,12,7,15,10,13,6,12,8,11,6,14,9,12,5,10,7,13,8,11,6,9].map((h,i) => (
            <div key={i} style={{ width: 2.5, height: h, borderRadius: 2, background: QLM.primary, opacity: 0.28 }}/>
          ))}
        </div>
        <div style={{ fontSize: 13.5, lineHeight: 1.55, color: QLM.text }}>
          “Bracket weld bead on serial <mark style={{ background: '#fef3c7', borderRadius: 3, padding: '0 2px' }}>SN-A2104</mark> looks inconsistent — porosity around the seam, similar to last week. About a quarter inch off spec.”
        </div>
      </div>

      {/* AI structure card */}
      <div style={{ borderRadius: 14, padding: 14, background: 'linear-gradient(135deg, rgba(124,58,237,0.07), rgba(37,99,235,0.06))', border: '1px solid rgba(124,58,237,0.22)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <span style={{ width: 22, height: 22, borderRadius: '50%', background: 'linear-gradient(135deg,#a855f7,#6366f1)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="sparkles" size={12} stroke={2.25}/>
          </span>
          <span style={{ fontSize: 12.5, fontWeight: 700 }}>Structured for you</span>
          <div style={{ flex: 1 }}/>
          <span style={{ fontSize: 10.5, color: QLM.muted }}>tap any chip to edit</span>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {[
            { l: 'Type', v: 'NCR draft' },
            { l: 'Severity', v: 'High' },
            { l: 'Part', v: '#A-7742', mono: true },
            { l: 'Category', v: 'Weld / porosity' },
          ].map(c => (
            <span key={c.l} style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 9px',
              background: QLM.surface, border: `1px solid ${QLM.border}`, borderRadius: 9, fontSize: 12,
            }}>
              <span style={{ fontSize: 9.5, fontWeight: 700, color: QLM.subtle, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{c.l}</span>
              <span style={{ fontWeight: 600, fontFamily: c.mono ? 'ui-monospace, monospace' : 'inherit' }}>{c.v}</span>
            </span>
          ))}
        </div>
      </div>

      {/* Evidence + context strip */}
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, color: QLM.muted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 7 }}>Evidence</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ width: 70, height: 70, borderRadius: 11, background: 'linear-gradient(135deg,#475569,#1e293b)', position: 'relative', flexShrink: 0 }}>
            <span style={{ position: 'absolute', top: 6, left: 6, width: 14, height: 14, border: '2px solid #fbbf24', borderRadius: '50%' }}/>
            <span style={{ position: 'absolute', bottom: 4, left: 6, fontSize: 8.5, color: '#fff', fontWeight: 600 }}>2 marks</span>
          </div>
          <div style={{ width: 70, height: 70, borderRadius: 11, background: 'linear-gradient(135deg,#64748b,#334155)', flexShrink: 0 }}/>
          <button style={{ width: 70, height: 70, borderRadius: 11, border: `1.5px dashed ${QLM.borderStrong}`, background: QLM.surface, color: QLM.primary, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3 }}>
            <Icon name="camera" size={18}/>
            <span style={{ fontSize: 9.5, fontWeight: 600 }}>Add</span>
          </button>
        </div>
      </div>

      {/* Auto context */}
      <div style={{ background: QLM.surface, border: `1px solid ${QLM.border}`, borderRadius: 12, padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <Icon name="mapPin" size={15} style={{ color: QLM.primary }}/>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12.5, fontWeight: 600 }}>Weld Cell 3 · Station 3B</div>
          <div style={{ fontSize: 10.5, color: QLM.muted }}>GPS + QR · Lot HJ-22-04 · Shift A</div>
        </div>
        <QLChip bg="#dcfce7" fg="#166534">Auto</QLChip>
      </div>
    </div>

    {/* Capture bar */}
    <div style={{ background: QLM.surface, borderTop: `1px solid ${QLM.border}`, padding: '12px 16px 14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 11 }}>
        <button style={{ flex: 1, height: 46, borderRadius: 13, border: 'none', background: 'linear-gradient(135deg,#2563eb,#1e40af)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: 14, fontWeight: 700, boxShadow: '0 8px 18px -6px rgba(37,99,235,0.5)' }}>
          <Icon name="mic" size={18}/> Hold to talk
        </button>
        {[ 'camera', 'qr' ].map(ic => (
          <button key={ic} style={{ width: 46, height: 46, borderRadius: 13, border: `1px solid ${QLM.border}`, background: QLM.surface, color: QLM.text, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name={ic} size={19}/>
          </button>
        ))}
      </div>
      <button style={{ width: '100%', height: 46, borderRadius: 13, border: 'none', background: QLM.text, color: '#fff', fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
        Log it <Icon name="arrowRight" size={15} stroke={2.5}/>
      </button>
    </div>
  </div>
);

// ——— Screen 2: Tap-to-annotate photo editor ———
const QLScreen_Annotate = () => (
  <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#0a0a0a', color: '#fff', fontFamily: '-apple-system, system-ui, sans-serif' }}>
    {/* Top bar */}
    <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(0,0,0,0.6)' }}>
      <button style={{ background: 'none', border: 'none', color: '#fff', padding: 4 }}><Icon name="chevronLeft" size={22}/></button>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13.5, fontWeight: 700 }}>Annotate</div>
        <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.55)' }}>Tap the photo to drop a mark</div>
      </div>
      <button style={{ height: 30, padding: '0 14px', borderRadius: 9, border: 'none', background: QLM.primary, color: '#fff', fontSize: 12.5, fontWeight: 700 }}>Done</button>
    </div>

    {/* Photo canvas */}
    <div style={{ flex: 1, position: 'relative', overflow: 'hidden', background: 'radial-gradient(ellipse at 55% 42%, #555 0%, #1a1a1a 60%, #000 100%)' }}>
      <svg viewBox="0 0 400 600" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
        <defs>
          <linearGradient id="qlmetal" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#9ca3af"/><stop offset="0.5" stopColor="#4b5563"/><stop offset="1" stopColor="#1f2937"/>
          </linearGradient>
        </defs>
        <rect x="20" y="230" width="360" height="70" fill="url(#qlmetal)"/>
        <rect x="20" y="320" width="360" height="70" fill="url(#qlmetal)"/>
        <path d="M 20 312 Q 70 300, 120 314 T 230 310 Q 290 318, 360 308" stroke="#fbbf24" strokeWidth="13" fill="none" strokeLinecap="round" opacity="0.9"/>
        <path d="M 20 312 Q 70 300, 120 314 T 230 310 Q 290 318, 360 308" stroke="#fde68a" strokeWidth="5" fill="none" strokeLinecap="round" opacity="0.7"/>
      </svg>

      {/* Annotation 1 — circle + note (selected) */}
      <div style={{ position: 'absolute', top: 268, left: 168 }}>
        <div style={{ width: 56, height: 56, borderRadius: '50%', border: '3px solid #f87171', boxShadow: '0 0 0 2px rgba(0,0,0,0.4)' }}/>
        <div style={{ position: 'absolute', top: -6, left: -6, width: 22, height: 22, borderRadius: '50%', background: '#f87171', color: '#fff', fontSize: 11, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>1</div>
      </div>
      <div style={{ position: 'absolute', top: 200, left: 120, padding: '7px 10px', background: 'rgba(15,23,42,0.92)', backdropFilter: 'blur(8px)', borderRadius: 10, fontSize: 11.5, fontWeight: 600, border: '1px solid rgba(248,113,113,0.4)', maxWidth: 170 }}>
        Porosity cluster · ~3mm
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)', fontWeight: 400, marginTop: 1 }}>tap to edit · drag to move</div>
      </div>

      {/* Annotation 2 — arrow marker */}
      <div style={{ position: 'absolute', top: 360, left: 250 }}>
        <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#fbbf24', color: '#000', fontSize: 11, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>2</div>
      </div>

      {/* AI hint */}
      <div style={{ position: 'absolute', bottom: 14, left: 14, right: 14, padding: 11, background: 'rgba(15,23,42,0.85)', backdropFilter: 'blur(12px)', borderRadius: 12, border: '1px solid rgba(168,85,247,0.4)', display: 'flex', gap: 9, alignItems: 'center' }}>
        <span style={{ width: 26, height: 26, borderRadius: '50%', background: 'linear-gradient(135deg,#a855f7,#ec4899)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Icon name="sparkles" size={13} stroke={2.25}/>
        </span>
        <div style={{ fontSize: 11.5, lineHeight: 1.4 }}>
          <strong>AI pre-marked the defect</strong> · 87% match to NCR-0118
        </div>
      </div>

      {/* geotag pill */}
      <div style={{ position: 'absolute', top: 12, right: 12, padding: '5px 9px', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', borderRadius: 999, fontSize: 10.5, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5 }}>
        <Icon name="mapPin" size={11}/> 42.331, -83.045
      </div>
    </div>

    {/* Tool rail */}
    <div style={{ background: '#111', padding: '14px 18px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      {[
        { i: 'pen', l: 'Draw', a: false },
        { i: 'target', l: 'Circle', a: true },
        { i: 'arrowRight', l: 'Arrow', a: false },
        { i: 'type', l: 'Text', a: false },
        { i: 'hash', l: 'Measure', a: false },
      ].map(t => (
        <button key={t.l} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, background: 'none', border: 'none', color: t.a ? QLM.primary : 'rgba(255,255,255,0.55)' }}>
          <span style={{ width: 40, height: 40, borderRadius: 12, background: t.a ? 'rgba(37,99,235,0.18)' : 'rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name={t.i} size={18} stroke={2}/>
          </span>
          <span style={{ fontSize: 9.5, fontWeight: 600 }}>{t.l}</span>
        </button>
      ))}
    </div>
  </div>
);

// ——— Screen 3: Auto-captured context ———
const QLScreen_Context = () => (
  <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: QLM.bg, color: QLM.text, fontFamily: 'Roboto, system-ui, sans-serif' }}>
    {/* App bar */}
    <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10, background: QLM.surface, borderBottom: `1px solid ${QLM.border}` }}>
      <button style={{ background: 'none', border: 'none', padding: 4, color: QLM.text }}><Icon name="chevronLeft" size={22}/></button>
      <div>
        <div style={{ fontSize: 14.5, fontWeight: 700 }}>Context attached</div>
        <div style={{ fontSize: 10.5, color: QLM.muted }}>Captured automatically — no typing</div>
      </div>
    </div>

    {/* Map card */}
    <div style={{ margin: 16, borderRadius: 16, overflow: 'hidden', border: `1px solid ${QLM.border}`, position: 'relative', height: 170, background: '#e8eef5' }}>
      {/* stylized map */}
      <svg viewBox="0 0 400 200" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
        <rect width="400" height="200" fill="#eaf0f6"/>
        {[40,90,140,190,240,290,340].map(x => <line key={'v'+x} x1={x} y1="0" x2={x} y2="200" stroke="#d4dde8" strokeWidth="1"/>)}
        {[40,90,140,190].map(y => <line key={'h'+y} x1="0" y1={y} x2="400" y2={y} stroke="#d4dde8" strokeWidth="1"/>)}
        <rect x="90" y="40" width="150" height="100" rx="4" fill="#dbe6f1" stroke="#c3d2e2"/>
        <rect x="250" y="90" width="90" height="70" rx="4" fill="#dbe6f1" stroke="#c3d2e2"/>
        <path d="M0 150 L400 130" stroke="#cfdae6" strokeWidth="6" fill="none"/>
      </svg>
      {/* pin */}
      <div style={{ position: 'absolute', top: 66, left: 150 }}>
        <div style={{ width: 16, height: 16, borderRadius: '50%', background: QLM.primary, border: '3px solid #fff', boxShadow: '0 2px 6px rgba(0,0,0,0.3)' }}/>
        <div style={{ position: 'absolute', inset: -10, borderRadius: '50%', border: `2px solid ${QLM.primary}`, opacity: 0.35 }}/>
      </div>
      <div style={{ position: 'absolute', bottom: 10, left: 12, padding: '6px 10px', background: 'rgba(255,255,255,0.95)', borderRadius: 10, fontSize: 11.5, fontWeight: 700, boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
        <Icon name="mapPin" size={11} style={{ color: QLM.primary, marginRight: 4 }}/>
        Plant A · Weld Cell 3 · Station 3B
      </div>
    </div>

    {/* Auto-detected list */}
    <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px' }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: QLM.muted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Auto-detected</div>
      <div style={{ background: QLM.surface, borderRadius: 14, border: `1px solid ${QLM.border}` }}>
        {[
          { i: 'mapPin', l: 'Location', v: '42.331, -83.045', src: 'GPS' },
          { i: 'qr', l: 'Asset', v: 'MIG Welder W-03', src: 'QR scan' },
          { i: 'package', l: 'Batch / lot', v: 'HJ-22-04', src: 'QR scan' },
          { i: 'clock', l: 'Shift', v: 'Shift A · 06:00–14:00', src: 'Schedule' },
          { i: 'user', l: 'Operator', v: 'L. Wei', src: 'Badge' },
        ].map((r, i, arr) => (
          <div key={r.l} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '12px 14px', borderBottom: i < arr.length - 1 ? `1px solid ${QLM.border}` : 'none' }}>
            <span style={{ width: 32, height: 32, borderRadius: 9, background: '#eef2f7', color: QLM.primary, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Icon name={r.i} size={15}/>
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 10.5, color: QLM.muted, fontWeight: 600 }}>{r.l}</div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{r.v}</div>
            </div>
            <QLChip bg="#eef2f7" fg={QLM.muted}>{r.src}</QLChip>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 12, fontSize: 11.5, color: QLM.muted }}>
        <Icon name="info" size={13}/> Wrong spot? Tap any row to correct it.
      </div>
    </div>

    {/* Confirm */}
    <div style={{ padding: 16, background: QLM.surface, borderTop: `1px solid ${QLM.border}` }}>
      <button style={{ width: '100%', height: 46, borderRadius: 13, border: 'none', background: QLM.primary, color: '#fff', fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
        <Icon name="check" size={16} stroke={2.5}/> Looks right — attach
      </button>
    </div>
  </div>
);

const QL_MOBILE_SCREENS = [
  { id: 'capture', label: 'Quick-Log sheet', frame: 'ios', component: QLScreen_Capture,
    desc: 'One screen: voice auto-transcribes, AI structures it into editable chips, evidence + context ride along. Three taps to log.' },
  { id: 'annotate', label: 'Tap-to-annotate', frame: 'ios', component: QLScreen_Annotate,
    desc: 'Drop circles, arrows, text and measurements straight onto the photo. AI pre-marks likely defects; geotag is stamped in.' },
  { id: 'context', label: 'Auto context', frame: 'android', component: QLScreen_Context,
    desc: 'Location, asset, batch, shift and operator captured from GPS, QR and badge — zero fields typed, all correctable.' },
];

Object.assign(window, { QL_MOBILE_SCREENS, QLM });
