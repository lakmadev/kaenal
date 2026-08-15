// Kaenal Mobile — Capture (ink refresh of the existing capture story)
// Quick-Log sheet · Camera + AI defect · Voice-to-NCR · Tap-to-annotate.
// AI treatment is restrained (ink chip + sparkle), matching the monochrome system.

// AI chip — no rainbow gradients, just ink
const AiChip = ({ T, children }) => (
  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 8px', borderRadius: 999,
    background: T.accentSoft, color: T.accent, fontSize: 11, fontWeight: 700 }}>
    <MI name="sparkles" size={12} stroke={2}/>{children}
  </span>
);

// ── Quick-Log capture sheet ──
const CapQuickLog = ({ T, platform = 'ios' }) => (
  <MScreen T={T} platform={platform}>
    <div style={{ paddingTop: topInset(platform), background: T.surface, borderBottom: `1px solid ${T.border}`, flexShrink: 0, padding: `${topInset(platform)}px 16px 12px` }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 12, fontWeight: 600, color: T.muted }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: T.success }}/> Plant A · Weld Cell 3
        </span>
        <button style={{ padding: 4, color: T.muted }}><MI name="x" size={20}/></button>
      </div>
      <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.02em' }}>Quick-Log</div>
      <div style={{ fontSize: 12.5, color: T.muted, marginTop: 1 }}>Say it, snap it, done. No forms.</div>
    </div>
    <Body style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Card T={T} style={{ padding: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <span style={{ width: 26, height: 26, borderRadius: '50%', background: T.accent, color: T.accentFg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><MI name="mic" size={13} stroke={2}/></span>
          <span style={{ fontSize: 12.5, fontWeight: 700 }}>Voice note</span>
          <Mono style={{ fontSize: 11, padding: '2px 6px', background: T.bgSubtle, borderRadius: 6, color: T.muted }}>0:14</Mono>
          <div style={{ flex: 1 }}/>
          <StatusPill T={T} tone="done">Transcribed</StatusPill>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 2.5, height: 20, marginBottom: 10 }}>
          {[6,11,5,14,9,12,7,15,10,13,6,12,8,11,6,14,9,12,5,10,7,13,8,11,6,9].map((h, i) => (
            <div key={i} style={{ width: 2.5, height: h, borderRadius: 2, background: T.accent, opacity: 0.3 }}/>
          ))}
        </div>
        <div style={{ fontSize: 13.5, lineHeight: 1.55 }}>
          "Bracket weld bead on serial <mark style={{ background: T.warnBg, color: T.warnFg, borderRadius: 3, padding: '0 3px' }}>SN-A2104</mark> looks inconsistent — porosity around the seam, similar to last week. About a quarter inch off spec."
        </div>
      </Card>

      <Card T={T} style={{ padding: 14, background: T.accentSoft, border: `1px solid ${T.border}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <AiChip T={T}>Structured for you</AiChip>
          <div style={{ flex: 1 }}/>
          <span style={{ fontSize: 10.5, color: T.muted }}>tap a chip to edit</span>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {[{ l: 'Type', v: 'NCR draft' }, { l: 'Severity', v: 'High' }, { l: 'Part', v: '#A-7742', m: true }, { l: 'Category', v: 'Weld / porosity' }].map(c => (
            <span key={c.l} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 9px', background: T.surface, border: `1px solid ${T.border}`, borderRadius: 9, fontSize: 12 }}>
              <span style={{ fontSize: 9.5, fontWeight: 700, color: T.subtle, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{c.l}</span>
              <span style={{ fontWeight: 600, fontFamily: c.m ? MONO : 'inherit' }}>{c.v}</span>
            </span>
          ))}
        </div>
      </Card>

      <div>
        <SectionLabel T={T} style={{ marginBottom: 7 }}>Evidence</SectionLabel>
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ width: 68, height: 68, borderRadius: 11, background: 'linear-gradient(135deg,#475569,#1e293b)', position: 'relative' }}>
            <span style={{ position: 'absolute', top: 6, left: 6, width: 14, height: 14, border: '2px solid #fbbf24', borderRadius: '50%' }}/>
            <span style={{ position: 'absolute', bottom: 4, left: 6, fontSize: 8.5, color: '#fff', fontWeight: 600 }}>2 marks</span>
          </div>
          <div style={{ width: 68, height: 68, borderRadius: 11, background: 'linear-gradient(135deg,#64748b,#334155)' }}/>
          <button style={{ width: 68, height: 68, borderRadius: 11, border: `1.5px dashed ${T.borderStrong}`, background: T.surface, color: T.accent, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3 }}>
            <MI name="camera" size={18}/><span style={{ fontSize: 9.5, fontWeight: 700 }}>Add</span>
          </button>
        </div>
      </div>

      <Card T={T} style={{ padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <MI name="mapPin" size={16} color={T.accent}/>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12.5, fontWeight: 600 }}>Weld Cell 3 · Station 3B</div>
          <div style={{ fontSize: 10.5, color: T.muted }}>GPS + QR · Lot HJ-22-04 · Shift A</div>
        </div>
        <StatusPill T={T} tone="done">Auto</StatusPill>
      </Card>
    </Body>
    <div style={{ padding: `12px 16px ${botInset(platform) + 12}px`, background: T.surface, borderTop: `1px solid ${T.border}`, flexShrink: 0 }}>
      <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
        <button style={{ flex: 1, height: 46, borderRadius: 13, background: T.accent, color: T.accentFg, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: 14, fontWeight: 700 }}>
          <MI name="mic" size={18}/> Hold to talk
        </button>
        {['camera', 'qr'].map(ic => (
          <button key={ic} style={{ width: 46, height: 46, borderRadius: 13, border: `1px solid ${T.border}`, background: T.surface, color: T.text, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><MI name={ic} size={19}/></button>
        ))}
      </div>
      <PrimaryBtn T={T} icon="arrowRight" style={{ height: 46 }}>Log it</PrimaryBtn>
    </div>
  </MScreen>
);

// ── Camera + AI defect ──
const CapCamera = ({ T, platform = 'ios' }) => (
  <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#0a0a0a', color: '#fff', fontFamily: platform === 'android' ? ROBOTO : SANS }}>
    <div style={{ flex: 1, position: 'relative', overflow: 'hidden', background: 'radial-gradient(ellipse at 60% 40%, #444 0%, #1a1a1a 60%, #000 100%)' }}>
      <svg viewBox="0 0 400 600" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
        <defs><linearGradient id="cmet" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#9ca3af"/><stop offset="0.5" stopColor="#4b5563"/><stop offset="1" stopColor="#1f2937"/></linearGradient></defs>
        <rect x="30" y="220" width="340" height="80" fill="url(#cmet)"/><rect x="30" y="320" width="340" height="80" fill="url(#cmet)"/>
        <path d="M 30 305 Q 60 295, 100 308 T 200 305 Q 250 312, 300 302 T 370 308" stroke="#fbbf24" strokeWidth="14" fill="none" strokeLinecap="round" opacity="0.9"/>
        <circle cx="220" cy="305" r="38" fill="none" stroke="#fff" strokeWidth="2.5" strokeDasharray="6 4"/>
        <circle cx="220" cy="305" r="38" fill="rgba(255,255,255,0.08)"/>
      </svg>
      <div style={{ position: 'absolute', top: topInset(platform), left: 16, right: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ padding: '6px 10px', background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(10px)', borderRadius: 999, fontSize: 11, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#ef4444' }}/> Point B · Weld Cell 3
        </div>
        <button style={{ padding: 8, background: 'rgba(0,0,0,0.55)', borderRadius: '50%', color: '#fff' }}><MI name="x" size={18}/></button>
      </div>
      <div style={{ position: 'absolute', bottom: 24, left: 16, right: 16, padding: 12, background: 'rgba(20,20,22,0.9)', backdropFilter: 'blur(12px)', borderRadius: 14, border: '1px solid rgba(255,255,255,0.14)', display: 'flex', gap: 11, alignItems: 'center' }}>
        <span style={{ width: 30, height: 30, borderRadius: 9, background: '#fafafa', color: '#18181b', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><MI name="sparkles" size={15} stroke={2}/></span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12.5, fontWeight: 700 }}>Possible porosity detected</div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 1 }}>87% confidence · like NCR-0118 · tap to draft NCR</div>
        </div>
        <MI name="chevronRight" size={16} color="rgba(255,255,255,0.6)"/>
      </div>
    </div>
    <div style={{ padding: `18px 24px ${botInset(platform) + 18}px`, background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <button style={{ padding: 10, background: 'rgba(255,255,255,0.1)', borderRadius: 12, color: '#fff' }}><MI name="grid" size={20}/></button>
      <button style={{ width: 66, height: 66, borderRadius: '50%', background: '#fff', border: '4px solid rgba(255,255,255,0.3)', boxShadow: '0 0 0 2px #fff' }}/>
      <button style={{ padding: 10, background: 'rgba(255,255,255,0.1)', borderRadius: 12, color: '#fff' }}><MI name="refresh" size={20}/></button>
    </div>
  </div>
);

// ── Voice-to-NCR ──
const CapVoice = ({ T, platform = 'android' }) => (
  <MScreen T={T} platform={platform}>
    <div style={{ paddingTop: topInset(platform), padding: `${topInset(platform)}px 16px 4px`, display: 'flex', alignItems: 'center', gap: 12 }}>
      <button style={{ padding: 4, color: T.text }}><MI name="chevronLeft" size={24} stroke={2}/></button>
      <div><div style={{ fontSize: 11.5, color: T.muted, fontWeight: 600 }}>New NCR · Voice mode</div><div style={{ fontSize: 16, fontWeight: 700 }}>Just describe what you see</div></div>
    </div>
    <Body style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 24, gap: 16 }}>
      <div style={{ position: 'relative', marginTop: 12 }}>
        <div style={{ position: 'absolute', inset: -24, borderRadius: '50%', border: `2px solid ${T.accent}`, opacity: 0.14 }}/>
        <div style={{ position: 'absolute', inset: -12, borderRadius: '50%', border: `2px solid ${T.accent}`, opacity: 0.28 }}/>
        <div style={{ width: 112, height: 112, borderRadius: '50%', background: T.accent, color: T.accentFg, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 12px 30px -8px rgba(0,0,0,0.4)' }}><MI name="mic" size={40} stroke={1.5}/></div>
      </div>
      <div style={{ fontSize: 13, color: T.muted, fontWeight: 600 }}>Listening… 0:14</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 3, height: 30 }}>
        {[12,22,8,28,18,24,14,30,20,26,10,24,16,22,12,28,18].map((h, i) => (
          <div key={i} style={{ width: 3, height: h, background: T.accent, borderRadius: 999, opacity: 0.35 + (Math.abs(i - 8) < 5 ? 0.45 : 0.05) }}/>
        ))}
      </div>
      <Card T={T} style={{ width: '100%', padding: 14, fontSize: 13.5, lineHeight: 1.55, minHeight: 92 }}>
        I'm at Plant A Line 3. The bracket weld bead on serial <mark style={{ background: T.warnBg, color: T.warnFg, borderRadius: 3, padding: '0 2px' }}>SN-A2104</mark> looks inconsistent — porosity around the seam, similar to last week. <span style={{ color: T.muted }}>It's about a quarter inch off spec…</span>
      </Card>
      <Card T={T} style={{ width: '100%', padding: 12, background: T.accentSoft, border: `1px solid ${T.border}`, display: 'flex', gap: 10 }}>
        <span style={{ width: 24, height: 24, borderRadius: 7, background: T.accent, color: T.accentFg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><MI name="sparkles" size={12} stroke={2.2}/></span>
        <div style={{ fontSize: 12, lineHeight: 1.5 }}>
          <div style={{ fontWeight: 700 }}>Filling in the form</div>
          <div style={{ color: T.muted }}>Detected <strong style={{ color: T.text }}>Plant A · Line 3 · SN-A2104 · Weld porosity</strong>. Tap stop to review.</div>
        </div>
      </Card>
    </Body>
    <ActionBar T={T} platform={platform}>
      <GhostBtn T={T} style={{ flex: 1 }}>Cancel</GhostBtn>
      <PrimaryBtn T={T} style={{ flex: 2 }}><span style={{ width: 10, height: 10, background: T.accentFg, borderRadius: 2, marginRight: 8 }}/>Stop & review</PrimaryBtn>
    </ActionBar>
  </MScreen>
);

// ── Tap-to-annotate photo editor ──
const CapAnnotate = ({ T, platform = 'ios' }) => (
  <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#0a0a0a', color: '#fff', fontFamily: platform === 'android' ? ROBOTO : SANS }}>
    <div style={{ paddingTop: topInset(platform), padding: `${topInset(platform)}px 16px 10px`, display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(0,0,0,0.6)' }}>
      <button style={{ color: '#fff', padding: 4 }}><MI name="chevronLeft" size={22}/></button>
      <div style={{ flex: 1 }}><div style={{ fontSize: 13.5, fontWeight: 700 }}>Annotate</div><div style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.55)' }}>Tap the photo to drop a mark</div></div>
      <button style={{ height: 30, padding: '0 14px', borderRadius: 9, background: '#fafafa', color: '#18181b', fontSize: 12.5, fontWeight: 700 }}>Done</button>
    </div>
    <div style={{ flex: 1, position: 'relative', overflow: 'hidden', background: 'radial-gradient(ellipse at 55% 42%, #555 0%, #1a1a1a 60%, #000 100%)' }}>
      <svg viewBox="0 0 400 600" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
        <defs><linearGradient id="ametal" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#9ca3af"/><stop offset="0.5" stopColor="#4b5563"/><stop offset="1" stopColor="#1f2937"/></linearGradient></defs>
        <rect x="20" y="230" width="360" height="70" fill="url(#ametal)"/><rect x="20" y="320" width="360" height="70" fill="url(#ametal)"/>
        <path d="M 20 312 Q 70 300, 120 314 T 230 310 Q 290 318, 360 308" stroke="#fbbf24" strokeWidth="13" fill="none" strokeLinecap="round" opacity="0.9"/>
      </svg>
      <div style={{ position: 'absolute', top: 268, left: 168 }}>
        <div style={{ width: 56, height: 56, borderRadius: '50%', border: '3px solid #fff', boxShadow: '0 0 0 2px rgba(0,0,0,0.4)' }}/>
        <div style={{ position: 'absolute', top: -6, left: -6, width: 22, height: 22, borderRadius: '50%', background: '#fff', color: '#18181b', fontSize: 11, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>1</div>
      </div>
      <div style={{ position: 'absolute', top: 200, left: 118, padding: '7px 10px', background: 'rgba(20,20,22,0.92)', borderRadius: 10, fontSize: 11.5, fontWeight: 600, border: '1px solid rgba(255,255,255,0.2)', maxWidth: 170 }}>
        Porosity cluster · ~3mm<div style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)', fontWeight: 400, marginTop: 1 }}>tap to edit · drag to move</div>
      </div>
      <div style={{ position: 'absolute', top: 360, left: 250, width: 22, height: 22, borderRadius: '50%', background: '#fbbf24', color: '#000', fontSize: 11, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>2</div>
      <div style={{ position: 'absolute', bottom: 14, left: 14, right: 14, padding: 11, background: 'rgba(20,20,22,0.9)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.14)', display: 'flex', gap: 9, alignItems: 'center' }}>
        <span style={{ width: 26, height: 26, borderRadius: 8, background: '#fafafa', color: '#18181b', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><MI name="sparkles" size={13} stroke={2}/></span>
        <div style={{ fontSize: 11.5, lineHeight: 1.4 }}><strong>AI pre-marked the defect</strong> · 87% match to NCR-0118</div>
      </div>
      <div style={{ position: 'absolute', top: 12, right: 12, padding: '5px 9px', background: 'rgba(0,0,0,0.6)', borderRadius: 999, fontSize: 10.5, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5 }}>
        <MI name="mapPin" size={11}/> 42.331, -83.045
      </div>
    </div>
    <div style={{ background: '#111', padding: `14px 18px ${botInset(platform) + 14}px`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      {[{ i: 'pen', l: 'Draw' }, { i: 'target', l: 'Circle', a: true }, { i: 'arrowRight', l: 'Arrow' }, { i: 'type', l: 'Text' }, { i: 'hash', l: 'Measure' }].map(t => (
        <button key={t.l} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, color: t.a ? '#fff' : 'rgba(255,255,255,0.55)' }}>
          <span style={{ width: 40, height: 40, borderRadius: 12, background: t.a ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><MI name={t.i} size={18} stroke={2}/></span>
          <span style={{ fontSize: 9.5, fontWeight: 600 }}>{t.l}</span>
        </button>
      ))}
    </div>
  </div>
);

Object.assign(window, { CapQuickLog, CapCamera, CapVoice, CapAnnotate, AiChip });
