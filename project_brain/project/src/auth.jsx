// Kaenal — Auth: workspace login (company-subdomain pattern)

const Auth = ({ onSignIn }) => {
  // Allow opening with a specific stage via URL hash or localStorage hint
  const initialStage = (() => {
    const hash = window.location.hash.replace('#', '');
    if (['forgot','reset','invite','locked','workspace','login','request','reset-success'].includes(hash)) return hash;
    return 'workspace';
  })();
  const [stage, setStage] = React.useState(initialStage);
  const [workspace, setWorkspace] = React.useState(localStorage.getItem('k_workspace') || 'precision-auto');
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [showPw, setShowPw] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState('');

  const tenants = {
    'precision-auto': { name: 'Precision Auto Components', industry: 'Automotive Tier-1', logo: 'P', color: '#2563eb', users: 412, sso: 'Microsoft Entra ID', plan: 'Enterprise' },
    'novacore-mfg': { name: 'NovaCore Manufacturing', industry: 'Aerospace', logo: 'N', color: '#7c3aed', users: 218, sso: 'Okta', plan: 'Professional' },
    'kobata-foods': { name: 'Kobata Foods Group', industry: 'Food & Beverage', logo: 'K', color: '#059669', users: 89, sso: 'Google Workspace', plan: 'Standard' },
  };
  const tenant = tenants[workspace] || tenants['precision-auto'];

  const submitWorkspace = (e) => {
    e?.preventDefault();
    if (!workspace.trim()) { setErr('Enter your workspace name'); return; }
    if (!tenants[workspace]) {
      setErr(`We couldn't find “${workspace}” — try precision-auto, novacore-mfg, or kobata-foods`);
      return;
    }
    setErr('');
    localStorage.setItem('k_workspace', workspace);
    setStage('login');
  };

  const submitLogin = async (e) => {
    e?.preventDefault();
    if (!email.includes('@')) { setErr('Enter a valid email'); return; }
    if (password.length < 4) { setErr('Password too short'); return; }
    setErr(''); setBusy(true);
    await new Promise(r => setTimeout(r, 850));
    setBusy(false);
    onSignIn({ email, workspace, tenant });
  };

  const ssoLogin = async () => {
    setBusy(true);
    await new Promise(r => setTimeout(r, 1200));
    setBusy(false);
    onSignIn({ email: `you@${workspace}.com`, workspace, tenant, sso: true });
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'grid', gridTemplateColumns: '1fr 1fr',
      background: 'var(--bg)',
    }}>
      {/* Left: form */}
      <div style={{ display: 'flex', flexDirection: 'column', padding: '40px 56px', minWidth: 480 }}>
        {/* Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 64 }}>
          <div style={{ color: 'var(--accent)' }}><Icon name="logo" size={26} stroke={1.75}/></div>
          <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: '0.08em' }}>KAENAL</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 8, padding: '2px 8px', background: 'var(--bg-subtle)', borderRadius: 'var(--r-full)', fontWeight: 500 }}>Quality · Safety · Compliance</div>
        </div>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', maxWidth: 420 }} className="fade-in" key={stage}>
          {stage === 'workspace' && (
            <>
              <h1 style={{ fontSize: 32, fontWeight: 700, margin: '0 0 8px', letterSpacing: '-0.02em' }}>Sign in to Kaenal</h1>
              <div style={{ color: 'var(--text-muted)', marginBottom: 32, fontSize: 14 }}>Each company has its own private workspace. Enter yours to continue.</div>

              <form onSubmit={submitWorkspace}>
                <label className="k-overline" style={{ display: 'block', marginBottom: 8 }}>Workspace</label>
                <div style={{
                  display: 'flex', alignItems: 'stretch',
                  border: '1px solid var(--border)', borderRadius: 'var(--r-md)',
                  background: 'var(--surface)',
                  overflow: 'hidden',
                }}>
                  <input
                    autoFocus value={workspace} onChange={e => setWorkspace(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                    placeholder="your-company"
                    style={{ flex: 1, padding: '0 12px', height: 44, border: 'none', outline: 'none', background: 'transparent', fontSize: 14 }}
                  />
                  <div style={{ padding: '0 14px', display: 'flex', alignItems: 'center', background: 'var(--bg-subtle)', color: 'var(--text-muted)', fontSize: 13, borderLeft: '1px solid var(--border)' }}>.kaenal.app</div>
                </div>
                {err && <div style={{ color: 'var(--danger-600)', fontSize: 12, marginTop: 8, display: 'flex', alignItems: 'center', gap: 6 }}><Icon name="alert" size={12}/>{err}</div>}

                <button type="submit" className="k-btn k-btn-primary" style={{ width: '100%', height: 44, marginTop: 20, fontSize: 14, justifyContent: 'center' }}>
                  Continue → <Icon name="arrowRight" size={14}/>
                </button>
              </form>

              <div style={{ marginTop: 24 }} className="k-overline">Try a demo workspace</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
                {Object.entries(tenants).map(([k, t]) => (
                  <button key={k} onClick={() => { setWorkspace(k); setErr(''); }} style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '10px 12px', border: '1px solid var(--border)',
                    borderRadius: 'var(--r-md)', background: workspace === k ? 'var(--accent-soft)' : 'var(--surface)',
                    borderColor: workspace === k ? 'var(--accent)' : 'var(--border)',
                    textAlign: 'left',
                  }}>
                    <div style={{ width: 32, height: 32, borderRadius: 'var(--r-sm)', background: t.color, color: 'white', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>{t.logo}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{t.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{k}.kaenal.app · {t.industry}</div>
                    </div>
                    {workspace === k && <Icon name="check" size={14} stroke={2.5}/>}
                  </button>
                ))}
              </div>

              <div style={{ marginTop: 32, fontSize: 12, color: 'var(--text-muted)', textAlign: 'center' }}>
                Don't have a workspace? <button onClick={() => setStage('request')} className="k-link" style={{ background: 'none', padding: 0 }}>Request access →</button>
              </div>
            </>
          )}

          {stage === 'login' && (
            <>
              <button onClick={() => setStage('workspace')} className="k-btn k-btn-plain k-btn-sm" style={{ alignSelf: 'flex-start', marginBottom: 14, padding: '4px 8px' }}>
                <Icon name="arrowLeft" size={12}/> Switch workspace
              </button>

              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 12, border: '1px solid var(--border)', borderRadius: 'var(--r-md)', background: 'var(--surface)', marginBottom: 24 }}>
                <div style={{ width: 36, height: 36, borderRadius: 'var(--r-sm)', background: tenant.color, color: 'white', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15 }}>{tenant.logo}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{tenant.name}</div>
                  <div className="mono" style={{ fontSize: 11, color: 'var(--text-muted)' }}>{workspace}.kaenal.app</div>
                </div>
                <span className="k-chip" style={{ background: 'var(--success-100)', color: 'var(--success-700)' }}>{tenant.plan}</span>
              </div>

              <h1 style={{ fontSize: 28, fontWeight: 700, margin: '0 0 6px' }}>Welcome back</h1>
              <div style={{ color: 'var(--text-muted)', marginBottom: 24, fontSize: 13 }}>Sign in to continue to your workspace.</div>

              <button className="k-btn k-btn-ghost" onClick={ssoLogin} disabled={busy} style={{ width: '100%', height: 44, justifyContent: 'center', fontSize: 13, marginBottom: 16 }}>
                <Icon name="shieldCheck" size={16}/>
                Continue with {tenant.sso}
              </button>

              <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text-muted)', fontSize: 11, margin: '8px 0 16px' }}>
                <div style={{ flex: 1, height: 1, background: 'var(--border)' }}/>
                OR SIGN IN WITH PASSWORD
                <div style={{ flex: 1, height: 1, background: 'var(--border)' }}/>
              </div>

              <form onSubmit={submitLogin}>
                <label className="k-overline" style={{ display: 'block', marginBottom: 6 }}>Work email</label>
                <input className="k-input" autoFocus value={email} onChange={e => setEmail(e.target.value)} placeholder="you@company.com" style={{ height: 42, marginBottom: 14 }}/>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <label className="k-overline">Password</label>
                  <button type="button" onClick={() => setStage('forgot')} className="k-link" style={{ fontSize: 11, background: 'none', padding: 0 }}>Forgot?</button>
                </div>
                <div style={{ position: 'relative' }}>
                  <input className="k-input" type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" style={{ height: 42, paddingRight: 42 }}/>
                  <button type="button" onClick={() => setShowPw(s => !s)} style={{ position: 'absolute', right: 6, top: 6, width: 30, height: 30, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon name={showPw ? 'eyeOff' : 'eye'} size={14}/>
                  </button>
                </div>

                <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 14, fontSize: 13, color: 'var(--text-muted)', cursor: 'pointer' }}>
                  <input type="checkbox" defaultChecked style={{ accentColor: 'var(--accent)' }}/> Trust this device for 30 days
                </label>

                {err && <div style={{ color: 'var(--danger-600)', fontSize: 12, marginTop: 12, display: 'flex', alignItems: 'center', gap: 6 }}><Icon name="alert" size={12}/>{err}</div>}

                <button type="submit" disabled={busy} className="k-btn k-btn-primary" style={{ width: '100%', height: 44, marginTop: 20, fontSize: 14, justifyContent: 'center' }}>
                  {busy ? 'Signing in…' : 'Sign in'}
                </button>
              </form>

              <div style={{ marginTop: 32, fontSize: 11, color: 'var(--text-subtle)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Icon name="lock" size={11}/> SOC 2 Type II · ISO 27001 · GDPR · Data hosted in {tenant.industry === 'Aerospace' ? 'US-East (FedRAMP)' : 'EU-West'}
              </div>
            </>
          )}

          {stage === 'forgot' && <AuthForgot tenant={tenant} setStage={setStage}/>}
          {stage === 'reset' && <AuthReset tenant={tenant} setStage={setStage}/>}
          {stage === 'reset-success' && <AuthResetSuccess setStage={setStage}/>}
          {stage === 'invite' && <AuthInvite tenant={tenant} setStage={setStage} onSignIn={onSignIn}/>}
          {stage === 'locked' && <AuthLocked tenant={tenant} setStage={setStage}/>}

          {stage === 'request' && (
            <>
              <button onClick={() => setStage('workspace')} className="k-btn k-btn-plain k-btn-sm" style={{ alignSelf: 'flex-start', marginBottom: 14 }}><Icon name="arrowLeft" size={12}/> Back</button>
              <h1 style={{ fontSize: 28, fontWeight: 700, margin: '0 0 6px' }}>Request a workspace</h1>
              <div style={{ color: 'var(--text-muted)', marginBottom: 24, fontSize: 13 }}>We'll provision a private Kaenal tenant for your company. Setup typically takes under an hour.</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <Field label="Company name"><input className="k-input" placeholder="Acme Manufacturing"/></Field>
                <Field label="Work email"><input className="k-input" placeholder="you@acme.com"/></Field>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <Field label="Industry"><select className="k-input"><option>Automotive</option><option>Aerospace</option><option>Food & Beverage</option><option>Pharmaceutical</option><option>Other</option></select></Field>
                  <Field label="Plant size"><select className="k-input"><option>50–200 employees</option><option>200–1,000</option><option>1,000–5,000</option><option>5,000+</option></select></Field>
                </div>
                <Field label="Compliance frameworks">
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {['IATF 16949', 'ISO 9001', 'ISO 14001', 'AS9100', 'FDA 21 CFR Part 11', 'HACCP'].map(f => (
                      <label key={f} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', border: '1px solid var(--border)', borderRadius: 'var(--r-full)', fontSize: 12, cursor: 'pointer' }}>
                        <input type="checkbox" style={{ accentColor: 'var(--accent)' }}/>{f}
                      </label>
                    ))}
                  </div>
                </Field>
              </div>
              <button className="k-btn k-btn-primary" style={{ width: '100%', height: 44, marginTop: 20, justifyContent: 'center' }}>Request access</button>
            </>
          )}
        </div>

        <div style={{ marginTop: 24, fontSize: 11, color: 'var(--text-subtle)', display: 'flex', justifyContent: 'space-between' }}>
          <span>© 2026 Kaenal Inc.</span>
          <div style={{ display: 'flex', gap: 14 }}>
            <a href="#" className="k-link">Privacy</a>
            <a href="#" className="k-link">Terms</a>
            <a href="#" className="k-link">Status</a>
            <span style={{ color: 'var(--border-strong)' }}>·</span>
            <details style={{ position: 'relative' }}>
              <summary style={{ cursor: 'pointer', listStyle: 'none', color: 'var(--text-muted)' }}>Demo screens ▾</summary>
              <div style={{ position: 'absolute', bottom: 22, right: 0, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', padding: 6, display: 'flex', flexDirection: 'column', gap: 2, minWidth: 180, boxShadow: '0 8px 24px rgba(15,23,42,0.18)', zIndex: 10 }}>
                {[
                  { id: 'workspace', l: 'Workspace picker' },
                  { id: 'login', l: 'Sign-in form' },
                  { id: 'forgot', l: 'Forgot password' },
                  { id: 'reset', l: 'Reset password' },
                  { id: 'reset-success', l: 'Reset success' },
                  { id: 'invite', l: 'Accept invitation' },
                  { id: 'locked', l: 'Account locked' },
                  { id: 'request', l: 'Request workspace' },
                ].map(d => (
                  <button key={d.id} onClick={() => setStage(d.id)} style={{ padding: '6px 10px', textAlign: 'left', fontSize: 12, background: stage === d.id ? 'var(--accent-soft)' : 'transparent', color: stage === d.id ? 'var(--accent)' : 'var(--text)', border: 'none', borderRadius: 4, cursor: 'pointer' }}>{d.l}</button>
                ))}
              </div>
            </details>
          </div>
        </div>
      </div>

      {/* Right: visual */}
      <div style={{
        position: 'relative', overflow: 'hidden',
        background: 'linear-gradient(135deg, #0f1d35 0%, #1e3a8a 60%, #312e81 100%)',
        color: 'white',
      }}>
        <div style={{ position: 'absolute', inset: 0, opacity: 0.18,
          backgroundImage: 'radial-gradient(circle at 20% 30%, white 1px, transparent 1px), radial-gradient(circle at 70% 70%, white 1px, transparent 1px)',
          backgroundSize: '40px 40px, 60px 60px',
        }}/>
        <div style={{ position: 'relative', padding: 56, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div style={{ marginTop: 56 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 'var(--r-full)', background: 'rgba(255,255,255,0.1)', fontSize: 11, marginBottom: 24, backdropFilter: 'blur(10px)' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#34d399' }}/> AI-driven · Powered by Anthropic
            </div>
            <h2 style={{ fontSize: 40, fontWeight: 700, lineHeight: 1.1, marginBottom: 16, letterSpacing: '-0.02em' }}>
              The quality<br/>copilot for<br/><span style={{ color: '#93c5fd' }}>modern factories.</span>
            </h2>
            <p style={{ fontSize: 14, lineHeight: 1.6, color: 'rgba(255,255,255,0.7)', maxWidth: 420 }}>
              Inspections, NCRs, and 8D — connected end-to-end with AI root-cause analysis and SPC monitoring. Trusted by 200+ plants across 14 countries.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24, marginTop: 40 }}>
            {[
              { v: '47%', l: 'Faster issue closure' },
              { v: '$2.1M', l: 'Avg. annual scrap savings' },
              { v: 'IATF 16949', l: 'Audit-ready out of the box' },
            ].map(s => (
              <div key={s.l}>
                <div style={{ fontSize: 22, fontWeight: 700, color: '#bfdbfe' }}>{s.v}</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 2 }}>{s.l}</div>
              </div>
            ))}
          </div>

          <div style={{ marginBottom: 8, padding: 18, borderRadius: 'var(--r-xl)', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', backdropFilter: 'blur(10px)' }}>
            <div style={{ fontSize: 13, lineHeight: 1.6, color: 'rgba(255,255,255,0.9)' }}>
              "We closed our IATF surveillance audit with zero findings. Kaenal's evidence trail saved us six weeks of prep."
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 14 }}>
              <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: 12 }}>RM</div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600 }}>Ramesh Mehta</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>Quality Director, Precision Auto Components</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const Field = ({ label, children }) => (
  <div>
    <label className="k-overline" style={{ display: 'block', marginBottom: 6 }}>{label}</label>
    {children}
  </div>
);

Object.assign(window, { Auth });
