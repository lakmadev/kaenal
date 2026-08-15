// Kaenal Mobile — Auth & onboarding
// Welcome → Workspace → Sign in → MFA; invite set-password; permission priming; biometric.

// ── Wordmark ──
const Wordmark = ({ T, size = 22 }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
    <span style={{ color: T.accent }}><Icon name="logo" size={size}/></span>
    <span style={{ fontSize: size * 0.72, fontWeight: 700, letterSpacing: '0.14em' }}>KAENAL</span>
  </div>
);

// ── 1. Welcome ──
const AuthWelcome = ({ T, platform = 'ios' }) => (
  <MScreen T={T} platform={platform}>
    <div style={{ height: topInset(platform) }}/>
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 28px' }}>
      <Wordmark T={T} size={26}/>
      <div style={{ fontSize: 30, fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1.12, marginTop: 28 }}>
        Quality that<br/>moves with you.
      </div>
      <div style={{ fontSize: 15, color: T.muted, marginTop: 14, lineHeight: 1.55, maxWidth: 300 }}>
        Run inspections, flag non-conformities, and stay in sync — on the floor, online or off.
      </div>
    </div>
    <div style={{ padding: `0 24px ${botInset(platform) + 24}px`, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <PrimaryBtn T={T}>Get started</PrimaryBtn>
      <GhostBtn T={T}>I have an invite link</GhostBtn>
      <div style={{ textAlign: 'center', fontSize: 12, color: T.subtle, marginTop: 6 }}>v2.4.0 · Kaenal QMS</div>
    </div>
  </MScreen>
);

// ── 2. Workspace picker (tenant slug + recent chips) ──
const AuthWorkspace = ({ T, platform = 'ios' }) => (
  <MScreen T={T} platform={platform}>
    <div style={{ paddingTop: topInset(platform) + 8, padding: `${topInset(platform) + 8}px 24px 0` }}>
      <button style={{ padding: 4, marginLeft: -6, color: T.text }}><MI name="chevronLeft" size={24} stroke={2}/></button>
    </div>
    <div style={{ flex: 1, padding: '20px 24px' }}>
      <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em' }}>Find your workspace</div>
      <div style={{ fontSize: 14, color: T.muted, marginTop: 6 }}>Enter your team's Kaenal address.</div>

      <div style={{ marginTop: 26 }}>
        <SectionLabel T={T} style={{ marginBottom: 8 }}>Workspace URL</SectionLabel>
        <div style={{ display: 'flex', alignItems: 'center', height: 52, border: `1.5px solid ${T.accent}`, borderRadius: 12, background: T.surface, padding: '0 14px', boxShadow: `0 0 0 3px ${T.ring}` }}>
          <Mono style={{ fontSize: 16, fontWeight: 600 }}>northstar</Mono>
          <Mono style={{ fontSize: 16, color: T.subtle }}>.kaenal.app</Mono>
        </div>
      </div>

      <SectionLabel T={T} style={{ margin: '26px 0 10px' }}>Recent workspaces</SectionLabel>
      <Card T={T}>
        {[
          { n: 'Northstar Mfg', s: 'northstar.kaenal.app', i: 'NS', on: true },
          { n: 'Detroit Plant A', s: 'detroit-a.kaenal.app', i: 'DA' },
        ].map((w, i, a) => (
          <div key={w.n} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 14px', borderBottom: i < a.length - 1 ? `1px solid ${T.border}` : 'none' }}>
            <Avatar T={T} initials={w.i} tone={w.on ? 'accent' : 'neutral'}/>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14.5, fontWeight: 600 }}>{w.n}</div>
              <Mono style={{ fontSize: 11.5, color: T.muted }}>{w.s}</Mono>
            </div>
            <MI name="chevronRight" size={16} color={T.subtle}/>
          </div>
        ))}
      </Card>
    </div>
    <div style={{ padding: `0 24px ${botInset(platform) + 24}px` }}>
      <PrimaryBtn T={T} icon="arrowRight">Continue</PrimaryBtn>
    </div>
  </MScreen>
);

// ── 3. Sign in ──
const AuthSignIn = ({ T, platform = 'ios' }) => {
  const field = (label, val, ph, opts = {}) => (
    <div style={{ marginBottom: 16 }}>
      <SectionLabel T={T} style={{ marginBottom: 8 }}>{label}</SectionLabel>
      <div style={{ display: 'flex', alignItems: 'center', height: 50, border: `1px solid ${T.border}`, borderRadius: 12, background: T.surface, padding: '0 14px' }}>
        <span style={{ flex: 1, fontSize: 15.5, color: val ? T.text : T.subtle }}>{val || ph}</span>
        {opts.eye && <MI name="eyeOff" size={18} color={T.muted}/>}
      </div>
    </div>
  );
  return (
    <MScreen T={T} platform={platform}>
      <div style={{ paddingTop: topInset(platform) + 8, padding: `${topInset(platform) + 8}px 24px 0` }}>
        <button style={{ padding: 4, marginLeft: -6, color: T.text }}><MI name="chevronLeft" size={24} stroke={2}/></button>
      </div>
      <div style={{ flex: 1, padding: '18px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 22 }}>
          <Avatar T={T} initials="NS" tone="accent"/>
          <div>
            <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em' }}>Sign in</div>
            <Mono style={{ fontSize: 12, color: T.muted }}>northstar.kaenal.app</Mono>
          </div>
        </div>
        {field('Email', 'sara.chen@northstar.co', 'you@company.com')}
        {field('Password', '••••••••••', 'Password', { eye: true })}
        <div style={{ textAlign: 'right', marginTop: -4 }}>
          <a href="#" style={{ fontSize: 13, color: T.accent, fontWeight: 600 }}>Forgot password?</a>
        </div>
      </div>
      <div style={{ padding: `0 24px ${botInset(platform) + 24}px`, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <PrimaryBtn T={T}>Sign in</PrimaryBtn>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '2px 0' }}>
          <div style={{ flex: 1, height: 1, background: T.border }}/>
          <span style={{ fontSize: 11.5, color: T.subtle, fontWeight: 600 }}>OR</span>
          <div style={{ flex: 1, height: 1, background: T.border }}/>
        </div>
        <GhostBtn T={T} icon="building">Continue with Northstar SSO</GhostBtn>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: 12.5, color: T.subtle, marginTop: 2 }}>
          <MI name="lock" size={13}/> SAML / Okta · enforced for this workspace
        </div>
      </div>
    </MScreen>
  );
};

// ── 4. MFA challenge (6-digit boxes + recovery-code link) · states: idle|busy|error|success ──
const AuthMFA = ({ T, platform = 'ios', state = 'idle' }) => {
  const digits = state === 'idle' ? ['4', '1', '9', '', '', ''] : ['4', '1', '9', '2', '0', '7'];
  const boxColor = state === 'error' ? T.danger : state === 'success' ? T.success : T.accent;
  return (
    <MScreen T={T} platform={platform}>
      <div style={{ paddingTop: topInset(platform) + 8, padding: `${topInset(platform) + 8}px 24px 0` }}>
        <button style={{ padding: 4, marginLeft: -6, color: T.text }}><MI name="chevronLeft" size={24} stroke={2}/></button>
      </div>
      <div style={{ flex: 1, padding: '24px 24px', display: 'flex', flexDirection: 'column' }}>
        <div style={{ width: 52, height: 52, borderRadius: 14, background: state === 'success' ? T.successBg : state === 'error' ? T.dangerBg : T.accentSoft, color: state === 'success' ? T.success : state === 'error' ? T.dangerFg : T.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
          <MI name={state === 'success' ? 'check' : state === 'error' ? 'alert' : 'shieldCheck'} size={26} stroke={state === 'success' ? 2.6 : 2}/>
        </div>
        <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.02em' }}>{state === 'success' ? 'Verified' : 'Two-factor'}</div>
        <div style={{ fontSize: 14, color: T.muted, marginTop: 6, lineHeight: 1.5 }}>
          {state === 'success' ? 'Signing you in…' : state === 'error' ? 'That code did not match. 2 attempts left.' : 'Enter the 6-digit code from your authenticator app.'}
        </div>

        <div style={{ display: 'flex', gap: 9, marginTop: 30 }}>
          {digits.map((d, i) => (
            <div key={i} style={{
              flex: 1, height: 58, borderRadius: 12, background: T.surface,
              border: `1.5px solid ${(state === 'idle' && i === 3) ? T.accent : (state === 'error' || state === 'success') ? boxColor : T.border}`,
              boxShadow: (state === 'idle' && i === 3) ? `0 0 0 3px ${T.ring}` : 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}><Mono style={{ fontSize: 26, fontWeight: 600, color: state === 'error' ? T.dangerFg : state === 'success' ? T.successFg : T.text }}>{d}</Mono></div>
          ))}
        </div>
        {state !== 'success' && (
          <div style={{ textAlign: 'center', marginTop: 24 }}>
            <a href="#" style={{ fontSize: 13.5, color: T.accent, fontWeight: 600 }}>Use a recovery code instead</a>
          </div>
        )}
      </div>
      <div style={{ padding: `0 24px ${botInset(platform) + 24}px` }}>
        {state === 'busy'
          ? <PrimaryBtn T={T} style={{ opacity: 0.85 }}><span className="k-spin"><MI name="refresh" size={18} color={T.accentFg}/></span> Verifying…</PrimaryBtn>
          : state === 'success'
          ? <PrimaryBtn T={T} style={{ background: T.success, color: '#fff' }} icon="check">Verified</PrimaryBtn>
          : <PrimaryBtn T={T}>Verify</PrimaryBtn>}
      </div>
    </MScreen>
  );
};

// ── 5. Set password (invite) — with strength meter ──
const AuthSetPassword = ({ T, platform = 'ios' }) => {
  const reqs = [
    { l: 'At least 12 characters', ok: true },
    { l: 'Upper & lowercase letters', ok: true },
    { l: 'A number or symbol', ok: true },
    { l: 'Not a common password', ok: false },
  ];
  return (
    <MScreen T={T} platform={platform}>
      <div style={{ paddingTop: topInset(platform) + 12, padding: `${topInset(platform) + 12}px 24px 0` }}>
        <Wordmark T={T} size={20}/>
      </div>
      <Body style={{ padding: '20px 24px' }}>
        <StatusPill T={T} tone="accent">Invited by Lin Wei</StatusPill>
        <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.02em', marginTop: 12 }}>Set up your account</div>
        <div style={{ fontSize: 14, color: T.muted, marginTop: 6 }}>You're joining <strong style={{ color: T.text }}>Northstar Mfg</strong> as an Inspector.</div>

        <SectionLabel T={T} style={{ margin: '24px 0 8px' }}>Full name</SectionLabel>
        <div style={{ display: 'flex', alignItems: 'center', height: 50, border: `1px solid ${T.border}`, borderRadius: 12, background: T.surface, padding: '0 14px', fontSize: 15.5 }}>Marcus Reyes</div>

        <SectionLabel T={T} style={{ margin: '18px 0 8px' }}>Create password</SectionLabel>
        <div style={{ display: 'flex', alignItems: 'center', height: 50, border: `1px solid ${T.border}`, borderRadius: 12, background: T.surface, padding: '0 14px' }}>
          <span style={{ flex: 1, fontSize: 15.5 }}>••••••••••••••</span>
          <MI name="eye" size={18} color={T.muted}/>
        </div>
        <div style={{ display: 'flex', gap: 5, marginTop: 10 }}>
          {[T.success, T.success, T.success, T.border].map((c, i) => (
            <div key={i} style={{ flex: 1, height: 4, borderRadius: 2, background: c }}/>
          ))}
        </div>
        <div style={{ fontSize: 12, color: T.successFg, fontWeight: 600, marginTop: 6 }}>Strong</div>
        <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {reqs.map(r => (
            <div key={r.l} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: r.ok ? T.text : T.muted }}>
              <span style={{ width: 18, height: 18, borderRadius: '50%', background: r.ok ? T.success : 'transparent', border: r.ok ? 'none' : `1.5px solid ${T.borderStrong}`, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {r.ok && <MI name="check" size={11} stroke={3}/>}
              </span>{r.l}
            </div>
          ))}
        </div>
      </Body>
      <div style={{ padding: `0 24px ${botInset(platform) + 24}px` }}>
        <PrimaryBtn T={T}>Create account</PrimaryBtn>
      </div>
    </MScreen>
  );
};

// ── 6. Permission priming (before OS prompt) ──
const AuthPriming = ({ T, platform = 'ios' }) => {
  const perms = [
    { i: 'camera', t: 'Camera', d: 'Photograph defects and scan asset QR codes while you inspect.' },
    { i: 'mapPin', t: 'Location', d: 'Auto-stamp the plant, line and station on every capture.' },
    { i: 'bell', t: 'Notifications', d: 'Get pinged when work is assigned or a sync fails.' },
  ];
  return (
    <MScreen T={T} platform={platform}>
      <div style={{ height: topInset(platform) + 24 }}/>
      <div style={{ flex: 1, padding: '0 24px' }}>
        <div style={{ fontSize: 25, fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.15 }}>A few permissions to work hands-free</div>
        <div style={{ fontSize: 14, color: T.muted, marginTop: 8 }}>Here's why Kaenal asks. You'll confirm each on the next screen.</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 26 }}>
          {perms.map(p => (
            <Card T={T} key={p.t} style={{ padding: 16, display: 'flex', gap: 14, alignItems: 'flex-start' }}>
              <div style={{ width: 42, height: 42, borderRadius: 11, background: T.accentSoft, color: T.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <MI name={p.i} size={20}/>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 700 }}>{p.t}</div>
                <div style={{ fontSize: 12.5, color: T.muted, marginTop: 3, lineHeight: 1.5 }}>{p.d}</div>
              </div>
            </Card>
          ))}
        </div>
      </div>
      <div style={{ padding: `18px 24px ${botInset(platform) + 24}px`, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <PrimaryBtn T={T}>Continue</PrimaryBtn>
        <div style={{ textAlign: 'center', fontSize: 13, color: T.muted, fontWeight: 500 }}>You can change these anytime in Settings.</div>
      </div>
    </MScreen>
  );
};

// ── 7. Biometric unlock (later launches) ──
const AuthBiometric = ({ T, platform = 'ios' }) => (
  <MScreen T={T} platform={platform}>
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 26, padding: 32 }}>
      <Wordmark T={T} size={22}/>
      <div style={{ position: 'relative', marginTop: 10 }}>
        <div style={{ position: 'absolute', inset: -14, borderRadius: '50%', border: `2px solid ${T.accent}`, opacity: 0.18 }}/>
        <div style={{ width: 96, height: 96, borderRadius: '50%', background: T.accentSoft, color: T.accent, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <MI name={platform === 'ios' ? 'user' : 'unlock'} size={46} stroke={1.4}/>
        </div>
      </div>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 19, fontWeight: 700 }}>{platform === 'ios' ? 'Unlock with Face ID' : 'Unlock with fingerprint'}</div>
        <div style={{ fontSize: 13.5, color: T.muted, marginTop: 6 }}>Welcome back, Sara</div>
      </div>
    </div>
    <div style={{ padding: `0 24px ${botInset(platform) + 24}px`, display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center' }}>
      <a href="#" style={{ fontSize: 14, color: T.accent, fontWeight: 600 }}>Use password instead</a>
    </div>
  </MScreen>
);

Object.assign(window, {
  Wordmark, AuthWelcome, AuthWorkspace, AuthSignIn, AuthMFA, AuthSetPassword, AuthPriming, AuthBiometric,
});
