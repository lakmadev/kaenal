// Kaenal — Phase 1 "Zero-Friction" Quality Logging & Collaboration
// Blueprint page: overview & journey, desktop Quick-Log composer, mobile capture,
// collaboration workspace, and component specifications.

const { useState: useQL } = React;

const QL_TABS = [
  { id: 'journey', label: 'Overview & journey', icon: 'zap' },
  { id: 'desktop', label: 'Quick-Log composer', icon: 'edit' },
  { id: 'mobile', label: 'On the floor', icon: 'smartphone' },
  { id: 'collab', label: 'Collaboration', icon: 'chat' },
  { id: 'specs', label: 'Component specs', icon: 'layers' },
];

// —————————————————————————————————————————————
//  Small shared bits
// —————————————————————————————————————————————
const Overline = ({ children, color }) => (
  <div className="k-overline" style={{ color: color || 'var(--text-muted)', marginBottom: 10 }}>{children}</div>
);

const GeoChip = () => (
  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 999, background: 'var(--bg-subtle)', border: '1px solid var(--border)', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>
    <span className="pulse-dot" style={{ background: '#22c55e', width: 7, height: 7 }}/>
    <Icon name="mapPin" size={12} style={{ color: 'var(--accent)' }}/>
    Plant A · Weld Cell 3 · Station 3B
  </span>
);

// —————————————————————————————————————————————
//  TAB 1 — Overview & journey
// —————————————————————————————————————————————
const QLJourney = () => {
  const steps = [
    { n: '01', icon: 'mic', title: 'Capture in seconds', body: 'Hold to talk, snap a photo, or scan a QR. Speech transcribes live; nothing to type.', cut: 'Replaces: 22-field form' },
    { n: '02', icon: 'sparkles', title: 'AI structures it', body: 'Severity, part, category and location are extracted into editable chips — confirm or tweak.', cut: 'Replaces: dropdown hunting' },
    { n: '03', icon: 'trending', title: 'Auto-triage & route', body: 'Rules score the event and route it to the right owner, queue and SLA the moment it lands.', cut: 'Replaces: manual assignment' },
    { n: '04', icon: 'chat', title: 'Resolve together', body: 'Engineering, Operations & Quality thread the conversation, tag components, own action items.', cut: 'Replaces: email + spreadsheets' },
    { n: '05', icon: 'shieldCheck', title: 'Close the loop', body: 'Recurring? Promote to NCR or 8D in one tap — evidence, thread and context carry over intact.', cut: 'Replaces: re-keying data' },
  ];
  return (
    <div className="fade-in" style={{ padding: '24px 28px 48px', maxWidth: 1180, margin: '0 auto' }}>
      {/* Friction framing */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr', gap: 16, marginBottom: 28 }}>
        <div className="k-surface" style={{ padding: 22, position: 'relative', overflow: 'hidden' }}>
          <Overline color="#b45309">The problem</Overline>
          <div style={{ fontSize: 19, fontWeight: 700, letterSpacing: '-0.01em', marginBottom: 8 }}>People don’t log what they don’t love typing.</div>
          <p style={{ fontSize: 13.5, color: 'var(--text-muted)', lineHeight: 1.6, margin: 0 }}>
            The old capture form is a 22-field wall of dropdowns — keyboard-only, desktop-bound, and abandoned on the floor. Quality data dies at the source.
          </p>
          <div style={{ display: 'flex', gap: 18, marginTop: 18 }}>
            {[['22', 'fields to fill'], ['~4 min', 'per entry'], ['Desktop', 'only']].map(([a,b]) => (
              <div key={b}>
                <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', color: '#b45309', fontFamily: 'var(--font-mono)' }}>{a}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{b}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="k-surface" style={{ padding: 22, background: 'linear-gradient(135deg, var(--accent-soft), transparent)', borderColor: 'var(--accent)' }}>
          <Overline color="var(--accent)">The Quick-Log answer</Overline>
          <div style={{ fontSize: 19, fontWeight: 700, letterSpacing: '-0.01em', marginBottom: 8 }}>Talk. Snap. Done.</div>
          <p style={{ fontSize: 13.5, color: 'var(--text-muted)', lineHeight: 1.6, margin: 0 }}>
            Voice-first, multimedia, mobile-native. AI does the structuring; the floor just describes what they see.
          </p>
          <div style={{ display: 'flex', gap: 18, marginTop: 18 }}>
            {[['3', 'taps to log'], ['~20 sec', 'per entry'], ['Voice', 'first']].map(([a,b]) => (
              <div key={b}>
                <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--accent)', fontFamily: 'var(--font-mono)' }}>{a}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{b}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Journey */}
      <Overline>User journey · floor to closed loop</Overline>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, position: 'relative' }}>
        {steps.map((s, i) => (
          <div key={s.n} style={{ position: 'relative' }}>
            <div className="k-surface" style={{ padding: '16px 14px', height: '100%', display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <span style={{ width: 34, height: 34, borderRadius: 10, background: 'var(--accent-soft)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name={s.icon} size={17}/>
                </span>
                <span style={{ fontSize: 12, fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--text-subtle)' }}>{s.n}</span>
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 5 }}>{s.title}</div>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5, margin: 0, flex: 1 }}>{s.body}</p>
              <div style={{ marginTop: 12, fontSize: 10.5, fontWeight: 600, color: 'var(--success-700)', background: 'rgba(34,197,94,0.1)', borderRadius: 6, padding: '5px 8px', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                <Icon name="check" size={11} stroke={3}/>{s.cut}
              </div>
            </div>
            {i < steps.length - 1 && (
              <div style={{ position: 'absolute', top: 33, right: -10, width: 20, height: 20, zIndex: 2, color: 'var(--border-strong)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="chevronRight" size={16}/>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

// —————————————————————————————————————————————
//  TAB 2 — Desktop Quick-Log composer (annotated)
// —————————————————————————————————————————————
const Marker = ({ n, style }) => (
  <div style={{ position: 'absolute', width: 22, height: 22, borderRadius: '50%', background: 'var(--accent)', color: '#fff', fontSize: 11.5, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 6px rgba(37,99,235,0.4)', border: '2px solid var(--surface)', zIndex: 5, ...style }}>{n}</div>
);

const QLDesktop = () => {
  const legend = [
    { n: 1, t: 'Context bar', d: 'Geolocation + asset auto-resolved from the user’s session; one click to change site.' },
    { n: 2, t: 'Smart input', d: 'Single free-text field. Hold ⌘ (or the mic) to dictate — speech transcribes inline.' },
    { n: 3, t: 'Multimedia rail', d: 'Voice, photo/video, screen-grab, file and #tag — the only “fields” that exist.' },
    { n: 4, t: 'AI structure bar', d: 'Type, severity, part & category as editable chips. Click any chip to correct.' },
    { n: 5, t: 'Evidence tray', d: 'Annotated photos and the voice clip travel with the log as first-class evidence.' },
    { n: 6, t: 'Notify & commit', d: '@mention to loop people in; “Log it” routes to the right owner instantly.' },
  ];
  return (
    <div className="fade-in" style={{ padding: '24px 28px 48px', display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 320px', gap: 28, maxWidth: 1240, margin: '0 auto', alignItems: 'start' }}>
      {/* Composer */}
      <div style={{ position: 'relative', background: 'radial-gradient(circle at 50% 0%, var(--bg-subtle), transparent 70%)', borderRadius: 'var(--r-2xl)', padding: '28px 8px' }}>
        <div className="k-surface" style={{ maxWidth: 660, margin: '0 auto', boxShadow: 'var(--shadow-lg)', position: 'relative', overflow: 'visible' }}>
          {/* 1 context bar */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
              <span style={{ width: 30, height: 30, borderRadius: 9, background: 'var(--accent)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="zap" size={16}/></span>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.1 }}>Quick-Log</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Describe what you saw — we’ll do the paperwork</div>
              </div>
            </div>
            <GeoChip/>
            <Marker n={1} style={{ top: 14, right: -11 }}/>
          </div>

          {/* 2 smart input */}
          <div style={{ padding: '18px 18px 8px', position: 'relative' }}>
            <div style={{ fontSize: 16, lineHeight: 1.55, color: 'var(--text)' }}>
              Bracket weld bead on <span style={{ background: 'rgba(124,58,237,0.1)', color: '#7c3aed', borderRadius: 4, padding: '1px 5px', fontFamily: 'var(--font-mono)', fontSize: 14 }}>#A-7742</span> looks inconsistent — porosity around the seam, third time this month.<span style={{ display: 'inline-block', width: 2, height: 18, background: 'var(--accent)', marginLeft: 2, verticalAlign: 'text-bottom', animation: 'k-pulse 1.2s infinite' }}/>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '6px 12px', borderRadius: 999, background: 'var(--accent)', color: '#fff', fontSize: 12.5, fontWeight: 600 }}>
                <Icon name="mic" size={14}/> Listening… 0:14
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 2, height: 16 }}>
                {[6,10,5,13,8,11,7,14,9,12,6,11,8,10,6,13,9,11].map((h,i) => <span key={i} style={{ width: 2, height: h, borderRadius: 2, background: 'var(--accent)', opacity: 0.35 }}/>)}
              </div>
              <span style={{ fontSize: 11.5, color: 'var(--text-subtle)' }}>transcribing live</span>
            </div>
            <Marker n={2} style={{ top: 18, right: -11 }}/>
          </div>

          {/* 3 media rail */}
          <div style={{ display: 'flex', gap: 8, padding: '10px 18px 14px', position: 'relative', flexWrap: 'wrap' }}>
            {[
              { i: 'mic', l: 'Voice', on: true }, { i: 'camera', l: 'Photo / video' }, { i: 'grid', l: 'Screen grab' }, { i: 'paperclip', l: 'File' }, { i: 'hash', l: 'Tag' },
            ].map(b => (
              <button key={b.l} className={b.on ? '' : 'k-btn-ghost'} style={{
                display: 'inline-flex', alignItems: 'center', gap: 7, height: 34, padding: '0 12px', borderRadius: 'var(--r-md)', fontSize: 12.5, fontWeight: 600,
                background: b.on ? 'var(--accent-soft)' : 'var(--surface)', color: b.on ? 'var(--accent)' : 'var(--text)', border: `1px solid ${b.on ? 'var(--accent)' : 'var(--border)'}`,
              }}>
                <Icon name={b.i} size={15}/>{b.l}
              </button>
            ))}
            <Marker n={3} style={{ bottom: 14, right: -11 }}/>
          </div>

          {/* 4 AI structure */}
          <div style={{ margin: '0 18px 14px', padding: 14, borderRadius: 'var(--r-lg)', background: 'linear-gradient(135deg, rgba(124,58,237,0.06), rgba(37,99,235,0.05))', border: '1px solid rgba(124,58,237,0.22)', position: 'relative' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <span style={{ width: 22, height: 22, borderRadius: '50%', background: 'linear-gradient(135deg,#a855f7,#6366f1)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="sparkles" size={12} stroke={2.25}/></span>
              <span style={{ fontSize: 12.5, fontWeight: 700 }}>AI structured this</span>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>· click a chip to edit · 94% confidence</span>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
              {[['Type', 'NCR draft'], ['Severity', 'High'], ['Part', '#A-7742'], ['Category', 'Weld / porosity'], ['Recurrence', '3rd in 30d']].map(([l,v]) => (
                <span key={l} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 10px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12.5, cursor: 'pointer' }}>
                  <span style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--text-subtle)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{l}</span>
                  <span style={{ fontWeight: 600 }}>{v}</span>
                  <Icon name="chevronDown" size={11} style={{ color: 'var(--text-subtle)' }}/>
                </span>
              ))}
            </div>
            <Marker n={4} style={{ top: 14, right: -11 }}/>
          </div>

          {/* 5 evidence */}
          <div style={{ display: 'flex', gap: 8, padding: '0 18px 16px', alignItems: 'center', position: 'relative' }}>
            <div style={{ width: 64, height: 64, borderRadius: 10, background: 'linear-gradient(135deg,#475569,#1e293b)', position: 'relative', flexShrink: 0 }}>
              <span style={{ position: 'absolute', top: 6, left: 8, width: 14, height: 14, border: '2px solid #fbbf24', borderRadius: '50%' }}/>
              <span style={{ position: 'absolute', bottom: 3, left: 5, fontSize: 8, color: '#fff', fontWeight: 600 }}>annotated</span>
            </div>
            <div style={{ width: 64, height: 64, borderRadius: 10, background: 'linear-gradient(135deg,#64748b,#334155)', flexShrink: 0 }}/>
            <div style={{ height: 64, flex: 1, minWidth: 120, borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg-subtle)', display: 'flex', alignItems: 'center', gap: 10, padding: '0 14px' }}>
              <button style={{ width: 34, height: 34, borderRadius: '50%', background: 'var(--accent)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Icon name="play" size={14}/></button>
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 2 }}>
                {[5,9,6,12,7,10,6,13,8,11,7,9,6,12,8,10,6,9,7,11,6,10].map((h,i) => <span key={i} style={{ width: 2, height: h, borderRadius: 2, background: 'var(--border-strong)' }}/>)}
              </div>
              <span className="mono" style={{ fontSize: 11, color: 'var(--text-muted)' }}>0:14</span>
            </div>
            <Marker n={5} style={{ top: -8, right: -11 }}/>
          </div>

          {/* 6 commit */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 18px', borderTop: '1px solid var(--border)', position: 'relative' }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Notify</span>
            <div style={{ display: 'flex' }}>
              {['u2','u3'].map((p,i) => <div key={p} style={{ marginLeft: i ? -7 : 0, border: '2px solid var(--surface)', borderRadius: '50%' }}><Avatar user={p} size={26}/></div>)}
            </div>
            <button style={{ width: 26, height: 26, borderRadius: '50%', border: '1px dashed var(--border-strong)', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="plus" size={13}/></button>
            <div style={{ flex: 1 }}/>
            <button className="k-btn k-btn-ghost">Save draft</button>
            <button className="k-btn k-btn-primary">Log it <Icon name="arrowRight" size={14} stroke={2.5}/></button>
            <Marker n={6} style={{ bottom: 12, right: -11 }}/>
          </div>
        </div>
      </div>

      {/* Legend / annotations */}
      <div style={{ position: 'sticky', top: 16 }}>
        <Overline>Anatomy</Overline>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {legend.map(l => (
            <div key={l.n} style={{ display: 'flex', gap: 11, padding: '10px 12px', borderRadius: 'var(--r-md)', background: 'var(--surface)', border: '1px solid var(--border)' }}>
              <span style={{ width: 20, height: 20, borderRadius: '50%', background: 'var(--accent)', color: '#fff', fontSize: 11, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{l.n}</span>
              <div>
                <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 1 }}>{l.t}</div>
                <div style={{ fontSize: 11.5, color: 'var(--text-muted)', lineHeight: 1.45 }}>{l.d}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// —————————————————————————————————————————————
//  TAB 3 — Mobile capture (phones)
// —————————————————————————————————————————————
const QLMobile = () => (
  <div className="fade-in" style={{ padding: '28px 28px 48px', background: 'radial-gradient(circle at 50% 0%, var(--bg-subtle), var(--bg) 70%)' }}>
    <div style={{ display: 'grid', gap: 36, gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', maxWidth: 1200, margin: '0 auto' }}>
      {QL_MOBILE_SCREENS.map((s, i) => {
        const C = s.component;
        return (
          <div key={s.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="k-chip" style={{ background: 'var(--accent-soft)', color: 'var(--accent)', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{i + 1}</span>
              <div style={{ fontSize: 15, fontWeight: 700 }}>{s.label}</div>
              <span className="k-chip" style={{ background: s.frame === 'ios' ? '#e2e8f0' : '#dcfce7', color: s.frame === 'ios' ? '#475569' : '#166534', fontSize: 10 }}>{s.frame === 'ios' ? 'iOS' : 'Android'}</span>
            </div>
            <div className={s.frame === 'ios' ? 'phone-shadow' : 'phone-shadow-android'} style={{ borderRadius: s.frame === 'ios' ? 50 : 36, overflow: 'hidden' }}>
              {s.frame === 'ios'
                ? <IOSDevice width={330} height={700}><C/></IOSDevice>
                : <AndroidDevice width={330} height={700}><C/></AndroidDevice>}
            </div>
            <div style={{ textAlign: 'center', fontSize: 12.5, color: 'var(--text-muted)', lineHeight: 1.55, maxWidth: 300 }}>{s.desc}</div>
          </div>
        );
      })}
    </div>
  </div>
);

// —————————————————————————————————————————————
//  TAB 5 — Component specs
// —————————————————————————————————————————————
const SpecCard = ({ name, role, props, states, accent }) => (
  <div className="k-surface" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13.5, fontWeight: 700, color: accent || 'var(--accent)' }}>{'<' + name + '>'}</span>
      </div>
      <div style={{ fontSize: 12.5, color: 'var(--text-muted)', lineHeight: 1.5 }}>{role}</div>
    </div>
    <div>
      <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-subtle)', marginBottom: 6 }}>Key props</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
        {props.map(p => <span key={p} className="mono" style={{ fontSize: 11, padding: '3px 7px', borderRadius: 5, background: 'var(--bg-subtle)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>{p}</span>)}
      </div>
    </div>
    <div>
      <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-subtle)', marginBottom: 6 }}>States</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {states.map(s => <span key={s} style={{ fontSize: 11, color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: 4 }}><span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--accent)' }}/>{s}</span>)}
      </div>
    </div>
  </div>
);

const QLSpecs = () => {
  const specs = [
    { name: 'QuickLogComposer', role: 'The single capture surface. Owns the smart input, media rail and AI bar; emits a structured draft on commit.', props: ['context', 'channels[]', 'onCommit', 'onSaveDraft'], states: ['empty', 'dictating', 'structuring', 'ready', 'offline-queued'] },
    { name: 'VoiceCapture', role: 'Press-and-hold or tap-to-toggle dictation with live waveform and on-device transcription.', props: ['mode="hold|toggle"', 'lang', 'onTranscript'], states: ['idle', 'listening', 'transcribing', 'error'], accent: '#7c3aed' },
    { name: 'MediaAnnotator', role: 'Full-screen photo/video editor: circle, arrow, text and measure tools with AI pre-marks.', props: ['asset', 'tools[]', 'aiMarks[]', 'onSave'], states: ['view', 'drawing', 'editing-mark', 'saved'] },
    { name: 'GeoContextChip', role: 'Resolves location, asset, batch, shift & operator from GPS / QR / badge; every value correctable.', props: ['sources[]', 'editable', 'onOverride'], states: ['resolving', 'resolved', 'overridden', 'denied'], accent: '#16a34a' },
    { name: 'AIStructureBar', role: 'Renders extracted fields as editable chips with a confidence score; click to override.', props: ['fields', 'confidence', 'onEditField'], states: ['extracting', 'suggested', 'edited', 'confirmed'], accent: '#7c3aed' },
    { name: 'ThreadMessage', role: 'A workspace message with @mention + #component-tag rendering, attachments and reactions.', props: ['author', 'team', 'body', 'attachments[]'], states: ['default', 'editing', 'pinned', 'unread'] },
    { name: 'InlineActionItem', role: 'A checkable to-do embedded in the thread with owner, due date and live status.', props: ['title', 'owner', 'due', 'status'], states: ['open', 'in-progress', 'done', 'overdue'], accent: '#16a34a' },
    { name: 'ComponentTag', role: 'A typed #tag that links a message or log to a part, asset or location in the graph.', props: ['kind', 'ref', 'onNavigate'], states: ['default', 'hover', 'resolved', 'broken'], accent: '#7c3aed' },
  ];
  return (
    <div className="fade-in" style={{ padding: '24px 28px 48px', maxWidth: 1180, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <Overline>Component specifications</Overline>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>8 new primitives power the zero-friction layer — all on the existing Kaenal token set.</div>
        </div>
        <div style={{ display: 'flex', gap: 14 }}>
          {[['var(--accent)', 'Capture'], ['#7c3aed', 'AI / tagging'], ['#16a34a', 'Context / actions']].map(([c, l]) => (
            <span key={l} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: 'var(--text-muted)' }}>
              <span style={{ width: 9, height: 9, borderRadius: '50%', background: c }}/>{l}
            </span>
          ))}
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(270px, 1fr))', gap: 14 }}>
        {specs.map(s => <SpecCard key={s.name} {...s}/>)}
      </div>
    </div>
  );
};

// —————————————————————————————————————————————
//  Page shell
// —————————————————————————————————————————————
const QuickLogPage = ({ setRoute }) => {
  const [tab, setTab] = useQL('journey');
  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <PageHeader
        title="Quick-Log & Collaboration"
        description="Phase 1 — “Zero-Friction” quality logging. Voice-first capture, multimedia evidence, and a shared workspace where Engineering, Operations & Quality resolve issues together."
        actions={
          <>
            <span className="k-chip" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>Phase 1 · UI/UX</span>
            <button className="k-btn k-btn-ghost" onClick={() => setRoute && setRoute('mobile')}><Icon name="smartphone" size={14}/>Field app</button>
            <button className="k-btn k-btn-primary" onClick={() => kToast('Export started — quicklog-blueprint.pdf')}><Icon name="download" size={14}/>Export blueprint</button>
          </>
        }
      />
      {/* Tabs */}
      <div style={{ padding: '16px 28px 0', display: 'flex', gap: 6, overflowX: 'auto', borderBottom: '1px solid var(--border)' }}>
        {QL_TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding: '10px 14px', whiteSpace: 'nowrap', fontSize: 13, fontWeight: 500,
            color: tab === t.id ? 'var(--accent)' : 'var(--text-muted)',
            borderBottom: '2px solid ' + (tab === t.id ? 'var(--accent)' : 'transparent'),
            marginBottom: -1, display: 'inline-flex', alignItems: 'center', gap: 7,
          }}>
            <Icon name={t.icon} size={15}/>{t.label}
          </button>
        ))}
      </div>
      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
        {tab === 'journey' && <QLJourney/>}
        {tab === 'desktop' && <QLDesktop/>}
        {tab === 'mobile' && <QLMobile/>}
        {tab === 'collab' && <div style={{ height: '100%', minHeight: 620 }}><CollabWorkspace/></div>}
        {tab === 'specs' && <QLSpecs/>}
      </div>
    </div>
  );
};

Object.assign(window, { QuickLogPage });
