// Kaenal — AI Drawer + Tweaks Panel

const AIDrawer = ({ open, onClose, context }) => {
  const [messages, setMessages] = React.useState([
    { role: 'assistant', text: "Hey — I'm your Kaenal AI copilot. Ask me about NCRs, root causes, or 8D progress. I can also draft problem statements and suggest corrective actions." },
  ]);
  const [input, setInput] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const scrollRef = React.useRef(null);

  React.useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, loading]);

  const send = async (text) => {
    const t = text || input;
    if (!t.trim()) return;
    setInput('');
    setMessages(m => [...m, { role: 'user', text: t }]);
    setLoading(true);
    try {
      const reply = await window.claude.complete({
        messages: [
          { role: 'user', content:
            `You are Kaenal AI, a quality & safety management copilot for a factory. The user is currently viewing: ${context}. Keep replies under 120 words, factual, and practical. Use bullet points when helpful.\n\nUser: ${t}` },
        ],
      });
      setMessages(m => [...m, { role: 'assistant', text: reply }]);
    } catch (e) {
      setMessages(m => [...m, { role: 'assistant', text: 'Sorry — I had trouble reaching my model. Try again in a moment.' }]);
    }
    setLoading(false);
  };

  if (!open) return null;

  const suggestions = [
    'Summarize today\'s overdue NCRs',
    'What\'s blocking 8D-2026-0015?',
    'Draft a problem statement for the weld porosity issue',
    'Top 3 areas by risk this week',
  ];

  return (
    <div style={{
      position: 'fixed', top: 0, right: 0, bottom: 0, width: 420,
      background: 'var(--surface)', borderLeft: '1px solid var(--border)',
      boxShadow: 'var(--shadow-xl)', zIndex: 100,
      display: 'flex', flexDirection: 'column',
    }} className="drawer-in">
      <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 32, height: 32, borderRadius: 'var(--r-md)', background: 'linear-gradient(135deg, #6366f1, #db2777)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="sparkles" size={16}/>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 700 }}>Kaenal AI</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span className="pulse-dot"/>Context aware · {context}
          </div>
        </div>
        <button onClick={onClose} className="k-btn-icon k-btn-plain"><Icon name="x" size={16}/></button>
      </div>

      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {messages.map((m, i) => (
          <div key={i} style={{ display: 'flex', flexDirection: m.role === 'user' ? 'row-reverse' : 'row', gap: 8, alignItems: 'flex-start' }}>
            {m.role === 'assistant' && (
              <div style={{ width: 26, height: 26, borderRadius: 'var(--r-sm)', background: 'linear-gradient(135deg, #6366f1, #db2777)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Icon name="sparkles" size={12}/>
              </div>
            )}
            <div style={{
              maxWidth: '82%', padding: '10px 12px',
              borderRadius: m.role === 'user' ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
              background: m.role === 'user' ? 'var(--accent)' : 'var(--bg-subtle)',
              color: m.role === 'user' ? 'white' : 'var(--text)',
              fontSize: 13, lineHeight: 1.5, whiteSpace: 'pre-wrap',
            }}>{m.text}</div>
          </div>
        ))}
        {loading && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div style={{ width: 26, height: 26, borderRadius: 'var(--r-sm)', background: 'linear-gradient(135deg, #6366f1, #db2777)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="sparkles" size={12}/>
            </div>
            <div style={{ padding: '10px 14px', background: 'var(--bg-subtle)', borderRadius: 12, display: 'flex', gap: 4 }}>
              {[0,1,2].map(i => <span key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--text-muted)', animation: `pulseDot 1.4s ${i*0.2}s infinite` }}/>)}
            </div>
          </div>
        )}
      </div>

      {messages.length === 1 && (
        <div style={{ padding: '8px 16px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div className="k-overline">Suggested</div>
          {suggestions.map(s => (
            <button key={s} onClick={() => send(s)} style={{
              textAlign: 'left', padding: '8px 12px', fontSize: 12,
              border: '1px solid var(--border)', borderRadius: 'var(--r-md)',
              color: 'var(--text)', background: 'var(--surface)',
            }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-subtle)'; e.currentTarget.style.borderColor = 'var(--accent)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--surface)'; e.currentTarget.style.borderColor = 'var(--border)'; }}
            >{s}</button>
          ))}
        </div>
      )}

      <div style={{ padding: 14, borderTop: '1px solid var(--border)' }}>
        <div style={{ position: 'relative' }}>
          <input
            className="k-input" placeholder="Ask Kaenal AI…"
            value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && send()}
            style={{ paddingRight: 42, height: 42 }}
          />
          <button onClick={() => send()} disabled={!input.trim() || loading}
            style={{
              position: 'absolute', right: 5, top: '50%', transform: 'translateY(-50%)',
              width: 32, height: 32, borderRadius: 'var(--r-sm)',
              background: input.trim() ? 'var(--accent)' : 'var(--bg-subtle)',
              color: input.trim() ? 'white' : 'var(--text-subtle)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}><Icon name="send" size={14}/></button>
        </div>
        <div style={{ fontSize: 10, color: 'var(--text-subtle)', marginTop: 6, textAlign: 'center' }}>
          Kaenal AI may produce inaccurate info. Verify before acting.
        </div>
      </div>
    </div>
  );
};

const TweaksPanel = ({ open, settings, update }) => {
  if (!open) return null;
  return (
    <div style={{
      position: 'fixed', bottom: 20, right: 20, width: 300,
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 'var(--r-xl)', boxShadow: 'var(--shadow-xl)',
      padding: 16, zIndex: 200, maxHeight: 'calc(100vh - 40px)', overflowY: 'auto',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <div style={{ width: 24, height: 24, borderRadius: 'var(--r-sm)', background: 'var(--accent)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="sliders" size={12}/></div>
        <div style={{ fontSize: 13, fontWeight: 700 }}>Tweaks</div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <TweakRow label="Theme">
          <Segmented size="sm" value={settings.theme} onChange={v => update({ theme: v })} options={[
            { value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' },
          ]}/>
        </TweakRow>
        <TweakRow label="Density">
          <Segmented size="sm" value={settings.density} onChange={v => update({ density: v })} options={[
            { value: 'comfy', label: 'Comfy' }, { value: 'dense', label: 'Dense' },
          ]}/>
        </TweakRow>
        <TweakRow label="Sidebar">
          <Segmented size="sm" value={settings.sidebar} onChange={v => update({ sidebar: v })} options={[
            { value: 'expanded', label: 'Expanded' }, { value: 'collapsed', label: 'Mini' },
          ]}/>
        </TweakRow>
        <TweakRow label="Accent">
          <div style={{ display: 'flex', gap: 6 }}>
            {[
              { key: 'blue', color: '#2563eb' },
              { key: 'indigo', color: '#4f46e5' },
              { key: 'teal', color: '#0d9488' },
              { key: 'orange', color: '#ea580c' },
            ].map(a => (
              <button key={a.key} onClick={() => update({ accent: a.key })}
                style={{
                  width: 24, height: 24, borderRadius: '50%', background: a.color,
                  border: settings.accent === a.key ? '2px solid var(--text)' : '2px solid transparent',
                  outline: '1px solid var(--border)',
                }}/>
            ))}
          </div>
        </TweakRow>
        <TweakRow label="AI prominence">
          <Segmented size="sm" value={settings.ai} onChange={v => update({ ai: v })} options={[
            { value: 'quiet', label: 'Quiet' }, { value: 'visible', label: 'Visible' },
          ]}/>
        </TweakRow>

        {/* Supplier scoring weights — visible only on supplier routes */}
        <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }}/>
        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Supplier scoring</div>
        <SupplierWeights settings={settings} update={update}/>
      </div>
    </div>
  );
};

const SupplierWeights = ({ settings, update }) => {
  const w = settings.supplierWeights || { ppm: 35, otd: 25, oqe: 25, scar: 15 };
  const setW = (key, val) => {
    // Normalize others proportionally to keep sum = 100
    const others = Object.keys(w).filter(k => k !== key);
    const remaining = 100 - val;
    const othersSum = others.reduce((s, k) => s + w[k], 0) || 1;
    const next = { ...w, [key]: val };
    others.forEach(k => { next[k] = Math.round((w[k] / othersSum) * remaining); });
    // Fix rounding to ensure sum exactly 100
    const fix = 100 - Object.values(next).reduce((s, v) => s + v, 0);
    next[others[0]] += fix;
    update({ supplierWeights: next });
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {[
        { key: 'ppm', label: 'PPM defects' },
        { key: 'otd', label: 'On-time delivery' },
        { key: 'oqe', label: 'Quality eval' },
        { key: 'scar', label: 'SCAR response' },
      ].map(row => (
        <div key={row.key}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 2 }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', flex: 1 }}>{row.label}</span>
            <span style={{ fontSize: 11, fontWeight: 600, fontVariantNumeric: 'tabular-nums', minWidth: 26, textAlign: 'right' }}>{w[row.key]}%</span>
          </div>
          <input type="range" min={5} max={80} value={w[row.key]} onChange={e => setW(row.key, parseInt(e.target.value, 10))} style={{ width: '100%', accentColor: 'var(--accent)' }}/>
        </div>
      ))}
    </div>
  );
};

const TweakRow = ({ label, children }) => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
    <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)' }}>{label}</span>
    {children}
  </div>
);

Object.assign(window, { AIDrawer, TweaksPanel });
