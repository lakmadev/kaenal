// Kaenal — Auth extra screens: forgot, reset, invite, locked

function AuthForgot({ tenant, setStage }) {
  const [email, setEmail] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [sent, setSent] = React.useState(false);

  const submit = async (e) => {
    e?.preventDefault();
    if (!email.includes('@')) return;
    setBusy(true);
    await new Promise(r => setTimeout(r, 800));
    setBusy(false);
    setSent(true);
  };

  if (sent) {
    return (
      <>
        <button onClick={() => setStage('login')} className="k-btn k-btn-plain k-btn-sm" style={{ alignSelf: 'flex-start', marginBottom: 14, padding: '4px 8px' }}>
          <Icon name="arrowLeft" size={12}/> Back to sign in
        </button>
        <div style={{ display: 'inline-flex', padding: 14, borderRadius: '50%', background: 'var(--success-50)', color: 'var(--success-600)', alignSelf: 'flex-start', marginBottom: 20 }}>
          <Icon name="mail" size={28}/>
        </div>
        <h1 style={{ fontSize: 28, fontWeight: 700, margin: '0 0 8px', letterSpacing: '-0.01em' }}>Check your inbox</h1>
        <div style={{ color: 'var(--text-muted)', marginBottom: 24, fontSize: 14, lineHeight: 1.6 }}>
          If <strong style={{ color: 'var(--text)' }}>{email}</strong> matches an account, a password reset link is on its way.
          The link expires in <strong style={{ color: 'var(--text)' }}>30 minutes</strong>.
        </div>

        <div className="k-surface" style={{ padding: 14, background: 'var(--bg-subtle)' }}>
          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Didn't get it?</div>
          <ul style={{ fontSize: 12, color: 'var(--text-muted)', paddingLeft: 18, margin: 0, lineHeight: 1.7 }}>
            <li>Check your spam folder</li>
            <li>Make sure <strong style={{ color: 'var(--text)' }}>{email}</strong> is the email you use for {tenant.name}</li>
            <li>Try in a few minutes — emails sometimes take longer at scale</li>
          </ul>
          <button onClick={() => setSent(false)} className="k-btn k-btn-secondary k-btn-sm" style={{ marginTop: 12 }}>
            <Icon name="refresh" size={12}/> Resend reset link
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      <button onClick={() => setStage('login')} className="k-btn k-btn-plain k-btn-sm" style={{ alignSelf: 'flex-start', marginBottom: 14, padding: '4px 8px' }}>
        <Icon name="arrowLeft" size={12}/> Back to sign in
      </button>

      <div style={{ display: 'inline-flex', padding: 14, borderRadius: 'var(--r-md)', background: 'var(--accent-soft)', color: 'var(--accent)', alignSelf: 'flex-start', marginBottom: 18 }}>
        <Icon name="key" size={26}/>
      </div>

      <h1 style={{ fontSize: 28, fontWeight: 700, margin: '0 0 8px', letterSpacing: '-0.01em' }}>Forgot your password?</h1>
      <div style={{ color: 'var(--text-muted)', marginBottom: 22, fontSize: 13.5, lineHeight: 1.6 }}>
        Enter the email tied to your <strong style={{ color: 'var(--text)' }}>{tenant.name}</strong> workspace and we'll send a secure reset link.
      </div>

      <form onSubmit={submit}>
        <label className="k-overline" style={{ display: 'block', marginBottom: 6 }}>Work email</label>
        <input className="k-input" autoFocus value={email} onChange={e => setEmail(e.target.value)}
          placeholder="you@company.com" style={{ height: 42 }}/>

        <button type="submit" disabled={busy || !email.includes('@')} className="k-btn k-btn-primary" style={{ width: '100%', height: 44, marginTop: 18, fontSize: 14, justifyContent: 'center' }}>
          {busy ? 'Sending…' : 'Send reset link'}
        </button>
      </form>

      <div style={{ marginTop: 28, padding: 14, background: 'var(--bg-subtle)', borderRadius: 'var(--r-md)', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <Icon name="info" size={16}/>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.55 }}>
          Signed in with <strong style={{ color: 'var(--text)' }}>{tenant.sso}</strong>?
          Password reset doesn't apply — sign in with SSO from the previous screen instead.
        </div>
      </div>
    </>
  );
}

function AuthReset({ tenant, setStage }) {
  const [pw, setPw] = React.useState('');
  const [pw2, setPw2] = React.useState('');
  const [showPw, setShowPw] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  // Password strength: 0-4
  const strength = (() => {
    if (!pw) return 0;
    let s = 0;
    if (pw.length >= 8) s++;
    if (pw.length >= 12) s++;
    if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s++;
    if (/[0-9]/.test(pw)) s++;
    if (/[^A-Za-z0-9]/.test(pw)) s++;
    return Math.min(s, 4);
  })();
  const strengthLabel = ['Too weak', 'Weak', 'Okay', 'Strong', 'Excellent'][strength];
  const strengthColor = ['#dc2626', '#ea580c', '#f59e0b', '#16a34a', '#15803d'][strength];

  const checks = [
    { l: 'At least 12 characters', ok: pw.length >= 12 },
    { l: 'Upper- and lower-case letters', ok: /[A-Z]/.test(pw) && /[a-z]/.test(pw) },
    { l: 'A number', ok: /[0-9]/.test(pw) },
    { l: 'A symbol', ok: /[^A-Za-z0-9]/.test(pw) },
    { l: 'Matches confirmation', ok: pw && pw === pw2 },
  ];
  const allOk = checks.every(c => c.ok);

  const submit = async (e) => {
    e?.preventDefault();
    if (!allOk) return;
    setBusy(true);
    await new Promise(r => setTimeout(r, 800));
    setBusy(false);
    setStage('reset-success');
  };

  return (
    <>
      <div style={{ display: 'inline-flex', padding: 14, borderRadius: 'var(--r-md)', background: 'var(--accent-soft)', color: 'var(--accent)', alignSelf: 'flex-start', marginBottom: 18 }}>
        <Icon name="key" size={26}/>
      </div>

      <h1 style={{ fontSize: 28, fontWeight: 700, margin: '0 0 8px', letterSpacing: '-0.01em' }}>Set a new password</h1>
      <div style={{ color: 'var(--text-muted)', marginBottom: 22, fontSize: 13.5, lineHeight: 1.6 }}>
        Setting password for <strong style={{ color: 'var(--text)' }}>priya.iyer@precision-auto.com</strong>.
        Choose something memorable and unique to Kaenal.
      </div>

      <div style={{ padding: '8px 12px', borderRadius: 'var(--r-md)', background: 'var(--bg-subtle)', fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18, fontFamily: 'var(--font-mono)' }}>
        <Icon name="lock" size={12}/>
        Reset token: <span style={{ color: 'var(--text)' }}>...4f8a-3b21</span> · Expires in 14:32
      </div>

      <form onSubmit={submit}>
        <label className="k-overline" style={{ display: 'block', marginBottom: 6 }}>New password</label>
        <div style={{ position: 'relative' }}>
          <input className="k-input" type={showPw ? 'text' : 'password'} value={pw} onChange={e => setPw(e.target.value)}
            placeholder="••••••••" autoFocus style={{ height: 42, paddingRight: 42 }}/>
          <button type="button" onClick={() => setShowPw(s => !s)} style={{ position: 'absolute', right: 6, top: 6, width: 30, height: 30, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name={showPw ? 'eyeOff' : 'eye'} size={14}/>
          </button>
        </div>

        {/* Strength meter */}
        <div style={{ marginTop: 8 }}>
          <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
            {[1, 2, 3, 4].map(i => (
              <div key={i} style={{ flex: 1, height: 4, borderRadius: 2, background: i <= strength ? strengthColor : 'var(--border)', transition: 'background 200ms' }}/>
            ))}
          </div>
          <div style={{ fontSize: 11.5, color: pw ? strengthColor : 'var(--text-muted)', fontWeight: 600 }}>{pw ? strengthLabel : 'Enter a password'}</div>
        </div>

        <label className="k-overline" style={{ display: 'block', marginBottom: 6, marginTop: 16 }}>Confirm new password</label>
        <input className="k-input" type={showPw ? 'text' : 'password'} value={pw2} onChange={e => setPw2(e.target.value)}
          placeholder="••••••••" style={{ height: 42 }}/>

        <div className="k-surface" style={{ padding: 12, background: 'var(--bg-subtle)', marginTop: 16 }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Requirements</div>
          {checks.map((c, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, padding: '2px 0', color: c.ok ? 'var(--success-600)' : 'var(--text-muted)' }}>
              <Icon name={c.ok ? 'check' : 'circle'} size={13} stroke={c.ok ? 2.5 : 1.5}/>
              <span>{c.l}</span>
            </div>
          ))}
        </div>

        <button type="submit" disabled={busy || !allOk} className="k-btn k-btn-primary"
          style={{ width: '100%', height: 44, marginTop: 18, fontSize: 14, justifyContent: 'center', opacity: allOk && !busy ? 1 : 0.6 }}>
          {busy ? 'Updating…' : 'Set new password'}
        </button>
      </form>
    </>
  );
}

function AuthResetSuccess({ setStage }) {
  return (
    <>
      <div style={{ display: 'inline-flex', padding: 18, borderRadius: '50%', background: 'var(--success-50)', color: 'var(--success-600)', alignSelf: 'flex-start', marginBottom: 22 }}>
        <Icon name="check" size={36} stroke={2.25}/>
      </div>

      <h1 style={{ fontSize: 30, fontWeight: 700, margin: '0 0 8px', letterSpacing: '-0.02em' }}>Password updated</h1>
      <div style={{ color: 'var(--text-muted)', marginBottom: 24, fontSize: 14, lineHeight: 1.6 }}>
        Your password has been changed. For security, you've been signed out of all other devices.
      </div>

      <div className="k-surface" style={{ padding: 14, background: 'var(--bg-subtle)', marginBottom: 18 }}>
        <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
          <Icon name="shieldCheck" size={14}/> Security actions taken
        </div>
        <ul style={{ fontSize: 12, color: 'var(--text-muted)', paddingLeft: 18, margin: 0, lineHeight: 1.7 }}>
          <li>Reset token invalidated</li>
          <li>3 other active sessions terminated</li>
          <li>Notification sent to your email & Quality Manager</li>
        </ul>
      </div>

      <button onClick={() => setStage('login')} className="k-btn k-btn-primary" style={{ width: '100%', height: 44, fontSize: 14, justifyContent: 'center' }}>
        Sign in with new password
      </button>
    </>
  );
}

function AuthInvite({ tenant, setStage, onSignIn }) {
  const [name, setName] = React.useState('');
  const [pw, setPw] = React.useState('');
  const [showPw, setShowPw] = React.useState(false);
  const [accept, setAccept] = React.useState(true);
  const [busy, setBusy] = React.useState(false);

  const submit = async (e) => {
    e?.preventDefault();
    if (!name.trim() || pw.length < 8 || !accept) return;
    setBusy(true);
    await new Promise(r => setTimeout(r, 900));
    setBusy(false);
    onSignIn();
  };

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 14, border: '1px solid var(--border)', borderRadius: 'var(--r-md)', background: 'var(--surface)', marginBottom: 22 }}>
        <div style={{ width: 40, height: 40, borderRadius: 'var(--r-sm)', background: tenant.color, color: 'white', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>{tenant.logo}</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13.5, fontWeight: 600 }}>{tenant.name}</div>
          <div className="mono" style={{ fontSize: 11, color: 'var(--text-muted)' }}>{tenant.users} members · {tenant.plan}</div>
        </div>
        <span className="k-chip" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>
          <Icon name="mail" size={11}/> Invited
        </span>
      </div>

      <h1 style={{ fontSize: 28, fontWeight: 700, margin: '0 0 6px', letterSpacing: '-0.01em' }}>You've been invited</h1>
      <div style={{ color: 'var(--text-muted)', marginBottom: 22, fontSize: 13.5, lineHeight: 1.6 }}>
        <strong style={{ color: 'var(--text)' }}>Manjunath Kumar</strong> invited you to join the
        <strong style={{ color: 'var(--text)' }}> Quality Engineering</strong> team as a <strong style={{ color: 'var(--text)' }}>Quality Engineer</strong>.
      </div>

      <div style={{ padding: '12px 14px', background: 'var(--bg-subtle)', borderRadius: 'var(--r-md)', display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 18 }}>
        {[
          { i: 'mail', l: 'Email', v: 'sarah.ahmed@precision-auto.com' },
          { i: 'shield', l: 'Role', v: 'Quality Engineer' },
          { i: 'users', l: 'Team', v: 'Quality · Pune-1' },
          { i: 'clock', l: 'Invite expires', v: 'in 6 days', warn: false },
        ].map(r => (
          <div key={r.l} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12 }}>
            <Icon name={r.i} size={13}/>
            <span style={{ color: 'var(--text-muted)', width: 80 }}>{r.l}</span>
            <span style={{ fontWeight: 500 }}>{r.v}</span>
          </div>
        ))}
      </div>

      <form onSubmit={submit}>
        <label className="k-overline" style={{ display: 'block', marginBottom: 6 }}>Full name</label>
        <input className="k-input" autoFocus value={name} onChange={e => setName(e.target.value)}
          placeholder="Sarah Ahmed" style={{ height: 42, marginBottom: 14 }}/>

        <label className="k-overline" style={{ display: 'block', marginBottom: 6 }}>Create a password</label>
        <div style={{ position: 'relative', marginBottom: 14 }}>
          <input className="k-input" type={showPw ? 'text' : 'password'} value={pw} onChange={e => setPw(e.target.value)}
            placeholder="At least 8 characters" style={{ height: 42, paddingRight: 42 }}/>
          <button type="button" onClick={() => setShowPw(s => !s)} style={{ position: 'absolute', right: 6, top: 6, width: 30, height: 30, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name={showPw ? 'eyeOff' : 'eye'} size={14}/>
          </button>
        </div>

        <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12, color: 'var(--text-muted)', cursor: 'pointer', lineHeight: 1.55 }}>
          <input type="checkbox" checked={accept} onChange={e => setAccept(e.target.checked)} style={{ accentColor: 'var(--accent)', marginTop: 2 }}/>
          <span>
            I agree to the <a href="#" className="k-link">Terms of Service</a>,
            <a href="#" className="k-link"> Privacy Policy</a>, and Precision Auto's
            <a href="#" className="k-link"> Acceptable Use</a> policy.
          </span>
        </label>

        <button type="submit" disabled={busy || !name.trim() || pw.length < 8 || !accept}
          className="k-btn k-btn-primary"
          style={{ width: '100%', height: 44, marginTop: 18, fontSize: 14, justifyContent: 'center',
            opacity: (!name.trim() || pw.length < 8 || !accept) ? 0.6 : 1 }}>
          {busy ? 'Creating account…' : 'Accept invite & join'}
        </button>

        <button type="button" className="k-btn k-btn-ghost" style={{ width: '100%', height: 40, marginTop: 8, fontSize: 13, justifyContent: 'center', color: 'var(--text-muted)' }}>
          Decline invitation
        </button>
      </form>
    </>
  );
}

function AuthLocked({ tenant, setStage }) {
  const [unlockTime] = React.useState(15);
  return (
    <>
      <div style={{ display: 'inline-flex', padding: 14, borderRadius: '50%', background: 'rgba(220,38,38,0.10)', color: '#dc2626', alignSelf: 'flex-start', marginBottom: 22 }}>
        <Icon name="shield" size={28}/>
      </div>

      <h1 style={{ fontSize: 28, fontWeight: 700, margin: '0 0 8px', letterSpacing: '-0.01em' }}>Account temporarily locked</h1>
      <div style={{ color: 'var(--text-muted)', marginBottom: 22, fontSize: 13.5, lineHeight: 1.6 }}>
        Too many failed sign-in attempts on <strong style={{ color: 'var(--text)' }}>priya.iyer@precision-auto.com</strong>.
        For your protection, this account is locked.
      </div>

      <div style={{ padding: 18, background: 'linear-gradient(135deg, rgba(220,38,38,0.04), rgba(220,38,38,0.10))', border: '1px solid rgba(220,38,38,0.20)', borderRadius: 'var(--r-md)', marginBottom: 18 }}>
        <div style={{ fontSize: 11, color: '#991b1b', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700, marginBottom: 8 }}>
          Failed attempts in last 15 min
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 14 }}>
          <div style={{ fontSize: 36, fontWeight: 700, color: '#991b1b' }}>5</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>/ 5 allowed</div>
        </div>
        <div style={{ display: 'flex', gap: 3, marginBottom: 14 }}>
          {[1,2,3,4,5].map(i => (
            <div key={i} style={{ flex: 1, height: 6, borderRadius: 3, background: '#dc2626' }}/>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5 }}>
          <Icon name="clock" size={14}/>
          <span style={{ color: 'var(--text)' }}>Automatic unlock in <strong>{unlockTime}:00 minutes</strong></span>
        </div>
      </div>

      <div className="k-surface" style={{ padding: 14, background: 'var(--bg-subtle)' }}>
        <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
          <Icon name="alert" size={14}/> Recent activity from this account
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {[
            { t: '2 min ago', ip: '203.0.113.42', loc: 'Unknown (VPN)', fail: true },
            { t: '3 min ago', ip: '203.0.113.42', loc: 'Unknown (VPN)', fail: true },
            { t: '4 min ago', ip: '203.0.113.42', loc: 'Unknown (VPN)', fail: true },
            { t: '12 min ago', ip: '192.168.4.18', loc: 'Pune, IN', fail: false },
          ].map((r, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11.5, padding: '4px 6px', borderRadius: 4 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: r.fail ? '#dc2626' : '#22c55e' }}/>
              <span className="mono" style={{ color: 'var(--text-muted)', width: 80 }}>{r.ip}</span>
              <span style={{ flex: 1, color: 'var(--text)' }}>{r.loc}</span>
              <span style={{ color: 'var(--text-muted)' }}>{r.t}</span>
            </div>
          ))}
        </div>
      </div>

      <button onClick={() => setStage('forgot')} className="k-btn k-btn-primary" style={{ width: '100%', height: 44, marginTop: 20, fontSize: 14, justifyContent: 'center' }}>
        Reset my password to unlock
      </button>
      <button onClick={() => setStage('login')} className="k-btn k-btn-ghost" style={{ width: '100%', height: 40, marginTop: 8, fontSize: 13, justifyContent: 'center', color: 'var(--text-muted)' }}>
        <Icon name="arrowLeft" size={12}/> Back to sign in
      </button>

      <div style={{ marginTop: 22, padding: 14, background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.20)', borderRadius: 'var(--r-md)', display: 'flex', gap: 10 }}>
        <Icon name="alert" size={16} stroke={2}/>
        <div style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.55 }}>
          <strong>Wasn't you?</strong> Someone may be trying to access your account. {' '}
          <a href="#" className="k-link">Contact your workspace admin</a>.
        </div>
      </div>
    </>
  );
}

Object.assign(window, { AuthForgot, AuthReset, AuthResetSuccess, AuthInvite, AuthLocked });
