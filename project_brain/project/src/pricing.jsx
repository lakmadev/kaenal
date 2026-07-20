// Kaenal — Plans & add-ons (billing / packaging)
// Reads & writes the same entitlement store as the live module gates,
// so toggling an add-on here unlocks/locks the corresponding pages.

function AddonCard({ p, active, onToggle }) {
  const pr = p.price(ORG_PROFILE);
  return (
    <div className="k-surface" style={{
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
      borderColor: active ? p.accent : 'var(--border)',
      boxShadow: active ? `0 0 0 1px ${p.accent}` : 'var(--shadow-xs)',
    }}>
      {/* head */}
      <div style={{ padding: '16px 18px 12px', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <div style={{ width: 38, height: 38, borderRadius: 'var(--r-md)', background: p.soft, color: p.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Icon name={p.icon} size={20} stroke={1.75} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <h3 style={{ margin: 0, fontSize: 14.5, fontWeight: 700, letterSpacing: '-0.01em', lineHeight: 1.3 }}>{p.name}</h3>
            {active && <span className="k-chip" style={{ background: p.soft, color: p.accent, gap: 4 }}><Icon name="check" size={11} stroke={3} /> Active</span>}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3, lineHeight: 1.4 }}>{p.tagline}</div>
        </div>
      </div>

      {/* price */}
      <div style={{ padding: '0 18px 14px', display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em' }}>{pr.display}</span>
        {pr.unit && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{pr.unit}</span>}
        {pr.note && <span style={{ fontSize: 11, color: 'var(--text-subtle)', width: '100%' }}>{pr.note}</span>}
      </div>

      {/* includes */}
      <div style={{ padding: '0 18px', flex: 1 }}>
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
          {p.includes.map((f, i) => (
            <div key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12.5, color: 'var(--text)', lineHeight: 1.4, marginBottom: i === p.includes.length - 1 ? 0 : 8 }}>
              <span style={{ color: p.accent, marginTop: 1, flexShrink: 0 }}><Icon name="check" size={13} stroke={2.5} /></span>
              <span>{f}</span>
            </div>
          ))}
        </div>
      </div>

      {/* value + action */}
      <div style={{ padding: 18, marginTop: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: 'var(--text-muted)', marginBottom: 12 }}>
          <Icon name="trending" size={13} stroke={2} style={{ color: p.accent }} />
          <span>{p.value}</span>
        </div>
        <button onClick={() => onToggle(!active)} className={active ? 'k-btn k-btn-ghost' : 'k-btn k-btn-primary'}
          style={{ width: '100%', justifyContent: 'center', height: 36, background: active ? undefined : p.accent }}>
          {active ? <><Icon name="check" size={14} stroke={2.5} /> Added to plan</> : <><Icon name="plus" size={14} stroke={2.5} /> Add to plan</>}
        </button>
      </div>
    </div>
  );
}

function AlacarteRow({ p, active, onToggle }) {
  const pr = p.price(ORG_PROFILE);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 4px', borderBottom: '1px solid var(--border)' }}>
      <div style={{ width: 34, height: 34, borderRadius: 'var(--r-md)', background: p.soft, color: p.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon name={p.icon} size={17} stroke={1.75} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 13.5, fontWeight: 600 }}>{p.name}</span>
          {active && <span className="k-chip" style={{ background: p.soft, color: p.accent, gap: 4 }}><Icon name="check" size={10} stroke={3} /> Active</span>}
        </div>
        <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{p.tagline}</div>
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0, minWidth: 120 }}>
        <div style={{ fontSize: 14, fontWeight: 700 }}>{pr.display} <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--text-muted)' }}>{pr.unit}</span></div>
        {pr.note && <div style={{ fontSize: 10.5, color: 'var(--text-subtle)' }}>{pr.note}</div>}
      </div>
      <button onClick={() => onToggle(!active)} className={active ? 'k-btn k-btn-ghost k-btn-sm' : 'k-btn k-btn-primary k-btn-sm'}
        style={{ flexShrink: 0, background: active ? undefined : p.accent }}>
        {active ? 'Remove' : 'Add'}
      </button>
    </div>
  );
}

// Plan tier bundles → entitlement maps
const TIERS = [
  {
    id: 'core', name: 'Core', price: '$2,400', unit: '/mo',
    blurb: 'Everything IATF 16949 requires.',
    bundle: { intelligence: false, supplier: false, qe: false, platform: false, security: false, multiplant: false, mobile: true, standards: false, support: false },
    feats: ['Inspections · NCR · CAPA · 8D', 'Audits & document control', 'Calibration & training records', 'Dashboards & core reports'],
  },
  {
    id: 'pro', name: 'Professional', price: '$4,050', unit: '/mo + units', popular: true,
    blurb: 'Core + AI + quality engineering.',
    bundle: { intelligence: true, supplier: false, qe: true, platform: false, security: false, multiplant: false, mobile: true, standards: false, support: false },
    feats: ['Everything in Core', 'Kaenal Intelligence (AI)', 'Quality Engineering pack', 'Premium support add-on ready'],
  },
  {
    id: 'ent', name: 'Enterprise', price: 'Custom', unit: '',
    blurb: 'Everything, fully governed.',
    bundle: { intelligence: true, supplier: true, qe: true, platform: true, security: true, multiplant: true, mobile: true, standards: true, support: true },
    feats: ['Every add-on included', 'SSO, SCIM, BYOK & DLP', 'Multi-plant & white-label', 'Named CSM + 1-hour SLA'],
  },
];

function tierMatches(ent, bundle) {
  return Object.keys(bundle).every((k) => !!ent[k] === !!bundle[k]);
}

function PricingPage({ setRoute }) {
  const ent = useEntitlements();
  const { lines, total, hasVariable } = billingSummary(ent);
  const activeCount = ALL_ADDONS.filter((p) => ent[p.id]).length;

  return (
    <div>
      <PageHeader
        title="Plans & add-ons"
        description="Compose Kaenal to fit your operation. Core covers your compliance obligations; add-ons extend it where you need more — and toggling one here unlocks the live module."
        actions={
          <>
            <button className="k-btn k-btn-ghost" onClick={() => kToast('Download started — kaenal-quote.pdf')}><Icon name="download" size={13} /> Download quote</button>
            <button className="k-btn k-btn-primary" onClick={() => kToast('Thanks! Sales will reach out within one business day')}><Icon name="chat" size={13} /> Contact sales</button>
          </>
        }
      />

      <div style={{ padding: '20px 28px 40px', display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 300px', gap: 24, alignItems: 'start' }}>
        {/* LEFT column */}
        <div style={{ minWidth: 0 }}>
          {/* Plan tiers */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 14 }}>
            {TIERS.map((t) => {
              const current = tierMatches(ent, t.bundle);
              return (
                <div key={t.id} className="k-surface" style={{ padding: 18, position: 'relative', borderColor: current ? 'var(--accent)' : 'var(--border)', boxShadow: current ? '0 0 0 1px var(--accent)' : 'var(--shadow-xs)' }}>
                  {t.popular && <span className="k-chip" style={{ position: 'absolute', top: -10, right: 14, background: 'var(--accent)', color: '#fff' }}>Most popular</span>}
                  <div style={{ fontSize: 14, fontWeight: 700 }}>{t.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', minHeight: 32, marginTop: 2 }}>{t.blurb}</div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 5, margin: '6px 0 12px' }}>
                    <span style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.02em' }}>{t.price}</span>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t.unit}</span>
                  </div>
                  <div style={{ marginBottom: 14 }}>
                    {t.feats.map((f, i) => (
                      <div key={f} style={{ display: 'flex', gap: 7, fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.4, marginBottom: i === t.feats.length - 1 ? 0 : 6 }}>
                        <span style={{ color: 'var(--accent)', flexShrink: 0, marginTop: 1 }}><Icon name="check" size={13} stroke={2.5} /></span>{f}
                      </div>
                    ))}
                  </div>
                  <button onClick={() => applyBundle(t.bundle)} disabled={current}
                    className={current ? 'k-btn k-btn-ghost' : 'k-btn k-btn-primary'}
                    style={{ width: '100%', justifyContent: 'center', height: 34, opacity: current ? 0.7 : 1, cursor: current ? 'default' : 'pointer' }}>
                    {current ? 'Current plan' : t.id === 'ent' ? 'Talk to sales' : 'Apply bundle'}
                  </button>
                </div>
              );
            })}
          </div>

          {/* Guardrail callout */}
          <div className="k-surface" style={{ padding: '14px 18px', display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 24, background: 'var(--bg-subtle)' }}>
            <span style={{ color: 'var(--accent)', flexShrink: 0, marginTop: 1 }}><Icon name="shieldCheck" size={18} stroke={1.75} /></span>
            <div style={{ fontSize: 12.5, color: 'var(--text-muted)', lineHeight: 1.55 }}>
              <strong style={{ color: 'var(--text)' }}>What always stays in Core.</strong> Anything an IATF 16949 audit requires — Inspections, NCR, CAPA, 8D, Audits, Document control, Calibration and Training — is never gated. Add-ons only extend beyond the certification, so customers never feel a compliance obligation has been paywalled.
            </div>
          </div>

          {/* Add-on packs */}
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Add-on packs</h2>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{activeCount} active</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14, marginBottom: 28 }}>
            {ADDON_PACKS.map((p) => (
              <AddonCard key={p.id} p={p} active={!!ent[p.id]} onToggle={(on) => setAddon(p.id, on)} />
            ))}
          </div>

          {/* À la carte */}
          <h2 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 4px' }}>À la carte upsells</h2>
          <p style={{ fontSize: 12.5, color: 'var(--text-muted)', margin: '0 0 12px' }}>Smaller, metered upgrades that attach to any plan.</p>
          <div className="k-surface" style={{ padding: '4px 18px 8px' }}>
            {ALACARTE_ADDONS.map((p) => (
              <AlacarteRow key={p.id} p={p} active={!!ent[p.id]} onToggle={(on) => setAddon(p.id, on)} />
            ))}
          </div>
        </div>

        {/* RIGHT — sticky billing summary */}
        <div style={{ position: 'sticky', top: 76 }}>
          <div className="k-surface" style={{ overflow: 'hidden' }}>
            <div style={{ padding: '16px 18px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ fontSize: 13, fontWeight: 700 }}>Estimated monthly</div>
              <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>Precision Auto · {ORG_PROFILE.plants} plants · {ORG_PROFILE.members} members</div>
            </div>
            <div style={{ padding: '12px 18px' }}>
              {lines.map((l) => (
                <div key={l.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10, padding: '7px 0' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.name}</div>
                    {l.note && <div style={{ fontSize: 10.5, color: 'var(--text-subtle)' }}>{l.note}</div>}
                  </div>
                  <div className="mono" style={{ fontSize: 12.5, fontWeight: 600, flexShrink: 0 }}>{l.display}</div>
                </div>
              ))}
            </div>
            <div style={{ padding: '14px 18px', borderTop: '1px solid var(--border)', background: 'var(--bg-subtle)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span style={{ fontSize: 12.5, fontWeight: 600 }}>Total{hasVariable ? '*' : ''}</span>
                <span style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em' }}>{fmtMoney(total)}<span style={{ fontSize: 12, fontWeight: 400, color: 'var(--text-muted)' }}> /mo</span></span>
              </div>
              {hasVariable && <div style={{ fontSize: 10.5, color: 'var(--text-subtle)', marginTop: 4 }}>* plus metered AI credits / custom enterprise terms</div>}
              <button className="k-btn k-btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: 12, height: 36 }} onClick={() => kToast('Subscription updated — changes apply next billing cycle')}>
                <Icon name="check" size={14} stroke={2.5} /> Update subscription
              </button>
              <div style={{ fontSize: 10.5, color: 'var(--text-subtle)', textAlign: 'center', marginTop: 8 }}>Annual billing · taxes calculated at checkout</div>
            </div>
          </div>

          <button onClick={() => setRoute('dashboard')} className="k-btn k-btn-plain" style={{ width: '100%', justifyContent: 'center', marginTop: 10 }}>
            <Icon name="arrowLeft" size={13} stroke={2} /> Back to dashboard
          </button>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { PricingPage });
