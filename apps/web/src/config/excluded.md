# Excluded navigation items

Features intentionally left **out of the app shell** — not shown in the sidebar,
not routed as placeholders, and not counted in role nav-visibility. Kept here so
the exclusion is a visible, reviewable decision rather than a silent gap against
the `shell.jsx` design (design rule #9).

To re-include one, restore its entry in `navigation.ts` (and, if it should render
a "coming soon" page, add it back to `planned-modules.ts`).

| Item                                                                                                                                                                                               | Was                                      | Removed from                                                                                                                                                                               |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Quick-Log** (`/quicklog`)                                                                                                                                                                        | Top-level nav item                       | `navigation.ts` (nav item), `planned-modules.ts` (placeholder route), `rbac.ts` (inspector nav set)                                                                                        |
| **Mobile App** (`/mobile`)                                                                                                                                                                         | Child under **Inspections**              | `navigation.ts` (child item), `planned-modules.ts` (placeholder route), `rbac.ts` (`ALWAYS_ROUTES`)                                                                                        |
| **Quality Engine** (`/pqe`)                                                                                                                                                                        | Top-level nav item + planned placeholder | `navigation.ts`, `planned-modules.ts` (no spec exists; add a spec to re-include)                                                                                                           |
| **Single Sign-On, SCIM provisioning, Customer-managed keys, System status, Backup & restore, Data warehouse sync** (`/settings/sso`, `scim`, `byok`, `status-page`, `backup-restore`, `warehouse`) | Settings rail "coming soon" entries      | `settings-nav.ts` (`hidden: true`; the slug resolves to Profile). Deferred to the last roadmap wave (external infrastructure). To re-include: remove `hidden` once the real backend exists |

Removed on request. `/quicklog`, `/mobile` and `/pqe` now 404 (they are no longer planned
placeholders); the Expo/mobile-first surfaces live in the mobile app, not the web shell.
