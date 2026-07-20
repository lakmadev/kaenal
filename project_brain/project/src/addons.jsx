// Kaenal — Add-on packaging engine
// Defines the add-on catalog, a tenant entitlement store (localStorage),
// a React hook for live re-render, route→pack gating, and the UpgradeOverlay
// that fronts a locked module with a frosted upsell card.

// ── Org profile (drives per-unit pricing for Precision Auto) ──
const ORG_PROFILE = { plants: 4, suppliers: 86, inspectors: 38, members: 412, standards: 2 };

const fmt = (n) => '$' + Math.round(n).toLocaleString('en-US');

// ── Add-on catalog ───────────────────────────────────────────
// tier: 'pack' = headline bundle · 'alacarte' = single upsell
const ADDON_PACKS = [
  {
    id: 'intelligence', tier: 'pack', name: 'Kaenal Intelligence', icon: 'sparkles',
    accent: '#6366f1', soft: 'rgba(99,102,241,0.12)',
    tagline: 'AI woven through every quality workflow.',
    price: () => ({ amount: 1200, display: '$1,200', unit: '/workspace · mo', note: '+ metered AI credits' }),
    includes: [
      '8D AI copilot & root-cause drafting',
      'Document AI summaries & OCR',
      'Predictive risk scoring',
      'Knowledge graph explorer',
      'Compliance Q&A assistant',
    ],
    value: '≈ 40% faster 8D closure',
    routes: ['graph', 'predictive', 'ai-governance'],
  },
  {
    id: 'supplier', tier: 'pack', name: 'Supplier Network', icon: 'truck',
    accent: '#0d9488', soft: 'rgba(13,148,136,0.12)',
    tagline: 'Push quality actions out to your whole supply base.',
    price: (o) => ({ amount: o.suppliers * 18, display: '$18', unit: '/supplier · mo', note: `× ${o.suppliers} active suppliers` }),
    includes: [
      'External supplier portal',
      'PPAP submission workflow',
      'SCAR & chargebacks',
      'Weighted supplier scorecards',
      'Supplier risk matrix',
    ],
    value: 'Expands revenue beyond your seats',
    routes: ['suppliers', 'suppliers-scorecards', 'suppliers-risk', 'supplier-detail', 'ppap', 'ppap-detail', 'scar', 'supplier'],
  },
  {
    id: 'qe', tier: 'pack', name: 'Quality Engineering', icon: 'target',
    accent: '#2563eb', soft: 'rgba(37,99,235,0.12)',
    tagline: 'Deep statistical tooling for your QE team.',
    price: () => ({ amount: 450, display: '$450', unit: '/workspace · mo' }),
    includes: [
      'FMEA workbench (AIAG-VDA)',
      'SPC charts',
      'MSA / Gauge R&R studies',
      'Risk register',
      'Engineering changes (ECN)',
    ],
    value: 'Specialist depth, not everyday seats',
    routes: ['fmea', 'spc', 'msa', 'risk', 'ecn'],
  },
  {
    id: 'platform', tier: 'pack', name: 'Platform & Integrations', icon: 'code',
    accent: '#ea580c', soft: 'rgba(234,88,12,0.12)',
    tagline: 'Wire Kaenal into the rest of your stack.',
    price: () => ({ amount: 600, display: '$600', unit: '/workspace · mo' }),
    includes: [
      'Public API & webhooks',
      'Developer platform & OAuth apps',
      'Report builder & scheduled exports',
      'Data warehouse sync',
      'ERP / MES connectors',
    ],
    value: 'Integrated accounts churn less',
    routes: ['dev-platform', 'report-builder'],
  },
  {
    id: 'security', tier: 'pack', name: 'Enterprise Security & Identity', icon: 'shield',
    accent: '#475569', soft: 'rgba(71,85,105,0.14)',
    tagline: 'Pass enterprise IT & security review.',
    price: () => ({ amount: null, display: 'Custom', unit: '', note: 'Contact sales' }),
    includes: [
      'SSO — SAML / Entra',
      'SCIM provisioning',
      'Network policy & IP allowlists',
      'BYOK / customer-managed keys',
      'DSAR, legal hold & DLP',
    ],
    value: 'Separate IT security budget',
    routes: [],
    note: 'Configured in Settings → Security & Identity',
  },
  {
    id: 'multiplant', tier: 'pack', name: 'Multi-Plant & White-Label', icon: 'building',
    accent: '#be185d', soft: 'rgba(190,24,93,0.12)',
    tagline: 'Run every plant from a single tenant.',
    price: (o) => ({ amount: (o.plants - 1) * 900, display: '$900', unit: '/plant · mo', note: `× ${o.plants - 1} additional plants` }),
    includes: [
      'Org hierarchy & multi-tenancy',
      'White-label branding',
      'Cross-tenant analytics',
      'Cost centers & chargeback',
      'Clone / migrate / export',
    ],
    value: 'Lands the highest-value groups',
    routes: ['multi-tenancy'],
  },
];

const ALACARTE_ADDONS = [
  {
    id: 'mobile', tier: 'alacarte', name: 'Mobile Field Inspector', icon: 'smartphone',
    accent: '#2563eb', soft: 'rgba(37,99,235,0.12)',
    tagline: 'Offline-capable inspections from the floor.',
    price: (o) => ({ amount: o.inspectors * 9, display: '$9', unit: '/inspector · mo', note: `× ${o.inspectors} field inspectors` }),
    includes: ['Offline inspection capture', 'Camera, GPS & signature', 'Background sync queue'],
    value: 'Per-seat, scales with the field',
    routes: ['mobile'],
  },
  {
    id: 'standards', tier: 'alacarte', name: 'Extra Compliance Standards', icon: 'shieldCheck',
    accent: '#16a34a', soft: 'rgba(22,163,74,0.12)',
    tagline: 'Add standards beyond IATF 16949 & ISO 9001.',
    price: (o) => ({ amount: o.standards * 150, display: '$150', unit: '/standard · mo', note: `× ${o.standards} standards` }),
    includes: ['ISO 14001 (environment)', 'OSHA / ISO 45001 (safety)', 'Per-standard scorecards'],
    value: 'Each standard is its own line',
    routes: [],
  },
  {
    id: 'support', tier: 'alacarte', name: 'Premium Support & SLA', icon: 'award',
    accent: '#d97706', soft: 'rgba(217,119,6,0.12)',
    tagline: 'Named CSM and a guaranteed response SLA.',
    price: () => ({ amount: 2000, display: '$2,000', unit: '/mo' }),
    includes: ['1-hour P1 response SLA', 'Named customer success manager', 'Quarterly business reviews'],
    value: 'The easiest add-on to sell',
    routes: [],
  },
];

const ALL_ADDONS = [...ADDON_PACKS, ...ALACARTE_ADDONS];
const CORE_BASE = 2400; // workspace base, incl. core compliance modules + base seats

const packById = (id) => ALL_ADDONS.find((p) => p.id === id) || null;

// ── Entitlement store ────────────────────────────────────────
const ADDON_STORE_KEY = 'k_addons';
const DEFAULT_ENTITLEMENTS = {
  intelligence: false, supplier: false,        // locked by default → shows upgrade states
  qe: true, platform: true, multiplant: true,  // active by default → app stays usable
  mobile: true, security: false, standards: false, support: false,
};

function getEntitlements() {
  try { return { ...DEFAULT_ENTITLEMENTS, ...JSON.parse(localStorage.getItem(ADDON_STORE_KEY) || '{}') }; }
  catch (e) { return { ...DEFAULT_ENTITLEMENTS }; }
}
function writeEntitlements(ent) {
  localStorage.setItem(ADDON_STORE_KEY, JSON.stringify(ent));
  window.dispatchEvent(new CustomEvent('k-addons-changed', { detail: ent }));
}
function setAddon(id, on) {
  const e = getEntitlements(); e[id] = on; writeEntitlements(e);
}
function applyBundle(map) {
  const e = getEntitlements();
  Object.keys(map).forEach((k) => { e[k] = map[k]; });
  writeEntitlements(e);
}

function useEntitlements() {
  const [ent, setEnt] = React.useState(getEntitlements);
  React.useEffect(() => {
    const h = () => setEnt(getEntitlements());
    window.addEventListener('k-addons-changed', h);
    window.addEventListener('storage', h);
    return () => { window.removeEventListener('k-addons-changed', h); window.removeEventListener('storage', h); };
  }, []);
  return ent;
}

// ── Route → pack gating ──────────────────────────────────────
const ROUTE_TO_PACK = {};
ALL_ADDONS.forEach((p) => (p.routes || []).forEach((r) => { ROUTE_TO_PACK[r] = p.id; }));
const packForRoute = (route) => ROUTE_TO_PACK[route] || null;
function isRouteLocked(route, ent) {
  ent = ent || getEntitlements();
  const pid = packForRoute(route);
  return pid ? !ent[pid] : false;
}

// ── Estimated monthly summary ────────────────────────────────
function billingSummary(ent) {
  const lines = [{ id: 'core', name: 'Core platform', amount: CORE_BASE, display: fmt(CORE_BASE), note: 'IATF 16949 obligations + base seats' }];
  let total = CORE_BASE; let hasVariable = false;
  ALL_ADDONS.forEach((p) => {
    if (!ent[p.id]) return;
    const pr = p.price(ORG_PROFILE);
    if (pr.amount == null) { hasVariable = true; lines.push({ id: p.id, name: p.name, amount: 0, display: pr.display, note: pr.note }); }
    else { total += pr.amount; if (pr.note && /credit|usage/i.test(pr.note)) hasVariable = true; lines.push({ id: p.id, name: p.name, amount: pr.amount, display: fmt(pr.amount), note: pr.note }); }
  });
  return { lines, total, hasVariable };
}

// ── UpgradeOverlay — frosted upsell fronting a locked module ──
function UpgradeOverlay({ packId, setRoute, children }) {
  const ent = useEntitlements(); // re-render on unlock
  const pack = packById(packId);
  if (!pack || ent[packId]) return children; // entitled → show the real module
  const pr = pack.price(ORG_PROFILE);

  return (
    <div style={{ position: 'relative', minHeight: 'calc(100vh - 56px)', overflow: 'hidden' }}>
      {/* Inert blurred preview of the real module */}
      <div aria-hidden="true" style={{ position: 'absolute', inset: 0, filter: 'blur(3.5px) saturate(0.92)', opacity: 0.5, pointerEvents: 'none', userSelect: 'none', overflow: 'hidden', transform: 'scale(1.02)' }}>
        {children}
      </div>
      <div style={{ position: 'absolute', inset: 0, background: 'color-mix(in srgb, var(--bg) 64%, transparent)' }} />

      {/* Upsell card */}
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '64px 24px 24px', overflowY: 'auto' }}>
        <div className="k-surface fade-in" style={{ maxWidth: 560, width: '100%', boxShadow: 'var(--shadow-xl)', overflow: 'hidden' }}>
          {/* Banner */}
          <div style={{ padding: '22px 24px', display: 'flex', gap: 14, alignItems: 'center', borderBottom: '1px solid var(--border)', background: `linear-gradient(135deg, ${pack.soft}, transparent)` }}>
            <div style={{ width: 48, height: 48, borderRadius: 'var(--r-lg)', background: pack.soft, color: pack.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Icon name={pack.icon} size={24} stroke={1.75} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="k-overline" style={{ color: pack.accent }}>Add-on · locked</span>
                <span className="k-chip" style={{ background: 'var(--bg-subtle)', color: 'var(--text-muted)', gap: 4 }}><Icon name="lock" size={11} stroke={2} /> Not in your plan</span>
              </div>
              <h2 style={{ margin: '3px 0 0', fontSize: 19, fontWeight: 700, letterSpacing: '-0.01em' }}>{pack.name}</h2>
            </div>
          </div>

          <div style={{ padding: '20px 24px' }}>
            <p style={{ margin: '0 0 16px', fontSize: 13.5, color: 'var(--text-muted)' }}>{pack.tagline}</p>

            {/* Price */}
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 18, paddingBottom: 18, borderBottom: '1px solid var(--border)', flexWrap: 'wrap' }}>
              <span style={{ fontSize: 30, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--text)' }}>{pr.display}</span>
              {pr.unit && <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{pr.unit}</span>}
              {pr.note && <span className="k-chip" style={{ background: pack.soft, color: pack.accent, marginLeft: 'auto' }}>{pr.note}</span>}
            </div>

            {/* Includes */}
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 10 }}>What unlocks</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 16px', marginBottom: 20 }}>
              {pack.includes.map((f) => (
                <div key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12.5, lineHeight: 1.4 }}>
                  <span style={{ color: pack.accent, marginTop: 1, flexShrink: 0 }}><Icon name="check" size={14} stroke={2.5} /></span>
                  <span>{f}</span>
                </div>
              ))}
            </div>

            {/* CTAs */}
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <button className="k-btn k-btn-primary" style={{ background: pack.accent, height: 38 }}
                onClick={() => setAddon(pack.id, true)}>
                <Icon name="plus" size={14} stroke={2.5} /> Add to plan
              </button>
              <button className="k-btn k-btn-ghost" style={{ height: 38 }} onClick={() => setAddon(pack.id, true)}>
                Start 14-day trial
              </button>
              <button className="k-btn k-btn-plain" style={{ height: 38, marginLeft: 'auto' }} onClick={() => setRoute && setRoute('pricing')}>
                Compare plans <Icon name="arrowRight" size={13} stroke={2} />
              </button>
            </div>
            <div style={{ marginTop: 14, fontSize: 11, color: 'var(--text-subtle)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Icon name="info" size={12} stroke={2} /> Billed to Precision Auto · changes take effect immediately
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, {
  KAENAL_ADDONS: { ORG_PROFILE, ADDON_PACKS, ALACARTE_ADDONS, ALL_ADDONS, CORE_BASE },
  ADDON_PACKS, ALACARTE_ADDONS, ALL_ADDONS, CORE_BASE, ORG_PROFILE,
  packById, getEntitlements, setAddon, applyBundle, useEntitlements,
  packForRoute, isRouteLocked, billingSummary, UpgradeOverlay, fmtMoney: fmt,
});
