// Kaenal — Mobile Inspector page
// 6 screens across iOS + Android frames showcasing the field inspector experience

const { useState: useSm } = React;

// Brand color for mobile app
const M = {
  primary: '#2563eb',
  primaryDark: '#1e40af',
  bg: '#f8fafc',
  surface: '#ffffff',
  text: '#0f172a',
  muted: '#64748b',
  subtle: '#94a3b8',
  border: '#e2e8f0',
  borderStrong: '#cbd5e1',
  success: '#16a34a',
  warn: '#f59e0b',
  danger: '#dc2626',
};

const MIcon = ({ name, size = 16, stroke = 1.75, color = 'currentColor', style = {} }) => (
  <Icon name={name} size={size} stroke={stroke} style={{ color, ...style }}/>
);

// ——— Screen 1: Inspections list ———
const Screen_InspectionsList = () => (
  <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: M.bg, color: M.text, fontFamily: '-apple-system, system-ui, sans-serif' }}>
    {/* App bar */}
    <div style={{ padding: '8px 16px 12px', background: M.surface, borderBottom: `1px solid ${M.border}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div>
          <div style={{ fontSize: 11, color: M.muted, fontWeight: 500 }}>Plant A · Detroit</div>
          <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em' }}>Today's work</div>
        </div>
        <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#b45309', fontSize: 13, fontWeight: 700 }}>SC</div>
      </div>
      {/* Pills row */}
      <div style={{ display: 'flex', gap: 6, marginTop: 4, overflowX: 'auto', paddingBottom: 2 }}>
        <span style={{ padding: '6px 12px', background: M.primary, color: 'white', borderRadius: 999, fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' }}>Assigned · 6</span>
        <span style={{ padding: '6px 12px', background: '#fef2f2', color: M.danger, borderRadius: 999, fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' }}>Overdue · 2</span>
        <span style={{ padding: '6px 12px', background: M.surface, border: `1px solid ${M.border}`, color: M.muted, borderRadius: 999, fontSize: 12, fontWeight: 500, whiteSpace: 'nowrap' }}>Done · 14</span>
      </div>
    </div>

    {/* List */}
    <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
      {[
        { id: 'INS-0421', title: 'Line 3 — Weld station daily checks', meta: '14 questions', due: 'Due in 2h', overdue: false, priority: 'high', site: 'Welding' },
        { id: 'INS-0422', title: 'Cleanroom particle count — Suite B', meta: '6 questions', due: 'Due now', overdue: false, priority: 'medium', site: 'Cleanroom' },
        { id: 'INS-0423', title: 'PPE compliance — Floor walk', meta: '12 questions', due: 'Overdue 1d', overdue: true, priority: 'critical', site: 'All Lines' },
        { id: 'INS-0424', title: 'Incoming material — Steel coils QA-7', meta: '18 questions', due: 'Due tomorrow', overdue: false, priority: 'medium', site: 'Receiving' },
        { id: 'INS-0425', title: 'Forklift safety — Pre-shift', meta: '8 questions', due: 'Due 3pm', overdue: false, priority: 'high', site: 'Logistics' },
        { id: 'INS-0426', title: 'Hydraulic press calibration', meta: '22 questions', due: 'Due Fri', overdue: false, priority: 'low', site: 'Press shop' },
      ].map(it => (
        <div key={it.id} style={{
          background: M.surface, padding: '14px 16px', marginBottom: 6,
          borderTop: `1px solid ${M.border}`, borderBottom: `1px solid ${M.border}`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 10, fontWeight: 700, color: M.muted, letterSpacing: '0.02em' }}>{it.id}</span>
            <span style={{
              padding: '2px 7px', borderRadius: 999, fontSize: 9.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em',
              background: it.priority === 'critical' ? '#fee2e2' : it.priority === 'high' ? '#fef3c7' : it.priority === 'medium' ? '#dbeafe' : '#dcfce7',
              color: it.priority === 'critical' ? '#991b1b' : it.priority === 'high' ? '#92400e' : it.priority === 'medium' ? '#1e40af' : '#166534',
            }}>{it.priority}</span>
            <div style={{ flex: 1 }}/>
            <span style={{ fontSize: 11, color: it.overdue ? M.danger : M.muted, fontWeight: 600 }}>{it.due}</span>
          </div>
          <div style={{ fontSize: 14.5, fontWeight: 600, marginBottom: 4, lineHeight: 1.3 }}>{it.title}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 11, color: M.muted }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}><MIcon name="mapPin" size={11}/>{it.site}</span>
            <span>·</span>
            <span>{it.meta}</span>
          </div>
        </div>
      ))}
    </div>

    {/* Bottom tab bar */}
    <div style={{ display: 'flex', background: M.surface, borderTop: `1px solid ${M.border}`, padding: '8px 0 4px' }}>
      {[
        { i: 'home', l: 'Home', a: false },
        { i: 'clipboard', l: 'Inspect', a: true },
        { i: 'plus', l: '', a: false, fab: true },
        { i: 'alert', l: 'NCRs', a: false },
        { i: 'user', l: 'Me', a: false },
      ].map((t, i) => (
        <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, color: t.a ? M.primary : M.subtle }}>
          {t.fab ? (
            <div style={{ width: 44, height: 44, borderRadius: '50%', background: M.primary, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 10px -2px rgba(37,99,235,0.4)' }}>
              <Icon name="plus" size={22} stroke={2.5}/>
            </div>
          ) : (
            <>
              <Icon name={t.i} size={20} stroke={t.a ? 2.25 : 1.75}/>
              <span style={{ fontSize: 10, fontWeight: t.a ? 600 : 500 }}>{t.l}</span>
            </>
          )}
        </div>
      ))}
    </div>
  </div>
);

// ——— Screen 2: Inspection running (checklist) ———
const Screen_Checklist = () => (
  <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: M.bg, color: M.text, fontFamily: '-apple-system, system-ui, sans-serif' }}>
    {/* Header */}
    <div style={{ padding: '8px 16px 14px', background: M.surface, borderBottom: `1px solid ${M.border}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <button style={{ background: 'transparent', border: 'none', padding: 4, color: M.text, marginLeft: -4 }}>
          <Icon name="chevronLeft" size={22}/>
        </button>
        <div style={{ fontSize: 11, color: M.muted, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>INS-0421 · Welding</div>
      </div>
      <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.01em', marginBottom: 8, lineHeight: 1.25 }}>Line 3 — Weld station daily checks</div>
      {/* Progress */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12 }}>
        <div style={{ flex: 1, height: 6, background: '#e0e7ff', borderRadius: 999, overflow: 'hidden' }}>
          <div style={{ width: '57%', height: '100%', background: M.primary, borderRadius: 999 }}/>
        </div>
        <span style={{ fontFamily: 'ui-monospace, monospace', fontWeight: 600, color: M.muted }}>8/14</span>
      </div>
    </div>

    {/* Section header */}
    <div style={{ padding: '12px 16px 6px', fontSize: 11, fontWeight: 700, color: M.muted, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
      Section 3 of 5 — Weld parameters
    </div>

    {/* Question card 1 — answered */}
    <div style={{ background: M.surface, padding: 16, borderTop: `1px solid ${M.border}`, borderBottom: `1px solid ${M.border}`, marginBottom: 8 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 8 }}>
        <div style={{ width: 22, height: 22, borderRadius: '50%', background: M.success, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Icon name="check" size={13} stroke={3}/>
        </div>
        <div style={{ fontSize: 14.5, fontWeight: 600, lineHeight: 1.35, flex: 1 }}>Wire feed pressure within 3.2–3.8 bar?</div>
      </div>
      <div style={{ display: 'flex', gap: 8, paddingLeft: 30 }}>
        <button style={{ flex: 1, padding: '10px 14px', background: '#dcfce7', color: '#166534', border: `1.5px solid ${M.success}`, borderRadius: 8, fontSize: 13, fontWeight: 600 }}>✓ Pass</button>
        <button style={{ flex: 1, padding: '10px 14px', background: M.surface, color: M.muted, border: `1px solid ${M.border}`, borderRadius: 8, fontSize: 13, fontWeight: 500 }}>Fail</button>
        <button style={{ flex: 1, padding: '10px 14px', background: M.surface, color: M.muted, border: `1px solid ${M.border}`, borderRadius: 8, fontSize: 13, fontWeight: 500 }}>N/A</button>
      </div>
      <div style={{ paddingLeft: 30, marginTop: 8, fontSize: 11, color: M.muted, fontFamily: 'ui-monospace, monospace' }}>Reading: 3.5 bar · Sara Chen · 2 min ago</div>
    </div>

    {/* Question card 2 — current */}
    <div style={{ background: M.surface, padding: 16, borderTop: `2px solid ${M.primary}`, borderBottom: `1px solid ${M.border}`, marginBottom: 8 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 12 }}>
        <div style={{ width: 22, height: 22, borderRadius: '50%', border: `2px solid ${M.primary}`, color: M.primary, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 11, fontWeight: 700 }}>9</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14.5, fontWeight: 600, lineHeight: 1.35, marginBottom: 2 }}>Photograph weld bead at points A, B, C</div>
          <div style={{ fontSize: 11, color: M.muted }}>Required · 3 photos minimum</div>
        </div>
      </div>
      <div style={{ paddingLeft: 30, display: 'flex', gap: 8, marginBottom: 10 }}>
        {/* Captured photos */}
        <div style={{ width: 64, height: 64, borderRadius: 8, background: 'linear-gradient(135deg, #475569, #1e293b)', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', bottom: 4, left: 4, right: 4, fontSize: 9, color: 'white', fontWeight: 600, textShadow: '0 1px 2px rgba(0,0,0,0.6)' }}>Point A</div>
        </div>
        <div style={{ width: 64, height: 64, borderRadius: 8, background: 'linear-gradient(135deg, #64748b, #334155)', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', bottom: 4, left: 4, right: 4, fontSize: 9, color: 'white', fontWeight: 600, textShadow: '0 1px 2px rgba(0,0,0,0.6)' }}>Point B</div>
        </div>
        <button style={{ width: 64, height: 64, borderRadius: 8, background: M.bg, border: `2px dashed ${M.borderStrong}`, color: M.primary, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
          <Icon name="camera" size={20} stroke={1.75}/>
          <span style={{ fontSize: 9, fontWeight: 600 }}>Add</span>
        </button>
      </div>
      <div style={{ paddingLeft: 30, marginBottom: 4 }}>
        <textarea placeholder="Notes (optional)" style={{ width: '100%', padding: 10, fontSize: 13, border: `1px solid ${M.border}`, borderRadius: 8, fontFamily: 'inherit', resize: 'none', height: 60, color: M.text, background: M.bg }}/>
      </div>
    </div>

    {/* Bottom action */}
    <div style={{ marginTop: 'auto', padding: '12px 16px', background: M.surface, borderTop: `1px solid ${M.border}`, display: 'flex', gap: 8 }}>
      <button style={{ flex: 1, padding: '12px', background: '#fee2e2', color: M.danger, border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 600 }}>Flag NCR</button>
      <button style={{ flex: 2, padding: '12px', background: M.primary, color: 'white', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 600 }}>Save & next →</button>
    </div>
  </div>
);

// ——— Screen 3: Camera + AI defect ———
const Screen_Camera = () => (
  <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#0a0a0a', color: 'white', position: 'relative', fontFamily: '-apple-system, system-ui, sans-serif' }}>
    {/* Camera view (simulated weld photo) */}
    <div style={{ flex: 1, position: 'relative', overflow: 'hidden', background: 'radial-gradient(ellipse at 60% 40%, #444 0%, #1a1a1a 60%, #000 100%)' }}>
      {/* Weld bead silhouette */}
      <svg viewBox="0 0 400 600" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
        <defs>
          <linearGradient id="metal" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#9ca3af"/>
            <stop offset="0.5" stopColor="#4b5563"/>
            <stop offset="1" stopColor="#1f2937"/>
          </linearGradient>
        </defs>
        {/* Two metal plates */}
        <rect x="30" y="220" width="340" height="80" fill="url(#metal)"/>
        <rect x="30" y="320" width="340" height="80" fill="url(#metal)"/>
        {/* Weld bead */}
        <path d="M 30 305 Q 60 295, 100 308 T 200 305 Q 250 312, 300 302 T 370 308" stroke="#fbbf24" strokeWidth="14" fill="none" strokeLinecap="round" opacity="0.9"/>
        <path d="M 30 305 Q 60 295, 100 308 T 200 305 Q 250 312, 300 302 T 370 308" stroke="#fde68a" strokeWidth="6" fill="none" strokeLinecap="round" opacity="0.7"/>
        {/* Defect highlight */}
        <circle cx="220" cy="305" r="38" fill="none" stroke="#f87171" strokeWidth="3" strokeDasharray="6 4"/>
        <circle cx="220" cy="305" r="38" fill="rgba(248,113,113,0.12)"/>
      </svg>

      {/* Top status */}
      <div style={{ position: 'absolute', top: 16, left: 16, right: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ padding: '6px 10px', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(10px)', borderRadius: 999, fontSize: 11, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#ef4444' }}/>
          REC · Point B
        </div>
        <button style={{ padding: 8, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(10px)', borderRadius: '50%', color: 'white', border: 'none' }}>
          <Icon name="x" size={18}/>
        </button>
      </div>

      {/* AI tip */}
      <div style={{ position: 'absolute', bottom: 110, left: 16, right: 16, padding: 12, background: 'rgba(15,23,42,0.85)', backdropFilter: 'blur(12px)', borderRadius: 12, border: '1px solid rgba(168,85,247,0.4)', display: 'flex', gap: 10 }}>
        <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'linear-gradient(135deg, #a855f7, #ec4899)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Icon name="sparkles" size={14} stroke={2.25}/>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 2 }}>AI detected possible porosity</div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.65)', lineHeight: 1.45 }}>Confidence 87% · Similar to NCR-0118. Tap to auto-create NCR draft.</div>
        </div>
      </div>
    </div>

    {/* Bottom controls */}
    <div style={{ padding: '20px 24px 32px', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <button style={{ padding: 10, background: 'rgba(255,255,255,0.1)', borderRadius: 12, border: 'none', color: 'white' }}>
        <Icon name="grip" size={20}/>
      </button>
      <button style={{ width: 64, height: 64, borderRadius: '50%', background: 'white', border: '4px solid rgba(255,255,255,0.3)', boxShadow: '0 0 0 2px white' }}/>
      <button style={{ padding: 10, background: 'rgba(255,255,255,0.1)', borderRadius: 12, border: 'none', color: 'white' }}>
        <Icon name="refresh" size={20}/>
      </button>
    </div>
  </div>
);

// ——— Screen 4: Voice NCR (Android) ———
const Screen_Voice = () => (
  <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'linear-gradient(180deg, #f8fafc, #e0e7ff)', color: M.text, fontFamily: 'Roboto, system-ui, sans-serif' }}>
    {/* App bar */}
    <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
      <button style={{ background: 'transparent', border: 'none', padding: 4, color: M.text }}>
        <Icon name="chevronLeft" size={22}/>
      </button>
      <div>
        <div style={{ fontSize: 11, color: M.muted, fontWeight: 500 }}>New Non-Conformity · Voice mode</div>
        <div style={{ fontSize: 16, fontWeight: 600 }}>Just describe what you see</div>
      </div>
    </div>

    {/* Big mic */}
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16 }}>
      <div style={{ position: 'relative' }}>
        {/* Pulse rings */}
        <div style={{ position: 'absolute', inset: -28, borderRadius: '50%', border: `2px solid ${M.primary}`, opacity: 0.2 }}/>
        <div style={{ position: 'absolute', inset: -16, borderRadius: '50%', border: `2px solid ${M.primary}`, opacity: 0.4 }}/>
        <div style={{ width: 120, height: 120, borderRadius: '50%', background: `linear-gradient(135deg, ${M.primary}, ${M.primaryDark})`, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 12px 30px -6px rgba(37,99,235,0.5)', color: 'white' }}>
          <Icon name="mic" size={42} stroke={1.5}/>
        </div>
      </div>
      <div style={{ fontSize: 13, color: M.muted, fontWeight: 500 }}>Listening… 0:14</div>

      {/* Live waveform */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 3, height: 32 }}>
        {[12, 22, 8, 28, 18, 24, 14, 30, 20, 26, 10, 24, 16, 22, 12, 28, 18].map((h, i) => (
          <div key={i} style={{ width: 3, height: h, background: M.primary, borderRadius: 999, opacity: 0.4 + (Math.abs(i - 8) < 5 ? 0.5 : 0.1) }}/>
        ))}
      </div>

      {/* Live transcript */}
      <div style={{ width: '100%', padding: 14, background: M.surface, borderRadius: 12, border: `1px solid ${M.border}`, fontSize: 13.5, color: M.text, lineHeight: 1.55, minHeight: 100 }}>
        <span>I'm at Plant A Line 3. The bracket weld bead on serial </span>
        <span style={{ background: '#fef3c7', borderRadius: 3 }}>SN-A2104</span>
        <span> looks inconsistent — porosity around the seam, similar to what we saw last week. </span>
        <span style={{ color: M.muted }}>It's about a quarter inch off spec…</span>
      </div>

      {/* AI suggestion */}
      <div style={{ width: '100%', padding: 12, background: 'linear-gradient(135deg, rgba(168,85,247,0.08), rgba(236,72,153,0.08))', border: '1px solid rgba(168,85,247,0.3)', borderRadius: 12, display: 'flex', gap: 10 }}>
        <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'linear-gradient(135deg, #a855f7, #ec4899)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: 'white' }}>
          <Icon name="sparkles" size={12} stroke={2.5}/>
        </div>
        <div style={{ fontSize: 12, lineHeight: 1.5 }}>
          <div style={{ fontWeight: 600 }}>AI is filling in the form</div>
          <div style={{ color: M.muted }}>Detected: <strong>Plant A · Line 3 · SN-A2104 · Weld defect (porosity)</strong>. Tap stop to review.</div>
        </div>
      </div>
    </div>

    {/* Action buttons */}
    <div style={{ padding: '16px', display: 'flex', gap: 8 }}>
      <button style={{ flex: 1, padding: '14px', background: M.surface, color: M.muted, border: `1px solid ${M.border}`, borderRadius: 12, fontSize: 14, fontWeight: 500 }}>Cancel</button>
      <button style={{ flex: 2, padding: '14px', background: M.primary, color: 'white', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
        <span style={{ width: 10, height: 10, background: 'white', borderRadius: 2 }}/>
        Stop & review
      </button>
    </div>
  </div>
);

// ——— Screen 5: NCR detail (mobile) ———
const Screen_NCRDetail = () => (
  <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: M.bg, color: M.text, fontFamily: '-apple-system, system-ui, sans-serif' }}>
    {/* Header */}
    <div style={{ padding: '8px 16px 16px', background: M.surface, borderBottom: `1px solid ${M.border}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <button style={{ background: 'transparent', border: 'none', padding: 4, color: M.text, marginLeft: -4 }}>
          <Icon name="chevronLeft" size={22}/>
        </button>
        <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 11, fontWeight: 700, color: M.muted }}>NCR-2026-0184</span>
        <div style={{ flex: 1 }}/>
        <span style={{ padding: '3px 9px', background: '#fef3c7', color: '#92400e', borderRadius: 999, fontSize: 10, fontWeight: 700, textTransform: 'uppercase' }}>HIGH</span>
        <span style={{ padding: '3px 9px', background: '#dbeafe', color: '#1e40af', borderRadius: 999, fontSize: 10, fontWeight: 700, textTransform: 'uppercase' }}>OPEN</span>
      </div>
      <div style={{ fontSize: 17, fontWeight: 700, lineHeight: 1.3, marginBottom: 6 }}>Bracket weld bead inconsistent on Line 2</div>
      <div style={{ fontSize: 12, color: M.muted, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Icon name="mapPin" size={11}/>Plant A · Line 2</span>
        <span>·</span>
        <span>Today, 10:42 am</span>
      </div>
    </div>

    {/* Body — scrollable */}
    <div style={{ flex: 1, overflowY: 'auto', padding: '16px 0' }}>
      {/* Photos */}
      <div style={{ padding: '0 16px 16px' }}>
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto' }}>
          <div style={{ width: 110, height: 110, borderRadius: 10, background: 'linear-gradient(135deg, #475569, #1e293b)', flexShrink: 0, position: 'relative' }}>
            <div style={{ position: 'absolute', bottom: 4, left: 6, fontSize: 9, color: 'white', fontWeight: 600 }}>Bead — top</div>
          </div>
          <div style={{ width: 110, height: 110, borderRadius: 10, background: 'linear-gradient(135deg, #64748b, #334155)', flexShrink: 0, position: 'relative' }}>
            <div style={{ position: 'absolute', bottom: 4, left: 6, fontSize: 9, color: 'white', fontWeight: 600 }}>Side view</div>
          </div>
          <div style={{ width: 110, height: 110, borderRadius: 10, background: 'linear-gradient(135deg, #94a3b8, #475569)', flexShrink: 0 }}/>
        </div>
      </div>

      {/* Section */}
      <div style={{ padding: '0 16px 8px', fontSize: 11, fontWeight: 700, color: M.muted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Description</div>
      <div style={{ padding: '0 16px', fontSize: 13.5, lineHeight: 1.55, color: M.text }}>
        Welder noticed bead inconsistency on bracket SN-A2104. Visible porosity on roughly 3" of the seam. Production paused on this lot pending containment.
      </div>

      {/* Meta grid */}
      <div style={{ padding: '20px 16px 8px', fontSize: 11, fontWeight: 700, color: M.muted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Details</div>
      <div style={{ background: M.surface, margin: '0 16px', borderRadius: 10, border: `1px solid ${M.border}` }}>
        {[
          { l: 'Reporter', r: 'Sara Chen' },
          { l: 'Owner', r: 'Lin Wei' },
          { l: 'Category', r: 'Weld defect / porosity' },
          { l: 'Severity', r: 'High · 12 units affected' },
          { l: 'Due', r: 'Friday, May 8' },
        ].map((row, i, arr) => (
          <div key={row.l} style={{ display: 'flex', justifyContent: 'space-between', padding: '11px 14px', borderBottom: i < arr.length - 1 ? `1px solid ${M.border}` : 'none', fontSize: 13 }}>
            <span style={{ color: M.muted }}>{row.l}</span>
            <span style={{ fontWeight: 500 }}>{row.r}</span>
          </div>
        ))}
      </div>

      {/* Linked 8D banner */}
      <div style={{ margin: '16px', padding: 14, background: 'linear-gradient(135deg, rgba(99,102,241,0.08), rgba(168,85,247,0.05))', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 12, display: 'flex', gap: 12, alignItems: 'center' }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(99,102,241,0.18)', color: '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="brain" size={18}/>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 600 }}>Promote to 8D investigation</div>
          <div style={{ fontSize: 11, color: M.muted, marginTop: 2 }}>3rd repeat in 30 days. Recommended.</div>
        </div>
        <Icon name="chevronRight" size={16} style={{ color: '#6366f1' }}/>
      </div>
    </div>

    {/* Actions */}
    <div style={{ padding: '12px 16px', background: M.surface, borderTop: `1px solid ${M.border}`, display: 'flex', gap: 8 }}>
      <button style={{ flex: 1, padding: '12px', background: M.surface, color: M.text, border: `1px solid ${M.border}`, borderRadius: 10, fontSize: 13, fontWeight: 600 }}>Comment</button>
      <button style={{ flex: 1, padding: '12px', background: M.primary, color: 'white', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 600 }}>Take action</button>
    </div>
  </div>
);

// ——— Screen 7: NCR creation flow (mobile) — 3 steps in one shot ———
const Screen_NCRCreate = () => (
  <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: M.bg, color: M.text, fontFamily: '-apple-system, system-ui, sans-serif' }}>
    {/* Header */}
    <div style={{ padding: '12px 16px', background: 'white', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: 10 }}>
      <button style={{ background: 'none', border: 'none', padding: 4, color: M.accent }}>
        <Icon name="x" size={20}/>
      </button>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14, fontWeight: 700 }}>Flag non-conformity</div>
        <div style={{ fontSize: 10.5, color: M.muted }}>Step 2 of 3 · Details</div>
      </div>
      <button style={{ background: 'none', border: 'none', padding: 4, color: M.muted, fontSize: 12 }}>
        Save draft
      </button>
    </div>

    {/* Step indicator */}
    <div style={{ display: 'flex', gap: 4, padding: '8px 16px', background: 'white', borderBottom: '1px solid #e5e7eb' }}>
      {[1, 2, 3].map(n => (
        <div key={n} style={{ flex: 1, height: 3, borderRadius: 2, background: n <= 2 ? M.accent : '#e5e7eb' }}/>
      ))}
    </div>

    {/* Body scroll */}
    <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* AI banner */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 12, background: 'linear-gradient(135deg, #ede9fe, #dbeafe)', borderRadius: 10, border: '1px solid #c4b5fd' }}>
        <div style={{ width: 30, height: 30, borderRadius: '50%', background: '#7c3aed', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="sparkles" size={14}/>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11.5, fontWeight: 700 }}>AI pre-filled from your photo</div>
          <div style={{ fontSize: 10, color: '#5b21b6' }}>Review and adjust before submitting</div>
        </div>
      </div>

      {/* Photo preview */}
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 6, color: M.muted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Evidence (3)</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
          {[1, 2, 3].map(i => (
            <div key={i} style={{
              aspectRatio: '1', borderRadius: 8, position: 'relative',
              background: `linear-gradient(135deg, hsl(${15 + i * 20}, 35%, 30%), hsl(${20 + i * 20}, 45%, 20%))`,
            }}>
              {i === 1 && <div style={{ position: 'absolute', top: 30, left: 22, width: 18, height: 18, border: '2px solid #fbbf24', borderRadius: 2 }}/>}
              {i === 1 && <span style={{ position: 'absolute', top: 28, left: 44, fontSize: 8, color: '#fbbf24', background: 'rgba(0,0,0,0.7)', padding: '1px 4px', borderRadius: 2 }}>AI</span>}
            </div>
          ))}
          <button style={{
            aspectRatio: '1', borderRadius: 8, border: '1.5px dashed #cbd5e1',
            background: 'white', color: M.muted, display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexDirection: 'column', fontSize: 9.5, gap: 3, padding: 0,
          }}>
            <Icon name="camera" size={18}/>
            Add
          </button>
        </div>
      </div>

      {/* Title */}
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 6, color: M.muted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Title</div>
        <div style={{ background: 'white', borderRadius: 10, padding: '10px 12px', fontSize: 13.5, border: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ flex: 1 }}>Weld porosity — Cell 3 Station 3B</span>
          <span style={{ fontSize: 9, color: '#7c3aed', background: '#ede9fe', padding: '1px 5px', borderRadius: 3, fontWeight: 700 }}>AI</span>
        </div>
      </div>

      {/* Quick selects */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 6, color: M.muted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Severity</div>
          <div style={{ display: 'flex', gap: 3 }}>
            {[
              { l: 'Min', c: '#f59e0b', active: false },
              { l: 'Maj', c: '#ea580c', active: false },
              { l: 'Crit', c: '#dc2626', active: true },
            ].map(s => (
              <div key={s.l} style={{
                flex: 1, padding: '8px 0', textAlign: 'center', borderRadius: 8,
                background: s.active ? s.c : 'white',
                color: s.active ? 'white' : M.text,
                border: '1px solid ' + (s.active ? s.c : '#e5e7eb'),
                fontSize: 12, fontWeight: 600,
              }}>{s.l}</div>
            ))}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 6, color: M.muted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Category</div>
          <div style={{ padding: '8px 10px', background: 'white', borderRadius: 8, fontSize: 12, border: '1px solid #e5e7eb', display: 'flex', alignItems: 'center' }}>
            <span style={{ flex: 1 }}>Process</span>
            <Icon name="chevronDown" size={12}/>
          </div>
        </div>
      </div>

      {/* Location card */}
      <div style={{ padding: '10px 12px', background: 'white', borderRadius: 10, border: '1px solid #e5e7eb' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <Icon name="mapPin" size={13} style={{ color: M.accent }}/>
          <span style={{ fontSize: 12, fontWeight: 600, flex: 1 }}>Plant A · Weld Cell 3 · Station 3B</span>
          <span style={{ fontSize: 9, color: M.muted }}>QR</span>
        </div>
        <div style={{ fontSize: 10.5, color: M.muted, paddingLeft: 21 }}>Part #A-7742 · Lot HJ-22-04 · Operator: L. Wei</div>
      </div>

      {/* Affected qty */}
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 6, color: M.muted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Affected quantity</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button style={{ width: 32, height: 32, borderRadius: 8, background: 'white', border: '1px solid #e5e7eb', fontSize: 16, fontWeight: 700, color: M.text }}>−</button>
          <div style={{ flex: 1, height: 32, background: 'white', border: '1px solid #e5e7eb', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700 }}>14</div>
          <button style={{ width: 32, height: 32, borderRadius: 8, background: 'white', border: '1px solid #e5e7eb', fontSize: 16, fontWeight: 700, color: M.text }}>+</button>
          <span style={{ fontSize: 11, color: M.muted, width: 40 }}>units</span>
        </div>
      </div>

      {/* Containment */}
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 6, color: M.muted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Immediate containment</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {[
            { l: 'Cell stopped & quarantined', on: true },
            { l: 'Customer Quality notified', on: true },
            { l: 'WIP re-inspection started', on: false },
          ].map(c => (
            <label key={c.l} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', background: 'white', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 12 }}>
              <div style={{
                width: 18, height: 18, borderRadius: 5, border: '1.5px solid ' + (c.on ? M.accent : '#cbd5e1'),
                background: c.on ? M.accent : 'transparent', color: 'white',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>{c.on && <Icon name="check" size={11} stroke={3}/>}</div>
              <span style={{ flex: 1 }}>{c.l}</span>
            </label>
          ))}
        </div>
      </div>

      {/* AI 8D suggestion */}
      <div style={{ padding: 12, background: '#eff6ff', border: '1px solid #93c5fd', borderRadius: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <Icon name="brain" size={14} style={{ color: '#1d4ed8' }}/>
          <span style={{ fontSize: 11.5, fontWeight: 700, color: '#1e3a8a' }}>Open an 8D for this NCR?</span>
        </div>
        <div style={{ fontSize: 10.5, color: '#1e40af', lineHeight: 1.5, marginBottom: 8 }}>
          Critical severity + recurring porosity ({'\u2265'} 3 in 30d) usually trigger an 8D. We'll pre-fill the team.
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button style={{ flex: 1, height: 30, background: '#2563eb', color: 'white', border: 'none', borderRadius: 8, fontSize: 11.5, fontWeight: 600 }}>Yes, open 8D</button>
          <button style={{ height: 30, padding: '0 12px', background: 'white', color: '#1e40af', border: '1px solid #93c5fd', borderRadius: 8, fontSize: 11.5, fontWeight: 600 }}>Later</button>
        </div>
      </div>
    </div>

    {/* Bottom action bar */}
    <div style={{ padding: 14, background: 'white', borderTop: '1px solid #e5e7eb', display: 'flex', gap: 8 }}>
      <button style={{ flex: 1, height: 44, background: 'white', color: M.text, border: '1px solid #e5e7eb', borderRadius: 10, fontSize: 13, fontWeight: 600 }}>
        Back
      </button>
      <button style={{ flex: 2, height: 44, background: M.accent, color: 'white', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
        Review & submit <Icon name="arrowRight" size={14} stroke={2.5}/>
      </button>
    </div>
  </div>
);

// ——— Screen 6: Offline sync ———
const Screen_Offline = () => (
  <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: M.bg, color: M.text, fontFamily: '-apple-system, system-ui, sans-serif' }}>
    {/* Banner */}
    <div style={{ padding: '10px 16px', background: '#fef3c7', color: '#92400e', display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 600 }}>
      <Icon name="cloudOff" size={14}/>
      Offline — your work is saved on this device
    </div>

    {/* Header */}
    <div style={{ padding: '14px 16px 12px', background: M.surface, borderBottom: `1px solid ${M.border}` }}>
      <div style={{ fontSize: 11, color: M.muted, fontWeight: 600, marginBottom: 4 }}>SYNC QUEUE</div>
      <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em' }}>4 items waiting</div>
      <div style={{ fontSize: 12, color: M.muted, marginTop: 4 }}>Will upload automatically when reconnected</div>
    </div>

    {/* Queue items */}
    <div style={{ flex: 1, padding: '8px 0', overflowY: 'auto' }}>
      {[
        { i: 'clipboard', t: 'INS-0421 · 14 questions complete', sub: '5 photos · 1 NCR draft', size: '4.2 MB', state: 'ready', color: M.primary },
        { i: 'alert', t: 'NCR-DRAFT-39 · Bracket weld', sub: '3 photos, 1 voice note', size: '2.8 MB', state: 'ready', color: '#ea580c' },
        { i: 'clipboard', t: 'INS-0422 · Cleanroom check', sub: 'In progress · auto-saved 2m ago', size: '320 KB', state: 'draft', color: M.muted },
        { i: 'doc', t: 'PPE photo set · Floor walk', sub: '8 photos', size: '12.4 MB', state: 'ready', color: '#0d9488' },
      ].map((it, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: M.surface, borderBottom: `1px solid ${M.border}` }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: it.color + '18', color: it.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Icon name={it.i} size={18} stroke={1.75}/>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>{it.t}</div>
            <div style={{ fontSize: 11, color: M.muted }}>{it.sub} · <span style={{ fontFamily: 'ui-monospace, monospace' }}>{it.size}</span></div>
          </div>
          {it.state === 'ready' ? (
            <div style={{ width: 18, height: 18, borderRadius: '50%', border: `2px solid ${M.primary}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ width: 6, height: 6, background: M.primary, borderRadius: '50%' }}/>
            </div>
          ) : (
            <span style={{ fontSize: 10, padding: '2px 6px', background: '#fef3c7', color: '#92400e', borderRadius: 999, fontWeight: 700 }}>DRAFT</span>
          )}
        </div>
      ))}
    </div>

    {/* Storage */}
    <div style={{ padding: '12px 16px', background: M.surface, borderTop: `1px solid ${M.border}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: M.muted, marginBottom: 4 }}>
        <span>Local storage</span>
        <span><strong style={{ color: M.text }}>19.7 MB</strong> / 500 MB</span>
      </div>
      <div style={{ height: 4, background: M.bg, borderRadius: 999, overflow: 'hidden' }}>
        <div style={{ width: '4%', height: '100%', background: M.primary, borderRadius: 999 }}/>
      </div>
    </div>

    {/* Action */}
    <div style={{ padding: 16, background: M.surface, borderTop: `1px solid ${M.border}` }}>
      <button style={{ width: '100%', padding: 14, background: '#e2e8f0', color: M.muted, border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
        <Icon name="cloudOff" size={16}/>
        Waiting for connection…
      </button>
    </div>
  </div>
);

// ——— Mobile inspector page ———
const SCREENS = [
  { id: 'list', label: 'Daily work', desc: 'Inspector\'s assigned queue with priorities, due times, and a quick-add FAB.', frame: 'ios', component: Screen_InspectionsList },
  { id: 'checklist', label: 'Running checklist', desc: 'Question-by-question with photo capture, notes, and inline NCR flagging.', frame: 'android', component: Screen_Checklist },
  { id: 'camera', label: 'Camera + AI defect', desc: 'In-app capture with on-device AI suggesting NCR candidates from imagery.', frame: 'ios', component: Screen_Camera },
  { id: 'voice', label: 'Voice-to-NCR', desc: 'Inspector dictates an issue; AI extracts location, asset, severity, fills the form.', frame: 'android', component: Screen_Voice },
  { id: 'ncr-create', label: 'NCR create', desc: 'Three-step flagging flow with AI pre-fill, severity selector, containment checklist, and 8D suggestion.', frame: 'ios', component: Screen_NCRCreate },
  { id: 'ncr', label: 'NCR detail', desc: 'Mobile-optimized NCR view with photos, metadata, and an 8D promotion banner.', frame: 'ios', component: Screen_NCRDetail },
  { id: 'offline', label: 'Offline sync', desc: 'Queue of pending uploads with size, draft state, and storage gauge.', frame: 'android', component: Screen_Offline },
];

const MobileInspectorPage = ({ setRoute }) => {
  const [activeId, setActiveId] = useSm('list');
  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <PageHeader
        title="Mobile Inspector"
        description="Field-ready iOS + Android app — 6 key screens. The same data layer as the web app."
        actions={
          <>
            <button className="k-btn k-btn-ghost" onClick={() => setRoute('inspections')}>
              <Icon name="arrowLeft" size={14}/> Back to web
            </button>
            <button className="k-btn k-btn-ghost"><Icon name="qr" size={14}/>Get the app</button>
            <button className="k-btn k-btn-primary"><Icon name="download" size={14}/>Export tour PDF</button>
          </>
        }
      />

      {/* Screen tabs */}
      <div style={{ padding: '16px 28px 0', display: 'flex', gap: 8, overflowX: 'auto', borderBottom: '1px solid var(--border)' }}>
        {SCREENS.map(s => (
          <button key={s.id} onClick={() => setActiveId(s.id)}
            style={{
              padding: '10px 14px', whiteSpace: 'nowrap',
              fontSize: 13, fontWeight: 500,
              color: activeId === s.id ? 'var(--accent)' : 'var(--text-muted)',
              borderBottom: '2px solid ' + (activeId === s.id ? 'var(--accent)' : 'transparent'),
              marginBottom: -1,
              display: 'inline-flex', alignItems: 'center', gap: 6,
            }}>
            <span style={{ width: 18, height: 18, borderRadius: 4, background: 'var(--bg-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: 'var(--text-muted)' }}>{SCREENS.indexOf(s) + 1}</span>
            {s.label}
          </button>
        ))}
      </div>

      {/* Content: phones wall */}
      <div style={{
        flex: 1, padding: '32px 28px', overflowY: 'auto',
        background: 'radial-gradient(circle at 50% 0%, var(--bg-subtle), var(--bg) 70%)',
      }}>
        <div style={{
          display: 'grid', gap: 32,
          gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))',
          maxWidth: 1400, margin: '0 auto',
        }}>
          {SCREENS.map((s, i) => {
            const isActive = activeId === s.id;
            const Component = s.component;
            return (
              <div key={s.id}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20,
                  opacity: isActive ? 1 : 0.7,
                  transform: isActive ? 'scale(1)' : 'scale(0.95)',
                  transition: 'all 250ms',
                }}
                onClick={() => setActiveId(s.id)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="k-chip" style={{
                    background: 'var(--accent-soft)', color: 'var(--accent)',
                    fontFamily: 'var(--font-mono)', fontWeight: 700,
                  }}>{i + 1}</span>
                  <div style={{ fontSize: 15, fontWeight: 600 }}>{s.label}</div>
                  <span className="k-chip" style={{
                    background: s.frame === 'ios' ? '#e2e8f0' : '#dcfce7',
                    color: s.frame === 'ios' ? '#475569' : '#166534',
                    fontSize: 10,
                  }}>{s.frame === 'ios' ? 'iOS' : 'Android'}</span>
                </div>
                <div style={{ filter: isActive ? 'none' : 'saturate(0.8)' }}>
                  {s.frame === 'ios' ? (
                    <div className="phone-shadow" style={{ borderRadius: 50, overflow: 'hidden' }}>
                      <IOSDevice width={340} height={720}>
                        <Component/>
                      </IOSDevice>
                    </div>
                  ) : (
                    <div className="phone-shadow-android" style={{ borderRadius: 36, overflow: 'hidden' }}>
                      <AndroidDevice width={340} height={720}>
                        <Component/>
                      </AndroidDevice>
                    </div>
                  )}
                </div>
                <div style={{
                  textAlign: 'center', fontSize: 12.5, color: 'var(--text-muted)',
                  lineHeight: 1.55, maxWidth: 320,
                }}>{s.desc}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

Object.assign(window, { MobileInspectorPage });
