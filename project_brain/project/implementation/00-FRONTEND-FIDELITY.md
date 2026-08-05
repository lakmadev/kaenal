# 00 — FRONTEND FIDELITY (READ BEFORE WRITING ANY UI)

> **This document overrides your instincts.** When building any screen, you do **not** get to design. The design already exists. Your job is to **reproduce** it, pixel-for-pixel and behavior-for-behavior, from the prototype. Inventing your own colors, fonts, spacing, components, layouts, or copy is a **defect**, the same as a failing test.

If you catch yourself deciding what a button should look like, what color a header is, how a table should be laid out, or what an empty state should say — **STOP.** The answer is already in the prototype. Go read it.

---

## 1. The single source of visual truth

The design is fully specified in these files. They are canonical. Nothing you generate from imagination outranks them.

| Source | What it defines |
|---|---|
| `styles/tokens.css` | **Every** color, font, radius, shadow, and the shared component classes (`.k-btn`, `.k-chip`, `.k-table`, `.k-input`, `.k-tabs`, `.k-surface`, `.k-overline`, `.kbd`, `.skeleton`, `.mono`). This is law. |
| `src/shell.jsx` | Sidebar, top bar, page header, profile menu — exact structure, spacing, copy. |
| `src/*.jsx` (one per module) | The exact list / detail / create layout, columns, tabs, chips, states, and microcopy for that module. |
| `Kaenal.html` | Mounts everything. **Open it in a browser and keep it open while you build.** |
| `implementation/04-WEB-APP.md` | Maps routes → screens → which `src/*.jsx` to copy from, plus the 6 required UI states. |

**Rule of precedence:** on visuals (color, type, spacing, layout, copy, interaction) the **prototype wins over everything**, including this folder's prose. On data, security, and architecture, the `implementation/` specs win. If a spec sentence and the prototype disagree about how something *looks*, follow the prototype.

---

## 2. Why you have been drifting (read this — it is the actual problem)

Two things caused the hallucinated UI so far:

1. **A stale token file.** An earlier copy of `implementation/reference/tokens.css` described a **blue / slate / Inter** theme. That was wrong and is now corrected to match `styles/tokens.css`. **The real design is a monochrome INK system on the Archivo typeface — there is no blue brand color.** If anything you have built is blue, indigo, or uses Inter/Roboto/system-ui as its visible font, it is wrong and must be redone.
2. **Building from memory instead of from the file.** You generated "a reasonable QMS UI" instead of reproducing *this* QMS UI. Every screen you build must begin by reading the matching `src/*.jsx`. No exceptions.

---

## 3. The design in one screen (so you can self-check instantly)

You are building an **ink-on-paper, engineering-grade, near-monochrome** enterprise tool. Flat, tight, dense, quiet. Think precision instrument, not consumer SaaS.

| Aspect | Correct (from `styles/tokens.css`) | You are hallucinating if you see… |
|---|---|---|
| Accent / primary | Ink `#18181b` (near-black), white text on it | Blue `#2563eb`, indigo, any saturated brand hue |
| Font (UI) | **Archivo** | Inter, Roboto, system-ui, Helvetica showing through |
| Font (codes/IDs/numbers) | **JetBrains Mono** via `.mono` | sans-serif IDs, non-tabular figures |
| Background | `#f4f4f5` zinc, surface `#ffffff` | Blue-tinted `#f6f8fb`, gradients |
| Sidebar | Always dark `#18181b`, white active text + 3px left accent bar | Light sidebar, blue active highlight |
| Radii | Tight: 3 / 4 / 5 / 7 / 9px | 8/12/16px pills, big rounded cards |
| Shadows | Flat hairline (`--shadow-xs/sm`), 1px borders do the work | Big soft drop shadows, floating cards, glassmorphism |
| Color usage | Semantic/risk colors ONLY for status chips & risk scale | Colored section headers, colored buttons, decorative color |
| Density | Dense — 12–13px body, 22px chips, 34px buttons | Airy spacing, 16px+ body, oversized controls |

Every color, radius, and shadow must resolve to a `var(--token)` from `styles/tokens.css`. **If you are typing a raw hex code into a component, you are almost certainly doing it wrong** — reference the variable instead.

---

## 4. The mandatory per-screen build protocol

For **every** screen, in this order. Do not skip step 1.

1. **Open the source.** Read the matching `src/*.jsx` end to end (see the map in §6). This is not optional context — it is the specification you are implementing.
2. **Lift the structure.** Reproduce the same DOM hierarchy, the same `PageHeader` (title + description + actions), the same tabs, the same table columns in the same order, the same chip logic, the same empty/loading copy.
3. **Reuse the classes, don't reinvent them.** Use `.k-btn` / `.k-btn-primary` / `.k-btn-ghost` / `.k-btn-plain`, `.k-input`, `.k-chip`, `.k-table`, `.k-tabs`/`.k-tab`, `.k-surface`, `.k-overline`, `.kbd`, `.mono`. Port these classes into your styling layer (Tailwind `@layer components` / a global stylesheet) **using the exact CSS in `styles/tokens.css`**. Do not author a second, parallel button/table/chip style.
4. **Match the copy exactly.** Titles, descriptions, empty-state sentences, button labels, column headers, tooltip text, chip labels — copy them verbatim from the prototype. Do not paraphrase, "improve," or invent placeholder text.
5. **Implement all 6 UI states** (04-WEB-APP §6): loading skeletons (patterns in `src/realtime-empty-skel.jsx`, class `.skeleton`), empty (icon + one line + CTA), error (inline retry + requestId), stale-write 409 dialog, offline banner, permission-hidden. A screen missing any of these is not done.
6. **Wire data through the typed hooks only** (`@kaenal/api-client`) — never `fetch` in a component, never business logic in the UI (that lives in `packages/core` / the API). But the **markup and styling must match the prototype** regardless of where data comes from.
7. **Compare side by side.** Put your rendered screen next to the prototype screen. They should be indistinguishable in layout, spacing, color, and type. If they aren't, fix yours — the prototype is right.

The prototype uses inline `style={{…}}` + the `.k-*` classes and static mock data. You are porting it to Next.js + Tailwind + real data hooks. **Translate the presentation faithfully; only the data layer changes.** Same pixels, real data.

---

## 5. Hard "do NOT" list

- ❌ Do **not** introduce any color not in `styles/tokens.css`. No new brand color. No blue accent. Ever.
- ❌ Do **not** swap the font. Archivo + JetBrains Mono only.
- ❌ Do **not** design new components, cards, headers, or layouts "to match the vibe." Reproduce the prototype's.
- ❌ Do **not** invent copy, labels, empty-state text, or microcopy. Lift it from the `src/*.jsx`.
- ❌ Do **not** change spacing, radii, or shadow scale to something "cleaner." The tight/flat system is intentional.
- ❌ Do **not** add screens, tabs, widgets, or fields that aren't in the prototype or `FEATURES.md`. Log it in `PROGRESS.md` "Known issues / TODO" as a question instead.
- ❌ Do **not** skip any of the 6 UI states because the prototype "only shows the happy path in a screenshot." The state patterns are in `src/realtime-empty-skel.jsx`.
- ❌ Do **not** retype hex values from prose. Import/port the `:root` block from `styles/tokens.css` and use `var(--…)`.

---

## 6. Screen → prototype-source map

Read the listed `src/*.jsx` before building each screen. (Full route list: 04-WEB-APP §4.)

| Screen(s) | Read this source |
|---|---|
| App shell: sidebar, top bar, page header, command palette, profile menu | `src/shell.jsx` (+ palette notes in 04 §3) |
| Dashboard (KPIs, trend, risk donut, activity, assignments, heatmap) | `src/dashboard.jsx` |
| Inspections list/detail, dynamic form renderer | `src/inspections.jsx` |
| Inspection template editor / schedule | `src/template-editor.jsx`, `src/schedule.jsx` |
| NCR list (table + kanban) / detail (5-Whys, fishbone) | `src/ncr.jsx` |
| 8D list / D1–D8 stepper / report / AI drafting | `src/eightd.jsx`, `src/eightd-agentic.jsx`, `src/eightd-pdf.jsx`, `src/eightd-templates.jsx` |
| Audits | `src/audits.jsx` |
| CAPA | `src/capa.jsx` |
| Documents | `src/documents.jsx` |
| Suppliers / scorecards / risk / PPAP / SCAR | `src/suppliers.jsx`, `src/suppliers-ppap.jsx`, `src/supplier-portal.jsx` |
| Reports / dashboards / builder | `src/reports.jsx`, `src/prebuilt-dashboards.jsx` |
| Notifications | `src/notifications.jsx`, `src/notifications-center.jsx` |
| Settings (grouped hub) | `src/settings.jsx`, `src/settings-extra.jsx` |
| Auth (sign-in, invite, reset) | `src/auth.jsx`, `src/auth-extra.jsx` |
| Pricing / add-ons / entitlement paywalls | `src/pricing.jsx`, `src/addons.jsx` |
| Loading skeletons + empty states (needed by every screen) | `src/realtime-empty-skel.jsx` |
| Shared primitives: `Icon`, `Avatar`, chips, buttons | `src/primitives.jsx` |
| Quality system modules (SPC, FMEA, MSA, risk, calibration, training, ECN, complaints) | `src/qms-modules.jsx`, `src/qms-risk-spc.jsx` |
| Predictive risk / knowledge graph / quality engine | `src/predictive.jsx`, `src/graph-explorer.jsx`, `src/pqe.jsx` |
| Platform: AI governance, dev platform, multi-tenancy | `src/ai-governance.jsx`, `src/dev-platform.jsx`, `src/multi-tenancy.jsx` |

`src/primitives.jsx` defines the shared `Icon` set and `Avatar` — use the same icon names and sizing so screens stay consistent. Do not substitute a different icon library's glyphs where the prototype names a specific icon.

---

## 7. Remediation — fixing what's already built

~10% is already built (Auth, Sidebar, Inspections) with a hallucinated design. Before adding new screens, **audit and correct the existing ones** so the whole app is consistent:

1. **Port `styles/tokens.css` first.** Get the real `:root` + `[data-theme="dark"]` variables and the `.k-*` component classes into the shared styling layer. Everything downstream depends on this. If your Tailwind theme currently has blue as primary, replace it with the ink tokens now.
2. **Re-skin the Sidebar** against `src/shell.jsx`: dark `#18181b`, the exact `NAV` groups/labels/badges/dividers, white active text with a 3px left accent bar, the "All systems operational" footer pill. No light sidebar, no blue highlight.
3. **Re-skin the Top bar** against `src/shell.jsx`: 56px, breadcrumbs, the 400px search button opening ⌘K, quick-create, live toggle, AI button, notifications bell with count, theme toggle, the full profile menu (identity header + quick facts grid + menu + workspace switcher + sign out).
4. **Re-skin Auth** against `src/auth.jsx` — same layout, copy, and ink styling.
5. **Rebuild Inspections** against `src/inspections.jsx` — same `PageHeader`, table columns, view toggle, chips, and the 6 states.
6. Only then continue with new modules, each via the §4 protocol.

Record the remediation as its own checklist section in `PROGRESS.md` so the re-skin is tracked, not silently skipped.

---

## 8. Self-review checklist (run before you mark any screen done)

- [ ] I read the matching `src/*.jsx` before writing this screen.
- [ ] Zero blue. Accent is ink `#18181b`. All colors resolve to `var(--token)` from `styles/tokens.css`.
- [ ] Font is Archivo (UI) + JetBrains Mono (codes/IDs/numbers). No Inter/Roboto/system-ui showing.
- [ ] Radii 3–9px; flat hairline shadows; 1px borders. No big rounded floating cards.
- [ ] I reused `.k-btn/.k-chip/.k-table/.k-input/.k-tabs/.k-surface` — I did not invent parallel styles.
- [ ] Layout, column order, tabs, and chip logic match the prototype.
- [ ] Copy (titles, descriptions, labels, empty states) is verbatim from the prototype — nothing invented.
- [ ] All 6 UI states implemented.
- [ ] Placed side by side with the prototype, the two are visually indistinguishable.
- [ ] No new screens/fields/scope beyond the prototype + `FEATURES.md` (open questions logged, not built).

If any box is unchecked, the screen is **not done** — the same standard as a failing test.
