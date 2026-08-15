// Kaenal Mobile — Auth extras
// SSO/IdP handoff · recovery-code entry · forgot password + reset sent · biometric fail · workspace switcher.

// ── SSO redirect / IdP handoff ──
const AuthSSORedirect = ({ T, platform = 'ios' }) => (
  <MScreen T={T} platform={platform}>
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 32, gap: 22, textAlign: 'center' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <Avatar T={T} initials="NS" size={46} tone="accent"/>
        <div className="k-spin" style={{ color: T.subtle }}><MI name="refresh" size={20}/></div>
        <div style={{ width: 46, height: 46, borderRadius: 12, background: T.bgSubtle, color: T.muted, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><MI name="building" size={22}/></div>
      </div>
      <div>
        <div style={{ fontSize: 19, fontWeight: 700 }}>Redirecting to Okta…</div>
        <div style={{ fontSize: 13.5, color: T.muted, marginTop: 8, lineHeight: 1.5, maxWidth: 260 }}>You'll sign in with your Northstar company account, then return to Kaenal.</div>
      </div>
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '7px 12px', borderRadius: 999, background: T.bgSubtle, color: T.muted, fontSize: 12, fontWeight: 600 }}>
        <MI name="lock" size={13}/> Opens in a secure browser tab
      </div>
    </div>
    <div style={{ padding: `0 24px ${botInset(platform) + 24}px` }}>
      <GhostBtn T={T}>Cancel</GhostBtn>
    </div>
  </MScreen>
);

// ── Recovery-code entry ──
const AuthRecovery = ({ T, platform = 'ios' }) => (
  <MScreen T={T} platform={platform}>
    <div style={{ paddingTop: topInset(platform) + 8, padding: `${topInset(platform) + 8}px 24px 0` }}>
      <button style={{ padding: 4, marginLeft: -6, color: T.text }}><MI name="chevronLeft" size={24} stroke={2}/></button>
    </div>
    <div style={{ flex: 1, padding: '24px 24px' }}>
      <div style={{ width: 52, height: 52, borderRadius: 14, background: T.accentSoft, color: T.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}><MI name="key" size={24}/></div>
      <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.02em' }}>Recovery code</div>
      <div style={{ fontSize: 14, color: T.muted, marginTop: 6, lineHeight: 1.5 }}>Enter one of the one-time codes you saved when you set up two-factor.</div>
      <div style={{ marginTop: 28 }}>
        <div style={{ height: 54, border: `1.5px solid ${T.accent}`, borderRadius: 12, background: T.surface, padding: '0 16px', display: 'flex', alignItems: 'center', boxShadow: `0 0 0 3px ${T.ring}` }}>
          <Mono style={{ fontSize: 19, fontWeight: 600, letterSpacing: '0.12em' }}>3F9K-</Mono>
          <span style={{ width: 1.5, height: 22, background: T.accent, marginLeft: 1 }}/>
        </div>
        <div style={{ fontSize: 12, color: T.muted, marginTop: 8, display: 'flex', alignItems: 'center', gap: 6 }}><MI name="info" size={13}/> Each code works once. 6 of 8 remaining.</div>
      </div>
      <div style={{ textAlign: 'center', marginTop: 24 }}>
        <a href="#" style={{ fontSize: 13.5, color: T.accent, fontWeight: 600 }}>Back to authenticator code</a>
      </div>
    </div>
    <div style={{ padding: `0 24px ${botInset(platform) + 24}px` }}><PrimaryBtn T={T}>Verify recovery code</PrimaryBtn></div>
  </MScreen>
);

// ── Forgot password (request reset) ──
const AuthForgot = ({ T, platform = 'ios' }) => (
  <MScreen T={T} platform={platform}>
    <div style={{ paddingTop: topInset(platform) + 8, padding: `${topInset(platform) + 8}px 24px 0` }}>
      <button style={{ padding: 4, marginLeft: -6, color: T.text }}><MI name="chevronLeft" size={24} stroke={2}/></button>
    </div>
    <div style={{ flex: 1, padding: '24px 24px' }}>
      <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.02em' }}>Reset password</div>
      <div style={{ fontSize: 14, color: T.muted, marginTop: 6, lineHeight: 1.5 }}>We'll email a secure reset link to your work address.</div>
      <SectionLabel T={T} style={{ margin: '26px 0 8px' }}>Email</SectionLabel>
      <div style={{ display: 'flex', alignItems: 'center', height: 50, border: `1.5px solid ${T.accent}`, borderRadius: 12, background: T.surface, padding: '0 14px', boxShadow: `0 0 0 3px ${T.ring}`, fontSize: 15.5 }}>sara.chen@northstar.co</div>
    </div>
    <div style={{ padding: `0 24px ${botInset(platform) + 24}px` }}><PrimaryBtn T={T} icon="send">Send reset link</PrimaryBtn></div>
  </MScreen>
);

// ── Reset link sent (confirmation) ──
const AuthResetSent = ({ T, platform = 'ios' }) => (
  <MScreen T={T} platform={platform}>
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 32, gap: 16, textAlign: 'center' }}>
      <div style={{ width: 80, height: 80, borderRadius: '50%', background: T.accentSoft, color: T.accent, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><MI name="mail" size={38} stroke={1.6}/></div>
      <div style={{ fontSize: 21, fontWeight: 700, letterSpacing: '-0.02em' }}>Check your email</div>
      <div style={{ fontSize: 14, color: T.muted, lineHeight: 1.55, maxWidth: 280 }}>We sent a reset link to <strong style={{ color: T.text }}>sara.chen@northstar.co</strong>. It expires in 30 minutes.</div>
    </div>
    <div style={{ padding: `0 24px ${botInset(platform) + 24}px`, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <PrimaryBtn T={T}>Open mail app</PrimaryBtn>
      <div style={{ textAlign: 'center', fontSize: 13, color: T.muted }}>Didn't get it? <a href="#" style={{ color: T.accent, fontWeight: 600 }}>Resend</a></div>
    </div>
  </MScreen>
);

// ── Biometric fallback (failed / locked) ──
const AuthBiometricFail = ({ T, platform = 'ios' }) => (
  <MScreen T={T} platform={platform}>
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 24, padding: 32 }}>
      <Wordmark T={T} size={22}/>
      <div style={{ width: 96, height: 96, borderRadius: '50%', background: T.dangerBg, color: T.dangerFg, display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 6 }}>
        <MI name="lock" size={42} stroke={1.5}/>
      </div>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 18, fontWeight: 700 }}>Couldn't recognise you</div>
        <div style={{ fontSize: 13.5, color: T.muted, marginTop: 6, maxWidth: 250, lineHeight: 1.5 }}>Face ID failed twice. Enter your password to continue.</div>
      </div>
    </div>
    <div style={{ padding: `0 24px ${botInset(platform) + 24}px`, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <PrimaryBtn T={T}>Enter password</PrimaryBtn>
      <GhostBtn T={T} icon="refresh">Try Face ID again</GhostBtn>
    </div>
  </MScreen>
);

// ── Workspace switcher (multi-tenant) ──
const WorkspaceSwitcher = ({ T, platform = 'ios' }) => (
  <MScreen T={T} platform={platform} style={{ background: T.bg }}>
    <div style={{ flex: 1, position: 'relative' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.35)' }}/>
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, background: T.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: `10px 16px ${botInset(platform) + 16}px`, boxShadow: '0 -12px 40px -8px rgba(0,0,0,0.3)' }}>
        <div style={{ width: 40, height: 5, borderRadius: 999, background: T.borderStrong, margin: '0 auto 14px' }}/>
        <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 2 }}>Switch workspace</div>
        <div style={{ fontSize: 12.5, color: T.muted, marginBottom: 14 }}>You belong to 3 Kaenal workspaces</div>
        {[
          { i: 'NS', n: 'Northstar Mfg', s: 'Inspector · Plant A', on: true },
          { i: 'AC', n: 'Apex Components', s: 'Auditor · 2 plants' },
          { i: 'VT', n: 'Vertex Tooling', s: 'Viewer' },
        ].map((w, i, a) => (
          <div key={w.i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 8px', borderBottom: i < a.length - 1 ? `1px solid ${T.border}` : 'none' }}>
            <Avatar T={T} initials={w.i} size={40} tone={w.on ? 'accent' : 'neutral'}/>
            <div style={{ flex: 1 }}><div style={{ fontSize: 14.5, fontWeight: 600 }}>{w.n}</div><div style={{ fontSize: 11.5, color: T.muted }}>{w.s}</div></div>
            {w.on ? <MI name="check" size={18} color={T.accent} stroke={2.4}/> : <MI name="chevronRight" size={16} color={T.subtle}/>}
          </div>
        ))}
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 14, fontSize: 11.5, color: T.warnFg }}>
          <MI name="alert" size={13}/> 4 items must sync before switching
        </div>
        <GhostBtn T={T} icon="plus" style={{ marginTop: 14 }}>Add another workspace</GhostBtn>
      </div>
    </div>
  </MScreen>
);

Object.assign(window, { AuthSSORedirect, AuthRecovery, AuthForgot, AuthResetSent, AuthBiometricFail, WorkspaceSwitcher });
