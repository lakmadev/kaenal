# P24 — PDF Template Designer & Branded Reports (end-to-end)

**Status:** Backend 🔴 `PROPOSED` (basic PDF renderer ✅; branded/designer new) · FE 🔴
**Design jsx:** `pdf-designer.jsx`, `eightd-pdf.jsx`
**Spec:** 09 (integrations/PDF), FEATURES §6 (8D PDF), §17 — **designer designed here, needs sign-off**
**Value:** OEM-grade branded reports (8D, audit, inspection, PPAP) — the artifact customers actually receive; VDA/CQI expectations.

## 1. Feature scope (from jsx)
- **PDF Template Designer** (`pdf-designer.jsx`, admin): design branded PDF templates — header/footer, logo, sections, field bindings, style.
- **8D PDF report** (`eightd-pdf.jsx`): auto-generated comprehensive D1–D8 report w/ diagrams + signatures, VDA/CQI style.

## 2. Backend
- ✅ **Base PDF renderer** ships in the `exports` job (PDF renderer + async delivery).
- 🟡/`PROPOSED` **New:**
  - **Branded rendering** — a **Chromium/print-route** renderer (09) for rich layout (logo, tables, charts, signatures) beyond the base PDF. This is the delta for 8D/audit/inspection packs.
  - **Template storage**: `0032_pdf_templates.sql` → `pdf_templates` (`tenant_id`, `id`, `name`, `kind` (`eight_d|audit|inspection|ppap|generic`), `definition` jsonb {header, footer, sections, bindings, branding}, `version`, `active` bool, `lock_version`). FORCED RLS.
  - **Render endpoint**: `POST /v1/exports/render` with `{templateId, entityKind, entityId}` → enqueues the branded render job → produces a File (AV-gated download). Bindings map template fields → entity data (server-side, validated).
- White-label branding (logo/colors) sourced from tenant settings.

## 3. Frontend (maps to jsx)
- **Routes:** `/settings/templates/pdf` (designer, admin-only), + "Generate PDF" actions on 8D/audit/inspection detail.
- **Components:** PdfDesigner (section/field canvas, branding controls, live preview, versioning), template list, Generate-PDF button → async job + download; 8D pack preview matching `eightd-pdf.jsx`.
- **States:** preview, rendering (job pending), error.

## 4. Definition of Done
- [ ] Designer saves versioned branded templates (RLS, audited); admin-gated.
- [ ] 8D/audit/inspection "Generate PDF" renders a branded doc via the job → AV-gated File download.
- [ ] Output matches `eightd-pdf.jsx` layout (D1–D8, diagrams, signatures, branding).

## 5. Dependencies & open questions
- Depends on: [P03](P03-8d.md), [P04](P04-audits.md), [P01](P01-inspections.md), [P09](P09-ppap.md) (report subjects); Files/AV; exports job.
- **Open (sign-off):** Chromium print service vs a PDF lib; how freeform the designer is v1 (fixed templates vs full WYSIWYG); which report kinds ship first.
