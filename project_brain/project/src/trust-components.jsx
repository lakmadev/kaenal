// Kaenal — Trust components
// Two reusable building blocks for "trust as a feature":
//   1. <AISuggestion>  — the block shown anywhere AI proposes something.
//                        Suggestion + expandable reasoning + cited source chips with preview.
//   2. <AuditRow> / <AuditTrail> + <SignatureBadge>
//                        — audit-trail timeline row with a cryptographic signature
//                        badge, a Verify action, and tamper-evident status.

// —— Icons this module needs that aren't in the base set ——
if (window.ICONS) {
  if (!window.ICONS.fingerprint) window.ICONS.fingerprint = '<path d="M2 12C2 6.5 6.5 2 12 2a10 10 0 0 1 8 4"/><path d="M5 19.5C5.5 18 6 15 6 12a6 6 0 0 1 .34-2"/><path d="M17.29 21.02c.12-.6.43-2.3.5-3.02"/><path d="M12 10a2 2 0 0 0-2 2c0 1.02-.1 2.51-.26 4"/><path d="M8.65 22c.21-.66.45-1.32.57-2"/><path d="M14 13.12c0 2.38 0 6.38-1 8.88"/><path d="M2 16h.01"/><path d="M21.8 16c.2-2 .131-5.354 0-6"/><path d="M9 6.8a6 6 0 0 1 9 5.2v2"/>';
  if (!window.ICONS.seal) window.ICONS.seal = '<path d="M12 2 4 5v6c0 5 3.5 8 8 11 4.5-3 8-6 8-11V5l-8-3Z"/><path d="m9 12 2 2 4-4"/>';
  if (!window.ICONS.external) window.ICONS.external = '<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>';
  if (!window.ICONS.sliders) window.ICONS.sliders = '<line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/>';
  if (!window.ICONS.undo) window.ICONS.undo = '<path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/>';
}

const AI_GRADIENT = 'linear-gradient(135deg, #6366f1, #db2777)';

// ── Confidence band ──
function confBand(v) {
  if (v >= 80) return { label: 'High confidence', color: '#16a34a', soft: 'rgba(22,163,74,0.12)' };
  if (v >= 55) return { label: 'Medium confidence', color: '#d97706', soft: 'rgba(217,119,6,0.12)' };
  return { label: 'Low confidence', color: '#64748b', soft: 'rgba(100,116,139,0.14)' };
}

function ConfidenceMeter({ value }) {
  const b = confBand(value);
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }} title={`${b.label} — model self-reported`}>
      <div style={{ display: 'flex', gap: 2 }}>
        {[0, 1, 2, 3, 4].map(i => {
          const on = value >= (i + 1) * 20 - 10;
          return <span key={i} style={{ width: 4, height: 12, borderRadius: 1, background: on ? b.color : 'var(--border-strong)' }}/>;
        })}
      </div>
      <span style={{ fontSize: 11.5, fontWeight: 700, color: b.color }} className="mono">{value}%</span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Source chip with click-to-open document preview
// ─────────────────────────────────────────────────────────────
function SourceChip({ source }) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef(null);

  React.useEffect(() => {
    if (!open) return;
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const kindIcon = { doc: 'fileText', data: 'lineChart', case: 'brain', log: 'history', clause: 'shield' }[source.kind] || 'fileText';

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      <button onClick={() => setOpen(o => !o)}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6, height: 26, padding: '0 9px',
          borderRadius: 'var(--r-full)', fontSize: 11.5, fontWeight: 600,
          border: `1px solid ${open ? 'var(--accent)' : 'var(--border-strong)'}`,
          background: open ? 'var(--accent-soft)' : 'var(--surface)',
          color: open ? 'var(--accent)' : 'var(--text)', transition: 'all 120ms',
        }}
        onMouseEnter={e => { if (!open) e.currentTarget.style.borderColor = 'var(--accent)'; }}
        onMouseLeave={e => { if (!open) e.currentTarget.style.borderColor = 'var(--border-strong)'; }}>
        <Icon name={kindIcon} size={12}/>
        <span>{source.label}</span>
        {source.ref && <span className="mono" style={{ fontSize: 10, color: 'var(--text-muted)' }}>{source.ref}</span>}
      </button>

      {open && (
        <div className="fade-in" style={{
          position: 'absolute', top: 'calc(100% + 8px)', left: 0, zIndex: 60, width: 348,
          background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)',
          boxShadow: 'var(--shadow-xl)', overflow: 'hidden',
        }}>
          <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <div style={{ width: 32, height: 32, borderRadius: 'var(--r-md)', background: 'var(--bg-subtle)', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Icon name={kindIcon} size={16}/>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.3 }}>{source.title}</div>
              <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 2 }}>
                {source.meta}{source.ref ? <> · <span className="mono">{source.ref}</span></> : null}
              </div>
            </div>
          </div>
          <div style={{ padding: 14 }}>
            <div className="k-overline" style={{ marginBottom: 6, fontSize: 9.5 }}>Cited passage</div>
            <div style={{
              fontSize: 12, lineHeight: 1.6, color: 'var(--text)',
              fontFamily: source.mono ? 'var(--font-mono)' : 'inherit',
              padding: '10px 12px', background: 'var(--bg-subtle)', borderRadius: 'var(--r-md)',
              borderLeft: '2px solid var(--accent)',
            }}>
              {source.passage.map((seg, i) =>
                seg.hl
                  ? <mark key={i} style={{ background: 'rgba(99,102,241,0.20)', color: 'var(--text)', padding: '0 2px', borderRadius: 2 }}>{seg.t}</mark>
                  : <React.Fragment key={i}>{seg.t}</React.Fragment>
              )}
            </div>
          </div>
          <button className="k-btn-plain" style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderTop: '1px solid var(--border)', fontSize: 12, fontWeight: 600, color: 'var(--accent)' }}>
            <span>Open {source.kind === 'data' ? 'record' : source.kind === 'case' ? '8D report' : 'document'}</span>
            <Icon name="external" size={13}/>
          </button>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// AISuggestion — drop in anywhere AI proposes something
// ─────────────────────────────────────────────────────────────
function AISuggestion({
  label = 'Kaenal AI suggestion',
  context,
  confidence = 80,
  headline,
  detail,
  reasoning = [],
  signals = [],
  sources = [],
  alternatives = [],
  approval,
  acceptLabel = 'Accept',
  defaultOpen = false,
}) {
  const [showReasoning, setShowReasoning] = React.useState(defaultOpen);
  const [state, setState] = React.useState('open'); // open | accepted | dismissed

  if (state === 'dismissed') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', border: '1px dashed var(--border-strong)', borderRadius: 'var(--r-lg)', fontSize: 12.5, color: 'var(--text-muted)' }}>
        <Icon name="x" size={14}/>
        <span style={{ flex: 1 }}>Suggestion dismissed. It stays in the AI audit trail.</span>
        <button onClick={() => setState('open')} className="k-btn-plain" style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent)', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          <Icon name="undo" size={12}/> Undo
        </button>
      </div>
    );
  }

  return (
    <div style={{
      border: '1px solid rgba(99,102,241,0.28)', borderRadius: 'var(--r-lg)', overflow: 'hidden',
      background: 'linear-gradient(180deg, rgba(99,102,241,0.05), rgba(99,102,241,0.012) 120px, var(--surface) 220px)',
      boxShadow: 'var(--shadow-xs)',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px 10px' }}>
        <div style={{ width: 28, height: 28, borderRadius: 'var(--r-md)', background: AI_GRADIENT, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 2px 6px rgba(99,102,241,0.35)' }}>
          <Icon name="sparkles" size={15}/>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.2 }}>{label}</div>
          {context && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{context}</div>}
        </div>
        <ConfidenceMeter value={confidence}/>
      </div>

      {/* Suggestion body */}
      <div style={{ padding: '0 16px 14px' }}>
        {state === 'accepted' ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 'var(--r-md)' }}>
            <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--success-500)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Icon name="check" size={13} stroke={3}/>
            </div>
            <span style={{ flex: 1, fontSize: 12.5, fontWeight: 600, color: 'var(--success-700)' }}>Applied — and logged to the audit trail as AI-assisted.</span>
            <button onClick={() => setState('open')} className="k-btn-plain" style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <Icon name="undo" size={12}/> Undo
            </button>
          </div>
        ) : (
          <div style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.4, letterSpacing: '-0.01em' }}>{headline}</div>
        )}
        {state !== 'accepted' && detail && (
          <div style={{ fontSize: 12.5, color: 'var(--text-muted)', lineHeight: 1.55, marginTop: 5 }}>{detail}</div>
        )}

        {/* Alternatives */}
        {state !== 'accepted' && alternatives.length > 0 && (
          <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 4 }}>
            {alternatives.map((a, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 10px', borderRadius: 'var(--r-md)', background: 'var(--bg-subtle)' }}>
                <span style={{ fontSize: 12, color: 'var(--text)', flex: 1 }}>{a.text}</span>
                <span className="mono" style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>{a.confidence}%</span>
                <button className="k-btn-plain" style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent)', padding: '2px 4px' }}>Use instead</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Reasoning toggle + panel */}
      {reasoning.length > 0 && state !== 'accepted' && (
        <div style={{ padding: '0 16px' }}>
          <button onClick={() => setShowReasoning(s => !s)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', padding: '4px 0' }}>
            <Icon name={showReasoning ? 'chevronDown' : 'chevronRight'} size={14}/>
            {showReasoning ? 'Hide reasoning' : 'Show reasoning'}
            {!showReasoning && <span style={{ fontWeight: 500, color: 'var(--text-subtle)' }}>· {reasoning.length} steps</span>}
          </button>

          {showReasoning && (
            <div className="fade-in" style={{ marginTop: 6, marginBottom: 6, paddingLeft: 14, borderLeft: '2px solid rgba(99,102,241,0.3)' }}>
              <div className="k-overline" style={{ fontSize: 9.5, marginBottom: 8 }}>How Kaenal AI reached this</div>
              <ol style={{ margin: 0, paddingLeft: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {reasoning.map((r, i) => (
                  <li key={i} style={{ display: 'flex', gap: 9 }}>
                    <span style={{ width: 18, height: 18, borderRadius: '50%', background: 'rgba(99,102,241,0.12)', color: '#6366f1', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>{i + 1}</span>
                    <span style={{ fontSize: 12, lineHeight: 1.5, color: 'var(--text)' }}>{r}</span>
                  </li>
                ))}
              </ol>
              {signals.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  <div className="k-overline" style={{ fontSize: 9.5, marginBottom: 6 }}>Signals it weighed</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                    {signals.map((s, i) => (
                      <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--text-muted)', background: 'var(--bg-subtle)', padding: '3px 8px', borderRadius: 'var(--r-full)' }}>
                        <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#6366f1' }}/>{s}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Sources */}
      {sources.length > 0 && state !== 'accepted' && (
        <div style={{ padding: '10px 16px 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span className="k-overline" style={{ fontSize: 9.5 }}>Sources</span>
            {sources.map((s, i) => <SourceChip key={i} source={s}/>)}
          </div>
        </div>
      )}

      {/* Footer */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '14px 16px', marginTop: 12 }}>
        {state !== 'accepted' && (
          <>
            <button className="k-btn k-btn-primary k-btn-sm" onClick={() => setState('accepted')}>
              <Icon name="check" size={13}/> {acceptLabel}
            </button>
            <button className="k-btn k-btn-ghost k-btn-sm" onClick={() => setShowReasoning(true)}><Icon name="edit" size={12}/> Edit first</button>
            <button className="k-btn k-btn-plain k-btn-sm" onClick={() => setState('dismissed')}>Dismiss</button>
          </>
        )}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
          {approval && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--warning-700)', fontWeight: 600 }}>
              <Icon name="user" size={12}/> {approval}
            </span>
          )}
          <button className="k-btn-plain" title="Regenerate" style={{ color: 'var(--text-subtle)', padding: 4 }}><Icon name="refresh" size={14}/></button>
        </div>
      </div>
    </div>
  );
}

// ── Compact inline variant (e.g. inside a form field) ──
function AISuggestionInline({ value, field = 'field' }) {
  const [state, setState] = React.useState('open');
  if (state === 'dismissed') return null;
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px',
      border: '1px solid rgba(99,102,241,0.3)', borderRadius: 'var(--r-md)',
      background: 'rgba(99,102,241,0.05)',
    }}>
      <div style={{ width: 20, height: 20, borderRadius: 5, background: AI_GRADIENT, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon name="sparkles" size={11}/>
      </div>
      <div style={{ flex: 1, minWidth: 0, fontSize: 12.5, lineHeight: 1.35 }}>
        {state === 'accepted'
          ? <span style={{ color: 'var(--text)' }}>{value}</span>
          : <><span style={{ color: 'var(--text-subtle)' }}>Suggested {field}: </span><span style={{ color: 'var(--text)' }}>{value}</span></>}
      </div>
      {state === 'accepted' ? (
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--success-600)', display: 'inline-flex', alignItems: 'center', gap: 4 }}><Icon name="check" size={12} stroke={3}/> Accepted</span>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          <button onClick={() => setState('accepted')} className="k-btn k-btn-primary" style={{ height: 24, padding: '0 9px', fontSize: 11 }}>Tab</button>
          <button onClick={() => setState('dismissed')} className="k-btn-plain" style={{ padding: 3, color: 'var(--text-muted)' }}><Icon name="x" size={13}/></button>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// SignatureBadge — cryptographic signature + verify + tamper status
// ─────────────────────────────────────────────────────────────
function SignatureBadge({ entry, status, onVerify }) {
  const [expanded, setExpanded] = React.useState(false);

  const verified = status === 'verified';
  const tampered = status === 'tampered';
  const verifying = status === 'verifying';
  const pending = status === 'pending';

  const tone = tampered
    ? { color: '#b91c1c', soft: 'rgba(220,38,38,0.08)', border: 'rgba(220,38,38,0.35)', icon: 'alert' }
    : verified
      ? { color: 'var(--success-700)', soft: 'rgba(34,197,94,0.08)', border: 'rgba(34,197,94,0.35)', icon: 'shieldCheck' }
      : pending
        ? { color: '#b45309', soft: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.32)', icon: 'clock' }
        : { color: 'var(--text-muted)', soft: 'var(--bg-subtle)', border: 'var(--border-strong)', icon: 'seal' };

  return (
    <div style={{ border: `1px solid ${tone.border}`, background: tone.soft, borderRadius: 'var(--r-md)', overflow: 'hidden', maxWidth: 420 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px' }}>
        <div style={{ width: 26, height: 26, borderRadius: 6, background: 'var(--surface)', border: `1px solid ${tone.border}`, color: tone.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          {verifying
            ? <Icon name="refresh" size={14} className="k-spin"/>
            : <Icon name={tone.icon} size={14}/>}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: tone.color, lineHeight: 1.2 }}>
            {verifying ? 'Verifying signature…' : verified ? 'Signature verified' : tampered ? 'Tamper detected' : pending ? 'Awaiting notarization' : 'Cryptographically signed'}
          </div>
          <div style={{ fontSize: 10.5, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 5, marginTop: 1 }}>
            <span className="mono" style={{ whiteSpace: 'nowrap' }}>sha256:{entry.hash}</span>
          </div>
        </div>
        {status === 'signed' && (
          <button onClick={onVerify} className="k-btn k-btn-ghost" style={{ height: 26, padding: '0 10px', fontSize: 11.5 }}>
            <Icon name="fingerprint" size={12}/> Verify
          </button>
        )}
        {pending && (
          <span style={{ fontSize: 10.5, color: '#b45309', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <Icon name="refresh" size={11} className="k-spin"/> TSA
          </span>
        )}
        {(verified || tampered) && (
          <button onClick={() => setExpanded(e => !e)} className="k-btn-plain" style={{ height: 26, padding: '0 6px', fontSize: 11, color: 'var(--text-muted)' }}>
            {expanded ? 'Hide' : 'Details'}
            <Icon name={expanded ? 'chevronDown' : 'chevronRight'} size={13}/>
          </button>
        )}
      </div>

      {/* Tamper banner */}
      {tampered && (
        <div style={{ padding: '8px 10px', borderTop: `1px solid ${tone.border}`, fontSize: 11.5, color: '#b91c1c', lineHeight: 1.5, display: 'flex', gap: 7 }}>
          <Icon name="alert" size={13} style={{ flexShrink: 0, marginTop: 1 }}/>
          <span>Stored hash does not match the recomputed payload — this record was altered after signing. The chain is broken from this block onward.</span>
        </div>
      )}

      {/* Verified chain-intact note */}
      {verified && !expanded && (
        <div style={{ padding: '7px 10px', borderTop: `1px solid ${tone.border}`, fontSize: 11, color: 'var(--success-700)', display: 'flex', alignItems: 'center', gap: 6 }}>
          <Icon name="link" size={12}/> Hash chain intact · links to previous block
        </div>
      )}

      {/* Expanded crypto detail */}
      {expanded && (verified || tampered) && (
        <div style={{ padding: '10px 12px', borderTop: `1px solid ${tone.border}`, background: 'var(--surface)', display: 'grid', gridTemplateColumns: '92px 1fr', gap: '6px 10px', fontSize: 11 }}>
          <CryptoRow k="Algorithm" v="Ed25519" />
          <CryptoRow k="Signed by" v={entry.signer} />
          <CryptoRow k="Key ID" v={entry.keyId} mono />
          <CryptoRow k="Signed at" v={entry.signedAt} mono />
          <CryptoRow k="This block" v={`sha256:${entry.hash}`} mono />
          <CryptoRow k="Prev block" v={entry.prevHash ? `sha256:${entry.prevHash}` : '— genesis —'} mono link={!!entry.prevHash} />
          <CryptoRow k="Chain" v={tampered ? 'Broken — hash mismatch' : 'Intact'} tone={tampered ? '#b91c1c' : 'var(--success-700)'} />
          <CryptoRow k="Notary" v="RFC 3161 TSA · DigiCert · 2026-05-19" />
        </div>
      )}
    </div>
  );
}

function CryptoRow({ k, v, mono, link, tone }) {
  return (
    <>
      <span style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600, alignSelf: 'center' }}>{k}</span>
      <span className={mono ? 'mono' : ''} style={{ fontSize: mono ? 10.5 : 11.5, color: tone || (link ? 'var(--accent)' : 'var(--text)'), wordBreak: 'break-all', fontWeight: tone ? 700 : 500, cursor: link ? 'pointer' : 'default' }}>{v}</span>
    </>
  );
}

// ─────────────────────────────────────────────────────────────
// AuditRow + AuditTrail (timeline)
// ─────────────────────────────────────────────────────────────
const AUDIT_EVENT_STYLES = {
  closure:  { icon: 'lock', color: '#7c3aed' },
  approve:  { icon: 'check', color: '#16a34a' },
  verify:   { icon: 'shieldCheck', color: '#0891b2' },
  status:   { icon: 'refresh', color: '#2563eb' },
  edit:     { icon: 'edit', color: '#d97706' },
  create:   { icon: 'plus', color: '#64748b' },
};

function AuditRow({ entry, status, onVerify, last }) {
  const ev = AUDIT_EVENT_STYLES[entry.type] || AUDIT_EVENT_STYLES.status;
  const user = entry.actor ? userById(entry.actor) : null;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '76px 28px 1fr', gap: 0 }}>
      {/* time */}
      <div style={{ textAlign: 'right', paddingRight: 12, paddingTop: 3 }}>
        <div className="mono" style={{ fontSize: 11, fontWeight: 600, color: 'var(--text)' }}>{entry.time}</div>
        <div style={{ fontSize: 10, color: 'var(--text-subtle)' }}>{entry.date}</div>
      </div>
      {/* node + connector */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{ width: 28, height: 28, borderRadius: '50%', background: ev.color + '18', color: ev.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: '2px solid var(--surface)' }}>
          <Icon name={ev.icon} size={13}/>
        </div>
        {!last && <div style={{ width: 2, flex: 1, background: 'var(--border)', minHeight: 18, marginTop: 2 }}/>}
      </div>
      {/* content */}
      <div style={{ paddingLeft: 12, paddingBottom: last ? 0 : 22 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {user && <Avatar user={user} size={20}/>}
          <span style={{ fontSize: 13, lineHeight: 1.3 }}>
            <strong style={{ fontWeight: 600 }}>{user ? user.name : 'System'}</strong> {entry.action}
            {entry.entity && <> <span className="mono" style={{ color: 'var(--accent)', fontWeight: 600 }}>{entry.entity}</span></>}
          </span>
        </div>
        {entry.note && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3, lineHeight: 1.5 }}>{entry.note}</div>}
        {entry.signed && (
          <div style={{ marginTop: 10 }}>
            <SignatureBadge entry={entry} status={status} onVerify={onVerify}/>
          </div>
        )}
      </div>
    </div>
  );
}

function AuditTrail({ entries, title = 'Audit trail', subtitle }) {
  const initial = {};
  entries.forEach(e => { if (e.signed) initial[e.id] = e.start || 'signed'; });
  const [statuses, setStatuses] = React.useState(initial);

  const verifyOne = (e) => {
    setStatuses(s => ({ ...s, [e.id]: 'verifying' }));
    setTimeout(() => {
      setStatuses(s => ({ ...s, [e.id]: e.result }));
    }, 950 + Math.random() * 500);
  };

  const verifyAll = () => {
    const signed = entries.filter(e => e.signed && (statuses[e.id] === 'signed' || statuses[e.id] === undefined));
    signed.forEach((e, i) => {
      setTimeout(() => verifyOne(e), i * 420);
    });
  };

  const signedCount = entries.filter(e => e.signed).length;
  const verifiedCount = entries.filter(e => e.signed && statuses[e.id] === 'verified').length;
  const tamperCount = entries.filter(e => e.signed && statuses[e.id] === 'tampered').length;

  return (
    <div className="k-surface" style={{ overflow: 'hidden' }}>
      <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
            {title}
            <span className="k-chip" style={{ background: 'var(--bg-subtle)', color: 'var(--text-muted)', fontWeight: 600 }}>
              <Icon name="seal" size={11}/> {signedCount} signed
            </span>
          </div>
          {subtitle && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{subtitle}</div>}
        </div>
        {tamperCount > 0 && (
          <span className="k-chip" style={{ background: 'rgba(220,38,38,0.10)', color: '#b91c1c' }}>
            <Icon name="alert" size={11}/> {tamperCount} tampered
          </span>
        )}
        {verifiedCount > 0 && (
          <span className="k-chip" style={{ background: 'rgba(34,197,94,0.12)', color: 'var(--success-700)' }}>
            <Icon name="check" size={11} stroke={3}/> {verifiedCount} verified
          </span>
        )}
        <button onClick={verifyAll} className="k-btn k-btn-ghost k-btn-sm">
          <Icon name="fingerprint" size={13}/> Verify all
        </button>
      </div>
      <div style={{ padding: '18px 18px 18px' }}>
        {entries.map((e, i) => (
          <AuditRow key={e.id} entry={e} status={statuses[e.id]} onVerify={() => verifyOne(e)} last={i === entries.length - 1}/>
        ))}
      </div>
    </div>
  );
}

Object.assign(window, {
  AISuggestion, AISuggestionInline, SignatureBadge, AuditRow, AuditTrail,
  ConfidenceMeter, SourceChip, confBand,
});
