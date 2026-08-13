// Kaenal — Role-Based Access Control (RBAC)
// Mirrors the addons.jsx entitlement pattern: a persisted store (localStorage),
// a live-re-render React hook, a role catalog (nav visibility + capabilities),
// and pure helpers used to gate navigation and per-screen actions.
//
// PORTING NOTE (for the real backend):
//   - `currentRole()` here reads localStorage. In production this comes from the
//     authenticated session (GET /me → { role }). Swap the getter, keep the API.
//   - `can(capability)` is the SINGLE source of truth for action gating. Server
//     must re-check the same capability on every mutating endpoint — the client
//     gate is UX only, never security.
//   - `visibleNav(role)` filters the sidebar. The server should also 403 routes
//     a role cannot see, so deep-links can't bypass the UI.

// ── Capability vocabulary ────────────────────────────────────
// Coarse, action-level capabilities checked across modules.
//   view.*      read a module
//   create.*    raise/create an entity
//   edit.*      modify existing entities
//   verify      close/verify/approve NCR·8D·CAPA·audit findings
//   configure   edit templates, SLAs, categories, validation rules
//   admin       workspace settings, roles, sites, members
//   platform    AI governance, dev platform, multi-tenancy, billing

// ── Role catalog ─────────────────────────────────────────────
// `nav` = 'all' or an explicit set of visible root nav ids.
// `caps` = Set of capabilities granted. Admin gets '*' (everything).
const PLATFORM_ROOTS = ['ai-governance', 'dev-platform', 'multi-tenancy', 'pricing', 'pdf-designer', 'empty-states', 'skeletons'];

const INSPECTOR_NAV = ['dashboard', 'quicklog', 'inspections', 'ncr', 'documents', 'notifications'];
const AUDITOR_NAV = ['dashboard', 'inspections', 'ncr', '8d', 'audits', 'capa', 'documents', 'graph', 'predictive', 'reports', 'notifications'];
const VIEWER_NAV = ['dashboard', 'documents', 'reports', 'notifications'];

const ROLE_CATALOG = {
  admin: {
    id: 'admin', label: 'Workspace Admin', short: 'Admin', color: '#dc2626',
    desc: 'Full access — every module, settings, and platform tool.',
    nav: 'all', caps: '*', settingsFull: true,
  },
  manager: {
    id: 'manager', label: 'Quality Manager', short: 'Manager', color: '#2563eb',
    desc: 'Owns NCRs, 8D, audits, CAPA and document approvals. No platform/admin tools.',
    nav: 'all-minus-platform',
    caps: new Set(['view.all', 'create.all', 'edit.all', 'verify', 'configure']),
    settingsFull: false,
  },
  auditor: {
    id: 'auditor', label: 'Auditor', short: 'Auditor', color: '#9333ea',
    desc: 'Runs audits, raises findings & NCRs. Read access to related records.',
    nav: AUDITOR_NAV,
    caps: new Set(['view.audits', 'view.ncr', 'view.8d', 'view.capa', 'view.inspections', 'view.documents', 'create.audit-finding', 'create.ncr', 'edit.own']),
    settingsFull: false,
  },
  inspector: {
    id: 'inspector', label: 'Inspector', short: 'Inspector', color: '#0891b2',
    desc: 'Field user — performs inspections, logs findings, raises NCRs.',
    nav: INSPECTOR_NAV,
    caps: new Set(['view.mywork', 'view.inspections', 'view.ncr', 'view.documents', 'create.inspection', 'create.ncr', 'edit.own']),
    settingsFull: false,
  },
  viewer: {
    id: 'viewer', label: 'Viewer', short: 'Viewer', color: '#475569',
    desc: 'Read-only — dashboards, documents and reports. No create or edit.',
    nav: VIEWER_NAV,
    caps: new Set(['view.dashboard', 'view.documents', 'view.reports']),
    settingsFull: false,
  },
};
const ROLE_ORDER = ['admin', 'manager', 'auditor', 'inspector', 'viewer'];
const roleById = (id) => ROLE_CATALOG[id] || ROLE_CATALOG.admin;

// ── Role store ───────────────────────────────────────────────
const ROLE_STORE_KEY = 'k_role';
const DEFAULT_ROLE = 'admin';

function currentRole() {
  try { return ROLE_CATALOG[localStorage.getItem(ROLE_STORE_KEY)] ? localStorage.getItem(ROLE_STORE_KEY) : DEFAULT_ROLE; }
  catch (e) { return DEFAULT_ROLE; }
}
function setRole(id) {
  if (!ROLE_CATALOG[id]) return;
  localStorage.setItem(ROLE_STORE_KEY, id);
  window.dispatchEvent(new CustomEvent('k-role-changed', { detail: id }));
}
function useRole() {
  const [role, setR] = React.useState(currentRole);
  React.useEffect(() => {
    const h = () => setR(currentRole());
    window.addEventListener('k-role-changed', h);
    window.addEventListener('storage', h);
    return () => { window.removeEventListener('k-role-changed', h); window.removeEventListener('storage', h); };
  }, []);
  return role;
}

// ── Capability check ─────────────────────────────────────────
// can('create.ncr') → boolean for the current (or passed) role.
// Supports wildcards: admin caps '*' grants all; 'create.all' grants any 'create.*'.
function can(cap, roleId) {
  const r = roleById(roleId || currentRole());
  if (r.caps === '*') return true;
  if (r.caps.has(cap)) return true;
  const [verb] = cap.split('.');
  if (r.caps.has(verb + '.all')) return true;
  return false;
}

// ── Nav visibility ───────────────────────────────────────────
function isNavRootVisible(id, roleId) {
  const r = roleById(roleId || currentRole());
  if (r.nav === 'all') return true;
  if (r.nav === 'all-minus-platform') return !PLATFORM_ROOTS.includes(id);
  return r.nav.includes(id);
}

// Filters a NAV array for a role: drops hidden roots, adminOnly items for
// non-admins, and any divider whose entire following group became empty.
function visibleNav(navArr, roleId) {
  const r = roleById(roleId || currentRole());
  const isAdmin = r.id === 'admin';
  const kept = navArr.filter((item) => {
    if (item.divider) return true;               // decided in the second pass
    if (item.adminOnly && !isAdmin) return false;
    return isNavRootVisible(item.id, r.id);
  });
  // Second pass: remove dividers with no real item before the next divider.
  return kept.filter((item, i) => {
    if (!item.divider) return true;
    for (let j = i + 1; j < kept.length; j++) {
      if (kept[j].divider) break;
      return true; // found a visible item in this group
    }
    return false;
  });
}

Object.assign(window, {
  KAENAL_RBAC: { ROLE_CATALOG, ROLE_ORDER, PLATFORM_ROOTS },
  ROLE_CATALOG, ROLE_ORDER, roleById,
  currentRole, setRole, useRole, can, isNavRootVisible, visibleNav,
});
