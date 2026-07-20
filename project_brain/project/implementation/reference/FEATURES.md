# KAENAL — Complete Feature Inventory

**Kaenal** is a multi-tenant **Quality & Safety Management System (QMS)** built for manufacturing (automotive / IATF 16949 context). This document is an exhaustive inventory of every feature, screen, module, and capability present in the project.

- **Deliverable:** `Kaenal.html` — a single-page React (UMD + Babel) hi-fi interactive prototype
- **Spec source:** `uploads/KAENAL_UI_SPEC.md` (target stack: Next.js 14 + TypeScript + Tailwind + shadcn/ui + Zustand + React Query + Recharts; mobile: Flutter)
- **Persona:** Manjunath Kumar — Quality Manager, "Precision Auto" tenant, Pune-1 plant
- **Supporting file:** `Trust Components.html`

---

## 1. Global Shell, Navigation & Cross-App Features

### 1.1 Application Shell
- Collapsible **sidebar** (260px expanded ↔ 72px collapsed), state persisted to localStorage
- Sticky **top bar** (56px) with breadcrumbs, search, quick-create, AI, notifications, theme, profile
- Scrollable main content area; full route map driven by client-side state router (`k_route` in localStorage)
- **Auth gate** — entire app sits behind a sign-in screen (`k_signed_in` flag)

### 1.2 Sidebar Navigation (grouped)
- **Core:** Dashboard · Inspections · Non-Conformities · 8D Reports · Audits · CAPA · Documents · Knowledge graph · Predictive risk
- **Supply chain:** Suppliers · PPAP submissions · SCAR & chargebacks
- **Quality system:** Training & competency · Calibration · Customer complaints · Engineering changes (ECN) · Risk register · FMEA workbench · SPC charts · MSA / Gauge R&R
- **Platform:** AI Governance · Developer Platform · Multi-tenancy
- Reports · Notifications
- **Design patterns:** Empty states · Loading skeletons
- **External:** Supplier Portal · PDF Templates (admin-only)
- Expandable sub-menus with persistence; **badge counts** on Inspections (2), NCR (3, red/danger), CAPA (2, warn)
- "All systems operational" live status pill at sidebar footer

### 1.3 Top Bar
- Sidebar toggle (hamburger)
- **Auto-generated breadcrumbs** (clickable, up to 3+ levels) driven by a full `BREADCRUMBS` route map
- **Global search / Command palette** trigger (⌘K) styled as a 400px search field
- **Quick-Create** button (create Inspection / NCR / 8D / Document)
- **Live mode** toggle (real-time event simulation)
- **AI Assistant** button (prominence configurable: quiet / on / front)
- **Notifications** bell with unread badge (5)
- **Theme** toggle (light/dark)
- **Profile menu** (rich dropdown — see 1.7)

### 1.4 Command Palette (⌘K)
- Full-screen overlay search
- Categories: **Navigate**, **Actions** (create entities), **Recent**, live **search results** with type icons
- Keyboard-driven

### 1.5 Keyboard Shortcuts
- `⌘K` / `Ctrl+K` — command palette
- `⌘I` — create Inspection
- `⌘D` — start 8D
- `⇧⌘Q` — sign out (shown in profile menu)

### 1.6 Quick Create Wizard
- Multi-type create wizard: **Inspection · NCR · 8D · Document**
- On completion: success toast + routes to the new entity's detail page

### 1.7 Profile / Account Menu
- Identity header (name, email, role pill, plant)
- Quick facts grid: Tenant, Plant, Open items (14 NCRs · 3 CAPAs), MFA status
- Menu: Your profile · Account settings · My assignments · Keyboard shortcuts
- **Workspace switcher** (Precision Auto / Sandbox) with active indicator
- Sign out

### 1.8 Real-time / Live Mode
- Live toast provider streaming simulated events (NCR/8D/audit/CAPA/inspection/document)
- Click-through from toast to the relevant entity detail
- Live mode toggle button in top bar

### 1.9 Theming & Display
- **Light / Dark mode** (full CSS-variable token system in `styles/tokens.css`)
- **Accent colors:** Blue (default), Indigo, Teal, Orange
- **Density:** dense / comfortable / spacious (also compact)
- Persisted to localStorage and broadcast to host edit-mode

### 1.10 Tweaks Panel (in-design controls)
Toggleable panel exposing live design tweaks:
- Theme (light/dark)
- Density
- Sidebar (expanded/collapsed)
- Accent color
- AI prominence (quiet/on/front)
- Supplier scorecard weighting (PPM / OTD / OQE / SCAR sliders)

### 1.11 AI Chat Drawer
- Right-side slide-in assistant (context-aware of current page/entity)
- Suggested capabilities: root-cause analysis, document summaries, compliance Q&A, report generation
- Response actions: Copy · Pin to entity · Insert into field · Generate PDF
- Context selector to pin a specific NCR/8D/Inspection

### 1.12 Toasts, Upload Modal & Misc
- Global toast notifications
- Global **Upload modal** (multi-file, OCR + AI summary completion message)

---

## 2. Authentication Module
- **Sign-in screen** (split-screen brand panel + form), gates the whole app
- Email + password with show/hide toggle, "Remember me", "Forgot password?"
- SSO buttons (Microsoft / Google)
- States: default · loading · error · **account locked** (after failed attempts)
- **Forgot password** flow
- **Reset password** (with strength indicator + requirements)
- **Reset success** screen
- **Accept invitation** flow (join organization)
- Roles model: admin · manager · auditor · inspector · viewer

---

## 3. Dashboard
- **KPI cards** (4): Open Inspections, Open NCRs, Active 8Ds, Overdue Items — each with value, trend %, sparkline
- **NCR trend** line chart (Created / Resolved / Open, time-range filter)
- **Risk distribution** donut (Critical/High/Medium/Low) with click-to-filter
- **Recent activity** feed (timeline of system events)
- **My Assignments** tabbed panel (NCRs / 8Ds / Inspections) with empty "all caught up" state
- **Risk heatmap** (Areas × Categories, color-graded, period toggle)
- **Compliance status** stacked bars per standard
- **Drag-and-drop widget customization** (reorder/hide widgets, drop-target highlighting)

---

## 4. Inspection Module
- **Inspection list** — sortable/filterable table; List & Grid views; bulk actions; pagination; export; empty state
  - Filters: status, type, inspector, date range, risk, location, template
  - Columns: ID, Title, Template, Inspector, Status, Risk, Findings, Due, Completed, actions menu
- **Inspection detail** — two-column (content + metadata sidebar)
  - Tabs: **Overview** (rendered checklist/form, scoring gauge, signature, summary) · **Findings** (cards, create-NCR per finding, bulk-create) · **Media** (gallery + lightbox, GPS, ZIP download) · **History** (audit trail)
  - Metadata sidebar: status dropdown, inspector, template, location, scheduled/started/completed, duration, risk rating, score with progress, findings, linked NCRs, tags
- **Create/Edit inspection** — multi-step wizard (Setup → Perform → Review & Submit) with auto-save, section nav, signature capture
- **Dynamic form engine** — renders checklists from JSON schema; field types: pass/fail, yes/no, score, text, textarea, number, select, multi-select, date, datetime, photo, signature, section header, info text; conditional logic, scoring, finding triggers
- **Template manager** — template list with version/usage; **template editor** (drag-drop sections/items, per-item property panel, preview mode, versioning, import/export JSON, duplicate)
- **Schedule view** — calendar (month/week/day), color-coded by status, recurring inspection setup, filters
- **Mobile App** — dedicated mobile inspector experience (iOS device frame) for performing inspections in the field

---

## 5. Non-Conformity (NCR) Module
- **NCR list** + **My Assignments** + **Overdue/At-risk** views
  - Table columns incl. Source, Priority, Owner, Status, Risk, Due, Age, Linked 8D
  - **Kanban view** with drag-between-columns status changes
- **NCR detail** — two-column with tabs:
  - **Details** (description, source link, evidence, impact assessment)
  - **Investigation** — Root cause (with AI suggestion), **5 Whys** interactive chain, **Fishbone/Ishikawa** builder (6 M's), contributing factors
  - **Actions** — Containment / Corrective / Preventive action lists, each with owner, due date, status, verification, evidence
  - **History** — full audit trail, threaded comments, escalations, linkages
  - Metadata sidebar + **SLA indicator** (on-track / at-risk / breached)
- **Create NCR** — source selection (Inspection / Manual / Customer complaint), priority-based auto-due-dates, evidence upload, notify rules, tags
- **Workflow & escalation** — Draft→Open→Assigned→In Progress→Resolved→Verified→Closed (+ Escalated / Reopened), configurable auto-escalation rules

---

## 6. 8D Problem Solving Module
- **8D list** (Active / Completed) with D1–D8 mini progress stepper, team lead, status, dates
- **8D detail** — full stepped workflow with step navigator:
  - **D1** Form the Team (lead, members, champion, formation date)
  - **D2** Describe the Problem (statement, **IS / IS-NOT** table, quantification, customer impact)
  - **D3** Interim Containment Actions (+ customer notification, effectiveness check)
  - **D4** Root Cause Analysis — 5 Whys, Fishbone, Fault tree, free-form, **AI root-cause suggestions** with confidence scores + accept/dismiss, escape point, verification
  - **D5** Permanent Corrective Actions (+ decision matrix scoring, verification plan)
  - **D6** Implement & Validate (task checklist, before/after data, customer validation)
  - **D7** Prevent Recurrence (systemic changes, training, control-plan/FMEA updates, horizontal deployment, poka-yoke)
  - **D8** Close & Congratulate (recognition, lessons learned, final metrics/cost of quality, sign-offs)
- **Agentic AI 8D copilot** (`eightd-agentic`): AI draft controls per field, AI card headers, **provenance strip**, **AI copilot rail**, **Generate Pack** modal — AI-authored field drafting with source/confidence attribution
- **8D templates** — template list + editor (industry-specific prompts, default roles, SLA per step)
- **8D PDF report** — auto-generated branded comprehensive report (all D1–D8, diagrams, signatures, VDA/CQI style)

---

## 7. Audit Module
- **Audit list** + **My Audits** + **Schedule** views
- Audit types and standards (e.g., IATF 16949:2016 re-certification)
- **Audit detail** — scope, lead auditor + team, auditees, phase/progress, planned dates, **findings breakdown** (major/minor/opportunity), linked CAPAs, next activity, audit checklist
- Create-NCR-from-finding linkage

---

## 8. CAPA Module
- **CAPA list** + **My CAPAs** + **At-risk/Overdue** views
- **CAPA detail** with phased workflow (`CAPA_PHASES`)
- Links to NCRs and 8Ds; CAPA trend data

---

## 9. Document & Compliance Module
- **Document library** — folder/category sidebar (Certificates, Policies, Procedures, Work Instructions, Forms, Training Records, Audit Reports, Supplier Documents), card & list views, toolbar (Upload/New Folder/Search/Filter)
- **Document detail** — viewer, metadata, **expiry tracking** (color by days remaining), **AI summary**, version history, related items, access log, comments
- **Upload flow** — drag-and-drop multi-file, per-file progress, post-upload metadata form, **OCR** + **AI summarize** actions
- **Compliance dashboard** — overall score, per-standard scorecards (ISO 9001, IATF 16949, OSHA, ISO 14001), gap analysis matrix, expiring-certificates widget

---

## 10. Intelligence Features

### 10.1 Knowledge Graph Explorer
- Interactive **layered knowledge graph** linking Inspections → Findings/Audits → Non-conformities → 8D cases → Documents → Corrective actions / Suppliers
- 7 node types, color-coded with icons; real seed core + synthetic mass for realistic scale
- **Bounded query engine** (open-doc / open-CAPA filters), seeds (e.g., Weld porosity NC, 8D-2026-0015, Precision Stamping GmbH, IATF re-cert audit)
- Pan/zoom geometry, edge routing; click any node to jump to its entity detail

### 10.2 Predictive Risk
- Predictive risk scoring across suppliers / NCRs
- Links into supplier and NCR detail views

---

## 11. Supply Chain Module

### 11.1 Suppliers
- **Supplier list** with risk tiers, scorecards, mini-sparklines, PPAP status badges
- **Supplier scorecards** — weighted scoring (PPM / OTD / OQE / SCAR weights, tweakable)
- **Supplier risk matrix**
- **Supplier detail** — links to NCRs, 8Ds, audits, CAPAs; supplier logo, risk tier

### 11.2 PPAP Submissions
- **PPAP submissions list** + **PPAP detail** (Production Part Approval Process)
- Status tracking per submission

### 11.3 SCAR & Chargebacks
- **SCAR workflow** (Supplier Corrective Action Request) with chargebacks, links to NCRs/8Ds

---

## 12. Quality System Modules
- **Training & competency** — training matrix
- **Calibration** management (gauge/equipment calibration tracking)
- **Customer complaints** — complaint handling, links to NCR
- **Engineering changes (ECN)** workbench
- **Risk register**
- **FMEA workbench** (Failure Mode & Effects Analysis)
- **SPC charts** (Statistical Process Control)
- **MSA / Gauge R&R** study (Measurement System Analysis)

---

## 13. Reporting & BI Module
- **Reports hub** (My Reports)
- **Pre-built dashboards** — Quality Overview, Inspection Performance, Compliance (charts: line, bar, donut, radar, gauge, heatmap, KPI)
- **Report builder** — drag-drop widget placement, data sources, filters, save/share, scheduled email delivery
- Exports (PDF / CSV / XLS), export history, scheduled recurring exports

---

## 14. Notification System
- **Notifications panel** (top-bar dropdown, last items, "view all")
- **Notifications center** (full page) — filters (All/Unread/by type), bulk actions, open-item routing
- **Notification preferences** — per-channel matrix (in-app / email / push / SMS), digest mode
- Real-time toasts, optional sound, browser tab unread count

---

## 15. Admin & Settings Module
Settings is a grouped, sectioned hub:

- **Personal:** Profile · Notifications · Security & devices · Preferences (theme, density, accent, AI tone, landing page, doc-open behavior, keyboard hints)
- **Workspace:** Organization · Members & teams (412) · Roles & permissions · Sites & areas (7)
- **Security & Identity:** **Trust Center** · **Single Sign-On (SSO)** (SAML/Entra) · **SCIM provisioning** · **Network policy** (IP allowlists, geo-fencing, VPN) · **Session policies** · **Service accounts** · **Delegated admin**
- **Compliance & Privacy:** **DSAR** (data subject requests) · **Legal hold** · **DLP policies** · **Customer-managed keys (BYOK)**
- **AI:** AI Governance
- **Multi-tenancy:** Org hierarchy · White-label branding · Cross-tenant analytics · Clone/migrate/export · Cost centers & chargeback
- **Process:** SLA configuration · Categories · Validation rules · Email templates (12) · PDF templates (8) · Inspection templates · 8D templates
- **Developer:** Developer Platform · Integrations (12) · API & webhooks
- **Operations:** System status page · Backup & restore · Data warehouse sync · Bulk import
- **Adoption:** Onboarding wizard · Product tours · Knowledge base · NPS & satisfaction · Adoption analytics · Release notes
- **System:** Audit log · Billing & plan

---

## 16. Platform Modules

### 16.1 AI Governance Hub
Tabs: **Data controls** · **Models & routing** · **PII redaction** · **AI audit trail** · **Cost & budgets** · **Evals & red-team**

### 16.2 Developer Platform Hub
Tabs: **Overview** · **API reference** · **Webhooks** · **OAuth apps** · **Rate limits & logs** · **Sandbox** · **SDKs & CLI**

### 16.3 Multi-tenancy Hub
Tabs: **Org hierarchy** · **White-label branding** · **Cross-tenant analytics** · **Clone / migrate / export** · **Cost centers & chargeback**

### 16.4 Identity & Security (advanced)
SSO config · SCIM provisioning · Network policy · Session policies · Service accounts · Delegated administration · Trust Center

### 16.5 Compliance (advanced)
DSAR workflow · Legal hold · DLP policies · BYOK / customer-managed keys

### 16.6 Operations
System status page · Backup & restore · Data warehouse sync · **Bulk import wizard** (Source → Map fields → Validate → Dry run → Commit) · Data validation rules

### 16.7 Adoption & Growth
Onboarding wizard · Product tours · Knowledge base · NPS dashboard · Adoption analytics · Release notes / changelog

---

## 17. External / Standalone Experiences
- **Supplier Portal** — external-facing supplier experience (separate portal)
- **PDF Template Designer** — admin tool to design branded PDF report templates
- **Mobile Inspector** — iOS-framed mobile inspection app
- **Trust Center** — public-style compliance posture page (also `Trust Components.html`)

---

## 18. Design-Pattern Galleries
- **Empty states gallery** — reusable empty-state patterns with CTAs
- **Loading skeletons gallery** — skeleton/shimmer loading patterns

---

## 19. Shared Component / Primitive Library
- **Primitives:** Icon (Lucide-style inline SVGs), Avatar, StatusBadge, PriorityBadge, RiskBadge, EntityLink, EmptyState, Segmented control + status/priority/risk style maps
- **Trust components:** AISuggestion / AISuggestionInline, SignatureBadge, AuditRow, AuditTrail, ConfidenceMeter, SourceChip, confidence bands
- **Layout:** Sidebar, TopBar, PageHeader, SettingsPage, Card, Row, Toggle
- **Data display:** tables, Kanban board, timelines, metadata panels, progress steppers, score gauges, mini-sparklines
- **Device frames:** iOS frame & Android frame starters (status bars, nav bars, keyboards, list rows)
- Reusable AI controls: copilot rail, provenance strip, draft controls, generate-pack modal

---

## 20. Data & Domain Model
Mock datasets powering the prototype:
- **Users** (with role/plant), **NCRs**, **Inspections** + templates + responses, **Findings**, **8D** cases/list, **Audits** + checklist + findings + frequency, **CAPAs** + trend
- **Suppliers**, **PPAP submissions**, **SCARs**
- Analytics seeds: NCR trend, risk distribution, activity feed, heatmap, CAPA trend
- Entity ID conventions: `INS-`, `NCR-`, `8D-`, `AUD-`, `CAPA-`, `SUP-`, `PPAP-`, `D-` (documents)
- Core data models specified (Tenant, User, Inspection, NCR/NonConformity, Action, Finding, etc.) with full status/priority/risk enums

---

## 21. Cross-Cutting Capabilities
- Multi-tenant architecture with workspace switching
- Full audit trails / history timelines on every entity
- Linkage graph across Inspections ↔ Findings ↔ NCRs ↔ 8Ds ↔ CAPAs ↔ Audits ↔ Documents ↔ Suppliers
- AI woven throughout (suggestions, summaries, drafting, governance, provenance/confidence)
- Persistence of route, selected entities, sign-in, live mode, and settings via localStorage
- Accessibility & i18n intent (en/de/es locales), responsive breakpoints, defined animation guidelines

---

*This inventory reflects the implemented `Kaenal.html` prototype together with the full `KAENAL_UI_SPEC.md`. Items marked from the spec (e.g., some Phase-4 SSO/ERP integrations) may be represented as UI mockups rather than functional backends.*
