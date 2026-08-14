// Kaenal — MFA: Settings › Security › Two-Factor Authentication
// Lives in the settings shell (uses SettingsPage / Card / Row from settings.jsx).
// Not-enrolled → enrollment flow (QR → confirm → recovery codes) → active/manage.

// ---- Demo secrets (presentational only; real values come from the API) ----
const MFA_SETUP_KEY = 'JBSWY3DPEHPK3PXP KAEN AL42 QMS7';
const MFA_OTPAUTH = 'otpauth://totp/Kaenal:priya.iyer@precision-auto.com?secret=JBSWY3DPEHPK3PXPKAENAL42QMS7&issuer=Kaenal';
function genRecoveryCodes(seed = 'kaenal-recovery-2026') {
  const rnd = mfaSeed(seed); const abc = 'abcdefghijkmnpqrstuvwxyz23456789';
  const chunk = () => Array.from({ length: 4 }, () => abc[Math.floor(rnd() * abc.length)]).join('');
  return Array.from({ length: 10 }, () => `${chunk()}-${chunk()}-${chunk()}`);
}

// ---- Recovery-codes grid + copy / download / print ----
const RecoveryCodesGrid = ({ codes, used = [] }) => (
  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, padding: 16, background: 'var(--bg-subtle)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)' }}>
    {codes.map((c, i) => {
      const isUsed = used.includes(i);
      return (
        <div key={i} className="mono" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', fontSize: 13.5, letterSpacing: '0.04em', color: isUsed ? 'var(--text-subtle)' : 'var(--text)', textDecoration: isUsed ? 'line-through' : 'none' }}>
          <span style={{ fontSize: 11, color: 'var(--text-subtle)', width: 16 }}>{String(i + 1).padStart(2, '0')}</span>
          {c}
        </div>
      );
    })}
  </div>
);
const RecoveryActions = ({ codes }) => {
  const [copied, setCopied] = React.useState(false);
  const body = codes.join('\n');
  const copy = () => { navigator.clipboard?.writeText(body).catch(() => {}); setCopied(true); setTimeout(() => setCopied(false), 1800); if (window.kToast) kToast('Recovery codes copied to clipboard'); };
  const download = () => { try { const b = new Blob([`Kaenal — Two-factor recovery codes\nprecision-auto.kaenal.app · Generated ${new Date().toISOString().slice(0, 10)}\nEach code can be used once.\n\n${body}\n`], { type: 'text/plain' }); const u = URL.createObjectURL(b); const a = document.createElement('a'); a.href = u; a.download = 'kaenal-recovery-codes.txt'; a.click(); URL.revokeObjectURL(u); } catch (e) {} if (window.kToast) kToast('Downloaded kaenal-recovery-codes.txt'); };
  const print = () => { if (window.kToast) kToast('Opening print dialog…'); setTimeout(() => { try { window.print(); } catch (e) {} }, 120); };
  return (
    <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
      <button type="button" onClick={copy} className="k-btn k-btn-ghost" style={{ flex: 1, justifyContent: 'center' }}><Icon name={copied ? 'check' : 'copy'} size={13}/>{copied ? 'Copied' : 'Copy'}</button>
      <button type="button" onClick={download} className="k-btn k-btn-ghost" style={{ flex: 1, justifyContent: 'center' }}><Icon name="download" size={13}/>Download</button>
      <button type="button" onClick={print} className="k-btn k-btn-ghost" style={{ flex: 1, justifyContent: 'center' }}><Icon name="doc" size={13}/>Print</button>
    </div>
  );
};

// ============================================================
// ENROLLMENT FLOW — stepped modal (QR → confirm → recovery)
// ============================================================
const MfaEnrollModal = ({ onClose, onDone, startStep = 1, startState }) => {
  const [step, setStep] = React.useState(startStep);
  const [showKey, setShowKey] = React.useState(false);
  const [code, setCode] = React.useState(startState === 'confirm-error' ? '771043' : '');
  const [state, setState] = React.useState(startState || 'idle'); // idle | busy | confirm-error
  const [saved, setSaved] = React.useState(false);
  const codes = React.useMemo(() => genRecoveryCodes(), []);

  const confirm = () => {
    if (code.replace(/\s/g, '').length !== 6 || state === 'busy') return;
    setState('busy');
    setTimeout(() => { setState('idle'); setStep(3); }, 1300);
  };

  const steps = [{ n: 1, l: 'Scan' }, { n: 2, l: 'Confirm' }, { n: 3, l: 'Save codes' }];

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(15,23,42,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, backdropFilter: 'blur(2px)', animation: 'fadeIn 140ms ease-out' }}>
      <div onClick={e => e.stopPropagation()} className="k-surface fade-in" style={{ width: 540, maxWidth: '100%', maxHeight: '92vh', overflowY: 'auto', boxShadow: 'var(--shadow-xl)' }}>
        {/* Header + stepper */}
        <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 'var(--r-md)', background: 'var(--accent-soft)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="shieldCheck" size={17}/></div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 15, fontWeight: 700 }}>Set up two-factor authentication</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Step {step} of 3</div>
            </div>
            <button onClick={onClose} className="k-btn-icon k-btn-plain"><Icon name="x" size={16}/></button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 16 }}>
            {steps.map((s, i) => (
              <React.Fragment key={s.n}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <div style={{ width: 22, height: 22, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, background: step > s.n ? 'var(--success-500)' : step === s.n ? 'var(--accent)' : 'var(--bg-subtle)', color: step >= s.n ? '#fff' : 'var(--text-subtle)', border: step >= s.n ? 'none' : '1px solid var(--border)' }}>
                    {step > s.n ? <Icon name="check" size={12} stroke={3}/> : s.n}
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 500, color: step >= s.n ? 'var(--text)' : 'var(--text-subtle)' }}>{s.l}</span>
                </div>
                {i < steps.length - 1 && <div style={{ flex: 1, height: 1.5, background: step > s.n ? 'var(--success-500)' : 'var(--border)', borderRadius: 2 }}/>}
              </React.Fragment>
            ))}
          </div>
        </div>

        <div style={{ padding: 22 }}>
          {/* STEP 1 — QR + manual key */}
          {step === 1 && (
            <div className="fade-in" key="s1">
              <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: 18 }}>
                Open your authenticator app — <strong style={{ color: 'var(--text)' }}>Google Authenticator, 1Password, Microsoft Authenticator, or Authy</strong> — and scan this QR code.
              </div>
              <div style={{ display: 'flex', gap: 20 }}>
                <div style={{ padding: 12, background: '#fff', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', flexShrink: 0 }}><QrCode size={160} seed={MFA_OTPAUTH}/></div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="k-overline" style={{ marginBottom: 6 }}>Can't scan?</div>
                  <div style={{ fontSize: 12.5, color: 'var(--text-muted)', lineHeight: 1.55, marginBottom: 10 }}>Enter this setup key manually in your app.</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', background: 'var(--bg-subtle)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)' }}>
                    <span className="mono" style={{ flex: 1, fontSize: 12.5, letterSpacing: '0.06em', wordBreak: 'break-all', filter: showKey ? 'none' : 'blur(4px)', userSelect: showKey ? 'text' : 'none', transition: 'filter 120ms' }}>{MFA_SETUP_KEY}</span>
                    <button onClick={() => setShowKey(s => !s)} className="k-btn-icon k-btn-plain" style={{ height: 28, width: 28, flexShrink: 0 }}><Icon name={showKey ? 'eyeOff' : 'eye'} size={14}/></button>
                    <button onClick={() => { navigator.clipboard?.writeText(MFA_SETUP_KEY.replace(/\s/g, '')).catch(() => {}); if (window.kToast) kToast('Setup key copied'); }} className="k-btn-icon k-btn-plain" style={{ height: 28, width: 28, flexShrink: 0 }}><Icon name="copy" size={14}/></button>
                  </div>
                  <div style={{ marginTop: 12 }}><MfaNote icon="lock">Time-based (TOTP), 30-second codes. Keep this key private.</MfaNote></div>
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 22 }}>
                <button onClick={onClose} className="k-btn k-btn-ghost">Cancel</button>
                <button onClick={() => setStep(2)} className="k-btn k-btn-primary">Next <Icon name="arrowRight" size={13}/></button>
              </div>
            </div>
          )}

          {/* STEP 2 — confirm code */}
          {step === 2 && (
            <div className="fade-in" key="s2">
              <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: 20 }}>Enter the 6-digit code from your app to confirm it's set up correctly.</div>
              <label className="k-overline" style={{ display: 'block', marginBottom: 10 }}>Code from authenticator</label>
              <CodeBoxes value={code} onChange={v => { setCode(v); if (state === 'confirm-error') setState('idle'); }} disabled={state === 'busy'} invalid={state === 'confirm-error'} autoFocus/>
              {state === 'confirm-error' && <MfaError>That code isn't valid. Try again.</MfaError>}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginTop: 22 }}>
                <button onClick={() => setStep(1)} className="k-btn k-btn-plain"><Icon name="arrowLeft" size={13}/> Back</button>
                <button onClick={confirm} disabled={code.replace(/\s/g, '').length !== 6 || state === 'busy'} className="k-btn k-btn-primary" style={{ minWidth: 130, justifyContent: 'center', opacity: (code.replace(/\s/g, '').length !== 6 || state === 'busy') ? 0.6 : 1 }}>
                  {state === 'busy' ? <><span className="k-spin" style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', borderRadius: '50%' }}/> Verifying…</> : 'Confirm & continue'}
                </button>
              </div>
            </div>
          )}

          {/* STEP 3 — recovery codes */}
          {step === 3 && (
            <div className="fade-in" key="s3">
              <div style={{ marginBottom: 14 }}><MfaNote icon="alert" tone="warn"><strong>Save these recovery codes now.</strong> They're shown only once. Each lets you sign in if you lose your authenticator device — store them somewhere safe, like a password manager.</MfaNote></div>
              <RecoveryCodesGrid codes={codes}/>
              <RecoveryActions codes={codes}/>
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: 9, marginTop: 18, fontSize: 13, cursor: 'pointer', lineHeight: 1.5 }}>
                <input type="checkbox" checked={saved} onChange={e => setSaved(e.target.checked)} style={{ accentColor: 'var(--accent)', marginTop: 2, width: 15, height: 15 }}/>
                <span>I've saved my recovery codes somewhere safe.</span>
              </label>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
                <button onClick={onDone} disabled={!saved} className="k-btn k-btn-primary" style={{ minWidth: 150, justifyContent: 'center', opacity: saved ? 1 : 0.6 }}><Icon name="check" size={14}/> Finish setup</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ============================================================
// CONFIRM MODAL — regenerate / turn off (requires current code)
// ============================================================
const MfaConfirmModal = ({ variant, onClose, onConfirm, startState }) => {
  const danger = variant === 'disable';
  const [code, setCode] = React.useState(startState === 'error' ? '338920' : '');
  const [state, setState] = React.useState(startState || 'idle'); // idle | busy | error
  const cfg = danger
    ? { icon: 'shield', title: 'Turn off two-factor authentication', color: 'var(--danger-600)', bg: 'var(--danger-50)', border: 'var(--danger-100)', body: 'This removes the extra layer of protection on your account. Your workspace may require two-factor — turning it off could block your next sign-in.', cta: 'Turn off two-factor', btn: { background: 'var(--danger-600)', color: '#fff' } }
    : { icon: 'refresh', title: 'Regenerate recovery codes', color: 'var(--accent)', bg: 'var(--accent-soft)', border: 'var(--border)', body: 'This creates a new set of 10 codes and invalidates all of your current ones. Any codes you saved before will stop working.', cta: 'Regenerate codes', btn: null };
  const go = () => { if (code.replace(/\s/g, '').length !== 6 || state === 'busy') return; setState('busy'); setTimeout(() => onConfirm(), 1200); };
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(15,23,42,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, backdropFilter: 'blur(2px)', animation: 'fadeIn 140ms ease-out' }}>
      <div onClick={e => e.stopPropagation()} className="k-surface fade-in" style={{ width: 420, maxWidth: '100%', boxShadow: 'var(--shadow-xl)' }}>
        <div style={{ padding: 22 }}>
          <div style={{ display: 'inline-flex', padding: 11, borderRadius: 'var(--r-md)', background: cfg.bg, color: cfg.color, marginBottom: 14, border: `1px solid ${cfg.border}` }}><Icon name={cfg.icon} size={22}/></div>
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>{cfg.title}</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: 18 }}>{cfg.body}</div>
          <label className="k-overline" style={{ display: 'block', marginBottom: 8 }}>Confirm with your current code</label>
          <CodeBoxes value={code} onChange={v => { setCode(v); if (state === 'error') setState('idle'); }} disabled={state === 'busy'} invalid={state === 'error'} autoFocus/>
          {state === 'error' && <MfaError>That code isn't valid. Try again.</MfaError>}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
            <button onClick={onClose} className="k-btn k-btn-ghost">Cancel</button>
            <button onClick={go} disabled={code.replace(/\s/g, '').length !== 6 || state === 'busy'} className="k-btn k-btn-primary" style={{ minWidth: 150, justifyContent: 'center', opacity: (code.replace(/\s/g, '').length !== 6 || state === 'busy') ? 0.6 : 1, ...(cfg.btn || {}) }}>
              {state === 'busy' ? <><span className="k-spin" style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', borderRadius: '50%' }}/> Working…</> : cfg.cta}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================
// 2FA PANEL — the settings section (not-enrolled | active)
// ============================================================
const TwoFactorPanel = ({ initial = 'not-enrolled', recoveryRemaining = 8, loading = false }) => {
  const [status, setStatus] = React.useState(initial); // 'not-enrolled' | 'active'
  const [modal, setModal] = React.useState(null); // 'enroll' | 'regen' | 'disable'
  const [remaining, setRemaining] = React.useState(recoveryRemaining);
  const [flash, setFlash] = React.useState(initial === 'active' && recoveryRemaining >= 10 ? 'enrolled' : null);
  const lowCodes = remaining <= 3;

  if (loading) {
    return (
      <SettingsPage title="Two-factor authentication" subtitle="An extra layer of security for your account">
        <div className="k-surface" style={{ padding: 20 }}>
          {[0, 1, 2].map(i => <div key={i} className="skeleton" style={{ height: i === 0 ? 44 : 16, marginBottom: 14, width: i === 1 ? '70%' : '100%' }}/>)}
          <div className="skeleton" style={{ height: 36, width: 200, marginTop: 8 }}/>
        </div>
      </SettingsPage>
    );
  }

  return (
    <SettingsPage title="Two-factor authentication" subtitle="An extra layer of security for your account">
      {flash === 'enrolled' && (
        <div className="fade-in" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', background: 'var(--success-50)', border: '1px solid var(--success-100)', borderRadius: 'var(--r-md)', marginBottom: 16, color: 'var(--success-700)' }}>
          <Icon name="check" size={16} stroke={2.5}/>
          <span style={{ fontSize: 13, fontWeight: 500 }}>Two-factor authentication is on. Your account is now protected.</span>
          <button onClick={() => setFlash(null)} className="k-btn-icon k-btn-plain" style={{ marginLeft: 'auto', color: 'var(--success-700)' }}><Icon name="x" size={14}/></button>
        </div>
      )}

      {status === 'not-enrolled' ? (
        <Card>
          <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
            <div style={{ width: 46, height: 46, borderRadius: 'var(--r-md)', background: 'var(--accent-soft)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Icon name="shield" size={22}/></div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>Protect your account with 2FA</div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.65, marginBottom: 16 }}>
                Two-factor authentication asks for a short code from an app on your phone whenever you sign in. Even if someone learns your password, they can't get into your account — or the quality records tied to it — without your device.
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 18 }}>
                {[{ i: 'smartphone', l: 'Use any authenticator app', s: 'Google, 1Password, Authy' }, { i: 'key', l: '10 backup codes', s: 'For lost-device recovery' }, { i: 'history', l: 'Logged for audit', s: 'IATF 16949 §7.5.3' }].map(x => (
                  <div key={x.l} style={{ padding: 12, background: 'var(--bg-subtle)', borderRadius: 'var(--r-md)' }}>
                    <div style={{ color: 'var(--accent)', marginBottom: 8 }}><Icon name={x.i} size={17}/></div>
                    <div style={{ fontSize: 12.5, fontWeight: 600, lineHeight: 1.35 }}>{x.l}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{x.s}</div>
                  </div>
                ))}
              </div>
              <button onClick={() => setModal('enroll')} className="k-btn k-btn-primary" style={{ height: 40 }}><Icon name="shieldCheck" size={15}/> Enable two-factor authentication</button>
            </div>
          </div>
        </Card>
      ) : (
        <>
          <Card>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 44, height: 44, borderRadius: 'var(--r-md)', background: 'var(--success-50)', color: 'var(--success-600)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Icon name="shieldCheck" size={22}/></div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>Two-factor authentication is on <span className="k-chip" style={{ background: 'var(--success-100)', color: 'var(--success-700)' }}><span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--success-500)' }}/>Active</span></div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3, display: 'flex', alignItems: 'center', gap: 6 }}><Icon name="smartphone" size={12}/> Authenticator app · Added 4 months ago · Last used today</div>
              </div>
            </div>
          </Card>

          <Card title="Recovery codes" desc="One-time codes for signing in when you don't have your authenticator device">
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                <span style={{ fontSize: 30, fontWeight: 700, color: lowCodes ? 'var(--warning-600)' : 'var(--text)' }}>{remaining}</span>
                <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>of 10 remaining</span>
              </div>
              <div style={{ flex: 1, height: 6, background: 'var(--border)', borderRadius: 'var(--r-full)', overflow: 'hidden' }}>
                <div style={{ width: `${remaining * 10}%`, height: '100%', background: lowCodes ? 'var(--warning-500)' : 'var(--success-500)', transition: 'width 240ms' }}/>
              </div>
              <button onClick={() => setModal('regen')} className="k-btn k-btn-ghost"><Icon name="refresh" size={13}/> Regenerate</button>
            </div>
            {lowCodes && <div style={{ marginTop: 14 }}><MfaNote icon="alert" tone="warn"><strong>Running low on recovery codes.</strong> You have {remaining} left. Regenerate a fresh set of 10 so you don't get locked out if you lose your device.</MfaNote></div>}
          </Card>

          <Card title="Turn off two-factor" desc="Not recommended — your workspace may require two-factor to sign in">
            <button onClick={() => setModal('disable')} className="k-btn k-btn-ghost" style={{ color: 'var(--danger-600)', borderColor: 'var(--danger-100)' }}><Icon name="shield" size={13}/> Turn off two-factor authentication</button>
          </Card>
        </>
      )}

      {modal === 'enroll' && <MfaEnrollModal onClose={() => setModal(null)} onDone={() => { setModal(null); setStatus('active'); setRemaining(10); setFlash('enrolled'); }}/>}
      {modal === 'regen' && <MfaConfirmModal variant="regen" onClose={() => setModal(null)} onConfirm={() => { setModal(null); setRemaining(10); if (window.kToast) kToast('New recovery codes generated'); }}/>}
      {modal === 'disable' && <MfaConfirmModal variant="disable" onClose={() => setModal(null)} onConfirm={() => { setModal(null); setStatus('not-enrolled'); setFlash(null); if (window.kToast) kToast('Two-factor authentication turned off'); }}/>}
    </SettingsPage>
  );
};

Object.assign(window, { genRecoveryCodes, RecoveryCodesGrid, RecoveryActions, MfaEnrollModal, MfaConfirmModal, TwoFactorPanel, MFA_SETUP_KEY, MFA_OTPAUTH });
