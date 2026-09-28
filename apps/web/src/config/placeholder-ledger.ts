/**
 * Placeholder ledger (Sprint 01, S1-8): every "coming soon" surface still in the
 * web app, mapped to the ROADMAP sprint (docs/sprints/ROADMAP.md) that replaces it.
 *
 * This list may only SHRINK. `test/placeholder-ledger.test.ts` enumerates the real
 * placeholders (planned modules, unbuilt visible settings entries, pages rendering
 * `ModulePlaceholder`, hidden deferred settings entries) and fails when one exists
 * that is not listed here (a new dead end) or when an entry listed here has been
 * built or removed (delete its line). Key format: `<kind>:<id>`.
 */
export const PLACEHOLDER_LEDGER: Readonly<Record<string, number>> = {
  // Planned-module catch-all placeholders (config/planned-modules.ts)
  "planned:risk": 4,
  "planned:msa": 4,
  "planned:calibration": 5,
  "planned:training": 5,
  "planned:complaints": 6,
  "planned:ecn": 6,
  "planned:developer": 9,
  "planned:multi-tenancy": 9,
  "planned:ai-governance": 10,
  "planned:pricing": 10,
  "planned:pdf-templates": 10,

  // Static pages that render <ModulePlaceholder> (app/(app)/*/page.tsx)
  "page:graph": 3,

  // Settings entries visible in the rail but not built (settings-nav.ts, no `built`)
  "settings:organization": 7,
  "settings:roles": 7,
  "settings:sites": 7,
  "settings:sla": 7,
  "settings:categories": 7,
  "settings:email-templates": 7,
  "settings:insp-templates": 7,
  "settings:8d-templates": 7,
  "settings:trust": 8,
  "settings:network": 8,
  "settings:service-accounts": 8,
  "settings:delegated": 8,
  "settings:dsar": 8,
  "settings:org-hierarchy": 9,
  "settings:lifecycle": 9,
  "settings:dev-platform": 9,
  "settings:api": 9,
  "settings:ai-governance": 10,
  "settings:pdf-templates": 10,
  "settings:billing": 10,
  "settings:onboarding": 11,
  "settings:tours": 11,
  "settings:knowledge": 11,
  "settings:nps": 11,
  "settings:adoption": 11,
  "settings:release-notes": 11,

  // Settings entries hidden (deferred external infrastructure, Q5; see config/excluded.md)
  "hidden:sso": 13,
  "hidden:scim": 13,
  "hidden:byok": 13,
  "hidden:status-page": 13,
  "hidden:backup-restore": 13,
  "hidden:warehouse": 13,
};
