# KAENAL — Complete UI Implementation Specification

> **Purpose**: This document is the single source of truth for building Kaenal's complete frontend. It covers every screen, component, interaction, state, API contract, and edge case. Feed this to Claude Code to build the full application.

> **Tech Stack**: Next.js 14 (App Router) + TypeScript + Tailwind CSS + shadcn/ui + Zustand + React Query + Recharts

> **Mobile**: Flutter (Riverpod + GoRouter + Hive/SQLite + Dio)

---

## TABLE OF CONTENTS

1. [Design System & Tokens](#1-design-system--tokens)
2. [Application Shell & Navigation](#2-application-shell--navigation)
3. [Authentication Module](#3-authentication-module)
4. [Dashboard Module](#4-dashboard-module)
5. [Inspection Module](#5-inspection-module)
6. [Non-Conformity (NCR) Module](#6-non-conformity-ncr-module)
7. [8D Problem Solving Module](#7-8d-problem-solving-module)
8. [Document & Compliance Module](#8-document--compliance-module)
9. [AI/NLP Features](#9-ainlp-features)
10. [Notification System](#10-notification-system)
11. [Reporting & BI Module](#11-reporting--bi-module)
12. [Admin & Settings Module](#12-admin--settings-module)
13. [Shared Components Library](#13-shared-components-library)
14. [API Contracts & Data Models](#14-api-contracts--data-models)
15. [Offline & Sync (Flutter)](#15-offline--sync-flutter)
16. [Accessibility & i18n](#16-accessibility--i18n)
17. [File & Folder Structure](#17-file--folder-structure)

---

## 1. DESIGN SYSTEM & TOKENS

### 1.1 Color Palette

```typescript
// tailwind.config.ts — extend theme.colors
const colors = {
  // Primary brand
  primary: {
    50:  '#eff6ff',
    100: '#dbeafe',
    200: '#bfdbfe',
    300: '#93c5fd',
    400: '#60a5fa',
    500: '#3b82f6',  // Main primary
    600: '#2563eb',
    700: '#1d4ed8',
    800: '#1e40af',
    900: '#1e3a5f',
    950: '#0f1d35',  // Sidebar/dark backgrounds
  },
  // Semantic
  success:  { 50: '#f0fdf4', 100: '#dcfce7', 500: '#22c55e', 600: '#16a34a', 700: '#15803d' },
  warning:  { 50: '#fffbeb', 100: '#fef3c7', 500: '#f59e0b', 600: '#d97706', 700: '#b45309' },
  danger:   { 50: '#fef2f2', 100: '#fee2e2', 500: '#ef4444', 600: '#dc2626', 700: '#b91c1c' },
  info:     { 50: '#eff6ff', 100: '#dbeafe', 500: '#3b82f6', 600: '#2563eb', 700: '#1d4ed8' },
  // Neutrals
  slate: {
    50: '#f8fafc', 100: '#f1f5f9', 200: '#e2e8f0', 300: '#cbd5e1',
    400: '#94a3b8', 500: '#64748b', 600: '#475569', 700: '#334155',
    800: '#1e293b', 900: '#0f172a',
  },
  // Risk levels
  risk: {
    critical: '#dc2626',
    high:     '#ea580c',
    medium:   '#f59e0b',
    low:      '#22c55e',
    info:     '#6366f1',
  },
  // Status
  status: {
    open:        '#3b82f6',
    inProgress:  '#f59e0b',
    resolved:    '#22c55e',
    closed:      '#64748b',
    overdue:     '#dc2626',
    draft:       '#a78bfa',
    escalated:   '#ec4899',
  }
};
```

### 1.2 Typography

```typescript
// Font: Inter (sans-serif) — load from Google Fonts
// Monospace: JetBrains Mono (for IDs, codes)

const typography = {
  'display-lg': { size: '30px', lineHeight: '36px', weight: 700, tracking: '-0.025em' },
  'display':    { size: '24px', lineHeight: '32px', weight: 700, tracking: '-0.02em'  },
  'heading':    { size: '20px', lineHeight: '28px', weight: 600, tracking: '-0.01em'  },
  'subheading': { size: '16px', lineHeight: '24px', weight: 600 },
  'body':       { size: '14px', lineHeight: '20px', weight: 400 },
  'body-sm':    { size: '13px', lineHeight: '18px', weight: 400 },
  'caption':    { size: '12px', lineHeight: '16px', weight: 400 },
  'overline':   { size: '11px', lineHeight: '16px', weight: 600, tracking: '0.05em', transform: 'uppercase' },
};
```

### 1.3 Spacing & Layout

```
Base unit: 4px
Spacing scale: 0, 1(4px), 2(8px), 3(12px), 4(16px), 5(20px), 6(24px), 8(32px), 10(40px), 12(48px), 16(64px)
Border radius: sm(4px), md(6px), lg(8px), xl(12px), 2xl(16px), full(9999px)
Sidebar width: 260px (expanded), 72px (collapsed)
Top bar height: 56px
Page max-width: 1440px (content), 1200px (forms)
Card padding: 24px
```

### 1.4 Shadows & Elevation

```css
--shadow-xs:  0 1px 2px rgba(0,0,0,0.05);
--shadow-sm:  0 1px 3px rgba(0,0,0,0.1), 0 1px 2px rgba(0,0,0,0.06);
--shadow-md:  0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -2px rgba(0,0,0,0.1);
--shadow-lg:  0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -4px rgba(0,0,0,0.1);
--shadow-xl:  0 20px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1);
```

### 1.5 Icon System

Use **Lucide React** (consistent, MIT licensed). Icon size: 16px (inline), 20px (buttons), 24px (nav), 32px (empty states), 48px (feature icons).

### 1.6 Dark Mode

Support light and dark modes via `next-themes`. All colors must use CSS custom properties. Dark mode maps:
- Background: slate-900 → slate-50
- Surface: slate-800 → white
- Border: slate-700 → slate-200
- Text primary: slate-100 → slate-900
- Text secondary: slate-400 → slate-500

---

## 2. APPLICATION SHELL & NAVIGATION

### 2.1 Layout Structure

```
┌─────────────────────────────────────────────────────┐
│ Top Bar (56px)                                      │
├──────┬──────────────────────────────────────────────┤
│      │                                              │
│ Side │         Main Content Area                    │
│ bar  │         (scrollable)                         │
│      │                                              │
│ 260px│                                              │
│      │                                              │
└──────┴──────────────────────────────────────────────┘
```

### 2.2 Sidebar Navigation

**Behavior**: Collapsible (260px ↔ 72px). Persists collapse state in localStorage. On mobile (<1024px), sidebar becomes an overlay drawer.

**Navigation Items** (top to bottom):

```
[Logo] KAENAL                     ← Brand mark + wordmark (hide wordmark when collapsed)
─────────────────
📊  Dashboard                     ← /dashboard
📋  Inspections                   ← /inspections
  ├─ All Inspections              ← /inspections
  ├─ Templates                    ← /inspections/templates
  └─ Schedule                     ← /inspections/schedule
⚠️  Non-Conformities              ← /ncr
  ├─ All NCRs                     ← /ncr
  ├─ My Assignments               ← /ncr/assigned
  └─ Overdue                      ← /ncr/overdue
🧠  8D Reports                    ← /8d
  ├─ Active                       ← /8d?status=active
  ├─ Completed                    ← /8d?status=completed
  └─ Templates                    ← /8d/templates
📄  Documents                     ← /documents
  ├─ All Documents                ← /documents
  ├─ Certificates                 ← /documents/certificates
  └─ Compliance                   ← /documents/compliance
📊  Reports                       ← /reports
  ├─ Dashboards                   ← /reports/dashboards
  └─ Exports                      ← /reports/exports
🔔  Notifications                 ← /notifications
─────────────────
⚙️  Settings                      ← /settings
  ├─ Organization                 ← /settings/organization
  ├─ Users & Roles                ← /settings/users
  ├─ Templates                    ← /settings/templates
  ├─ Integrations                 ← /settings/integrations
  └─ Billing                      ← /settings/billing
```

**Active state**: Left border accent (4px primary-500), background primary-50 (light) / primary-950 (dark).

**Badge counts**: Show unread/overdue counts on NCR (red badge), Notifications (blue badge).

### 2.3 Top Bar

```
┌─[☰ Toggle]──[Breadcrumbs: Dashboard > Inspections > INS-2024-0042]──────────[🔍 Search][🤖 AI][🔔 3][Avatar ▾]─┐
```

**Components**:
- **Toggle**: Hamburger icon to collapse/expand sidebar
- **Breadcrumbs**: Auto-generated from route. Clickable segments. Max 3 levels visible.
- **Global Search** (⌘K): Opens command palette modal. Searches across inspections, NCRs, 8Ds, documents. Shows recent searches, categorized results.
- **AI Assistant** (🤖): Opens AI chat drawer from right side (see Section 9)
- **Notifications** (🔔): Badge with unread count. Click opens notification dropdown (last 10). "View all" links to /notifications.
- **User Avatar**: Dropdown with: Profile, Preferences, Switch Tenant (if multi-tenant), Sign Out.

### 2.4 Command Palette (⌘K / Ctrl+K)

Full-screen overlay with search input. Categories:
- **Navigate**: Go to Inspections, Go to NCRs, Go to 8D...
- **Actions**: Create Inspection, Create NCR, Start 8D...
- **Recent**: Last 5 viewed items
- **Search Results**: Live search across all entities with type icon + ID + title

Implementation: Use `cmdk` package (https://cmdk.paco.me/).

---

## 3. AUTHENTICATION MODULE

### 3.1 Screens

#### 3.1.1 Login Page (`/login`)

**Layout**: Split screen — left side brand panel (primary-950 bg, logo, tagline, feature highlights with icons), right side form.

**Form fields**:
- Email (text input, email validation)
- Password (password input with show/hide toggle)
- "Remember me" checkbox
- "Forgot password?" link
- "Sign in" primary button (full width)
- Divider: "Or continue with"
- SSO buttons: "Sign in with Microsoft" / "Sign in with Google" (Phase 4)
- Footer: "Don't have an account? Contact your administrator"

**States**: Default, loading (spinner in button), error (inline red text below field), locked (after 5 failed attempts — show "Account locked. Contact administrator.").

**Validation**:
- Email: Required, valid email format
- Password: Required, min 8 characters
- Show field-level errors on blur, form-level on submit

#### 3.1.2 Forgot Password (`/forgot-password`)

- Email input + "Send reset link" button
- Success: "Check your email for a reset link"
- Back to login link

#### 3.1.3 Reset Password (`/reset-password?token=xxx`)

- New password + Confirm password
- Password strength indicator (weak/fair/strong/very strong)
- Requirements: 8+ chars, 1 uppercase, 1 lowercase, 1 number, 1 special
- Success: "Password reset. Redirecting to login..."

#### 3.1.4 Accept Invitation (`/invite?token=xxx`)

- Pre-filled email (read-only)
- Set password + Confirm
- Full name input
- "Join [Organization Name]" button

### 3.2 Auth State Management

```typescript
// Zustand auth store
interface AuthState {
  user: User | null;
  tenant: Tenant | null;
  token: string | null;
  permissions: Permission[];
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  refreshToken: () => Promise<void>;
  switchTenant: (tenantId: string) => void;
  hasPermission: (permission: string) => boolean;
  hasRole: (role: Role) => boolean;
}

// Roles
type Role = 'admin' | 'manager' | 'auditor' | 'inspector' | 'viewer';

// Route protection middleware
// /login, /forgot-password, /reset-password — public
// All other routes — require authentication
// /settings/users, /settings/organization — require admin role
// /reports/exports — require manager or admin role
```

---

## 4. DASHBOARD MODULE

### 4.1 Main Dashboard (`/dashboard`)

**Layout**: Responsive grid. 4 columns on xl, 2 on md, 1 on sm.

#### Row 1 — KPI Cards (4 cards)

Each card: icon (left), metric value (large), label (small), trend indicator (↑↓ with %), sparkline (last 30 days).

| Card | Icon | Metric | Color |
|------|------|--------|-------|
| Open Inspections | ClipboardCheck | Count of status=open | primary-500 |
| Open NCRs | AlertTriangle | Count of status!=closed | warning-500 |
| Active 8Ds | Brain | Count of status=active | info-500 |
| Overdue Items | Clock | NCRs + Inspections past due date | danger-500 |

#### Row 2 — Charts (2 columns)

**Left: NCR Trend (Line Chart)**
- X-axis: Last 12 months
- Y-axis: NCR count
- Lines: Created (blue), Resolved (green), Open (amber)
- Tooltip: Date, counts
- Filter: Time range dropdown (3m, 6m, 12m, YTD)

**Right: Risk Distribution (Donut Chart)**
- Segments: Critical (red), High (orange), Medium (amber), Low (green)
- Center: Total count
- Legend below with counts
- Click segment → filtered NCR list

#### Row 3 — Activity & Assignments (2 columns)

**Left: Recent Activity Feed**
- Timeline list (last 20 items)
- Each item: icon + "User performed action on Entity" + relative time
- Types: inspection_completed, ncr_created, ncr_assigned, 8d_step_completed, document_uploaded, comment_added
- "View all" link to activity log

**Right: My Assignments**
- Tab bar: NCRs | 8Ds | Inspections
- List of items assigned to current user
- Each item: ID (monospace), title, due date, priority badge, status badge
- Click → navigate to item detail
- Empty state: checkmark icon + "You're all caught up!"

#### Row 4 — Heatmap & Compliance

**Left: Risk Heatmap**
- Matrix: X-axis = Areas/Departments, Y-axis = Categories
- Cell color: risk level gradient
- Click cell → filtered NCR list
- Toggle: Last 30/60/90 days

**Right: Compliance Status**
- Stacked horizontal bars per compliance standard (ISO 9001, IATF 16949, etc.)
- Segments: Compliant (green), Partial (amber), Non-compliant (red), Not assessed (gray)
- Click → compliance detail view

### 4.2 Dashboard Customization

Users can:
- Rearrange widgets via drag-and-drop (react-grid-layout)
- Hide/show widgets
- Save layout per user (persisted to backend)
- Reset to default layout

---

## 5. INSPECTION MODULE

### 5.1 Inspection List (`/inspections`)

**Layout**: Full-width table with toolbar above.

**Toolbar**:
```
[+ New Inspection]  [Filters ▾]  [Search: 🔍 ___________]  [View: ☰ List | ▦ Grid]  [⬇ Export]
```

**Filters panel** (collapsible):
- Status: multi-select chips (Draft, Scheduled, In Progress, Completed, Cancelled)
- Type: multi-select (Safety, Quality, Process Audit, Incoming Goods, Final, Custom)
- Inspector: user picker
- Date range: date range picker
- Risk rating: slider (1-5) or multi-select (Low, Medium, High, Critical)
- Location/Area: dropdown
- Template: dropdown
- "Clear all" + "Apply" buttons
- Active filter count shown on Filters button badge

**Table columns**:

| Column | Width | Sortable | Content |
|--------|-------|----------|---------|
| ID | 120px | ✓ | INS-2024-XXXX (monospace, clickable link) |
| Title | flex | ✓ | Inspection title |
| Template | 150px | ✓ | Template name badge |
| Inspector | 150px | ✓ | Avatar + name |
| Status | 110px | ✓ | Status badge (colored dot + text) |
| Risk | 80px | ✓ | Risk level badge |
| Findings | 80px | ✓ | Count with icon (⚠️ 3) |
| Due Date | 110px | ✓ | Date, red if overdue |
| Completed | 110px | ✓ | Date or "—" |
| Actions | 60px | ✗ | ⋯ menu (View, Edit, Duplicate, Delete) |

**Pagination**: 25/50/100 per page. Previous/Next + page numbers.

**Empty state**: Illustration + "No inspections yet" + "Create your first inspection" button.

**Bulk actions**: Select rows via checkbox → toolbar shows: "X selected" + [Assign] [Export] [Delete].

### 5.2 Inspection Detail (`/inspections/[id]`)

**Layout**: Two-column. Left (65%): inspection content. Right (35%): metadata sidebar.

**Left Column**:

**Header bar**:
```
← Back to Inspections    INS-2024-0042    [Status Badge]    [Edit] [⋯ More]
```

More menu: Duplicate, Print PDF, Export, Create NCR from findings, Delete.

**Tab bar**: Overview | Findings | Media | History

##### Tab: Overview

- **Info section**: Template name, type, description
- **Checklist/Form**: Rendered dynamic form (see 5.4)
  - Each item shows: sequence number, question/check text, response (pass/fail/NA/score), notes field, media attachment thumbnails
  - Completed items: green check or red X
  - Scoring: if scored template, show score per section and total score with gauge
- **Signature section**: Inspector signature (drawn or typed) + date/time
- **Summary**: Auto-generated text summary of results

##### Tab: Findings (count badge on tab)

- List of findings generated from failed/flagged items
- Each finding card:
  ```
  ┌─────────────────────────────────────────────┐
  │ ⚠️ Finding #1              [Critical] badge  │
  │ Item: "Fire extinguisher inspection date"    │
  │ Observation: "Expired 3 months ago"          │
  │ 📷 2 photos attached                         │
  │ NCR: NCR-2024-0089 (linked) or [Create NCR] │
  │ Corrective action: ___________________       │
  └─────────────────────────────────────────────┘
  ```
- "Create NCR" button on each finding (if not yet linked)
- Bulk: "Create NCRs for all critical findings"

##### Tab: Media

- Grid of all photos/videos/audio from this inspection
- Lightbox viewer on click
- Download individual or all as ZIP
- Each shows: thumbnail, item reference, timestamp, GPS coords (if available)

##### Tab: History

- Audit trail timeline
- Events: created, started, item_answered, paused, resumed, completed, finding_created, ncr_linked, edited, exported

**Right Sidebar — Metadata**:

```
┌─────────────────────────┐
│ Status                  │
│ [In Progress ▾]         │ ← Dropdown to change status
│                         │
│ Inspector               │
│ 👤 Manjunath Kumar      │
│                         │
│ Template                │
│ 📋 Process Audit v2.1   │
│                         │
│ Location                │
│ 📍 Plant A — Line 3     │
│                         │
│ Scheduled               │
│ 📅 2024-10-15           │
│                         │
│ Started                 │
│ 📅 2024-10-15 09:32     │
│                         │
│ Completed               │
│ 📅 2024-10-15 11:47     │
│                         │
│ Duration                │
│ ⏱️ 2h 15m               │
│                         │
│ Risk Rating             │
│ [★★★☆☆ Medium]          │
│                         │
│ Score                   │
│ 78/100 (78%)            │
│ [█████████░] progress   │
│                         │
│ Findings                │
│ 3 total (1 critical)    │
│                         │
│ Linked NCRs             │
│ NCR-2024-0089           │
│ NCR-2024-0091           │
│                         │
│ Tags                    │
│ [safety] [monthly] [+]  │
└─────────────────────────┘
```

### 5.3 Create/Edit Inspection (`/inspections/new`, `/inspections/[id]/edit`)

**Step 1 — Setup**:
- Title (auto-generated from template + date, editable)
- Template selector (card grid of available templates with preview)
- Inspector assignment (user picker, defaults to current user)
- Location/Area (dropdown or type-ahead)
- Scheduled date (date picker)
- Priority (Low/Medium/High)
- Notes (textarea)

**Step 2 — Perform Inspection** (or save as draft):
- Renders the selected template's dynamic form (see 5.4)
- Progress bar at top: "12 of 35 items completed"
- Auto-save every 30 seconds (show "Saved" indicator)
- Section navigation sidebar for long forms

**Step 3 — Review & Submit**:
- Summary of all responses
- Flagged/failed items highlighted
- Add overall observations (textarea)
- Risk rating (manual override or AI suggestion)
- Signature capture (draw pad or type name)
- [Save as Draft] [Complete Inspection]

### 5.4 Dynamic Form Builder & Renderer

This is the core UX component. The form engine renders inspection checklists from a JSON schema.

**Supported field types**:

| Type | Render | Data |
|------|--------|------|
| `pass_fail` | Two buttons: ✅ Pass / ❌ Fail / ➖ N/A | enum: pass, fail, na |
| `yes_no` | Two buttons: Yes / No | boolean |
| `score` | Slider or number input (1-5 or 1-10) | number |
| `text` | Single line text input | string |
| `textarea` | Multi-line text area | string |
| `number` | Number input with optional unit | number |
| `select` | Dropdown with predefined options | string |
| `multi_select` | Checkboxes or multi-select chips | string[] |
| `date` | Date picker | ISO date string |
| `datetime` | Date + time picker | ISO datetime |
| `photo` | Camera capture + gallery picker | file reference |
| `signature` | Signature draw pad | base64 image |
| `section_header` | Visual separator with title | — (display only) |
| `info_text` | Read-only informational text block | — (display only) |

**Form schema structure**:
```typescript
interface InspectionTemplate {
  id: string;
  name: string;
  version: string;
  industry: string;
  sections: InspectionSection[];
  scoring: {
    enabled: boolean;
    maxScore: number;
    passingScore: number;
    method: 'sum' | 'weighted_average' | 'percentage';
  };
}

interface InspectionSection {
  id: string;
  title: string;
  description?: string;
  weight?: number; // for weighted scoring
  items: InspectionItem[];
}

interface InspectionItem {
  id: string;
  type: FieldType;
  label: string;
  description?: string;
  required: boolean;
  options?: string[];          // for select/multi_select
  validation?: ValidationRule;
  triggerFinding: boolean;     // auto-create finding on fail
  findingSeverity?: RiskLevel; // default severity for auto-findings
  score?: { pass: number; fail: number; na: number }; // scoring values
  conditionalOn?: { itemId: string; value: any };      // show only if condition met
  mediaRequired?: boolean;     // require photo on fail
}
```

### 5.5 Template Manager (`/inspections/templates`)

**List view**: Cards showing template name, version, industry, item count, last modified, usage count.

**Template editor**: 
- Drag-and-drop section/item reordering
- Add/remove sections and items
- Configure each item's properties in a right-side panel
- Preview mode: renders form as inspector would see it
- Version history with diff view
- Import/Export as JSON
- Duplicate template

### 5.6 Schedule View (`/inspections/schedule`)

**Calendar view** (monthly/weekly/daily toggle):
- Color-coded by status: scheduled (blue), completed (green), overdue (red), draft (gray)
- Click date → create inspection for that date
- Click event → open inspection detail
- Recurring inspection setup: daily/weekly/monthly/quarterly/annually + end date
- Filter by template, inspector, location

---

## 6. NON-CONFORMITY (NCR) MODULE

### 6.1 NCR List (`/ncr`)

Same table pattern as inspections. Additional columns:

| Column | Content |
|--------|---------|
| ID | NCR-2024-XXXX |
| Title | NCR description |
| Source | Badge: Inspection / Manual / 8D / Customer Complaint |
| Priority | Critical / Major / Minor (color-coded badge) |
| Owner | Avatar + name |
| Status | Open / Assigned / In Progress / Resolved / Verified / Closed |
| Risk Level | Critical / High / Medium / Low |
| Due Date | Date, red if overdue |
| Age | "5 days" or "2 months" |
| Linked 8D | 8D-XXXX link or "—" |

**Kanban view toggle**: Columns = Status values. Drag cards between columns to change status. Each card shows: ID, title, owner avatar, priority badge, due date, age.

### 6.2 NCR Detail (`/ncr/[id]`)

**Layout**: Same two-column pattern as inspection detail.

**Left column tabs**: Details | Investigation | Actions | History

##### Tab: Details

```
┌─────────────────────────────────────────────────┐
│ NCR-2024-0089                    [Critical] 🔴   │
│ "Fire extinguisher expired in Assembly Area B"   │
├─────────────────────────────────────────────────┤
│ Description                                      │
│ During routine safety inspection on 2024-10-15,  │
│ fire extinguisher #FE-042 was found with         │
│ inspection date expired by 3 months...           │
├─────────────────────────────────────────────────┤
│ Source                                           │
│ 📋 INS-2024-0042 — Process Audit Line 3         │
│    Finding #1 (linked)                           │
├─────────────────────────────────────────────────┤
│ Evidence                                         │
│ [📷 Photo 1] [📷 Photo 2] [📎 Report.pdf]       │
├─────────────────────────────────────────────────┤
│ Impact Assessment                                │
│ Category: Safety                                 │
│ Affected area: Assembly Area B                   │
│ Personnel at risk: 12 operators                  │
│ Regulatory impact: OSHA compliance gap           │
└─────────────────────────────────────────────────┘
```

##### Tab: Investigation

- Root cause (text area with AI suggestion button — see Section 9)
- 5 Whys tool (interactive chain: Why 1 → Why 2 → ... → Root cause)
- Fishbone/Ishikawa diagram builder (interactive, categories: Man, Machine, Material, Method, Measurement, Environment)
- Contributing factors (multi-select tags)

##### Tab: Actions

**Containment Actions** (immediate):
```
┌─────────────────────────────────────────────────┐
│ ✅ Replace expired extinguisher     Due: Oct 16  │
│    Owner: Safety Team               ✓ Completed  │
├─────────────────────────────────────────────────┤
│ ⬜ Audit all extinguishers          Due: Oct 20  │
│    Owner: Facility Manager          In Progress   │
├─────────────────────────────────────────────────┤
│ [+ Add containment action]                       │
└─────────────────────────────────────────────────┘
```

**Corrective Actions** (permanent fix):
- Same structure as containment
- Effectiveness verification date + method
- Evidence of completion (file upload)

**Preventive Actions** (prevent recurrence):
- Same structure
- Link to process/procedure changes

Each action: title, owner (user picker), due date, status, notes, attachments, verification.

##### Tab: History

Full audit trail timeline with:
- Status changes (with who changed and from→to)
- Comments (threaded)
- File uploads
- Assignments
- Escalations
- 8D linkages

**Right sidebar**: Same pattern — status dropdown, owner, priority, risk, dates, linked items, tags, SLA indicator (green/amber/red based on target resolution time).

### 6.3 Create NCR (`/ncr/new`)

**Source selection**:
- From Inspection (inspection picker → finding picker — pre-fills data)
- Manual entry
- From Customer Complaint (complaint details form)

**Form**:
- Title (required)
- Description (rich text editor)
- Source (auto or manual)
- Priority: Critical / Major / Minor (radio with descriptions)
- Category: Safety / Quality / Environmental / Process / Regulatory (dropdown)
- Affected area/location (dropdown)
- Owner assignment (user picker)
- Due date (date picker, auto-calculated based on priority: Critical=2 days, Major=7 days, Minor=30 days)
- Evidence upload (drag & drop, multi-file)
- Notify (user multi-select, defaults based on priority rules)
- Tags (tag input)
- [Create as Draft] [Create & Assign]

### 6.4 NCR Workflow & Escalation

**Status flow**:
```
Draft → Open → Assigned → In Progress → Resolved → Verified → Closed
                    ↓                        ↓
              Escalated (if SLA breach)  Reopened (if verification fails)
```

**Auto-escalation rules** (configurable per tenant):
- Critical NCR not assigned within 4 hours → escalate to Manager
- NCR not started within 24 hours of assignment → escalate to Manager
- NCR overdue → escalate to Director
- Each escalation: email + push notification + status change

---

## 7. 8D PROBLEM SOLVING MODULE

### 7.1 8D List (`/8d`)

Table with columns: ID (8D-2024-XXXX), Title, NCR Link, Current Step (D1-D8 progress bar), Team Lead, Status (Active/Completed/Cancelled), Started, Last Updated, Target Date.

**Progress visualization**: Mini horizontal stepper showing D1-D8 with filled/empty circles. Current step highlighted.

### 7.2 8D Detail (`/8d/[id]`)

**Layout**: Full-width stepped workflow.

**Top header**:
```
8D-2024-0015    "Recurring weld defects on Part #A-7742"    [Active]
NCR: NCR-2024-0089    Team Lead: Manjunath Kumar
Progress: [●●●●○○○○] D4 of D8    Started: Oct 16    Target: Nov 30
```

**Step navigator** (horizontal or vertical stepper):
```
D1 Team ✓ → D2 Problem ✓ → D3 Containment ✓ → D4 Root Cause ● → D5 Corrective → D6 Implement → D7 Prevent → D8 Close
```

Clicking any completed step opens it in review mode. Current step is editable. Future steps are grayed out but visible.

#### D1 — Form the Team

```
Team Lead: [User Picker]
Team Members:
┌──────────────────────────────────────────────┐
│ 👤 Name              Role           Actions  │
│ Manjunath Kumar       Team Lead      —       │
│ Anna Schmidt          Quality Eng.   [✕]     │
│ Thomas Müller         Production     [✕]     │
│ [+ Add Member]                               │
└──────────────────────────────────────────────┘
Champion/Sponsor: [User Picker]
Team formation date: [Date]
[Mark D1 Complete]
```

#### D2 — Describe the Problem

- Problem statement (rich text, required)
- IS / IS NOT analysis (structured table):

```
┌──────────┬──────────────────┬──────────────────┐
│          │ IS               │ IS NOT           │
├──────────┼──────────────────┼──────────────────┤
│ What     │                  │                  │
│ Where    │                  │                  │
│ When     │                  │                  │
│ How much │                  │                  │
│ Who      │                  │                  │
└──────────┴──────────────────┴──────────────────┘
```

- Quantification: defect rate, affected quantity, cost impact (number inputs)
- Customer impact statement (textarea)
- Attachments: photos, data, reports
- [Mark D2 Complete]

#### D3 — Interim Containment Actions

- Actions list (same pattern as NCR containment actions)
- Each action: description, owner, due date, status, verification
- Customer notification: checkbox + template email
- Effectiveness check: did containment work? (yes/no + evidence)
- [Mark D3 Complete]

#### D4 — Root Cause Analysis

This is the AI-powered step.

- **Analysis tools** (tabs within D4):
  - **5 Whys**: Interactive chain builder. Type why → answer → next why. AI can auto-suggest the next "Why" based on the answer.
  - **Fishbone Diagram**: Interactive Ishikawa diagram. 6 categories (Man, Machine, Material, Method, Measurement, Environment). Click category → add causes. Drag to reorder.
  - **Fault Tree**: Top-down tree builder. AND/OR gates. Visual tree rendering.
  - **Free-form Analysis**: Rich text editor for custom analysis.

- **AI Root Cause Suggestions** (prominent button):
  ```
  [🤖 Get AI Suggestions]
  
  ┌─────────────────────────────────────────────────┐
  │ AI Analysis                           [Refresh]  │
  │                                                  │
  │ Based on the problem description, IS/IS NOT      │
  │ analysis, and similar NCRs in your history,      │
  │ likely root causes are:                          │
  │                                                  │
  │ 1. Welding parameter drift (85% confidence)      │
  │    → Wire feed speed decreased 12% over 2 weeks  │
  │    → Similar to 8D-2024-0008                     │
  │                                                  │
  │ 2. Material batch variation (62% confidence)     │
  │    → New supplier batch introduced Oct 10         │
  │                                                  │
  │ 3. Fixture wear (41% confidence)                 │
  │    → Fixture #J-12 last calibrated 6 months ago  │
  │                                                  │
  │ [Accept #1] [Accept #2] [Accept #3] [Dismiss]    │
  └─────────────────────────────────────────────────┘
  ```

- Selected root cause (text, required to complete D4)
- Escape point: where should the defect have been caught? (text)
- Verification of root cause: how was it confirmed? (text + attachments)
- [Mark D4 Complete]

#### D5 — Choose Permanent Corrective Actions

- List of proposed corrective actions
- Each: description, owner, target date, risk assessment
- Decision matrix (if multiple options):
  - Criteria: effectiveness, feasibility, cost, time, risk
  - Score each option 1-5 per criterion
  - Auto-calculate weighted total
- Verification plan: how will we verify the fix works?
- [Mark D5 Complete]

#### D6 — Implement & Validate

- Implementation plan (checklist of tasks from D5)
- Each task: status tracking, evidence upload, completion date
- Validation results: data before/after comparison
- Statistical evidence (upload charts/data)
- Customer validation: if applicable, customer approval
- [Mark D6 Complete]

#### D7 — Prevent Recurrence

- Systemic changes (list):
  - Process/procedure updates (link to document module)
  - Training requirements (who, what, by when)
  - Control plan updates
  - FMEA updates
  - Poka-yoke / error-proofing measures
- Horizontal deployment: apply learnings to similar processes/products (checklist)
- Updated documents (links to Document module)
- [Mark D7 Complete]

#### D8 — Close & Congratulate

- Team recognition (text area — learnings and acknowledgments)
- Lessons learned summary (structured):
  - What went well
  - What could be improved
  - Key takeaways
- Final metrics:
  - Total 8D duration
  - Cost of quality (containment + corrective + prevention costs)
  - Customer satisfaction outcome
- Effectiveness review date (date picker — future check)
- Sign-off: Team Lead signature + Sponsor signature
- [Generate Final PDF Report] [Close 8D]

### 7.3 8D PDF Report

Auto-generated comprehensive PDF containing all D1-D8 data, photos, diagrams, timeline, and signatures. Branded with tenant logo. Export format matches industry standards (VDA, CQI expectations).

### 7.4 8D Templates (`/8d/templates`)

Pre-configured templates with:
- Industry-specific D2 prompts
- Pre-populated D4 analysis tool selection
- Default team roles
- SLA targets per step
- Custom fields per step

---

## 8. DOCUMENT & COMPLIANCE MODULE

### 8.1 Document Library (`/documents`)

**Layout**: File explorer with left sidebar for folders/categories and main area for document grid/list.

**Left sidebar — Categories**:
```
📂 All Documents
├── 📂 Certificates
│   ├── ISO 9001
│   ├── ISO 14001
│   ├── IATF 16949
│   └── OSHA
├── 📂 Policies
├── 📂 Procedures
├── 📂 Work Instructions
├── 📂 Forms & Templates
├── 📂 Training Records
├── 📂 Audit Reports
└── 📂 Supplier Documents
```

**Main area — Document cards or list**:

Card view:
```
┌─────────────────────────────┐
│ [PDF icon]                  │
│ ISO 9001:2015 Certificate   │
│ Cert #: QMS-2024-001        │
│ Expires: 2026-03-15         │
│ Status: ✅ Valid             │
│ Tags: [iso] [quality]       │
│ Uploaded: Oct 5, 2024       │
│ [View] [Download] [⋯]      │
└─────────────────────────────┘
```

**Toolbar**: [Upload] [New Folder] [Search] [Filter: Type, Status, Expiry] [View: Grid/List]

### 8.2 Document Detail (`/documents/[id]`)

- Document viewer (PDF viewer embedded or download link)
- Metadata panel: filename, type, category, version, uploaded by, upload date, file size, tags
- Expiry tracking: expiry date, days remaining (with color: green >90d, amber 30-90d, red <30d)
- AI summary section (see Section 9)
- Version history: list of all versions with diff capability for text documents
- Related items: linked NCRs, inspections, 8Ds
- Access log: who viewed/downloaded when
- Comments thread

### 8.3 Upload Flow

- Drag & drop zone (supports multiple files)
- Upload progress with individual file progress bars
- Post-upload form per file:
  - Category (dropdown)
  - Document type (Certificate, Policy, Procedure, etc.)
  - Expiry date (if applicable)
  - Tags
  - [Run OCR] button for scanned documents
  - [AI Summarize] button

### 8.4 Compliance Dashboard (`/documents/compliance`)

**Compliance Scorecard**:
```
┌─────────────────────────────────────────────┐
│ Overall Compliance Score: 84/100            │
│ [████████████████████░░░░] 84%              │
├─────────────────────────────────────────────┤
│ ISO 9001    [███████████████████░] 95%  ✅   │
│ IATF 16949  [████████████████░░░░] 80%  ⚠️   │
│ OSHA        [███████████░░░░░░░░░] 62%  ❌   │
│ ISO 14001   [█████████████████░░░] 88%  ✅   │
└─────────────────────────────────────────────┘
```

- Drill-down per standard: list of requirements with status (met/partial/not met/not assessed)
- Gap analysis: visual matrix of requirements vs evidence
- Due diligence scorecard for suppliers (configurable criteria, weighted scoring)
- Expiring certificates widget: sorted by days until expiry

---

## 9. AI/NLP FEATURES

### 9.1 AI Chat Drawer

**Trigger**: 🤖 button in top bar, or contextual AI buttons throughout the app.

**Layout**: Right-side drawer (400px wide), slides in.

```
┌────────────────────────────────┐
│ 🤖 Kaenal AI        [✕ Close] │
├────────────────────────────────┤
│                                │
│ How can I help? I can:         │
│ • Analyze root causes          │
│ • Summarize documents          │
│ • Answer compliance questions  │
│ • Generate reports             │
│                                │
│ ┌──────────────────────────┐   │
│ │ User: What are common    │   │
│ │ root causes for weld     │   │
│ │ defects in automotive?   │   │
│ └──────────────────────────┘   │
│ ┌──────────────────────────┐   │
│ │ AI: Based on industry    │   │
│ │ data and your NCR        │   │
│ │ history, common causes   │   │
│ │ include:                 │   │
│ │ 1. Parameter drift...    │   │
│ │ 2. Shielding gas...      │   │
│ │ 3. ...                   │   │
│ │ [📋 Copy] [📌 Pin to 8D] │   │
│ └──────────────────────────┘   │
│                                │
│ [Context: 8D-2024-0015]  [▾]  │
│ [💬 Type a message...    ➤]   │
└────────────────────────────────┘
```

**Context awareness**: AI drawer knows what page/entity the user is viewing. Context selector lets user pin a specific NCR, 8D, or inspection as context.

**Actions on AI responses**:
- Copy to clipboard
- Pin to current entity (adds as a note/comment)
- Insert into current form field
- Generate PDF from response

### 9.2 Contextual AI Features

**In NCR Investigation tab**:
- "🤖 Suggest root cause" → analyzes NCR description + similar past NCRs
- "🤖 Draft containment plan" → proposes immediate actions

**In 8D D4**:
- "🤖 Analyze with 5 Whys" → walks through the chain
- "🤖 Suggest based on history" → finds similar resolved 8Ds

**In Document viewer**:
- "🤖 Summarize this document" → generates structured summary
- "🤖 Ask a question about this document" → RAG-based Q&A
- "🤖 Check compliance gaps" → compares document against standard requirements

**In Dashboard**:
- "🤖 What should I focus on today?" → analyzes overdue items, priorities, assignments
- "🤖 Generate weekly quality report" → summarizes week's activity

### 9.3 AI Settings

- Model selection: Claude / OpenAI / Gemini (admin configurable)
- AI feature toggles per module (enable/disable)
- Data privacy controls: what data is sent to AI
- AI usage analytics: token usage, query counts, popular queries

---

## 10. NOTIFICATION SYSTEM

### 10.1 Notification Center (`/notifications`)

**Layout**: Full-page list with filters.

**Notification item**:
```
┌─────────────────────────────────────────────────────┐
│ 🔴 ⚠️ Critical NCR assigned to you       2 min ago │
│ NCR-2024-0089 "Fire extinguisher expired"           │
│ Assigned by: Anna Schmidt                           │
│ Due: Oct 17, 2024                                   │
│ [View NCR] [Acknowledge]                            │
├─────────────────────────────────────────────────────┤
│ ⚪ 📋 Inspection completed               1 hour ago │
│ INS-2024-0042 completed by Manjunath Kumar          │
│ 3 findings generated                                │
│ [View Inspection]                                   │
└─────────────────────────────────────────────────────┘
```

**Filters**: All / Unread / NCRs / Inspections / 8Ds / Documents / System
**Bulk actions**: Mark all read, Delete selected

### 10.2 Notification Preferences (`/settings/notifications`)

Per-channel (email, push, in-app, SMS) toggle matrix:

| Event | In-App | Email | Push | SMS |
|-------|--------|-------|------|-----|
| NCR assigned to me | ✓ | ✓ | ✓ | ☐ |
| NCR overdue | ✓ | ✓ | ✓ | ✓ |
| Inspection scheduled | ✓ | ✓ | ☐ | ☐ |
| 8D step completed | ✓ | ☐ | ☐ | ☐ |
| Document expiring | ✓ | ✓ | ☐ | ☐ |
| Comment/mention | ✓ | ✓ | ✓ | ☐ |
| Escalation | ✓ | ✓ | ✓ | ✓ |

**Digest mode**: daily/weekly email summary instead of individual emails.

### 10.3 Real-time Notifications

- WebSocket connection for live updates
- Toast notifications for new items (top-right, auto-dismiss after 5s)
- Sound notification option (toggle in preferences)
- Browser tab title update: "(3) Kaenal" when unread items

---

## 11. REPORTING & BI MODULE

### 11.1 Report Dashboards (`/reports/dashboards`)

**Pre-built dashboards** (selectable from sidebar):

**Quality Overview Dashboard**:
- NCR volume trend (line chart, 12 months)
- NCR by category (bar chart)
- Top 5 recurring NCR types (horizontal bar)
- 8D completion rate (gauge)
- Mean time to resolve NCR (KPI card + trend)
- Cost of quality (stacked bar: prevention, appraisal, internal failure, external failure)

**Inspection Performance Dashboard**:
- Inspections completed vs scheduled (bar chart)
- Pass rate trend (line chart)
- Average inspection score by area (radar chart)
- Inspector workload (stacked bar per inspector)
- Overdue inspections (table)

**Compliance Dashboard**:
- Certificate status overview (donut: valid, expiring, expired)
- Compliance score by standard (horizontal bars)
- Gap analysis matrix (heatmap)
- Upcoming expirations timeline (Gantt-style)

**Custom Dashboard Builder**:
- Drag-and-drop widget placement
- Widget library: chart types (line, bar, pie, donut, radar, gauge, heatmap, table, KPI card, sparkline)
- Data source selector per widget
- Filter configuration per widget
- Save/share dashboards
- Schedule email delivery (daily/weekly/monthly)

### 11.2 Exports (`/reports/exports`)

**Export builder**:
- Select module (Inspections, NCRs, 8Ds, Documents)
- Select fields (checkbox list of all available fields)
- Filters (date range, status, category, etc.)
- Format: PDF, CSV, XLS
- Template selection (for PDF reports)
- Schedule recurring exports
- Export history list

---

## 12. ADMIN & SETTINGS MODULE

### 12.1 Organization Settings (`/settings/organization`)

- Organization name, logo (upload), timezone, date format, currency
- Locations/Sites management (CRUD table)
- Departments/Areas management (CRUD table)
- Categories management (NCR categories, inspection types)
- SLA configuration:
  - Critical NCR resolution target: __ hours
  - Major NCR resolution target: __ days
  - Minor NCR resolution target: __ days
  - Escalation rules: after __ hours/days → escalate to [Role]

### 12.2 User Management (`/settings/users`)

**User list table**: Name, Email, Role, Status (Active/Invited/Disabled), Last Login, Actions.

**Invite user**: Email, Role (dropdown), Location (dropdown), Send invitation.

**User detail**: Edit role, permissions, location, disable/enable, reset password, view activity log.

**Role management** (Phase 4):
- Custom role builder
- Permission matrix: module × action (view, create, edit, delete, export, admin)
- Field-level permissions

### 12.3 Template Management (`/settings/templates`)

- Inspection templates (link to template editor)
- 8D templates
- NCR form customization
- Email notification templates (subject, body with variables)
- PDF report templates

### 12.4 Integrations (`/settings/integrations`)

**Available integrations** (card grid):
- Email (SMTP configuration)
- SMS (Twilio API key)
- ERP (SAP connector — Phase 4)
- Calendar (Google/Outlook)
- Storage (S3 configuration)
- AI (Claude/OpenAI API key + model selection)
- Webhook configuration (URL, events, secret)

Each card: logo, name, description, status (connected/disconnected), [Configure] button.

### 12.5 Audit Log (`/settings/audit-log`)

Searchable, filterable table of ALL system events:
- Timestamp, User, Action, Entity Type, Entity ID, Details, IP Address
- Filter by: user, action type, entity type, date range
- Export capability

---

## 13. SHARED COMPONENTS LIBRARY

### 13.1 Component List

Build these as a shared component library (src/components/):

**Layout**:
- `AppShell` — sidebar + topbar + content wrapper
- `Sidebar` — collapsible navigation
- `TopBar` — breadcrumbs, search, notifications, profile
- `PageHeader` — title + description + actions
- `ContentCard` — padded card container
- `SplitView` — two-column layout (content + sidebar metadata)
- `EmptyState` — illustration + message + action button

**Data Display**:
- `DataTable` — sortable, filterable, paginated table (use @tanstack/react-table)
- `KanbanBoard` — drag-and-drop columns (use @hello-pangea/dnd)
- `Timeline` — vertical activity timeline
- `StatusBadge` — colored badge for status values
- `PriorityBadge` — colored badge for priority/risk
- `UserAvatar` — avatar with fallback initials
- `UserPicker` — searchable user dropdown
- `EntityLink` — clickable link to NCR/Inspection/8D with ID formatting
- `MetadataPanel` — right sidebar metadata display
- `ProgressStepper` — horizontal/vertical step indicator
- `ScoreGauge` — circular or bar percentage display

**Forms**:
- `DynamicForm` — renders inspection forms from JSON schema
- `RichTextEditor` — WYSIWYG editor (use TipTap)
- `FileUploader` — drag-and-drop multi-file upload with progress
- `SignatureCanvas` — signature draw pad (use react-signature-canvas)
- `DateRangePicker` — combined date range selector
- `TagInput` — chip-based tag input
- `CommandPalette` — ⌘K search modal (use cmdk)
- `FilterPanel` — collapsible filter form
- `SearchInput` — debounced search with suggestions

**Charts** (use Recharts):
- `LineChartWidget` — time series line chart
- `BarChartWidget` — vertical/horizontal bar chart
- `DonutChartWidget` — donut/pie chart
- `RadarChartWidget` — radar/spider chart
- `HeatmapWidget` — 2D heatmap matrix
- `GaugeWidget` — semi-circular gauge
- `SparklineWidget` — inline mini chart
- `KPICard` — metric + trend + sparkline

**Feedback**:
- `Toast` — notification toasts (use sonner)
- `ConfirmDialog` — destructive action confirmation
- `LoadingSpinner` — spinner and skeleton loaders
- `ErrorBoundary` — error boundary with retry

**AI**:
- `AIChatDrawer` — right-side AI chat panel
- `AISuggestionCard` — AI suggestion with accept/dismiss
- `AILoadingIndicator` — animated thinking indicator

### 13.2 Component Patterns

**All list pages follow this pattern**:
```tsx
export default function EntityListPage() {
  return (
    <PageHeader
      title="Inspections"
      description="Manage and track all inspections"
      actions={<Button>+ New Inspection</Button>}
    />
    <FilterPanel filters={filters} onApply={handleFilter} />
    <DataTable
      columns={columns}
      data={data}
      isLoading={isLoading}
      pagination={pagination}
      sorting={sorting}
      onRowClick={navigateToDetail}
      bulkActions={bulkActions}
      emptyState={<EmptyState ... />}
    />
  );
}
```

**All detail pages follow this pattern**:
```tsx
export default function EntityDetailPage({ params }) {
  return (
    <SplitView
      main={
        <>
          <DetailHeader entity={entity} actions={actions} />
          <Tabs defaultValue="details">
            <TabsList>...</TabsList>
            <TabsContent value="details">...</TabsContent>
            <TabsContent value="history">
              <Timeline events={entity.history} />
            </TabsContent>
          </Tabs>
        </>
      }
      sidebar={<MetadataPanel fields={metadataFields} />}
    />
  );
}
```

---

## 14. API CONTRACTS & DATA MODELS

### 14.1 Core Data Models

```typescript
// ── Tenant ──
interface Tenant {
  id: string;
  name: string;
  slug: string;
  logo?: string;
  settings: TenantSettings;
  plan: 'starter' | 'professional' | 'enterprise';
  createdAt: string;
}

// ── User ──
interface User {
  id: string;
  tenantId: string;
  email: string;
  fullName: string;
  avatarUrl?: string;
  role: Role;
  permissions: Permission[];
  locations: string[];
  status: 'active' | 'invited' | 'disabled';
  lastLoginAt?: string;
  createdAt: string;
}

// ── Inspection ──
interface Inspection {
  id: string;           // INS-2024-XXXX
  tenantId: string;
  templateId: string;
  title: string;
  description?: string;
  status: 'draft' | 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  inspectorId: string;
  locationId?: string;
  area?: string;
  scheduledDate?: string;
  startedAt?: string;
  completedAt?: string;
  riskRating?: RiskLevel;
  score?: number;
  maxScore?: number;
  responses: InspectionResponse[];
  findings: Finding[];
  media: MediaAttachment[];
  signature?: SignatureData;
  gpsCoordinates?: { lat: number; lng: number };
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

interface InspectionResponse {
  itemId: string;
  value: any;
  notes?: string;
  media?: MediaAttachment[];
  answeredAt: string;
}

interface Finding {
  id: string;
  inspectionId: string;
  itemId: string;
  severity: RiskLevel;
  observation: string;
  media: MediaAttachment[];
  ncrId?: string;        // linked NCR
  status: 'open' | 'linked' | 'resolved';
}

// ── NCR ──
interface NonConformity {
  id: string;           // NCR-2024-XXXX
  tenantId: string;
  title: string;
  description: string;
  source: 'inspection' | 'manual' | '8d' | 'customer_complaint';
  sourceRef?: string;   // inspection ID or complaint ref
  status: 'draft' | 'open' | 'assigned' | 'in_progress' | 'resolved' | 'verified' | 'closed' | 'escalated';
  priority: 'critical' | 'major' | 'minor';
  riskLevel: RiskLevel;
  category: string;
  ownerId?: string;
  assignedById?: string;
  locationId?: string;
  area?: string;
  dueDate?: string;
  resolvedAt?: string;
  closedAt?: string;
  rootCause?: string;
  containmentActions: Action[];
  correctiveActions: Action[];
  preventiveActions: Action[];
  evidence: MediaAttachment[];
  eightDId?: string;    // linked 8D
  tags: string[];
  slaStatus: 'on_track' | 'at_risk' | 'breached';
  history: AuditEvent[];
  comments: Comment[];
  createdAt: string;
  updatedAt: string;
}

interface Action {
  id: string;
  description: string;
  ownerId: string;
  dueDate: string;
  status: 'pending' | 'in_progress' | 'completed' | 'verified';
  completedAt?: string;
  verifiedAt?: string;
  verificationMethod?: string;
  evidence?: MediaAttachment[];
  notes?: string;
}

// ── 8D Report ──
interface EightDReport {
  id: string;           // 8D-2024-XXXX
  tenantId: string;
  title: string;
  ncrId: string;
  status: 'active' | 'completed' | 'cancelled';
  currentStep: number;  // 1-8
  teamLeadId: string;
  sponsorId?: string;
  targetDate?: string;
  completedAt?: string;
  d1: D1Team;
  d2: D2Problem;
  d3: D3Containment;
  d4: D4RootCause;
  d5: D5CorrectiveActions;
  d6: D6Implementation;
  d7: D7Prevention;
  d8: D8Closure;
  history: AuditEvent[];
  comments: Comment[];
  createdAt: string;
  updatedAt: string;
}

interface D1Team {
  completed: boolean;
  completedAt?: string;
  teamLead: string;
  members: { userId: string; role: string }[];
  sponsor?: string;
}

interface D2Problem {
  completed: boolean;
  completedAt?: string;
  statement: string;
  isIsNotAnalysis: {
    what: { is: string; isNot: string };
    where: { is: string; isNot: string };
    when: { is: string; isNot: string };
    howMuch: { is: string; isNot: string };
    who: { is: string; isNot: string };
  };
  defectRate?: number;
  affectedQuantity?: number;
  costImpact?: number;
  customerImpact?: string;
  attachments: MediaAttachment[];
}

interface D4RootCause {
  completed: boolean;
  completedAt?: string;
  analysisMethod: 'five_whys' | 'fishbone' | 'fault_tree' | 'freeform';
  fiveWhys?: { question: string; answer: string }[];
  fishbone?: FishboneDiagram;
  faultTree?: FaultTreeNode;
  freeformAnalysis?: string;
  rootCause: string;
  escapePoint?: string;
  verification?: string;
  aiSuggestions?: AISuggestion[];
  attachments: MediaAttachment[];
}

// ── Document ──
interface Document {
  id: string;
  tenantId: string;
  filename: string;
  originalFilename: string;
  mimeType: string;
  fileSize: number;
  storageUrl: string;
  category: string;
  documentType: 'certificate' | 'policy' | 'procedure' | 'work_instruction' | 'form' | 'training_record' | 'audit_report' | 'other';
  version: number;
  expiryDate?: string;
  status: 'valid' | 'expiring' | 'expired' | 'draft' | 'archived';
  ocrText?: string;
  aiSummary?: string;
  tags: string[];
  uploadedById: string;
  linkedEntities: { type: string; id: string }[];
  accessLog: { userId: string; action: string; timestamp: string }[];
  createdAt: string;
  updatedAt: string;
}

// ── Shared Types ──
type RiskLevel = 'critical' | 'high' | 'medium' | 'low';
type Role = 'admin' | 'manager' | 'auditor' | 'inspector' | 'viewer';

interface MediaAttachment {
  id: string;
  filename: string;
  mimeType: string;
  fileSize: number;
  url: string;
  thumbnailUrl?: string;
  gpsCoordinates?: { lat: number; lng: number };
  capturedAt?: string;
}

interface AuditEvent {
  id: string;
  userId: string;
  action: string;
  entityType: string;
  entityId: string;
  details: Record<string, any>;
  timestamp: string;
}

interface Comment {
  id: string;
  userId: string;
  text: string;
  attachments?: MediaAttachment[];
  parentId?: string;    // for threading
  createdAt: string;
  updatedAt?: string;
}

interface Notification {
  id: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  entityType?: string;
  entityId?: string;
  read: boolean;
  readAt?: string;
  channels: ('in_app' | 'email' | 'push' | 'sms')[];
  createdAt: string;
}

interface AISuggestion {
  id: string;
  content: string;
  confidence: number;
  reasoning: string;
  similarEntities?: string[];
  accepted?: boolean;
}
```

### 14.2 API Endpoints Pattern

All endpoints follow REST conventions:

```
Auth:
POST   /api/auth/login
POST   /api/auth/logout
POST   /api/auth/refresh
POST   /api/auth/forgot-password
POST   /api/auth/reset-password
POST   /api/auth/accept-invite

Inspections:
GET    /api/inspections                    (list, paginated, filterable)
POST   /api/inspections                    (create)
GET    /api/inspections/:id                (detail)
PATCH  /api/inspections/:id                (update)
DELETE /api/inspections/:id                (delete)
POST   /api/inspections/:id/complete       (complete inspection)
GET    /api/inspections/:id/findings       (list findings)
POST   /api/inspections/:id/findings       (create finding)
GET    /api/inspections/templates          (list templates)
POST   /api/inspections/templates          (create template)
GET    /api/inspections/templates/:id      (get template)
PATCH  /api/inspections/templates/:id      (update template)

NCRs:
GET    /api/ncrs                           (list)
POST   /api/ncrs                           (create)
GET    /api/ncrs/:id                       (detail)
PATCH  /api/ncrs/:id                       (update)
DELETE /api/ncrs/:id                       (delete)
POST   /api/ncrs/:id/assign               (assign owner)
POST   /api/ncrs/:id/escalate             (escalate)
POST   /api/ncrs/:id/actions              (add action)
PATCH  /api/ncrs/:id/actions/:actionId    (update action)
POST   /api/ncrs/:id/comments             (add comment)

8D Reports:
GET    /api/8d                             (list)
POST   /api/8d                             (create)
GET    /api/8d/:id                         (detail)
PATCH  /api/8d/:id                         (update)
PATCH  /api/8d/:id/steps/:step            (update specific step)
POST   /api/8d/:id/steps/:step/complete   (complete step)
POST   /api/8d/:id/generate-pdf           (generate report)

Documents:
GET    /api/documents                      (list)
POST   /api/documents                      (upload)
GET    /api/documents/:id                  (detail)
PATCH  /api/documents/:id                  (update metadata)
DELETE /api/documents/:id                  (delete)
POST   /api/documents/:id/ocr             (run OCR)
POST   /api/documents/:id/summarize       (AI summarize)
GET    /api/documents/compliance/scorecard (compliance scores)

AI:
POST   /api/ai/chat                        (chat message)
POST   /api/ai/root-cause                  (root cause suggestion)
POST   /api/ai/summarize                   (document summary)
POST   /api/ai/compliance-check            (compliance analysis)

Notifications:
GET    /api/notifications                  (list)
PATCH  /api/notifications/:id/read        (mark read)
POST   /api/notifications/read-all        (mark all read)
GET    /api/notifications/preferences     (get preferences)
PATCH  /api/notifications/preferences     (update preferences)

Reports:
GET    /api/reports/dashboard/:type        (dashboard data)
POST   /api/reports/export                 (generate export)
GET    /api/reports/exports                (list exports)

Admin:
GET    /api/admin/users                    (list users)
POST   /api/admin/users/invite            (invite user)
PATCH  /api/admin/users/:id               (update user)
GET    /api/admin/audit-log               (audit log)
GET    /api/admin/organization            (org settings)
PATCH  /api/admin/organization            (update org settings)
```

### 14.3 Query Parameters Convention

```
?page=1&limit=25                    — Pagination
&sort=createdAt&order=desc          — Sorting
&status=open,in_progress            — Multi-value filter (comma-separated)
&priority=critical                  — Single value filter
&search=fire+extinguisher           — Full-text search
&dateFrom=2024-01-01&dateTo=2024-12-31 — Date range
&inspectorId=user_xxx               — Foreign key filter
```

---

## 15. OFFLINE & SYNC (FLUTTER)

### 15.1 Offline Architecture

```
┌─────────────────────────────┐
│ Flutter App                 │
│ ┌─────────┐ ┌────────────┐ │
│ │ UI Layer│ │ Riverpod   │ │
│ └────┬────┘ │ Providers  │ │
│      │      └─────┬──────┘ │
│ ┌────▼────────────▼──────┐ │
│ │ Repository Layer       │ │
│ │ (decides: local/remote)│ │
│ ├────────────┬───────────┤ │
│ │ Local DB   │ Remote API│ │
│ │ (SQLite/   │ (Dio +    │ │
│ │  Hive)     │ Retrofit) │ │
│ └────────────┴───────────┘ │
│ ┌────────────────────────┐ │
│ │ Sync Engine            │ │
│ │ (Background queue)     │ │
│ └────────────────────────┘ │
└─────────────────────────────┘
```

### 15.2 Offline Capabilities

| Feature | Offline Support | Sync Strategy |
|---------|----------------|---------------|
| View inspections | ✓ (cached) | Pull on connect |
| Create inspection | ✓ (local) | Push on connect |
| Complete inspection | ✓ (local) | Push on connect |
| View NCRs | ✓ (cached) | Pull on connect |
| Create NCR | ✓ (local) | Push on connect |
| Upload photos | ✓ (queued) | Push on connect |
| View 8D | ✓ (cached) | Pull on connect |
| Edit 8D | ✗ (requires latest) | — |
| AI features | ✗ (requires API) | — |
| Notifications | ✗ (real-time only) | Pull on connect |

### 15.3 Sync Engine

```dart
class SyncEngine {
  // Sync queue stored in Hive
  // Each item: { id, entityType, action, payload, createdAt, retryCount }
  
  // On connectivity restored:
  // 1. Process queue in FIFO order
  // 2. For each item: POST/PATCH to API
  // 3. On success: remove from queue, update local DB with server response
  // 4. On conflict (409): prompt user to resolve (keep local / keep server / merge)
  // 5. On failure (5xx): retry with exponential backoff (max 5 retries)
  // 6. On auth failure (401): re-authenticate then retry
  
  // Conflict resolution strategy: Last-write-wins with server arbitration
  // Server compares updatedAt timestamps
  // If server version is newer → 409 Conflict with server data
  // Client shows diff and lets user choose
}
```

### 15.4 Flutter Screen Structure

```
lib/
├── main.dart
├── app.dart                          — MaterialApp + GoRouter + Theme
├── core/
│   ├── theme/                        — Colors, typography, theme data
│   ├── network/                      — Dio client, interceptors, connectivity
│   ├── storage/                      — Hive boxes, SQLite database
│   ├── sync/                         — Sync engine, queue, conflict resolution
│   └── utils/                        — Formatters, validators, helpers
├── features/
│   ├── auth/
│   │   ├── data/                     — Auth repository, API service
│   │   ├── domain/                   — User model, auth state
│   │   ├── presentation/
│   │   │   ├── login_screen.dart
│   │   │   ├── forgot_password_screen.dart
│   │   │   └── widgets/
│   │   └── providers/                — Auth providers (Riverpod)
│   ├── dashboard/
│   │   ├── presentation/
│   │   │   ├── dashboard_screen.dart
│   │   │   └── widgets/              — KPI cards, charts, activity feed
│   │   └── providers/
│   ├── inspections/
│   │   ├── data/
│   │   ├── domain/
│   │   ├── presentation/
│   │   │   ├── inspection_list_screen.dart
│   │   │   ├── inspection_detail_screen.dart
│   │   │   ├── inspection_form_screen.dart  — Dynamic form renderer
│   │   │   ├── template_list_screen.dart
│   │   │   └── widgets/
│   │   │       ├── dynamic_form/            — Form field widgets
│   │   │       │   ├── pass_fail_field.dart
│   │   │       │   ├── score_field.dart
│   │   │       │   ├── photo_field.dart
│   │   │       │   ├── signature_field.dart
│   │   │       │   └── ...
│   │   │       ├── inspection_card.dart
│   │   │       └── findings_list.dart
│   │   └── providers/
│   ├── ncr/
│   │   ├── data/
│   │   ├── domain/
│   │   ├── presentation/
│   │   │   ├── ncr_list_screen.dart
│   │   │   ├── ncr_detail_screen.dart
│   │   │   ├── ncr_create_screen.dart
│   │   │   └── widgets/
│   │   │       ├── ncr_card.dart
│   │   │       ├── action_list.dart
│   │   │       ├── five_whys_widget.dart
│   │   │       └── fishbone_widget.dart
│   │   └── providers/
│   ├── eight_d/
│   │   ├── data/
│   │   ├── domain/
│   │   ├── presentation/
│   │   │   ├── eight_d_list_screen.dart
│   │   │   ├── eight_d_detail_screen.dart
│   │   │   ├── steps/                       — One screen per D1-D8
│   │   │   │   ├── d1_team_screen.dart
│   │   │   │   ├── d2_problem_screen.dart
│   │   │   │   ├── d3_containment_screen.dart
│   │   │   │   ├── d4_root_cause_screen.dart
│   │   │   │   ├── d5_corrective_screen.dart
│   │   │   │   ├── d6_implementation_screen.dart
│   │   │   │   ├── d7_prevention_screen.dart
│   │   │   │   └── d8_closure_screen.dart
│   │   │   └── widgets/
│   │   └── providers/
│   ├── documents/
│   ├── notifications/
│   └── settings/
├── shared/
│   ├── widgets/                       — Shared UI components
│   │   ├── status_badge.dart
│   │   ├── priority_badge.dart
│   │   ├── user_avatar.dart
│   │   ├── empty_state.dart
│   │   ├── loading_shimmer.dart
│   │   ├── error_view.dart
│   │   ├── search_bar.dart
│   │   ├── filter_chips.dart
│   │   └── ...
│   └── models/                        — Shared data models
└── router/
    └── app_router.dart                — GoRouter configuration
```

---

## 16. ACCESSIBILITY & i18n

### 16.1 Accessibility Requirements

- WCAG 2.1 AA compliance
- All interactive elements keyboard-navigable
- ARIA labels on all icons, buttons, form fields
- Focus indicators visible (2px primary-500 ring)
- Color is never the only indicator (always paired with icon/text/shape)
- Minimum contrast ratio 4.5:1 for text, 3:1 for large text
- Screen reader testing with NVDA/VoiceOver
- Reduced motion support: `prefers-reduced-motion` → disable animations

### 16.2 Internationalization

- Use `next-intl` for Next.js, `flutter_localizations` + `intl` for Flutter
- Initial languages: English (default), German, Spanish
- All user-facing strings in translation files (no hardcoded text)
- Date/time formatting per locale
- Number formatting per locale (decimal separator, thousands separator)
- RTL support structure (for future Arabic/Hebrew)

**Translation file structure**:
```
locales/
├── en/
│   ├── common.json        — Shared strings (buttons, labels)
│   ├── auth.json
│   ├── dashboard.json
│   ├── inspections.json
│   ├── ncr.json
│   ├── eightd.json
│   ├── documents.json
│   ├── notifications.json
│   ├── reports.json
│   └── settings.json
├── de/
│   └── ... (same structure)
└── es/
    └── ... (same structure)
```

---

## 17. FILE & FOLDER STRUCTURE

### 17.1 Next.js Project Structure

```
kaenal-web/
├── src/
│   ├── app/                           — App Router pages
│   │   ├── (auth)/
│   │   │   ├── login/page.tsx
│   │   │   ├── forgot-password/page.tsx
│   │   │   ├── reset-password/page.tsx
│   │   │   ├── invite/page.tsx
│   │   │   └── layout.tsx             — Auth layout (split screen)
│   │   ├── (app)/
│   │   │   ├── dashboard/page.tsx
│   │   │   ├── inspections/
│   │   │   │   ├── page.tsx           — List
│   │   │   │   ├── new/page.tsx       — Create
│   │   │   │   ├── [id]/
│   │   │   │   │   ├── page.tsx       — Detail
│   │   │   │   │   └── edit/page.tsx  — Edit
│   │   │   │   ├── templates/
│   │   │   │   │   ├── page.tsx       — Template list
│   │   │   │   │   ├── new/page.tsx   — Template builder
│   │   │   │   │   └── [id]/page.tsx  — Template edit
│   │   │   │   └── schedule/page.tsx  — Calendar view
│   │   │   ├── ncr/
│   │   │   │   ├── page.tsx
│   │   │   │   ├── new/page.tsx
│   │   │   │   ├── [id]/page.tsx
│   │   │   │   ├── assigned/page.tsx
│   │   │   │   └── overdue/page.tsx
│   │   │   ├── 8d/
│   │   │   │   ├── page.tsx
│   │   │   │   ├── new/page.tsx
│   │   │   │   ├── [id]/page.tsx
│   │   │   │   └── templates/page.tsx
│   │   │   ├── documents/
│   │   │   │   ├── page.tsx
│   │   │   │   ├── [id]/page.tsx
│   │   │   │   ├── certificates/page.tsx
│   │   │   │   └── compliance/page.tsx
│   │   │   ├── reports/
│   │   │   │   ├── dashboards/page.tsx
│   │   │   │   └── exports/page.tsx
│   │   │   ├── notifications/page.tsx
│   │   │   ├── settings/
│   │   │   │   ├── organization/page.tsx
│   │   │   │   ├── users/page.tsx
│   │   │   │   ├── templates/page.tsx
│   │   │   │   ├── integrations/page.tsx
│   │   │   │   ├── billing/page.tsx
│   │   │   │   └── audit-log/page.tsx
│   │   │   └── layout.tsx             — App layout (sidebar + topbar)
│   │   ├── layout.tsx                 — Root layout
│   │   └── globals.css
│   ├── components/
│   │   ├── ui/                        — shadcn/ui components
│   │   ├── layout/
│   │   │   ├── app-shell.tsx
│   │   │   ├── sidebar.tsx
│   │   │   ├── top-bar.tsx
│   │   │   ├── breadcrumbs.tsx
│   │   │   ├── page-header.tsx
│   │   │   └── split-view.tsx
│   │   ├── data/
│   │   │   ├── data-table.tsx
│   │   │   ├── kanban-board.tsx
│   │   │   ├── timeline.tsx
│   │   │   ├── status-badge.tsx
│   │   │   ├── priority-badge.tsx
│   │   │   ├── user-avatar.tsx
│   │   │   ├── entity-link.tsx
│   │   │   ├── metadata-panel.tsx
│   │   │   ├── progress-stepper.tsx
│   │   │   └── score-gauge.tsx
│   │   ├── forms/
│   │   │   ├── dynamic-form/
│   │   │   │   ├── form-renderer.tsx
│   │   │   │   ├── fields/
│   │   │   │   │   ├── pass-fail-field.tsx
│   │   │   │   │   ├── score-field.tsx
│   │   │   │   │   ├── photo-field.tsx
│   │   │   │   │   ├── signature-field.tsx
│   │   │   │   │   ├── select-field.tsx
│   │   │   │   │   └── ...
│   │   │   │   └── form-builder.tsx   — Template editor
│   │   │   ├── rich-text-editor.tsx
│   │   │   ├── file-uploader.tsx
│   │   │   ├── signature-canvas.tsx
│   │   │   ├── date-range-picker.tsx
│   │   │   ├── tag-input.tsx
│   │   │   ├── user-picker.tsx
│   │   │   ├── filter-panel.tsx
│   │   │   └── search-input.tsx
│   │   ├── charts/
│   │   │   ├── line-chart.tsx
│   │   │   ├── bar-chart.tsx
│   │   │   ├── donut-chart.tsx
│   │   │   ├── radar-chart.tsx
│   │   │   ├── heatmap.tsx
│   │   │   ├── gauge.tsx
│   │   │   ├── sparkline.tsx
│   │   │   └── kpi-card.tsx
│   │   ├── ai/
│   │   │   ├── ai-chat-drawer.tsx
│   │   │   ├── ai-suggestion-card.tsx
│   │   │   └── ai-loading.tsx
│   │   ├── investigation/
│   │   │   ├── five-whys.tsx
│   │   │   ├── fishbone-diagram.tsx
│   │   │   └── fault-tree.tsx
│   │   └── shared/
│   │       ├── command-palette.tsx
│   │       ├── confirm-dialog.tsx
│   │       ├── empty-state.tsx
│   │       ├── error-boundary.tsx
│   │       └── loading-spinner.tsx
│   ├── hooks/
│   │   ├── use-auth.ts
│   │   ├── use-permissions.ts
│   │   ├── use-debounce.ts
│   │   ├── use-media-query.ts
│   │   ├── use-keyboard-shortcut.ts
│   │   └── use-realtime.ts            — WebSocket hook
│   ├── lib/
│   │   ├── api/
│   │   │   ├── client.ts              — Axios/fetch wrapper
│   │   │   ├── inspections.ts
│   │   │   ├── ncrs.ts
│   │   │   ├── eight-d.ts
│   │   │   ├── documents.ts
│   │   │   ├── notifications.ts
│   │   │   ├── reports.ts
│   │   │   ├── admin.ts
│   │   │   └── ai.ts
│   │   ├── utils/
│   │   │   ├── formatters.ts          — Date, number, currency formatting
│   │   │   ├── validators.ts
│   │   │   ├── id-generator.ts        — Entity ID formatting
│   │   │   └── export-helpers.ts
│   │   └── constants.ts               — Status maps, priority configs, etc.
│   ├── stores/
│   │   ├── auth-store.ts              — Zustand auth store
│   │   ├── ui-store.ts                — Sidebar state, theme, preferences
│   │   └── notification-store.ts      — Real-time notification state
│   ├── types/
│   │   ├── inspection.ts
│   │   ├── ncr.ts
│   │   ├── eight-d.ts
│   │   ├── document.ts
│   │   ├── user.ts
│   │   ├── notification.ts
│   │   └── api.ts                     — API response types
│   └── locales/
│       ├── en/
│       ├── de/
│       └── es/
├── public/
│   ├── images/
│   │   ├── logo.svg
│   │   ├── logo-icon.svg
│   │   └── empty-states/              — Illustrations for empty states
│   └── icons/
├── tailwind.config.ts
├── next.config.js
├── package.json
└── tsconfig.json
```

### 17.2 Key Dependencies

```json
{
  "dependencies": {
    "next": "^14.0.0",
    "react": "^18.0.0",
    "typescript": "^5.0.0",
    "@tanstack/react-query": "^5.0.0",
    "@tanstack/react-table": "^8.0.0",
    "zustand": "^4.0.0",
    "tailwindcss": "^3.4.0",
    "@radix-ui/react-*": "latest",
    "recharts": "^2.0.0",
    "cmdk": "^0.2.0",
    "@hello-pangea/dnd": "^16.0.0",
    "react-grid-layout": "^1.4.0",
    "@tiptap/react": "^2.0.0",
    "react-signature-canvas": "^1.0.0",
    "date-fns": "^3.0.0",
    "lucide-react": "^0.300.0",
    "next-themes": "^0.2.0",
    "next-intl": "^3.0.0",
    "sonner": "^1.0.0",
    "zod": "^3.0.0",
    "react-hook-form": "^7.0.0",
    "@hookform/resolvers": "^3.0.0",
    "axios": "^1.0.0",
    "socket.io-client": "^4.0.0",
    "class-variance-authority": "^0.7.0",
    "clsx": "^2.0.0",
    "tailwind-merge": "^2.0.0"
  }
}
```

---

## IMPLEMENTATION NOTES FOR CLAUDE CODE

### Build Order (recommended)

1. **Project scaffold**: Next.js + Tailwind + shadcn/ui + folder structure
2. **Design system**: Colors, typography, theme provider, dark mode
3. **Layout shell**: Sidebar, top bar, breadcrumbs, page header
4. **Auth screens**: Login, forgot password, reset password
5. **Shared components**: DataTable, StatusBadge, PriorityBadge, UserAvatar, EmptyState, FilterPanel
6. **Dashboard**: KPI cards, charts (with mock data)
7. **Inspection list + detail**: Table, filters, detail view with tabs
8. **Dynamic form engine**: Form renderer + all field types
9. **Inspection create/edit**: Multi-step form with template selection
10. **NCR list + detail + create**: Including kanban view
11. **NCR workflow**: Status transitions, actions, investigation tools
12. **8D list + detail**: Step-by-step workflow, all D1-D8 screens
13. **8D AI integration**: Root cause suggestions, 5 Whys, Fishbone
14. **Document module**: Library, upload, viewer, compliance dashboard
15. **AI chat drawer**: Contextual AI assistant
16. **Notification system**: Center, preferences, real-time toasts
17. **Reporting module**: Dashboards, charts, export builder
18. **Admin/Settings**: Organization, users, templates, integrations, audit log
19. **Command palette**: Global search (⌘K)
20. **Polish**: Animations, loading states, error handling, responsiveness

### Mock Data Strategy

Until the backend is ready, use mock data with a consistent approach:

```typescript
// src/lib/mock/
// Each module has a mock data file with realistic manufacturing data
// Use MSW (Mock Service Worker) to intercept API calls in development
// Toggle: NEXT_PUBLIC_USE_MOCKS=true in .env.local
```

### Responsive Breakpoints

```
sm:  640px   — Mobile landscape
md:  768px   — Tablet portrait
lg:  1024px  — Tablet landscape / small desktop
xl:  1280px  — Desktop
2xl: 1536px  — Large desktop
```

### Animation Guidelines

- Page transitions: fade (150ms ease)
- Sidebar collapse: width transition (200ms ease-in-out)
- Drawer open: slide from right (250ms ease-out)
- Modal: fade + scale up (200ms ease-out)
- Skeleton loaders: pulse animation
- Toast: slide in from top-right (300ms spring)
- Kanban drag: smooth with shadow elevation
- Chart animations: ease-in-out, 500ms on mount

---

*End of specification. This document covers every screen, component, interaction, data model, and implementation detail needed to build the complete Kaenal frontend.*
