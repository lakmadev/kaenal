// Kaenal — MFA: sign-in verification challenge + shared code/QR/recovery primitives
// Extends the existing auth flow (workspace → email → password → verify).
// Presentational only; wires to existing verify/recovery endpoints.

// ---- Demo tenants (mirror auth.jsx) ----
const MFA_TENANTS = {
  'precision-auto': { name: 'Precision Auto Components', industry: 'Automotive Tier-1', logo: 'P', color: '#2563eb', plan: 'Enterprise', region: 'EU-West' },
  'apex-castings': { name: 'Apex Castings (Supplier)', industry: 'Casting supplier', logo: 'A', color: '#0d9488', plan: 'Supplier portal', region: 'EU-West', supplier: true },
};

// ---- Deterministic pseudo-random (seeded) for stable demo QR / codes ----
function mfaSeed(s) { let h = 2166136261 >>> 0; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return () => { h += 0x6d2b79f5; let t = h; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// ---- QR placeholder: realistic module matrix with three finder patterns ----
const QrCode = ({ size = 168, seed = 'otpauth://totp/Kaenal', quiet = true }) => {
  const N = 29;
  const rnd = React.useMemo(() => mfaSeed(seed), [seed]);
  const cells = React.useMemo(() => {
    const g = Array.from({ length: N }, () => Array(N).fill(false));
    const finder = (r, c) => { for (let i = -1; i <= 7; i++) for (let j = -1; j <= 7; j++) { const rr = r + i, cc = c + j; if (rr < 0 || cc < 0 || rr >= N || cc >= N) continue; const border = i === 0 || i === 6 || j === 0 || j === 6; const core = i >= 2 && i <= 4 && j >= 2 && j <= 4; g[rr][cc] = (i >= 0 && i <= 6 && j >= 0 && j <= 6) ? (border || core) : false; } };
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) { const inFinder = (r < 8 && c < 8) || (r < 8 && c >= N - 8) || (r >= N - 8 && c < 8); if (!inFinder) g[r][c] = rnd() > 0.52; }
    finder(0, 0); finder(0, N - 7); finder(N - 7, 0);
    for (let i = 8; i < N - 8; i++) { g[6][i] = i % 2 === 0; g[i][6] = i % 2 === 0; }
    return g;
  }, [seed]);
  const pad = quiet ? 4 : 0;
  const m = size / (N + pad * 2);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Authenticator QR code" style={{ display: 'block', borderRadius: 6 }}>
      <rect width={size} height={size} fill="#fff"/>
      {cells.map((row, r) => row.map((on, c) => on ? <rect key={`${r}-${c}`} x={(c + pad) * m} y={(r + pad) * m} width={m + 0.5} height={m + 0.5} fill="#18181b"/> : null))}
    </svg>
  );
};

// ---- 6-box code input (auto-advance, paste-aware) ----
const CodeBoxes = ({ value = '', onChange, len = 6, disabled, invalid, autoFocus, onComplete }) => {
  const refs = React.useRef([]);
  const digits = value.padEnd(len).slice(0, len).split('');
  React.useEffect(() => { if (autoFocus && refs.current[0]) refs.current[0].focus(); }, [autoFocus]);
  const setAt = (i, ch) => {
    const arr = value.padEnd(len).slice(0, len).split('');
    arr[i] = ch; const next = arr.join('').replace(/\s+$/, '');
    onChange(next);
    if (ch && i < len - 1) refs.current[i + 1]?.focus();
    if (next.replace(/\s/g, '').length === len && onComplete) onComplete(next);
  };
  const onKey = (i, e) => {
    if (e.key === 'Backspace' && !digits[i]?.trim() && i > 0) refs.current[i - 1]?.focus();
    if (e.key === 'ArrowLeft' && i > 0) refs.current[i - 1]?.focus();
    if (e.key === 'ArrowRight' && i < len - 1) refs.current[i + 1]?.focus();
  };
  const onPaste = (e) => { e.preventDefault(); const t = (e.clipboardData.getData('text') || '').replace(/\D/g, '').slice(0, len); if (t) { onChange(t); refs.current[Math.min(t.length, len - 1)]?.focus(); if (t.length === len && onComplete) onComplete(t); } };
  const borderColor = invalid ? 'var(--danger-500)' : 'var(--border-strong)';
  return (
    <div style={{ display: 'flex', gap: 8 }} onPaste={onPaste}>
      {Array.from({ length: len }).map((_, i) => (
        <React.Fragment key={i}>
          <input
            ref={el => refs.current[i] = el}
            inputMode="numeric" maxLength={1} disabled={disabled}
            value={digits[i]?.trim() || ''}
            onChange={e => setAt(i, e.target.value.replace(/\D/g, '').slice(-1))}
            onKeyDown={e => onKey(i, e)}
            onFocus={e => e.target.select()}
            className="mono"
            style={{
              width: 52, height: 60, textAlign: 'center', fontSize: 24, fontWeight: 600,
              border: `1.5px solid ${borderColor}`, borderRadius: 'var(--r-md)',
              background: disabled ? 'var(--bg-subtle)' : 'var(--surface)', color: 'var(--text)',
              outline: 'none', transition: 'all 120ms', caretColor: 'var(--accent)',
              opacity: disabled ? 0.6 : 1,
            }}
            onFocusCapture={e => { if (!invalid) e.target.style.borderColor = 'var(--accent)'; }}
            onBlur={e => e.target.style.borderColor = borderColor}
          />
          {i === 2 && <div style={{ display: 'flex', alignItems: 'center', color: 'var(--text-subtle)', fontSize: 20, userSelect: 'none' }}>–</div>}
        </React.Fragment>
      ))}
    </div>
  );
};

// ---- Inline error / success strips (shared) ----
const MfaError = ({ children }) => (
  <div className="fade-in" role="alert" style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 14, padding: '9px 12px', background: 'var(--danger-50)', border: '1px solid var(--danger-100)', borderRadius: 'var(--r-md)', color: 'var(--danger-700)', fontSize: 12.5, fontWeight: 500 }}>
    <Icon name="alert" size={14} stroke={2}/>{children}
  </div>
);
const MfaNote = ({ icon = 'info', children, tone = 'muted' }) => {
  const map = { muted: ['var(--bg-subtle)', 'var(--border)', 'var(--text-muted)'], warn: ['var(--warning-50)', 'rgba(245,158,11,0.25)', 'var(--warning-700)'] };
  const [bg, bd, fg] = map[tone];
  return <div style={{ display: 'flex', gap: 9, alignItems: 'flex-start', padding: '11px 13px', background: bg, border: `1px solid ${bd}`, borderRadius: 'var(--r-md)', fontSize: 12, lineHeight: 1.55, color: fg }}><Icon name={icon} size={14} stroke={2} style={{ flexShrink: 0, marginTop: 1 }}/><div>{children}</div></div>;
};

// ---- Two-column auth shell (mirrors auth.jsx) ----
const AuthShell = ({ children }) => (
  <div style={{ width: '100%', minHeight: 640, display: 'grid', gridTemplateColumns: '1fr 1fr', background: 'var(--bg)' }}>
    <div style={{ display: 'flex', flexDirection: 'column', padding: '40px 48px', minWidth: 420 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 56 }}>
        <div style={{ color: 'var(--accent)' }}><Icon name="logo" size={26} stroke={1.75}/></div>
        <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: '0.08em' }}>KAENAL</div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 8, padding: '2px 8px', background: 'var(--bg-subtle)', borderRadius: 'var(--r-full)', fontWeight: 500 }}>Quality · Safety · Compliance</div>
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', maxWidth: 420 }}>{children}</div>
      <div style={{ marginTop: 24, fontSize: 11, color: 'var(--text-subtle)', display: 'flex', justifyContent: 'space-between' }}>
        <span>© 2026 Kaenal Inc.</span>
        <div style={{ display: 'flex', gap: 14 }}><a href="#" className="k-link">Privacy</a><a href="#" className="k-link">Terms</a><a href="#" className="k-link">Status</a></div>
      </div>
    </div>
    <div style={{ position: 'relative', overflow: 'hidden', background: 'linear-gradient(135deg, #0f1d35 0%, #1e3a8a 60%, #312e81 100%)', color: 'white' }}>
      <div style={{ position: 'absolute', inset: 0, opacity: 0.18, backgroundImage: 'radial-gradient(circle at 20% 30%, white 1px, transparent 1px), radial-gradient(circle at 70% 70%, white 1px, transparent 1px)', backgroundSize: '40px 40px, 60px 60px' }}/>
      <div style={{ position: 'relative', padding: 44, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 24 }}>
        <div style={{ display: 'inline-flex', alignSelf: 'flex-start', alignItems: 'center', gap: 8, padding: '5px 12px', borderRadius: 'var(--r-full)', background: 'rgba(255,255,255,0.1)', fontSize: 12, backdropFilter: 'blur(10px)' }}>
          <Icon name="shieldCheck" size={14}/> Verified sign-in
        </div>
        <h2 style={{ fontSize: 28, fontWeight: 700, lineHeight: 1.15, margin: 0, letterSpacing: '-0.02em', textWrap: 'balance' }}>One more step to keep your <span style={{ color: '#93c5fd' }}>quality records safe.</span></h2>
        <p style={{ fontSize: 13.5, lineHeight: 1.65, color: 'rgba(255,255,255,0.72)', maxWidth: 380, margin: 0 }}>
          Two-factor verification protects the audit trail behind every inspection, NCR, and 8D — a requirement under IATF 16949 §7.5.3 record integrity.
        </p>
        <div style={{ padding: 18, borderRadius: 'var(--r-xl)', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', backdropFilter: 'blur(10px)', maxWidth: 400 }}>
          <div style={{ display: 'flex', gap: 12 }}>
            {[{ i: 'lock', l: 'Encrypted', s: 'AES-256' }, { i: 'shield', l: 'SOC 2', s: 'Type II' }, { i: 'history', l: 'Audit trail', s: '7-year' }].map(x => (
              <div key={x.l} style={{ flex: 1 }}>
                <div style={{ opacity: 0.8, marginBottom: 6 }}><Icon name={x.i} size={16}/></div>
                <div style={{ fontSize: 12.5, fontWeight: 600 }}>{x.l}</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>{x.s}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  </div>
);

// ---- Workspace context card (mirrors auth.jsx login card) ----
const TenantCard = ({ tenant, workspace, email }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 12, border: '1px solid var(--border)', borderRadius: 'var(--r-md)', background: 'var(--surface)', marginBottom: 24 }}>
    <div style={{ width: 36, height: 36, borderRadius: 'var(--r-sm)', background: tenant.color, color: 'white', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, flexShrink: 0 }}>{tenant.logo}</div>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{tenant.name}</div>
      <div className="mono" style={{ fontSize: 11, color: 'var(--text-muted)' }}>{email || `${workspace}.kaenal.app`}</div>
    </div>
    <span className="k-chip" style={{ background: tenant.supplier ? 'var(--info-50)' : 'var(--success-100)', color: tenant.supplier ? 'var(--info-600)' : 'var(--success-700)' }}>{tenant.plan}</span>
  </div>
);

// ============================================================
// SIGN-IN CHALLENGE — the verification step after password
// state: 'idle' | 'busy' | 'error' | 'success'
// ============================================================
const MfaChallenge = ({ tenant = MFA_TENANTS['precision-auto'], workspace = 'precision-auto', email = 'priya.iyer@precision-auto.com', forceState, onBack, onVerified }) => {
  const [mode, setMode] = React.useState('code'); // 'code' | 'recovery'
  const [code, setCode] = React.useState(forceState === 'error' ? '204815' : '');
  const [recovery, setRecovery] = React.useState('');
  const [state, setState] = React.useState(forceState || 'idle');

  React.useEffect(() => { if (forceState) setState(forceState); }, [forceState]);

  const ready = mode === 'code' ? code.replace(/\s/g, '').length === 6 : recovery.replace(/\s/g, '').length >= 10;
  const busy = state === 'busy';
  const invalid = state === 'error';

  const submit = (e) => {
    e?.preventDefault();
    if (!ready || busy) return;
    setState('busy');
    setTimeout(() => setState('idle'), 1400); // demo: land back on idle; real flow resolves via endpoint
  };

  if (state === 'success') {
    return (
      <div className="fade-in">
        <TenantCard tenant={tenant} email={email}/>
        <div style={{ display: 'inline-flex', padding: 16, borderRadius: '50%', background: 'var(--success-50)', color: 'var(--success-600)', marginBottom: 20 }}><Icon name="check" size={32} stroke={2.5}/></div>
        <h1 style={{ fontSize: 28, fontWeight: 700, margin: '0 0 8px', letterSpacing: '-0.01em' }}>Identity verified</h1>
        <div style={{ color: 'var(--text-muted)', fontSize: 14, lineHeight: 1.6, marginBottom: 20 }}>You're signed in to <strong style={{ color: 'var(--text)' }}>{tenant.name}</strong>. Taking you to your workspace…</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text-muted)', fontSize: 13 }}><span className="k-spin" style={{ width: 16, height: 16, border: '2px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%' }}/> Loading dashboard</div>
      </div>
    );
  }

  return (
    <form className="fade-in" onSubmit={submit} key={mode}>
      <button type="button" onClick={onBack} className="k-btn k-btn-plain k-btn-sm" style={{ alignSelf: 'flex-start', marginBottom: 14, padding: '4px 8px' }}>
        <Icon name="arrowLeft" size={12}/> Back
      </button>
      <TenantCard tenant={tenant} email={email}/>

      <div style={{ display: 'inline-flex', padding: 12, borderRadius: 'var(--r-md)', background: 'var(--accent-soft)', color: 'var(--accent)', marginBottom: 16 }}>
        <Icon name={mode === 'code' ? 'smartphone' : 'key'} size={24}/>
      </div>

      {mode === 'code' ? (
        <>
          <h1 style={{ fontSize: 26, fontWeight: 700, margin: '0 0 6px', letterSpacing: '-0.01em' }}>Two-factor verification</h1>
          <div style={{ color: 'var(--text-muted)', marginBottom: 24, fontSize: 13.5, lineHeight: 1.6 }}>Enter the 6-digit code from your authenticator app to finish signing in.</div>

          <label className="k-overline" style={{ display: 'block', marginBottom: 10 }}>Verification code</label>
          <CodeBoxes value={code} onChange={v => { setCode(v); if (invalid) setState('idle'); }} disabled={busy} invalid={invalid} autoFocus onComplete={() => setState(s => s)}/>
          {invalid && <MfaError>That code isn't valid. Try again.</MfaError>}

          <button type="submit" disabled={!ready || busy} className="k-btn k-btn-primary" style={{ width: '100%', height: 44, marginTop: 20, fontSize: 14, justifyContent: 'center', opacity: (!ready || busy) ? 0.6 : 1 }}>
            {busy ? <><span className="k-spin" style={{ width: 15, height: 15, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', borderRadius: '50%' }}/> Verifying…</> : 'Verify'}
          </button>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 18 }}>
            <button type="button" onClick={() => { setMode('recovery'); setState('idle'); }} className="k-link" style={{ fontSize: 12.5, background: 'none', padding: 0 }}>Use a recovery code instead</button>
            <span style={{ fontSize: 12, color: 'var(--text-subtle)', display: 'flex', alignItems: 'center', gap: 5 }}><Icon name="clock" size={12}/> Code refreshes every 30s</span>
          </div>
        </>
      ) : (
        <>
          <h1 style={{ fontSize: 26, fontWeight: 700, margin: '0 0 6px', letterSpacing: '-0.01em' }}>Enter a recovery code</h1>
          <div style={{ color: 'var(--text-muted)', marginBottom: 22, fontSize: 13.5, lineHeight: 1.6 }}>Use one of the one-time backup codes you saved when you set up two-factor. Each code works only once.</div>

          <label className="k-overline" style={{ display: 'block', marginBottom: 8 }}>Recovery code</label>
          <input className="k-input mono" autoFocus value={recovery} onChange={e => { setRecovery(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 14)); if (invalid) setState('idle'); }}
            placeholder="xxxx-xxxx-xxxx" style={{ height: 46, fontSize: 16, letterSpacing: '0.08em', borderColor: invalid ? 'var(--danger-500)' : undefined }}/>
          {invalid && <MfaError>That recovery code isn't valid or has already been used.</MfaError>}

          <button type="submit" disabled={!ready || busy} className="k-btn k-btn-primary" style={{ width: '100%', height: 44, marginTop: 20, fontSize: 14, justifyContent: 'center', opacity: (!ready || busy) ? 0.6 : 1 }}>
            {busy ? <><span className="k-spin" style={{ width: 15, height: 15, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', borderRadius: '50%' }}/> Verifying…</> : 'Verify recovery code'}
          </button>

          <div style={{ marginTop: 18 }}>
            <button type="button" onClick={() => { setMode('code'); setState('idle'); }} className="k-link" style={{ fontSize: 12.5, background: 'none', padding: 0 }}>← Back to authenticator code</button>
          </div>
        </>
      )}

      <div style={{ marginTop: 28, fontSize: 11.5, color: 'var(--text-subtle)', display: 'flex', alignItems: 'center', gap: 6, lineHeight: 1.5 }}>
        <Icon name="info" size={12}/> Lost access to your device and codes? <a href="#" className="k-link">Contact your workspace admin</a>.
      </div>
    </form>
  );
};

// ============================================================
// BLOCKED — external Supplier whose account REQUIRES MFA but has none set up
// ============================================================
const MfaRequiredBlocked = ({ tenant = MFA_TENANTS['apex-castings'], email = 'j.okafor@apex-castings.com' }) => (
  <div className="fade-in">
    <TenantCard tenant={tenant} email={email}/>
    <div style={{ display: 'inline-flex', padding: 14, borderRadius: 'var(--r-md)', background: 'var(--warning-50)', color: 'var(--warning-700)', marginBottom: 18, border: '1px solid rgba(245,158,11,0.25)' }}>
      <Icon name="shield" size={26}/>
    </div>
    <h1 style={{ fontSize: 26, fontWeight: 700, margin: '0 0 8px', letterSpacing: '-0.01em' }}>Two-factor is required to continue</h1>
    <div style={{ color: 'var(--text-muted)', marginBottom: 20, fontSize: 13.5, lineHeight: 1.65 }}>
      <strong style={{ color: 'var(--text)' }}>{tenant.name}</strong> requires two-factor authentication for all partner accounts, but it isn't set up on your account yet. For security, supplier accounts can only enroll a second factor with help from an administrator.
    </div>

    <div className="k-surface" style={{ padding: 16, background: 'var(--bg-subtle)', marginBottom: 16 }}>
      <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}><Icon name="mail" size={14}/> What to do next</div>
      <ol style={{ fontSize: 12.5, color: 'var(--text-muted)', paddingLeft: 18, margin: 0, lineHeight: 1.8 }}>
        <li>Contact your Kaenal administrator at <strong style={{ color: 'var(--text)' }}>Precision Auto Components</strong>.</li>
        <li>Ask them to send a two-factor setup link to <strong style={{ color: 'var(--text)' }}>{email}</strong>.</li>
        <li>Follow the link to enroll an authenticator app, then sign in again.</li>
      </ol>
    </div>

    <div style={{ padding: '12px 14px', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
      <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'var(--accent-soft)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Icon name="shieldCheck" size={16}/></div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 12.5, fontWeight: 600 }}>Supplier security administrator</div>
        <div className="mono" style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>supplier-admin@precision-auto.com</div>
      </div>
      <a href="#" className="k-btn k-btn-ghost k-btn-sm"><Icon name="mail" size={13}/> Email admin</a>
    </div>

    <a href="#" className="k-link" style={{ fontSize: 12.5, display: 'inline-flex', alignItems: 'center', gap: 6 }}><Icon name="arrowLeft" size={12}/> Back to sign in</a>
  </div>
);

Object.assign(window, { MFA_TENANTS, QrCode, CodeBoxes, MfaError, MfaNote, AuthShell, TenantCard, MfaChallenge, MfaRequiredBlocked, mfaSeed });
