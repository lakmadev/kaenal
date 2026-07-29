# P06 — Documents, Compliance & Files (end-to-end)

**Status:** Backend ✅ done · FE 🟡 partial
**Design jsx:** `documents.jsx`, `upload-flow.jsx`, `compliance-extra.jsx`
**Spec:** 02 §4, 03 §3/§7, 07 §3, FEATURES §9 · **Code:** `DOC-YYYY-NNNN`
**Value:** controlled-document backbone (approvals, expiry, evidence) — IATF documented-information control.

## 1. Feature scope (from jsx)
- **Library** — folder/category sidebar (Certificates, Policies, Procedures, Work Instructions, Forms, Training Records, Audit Reports, Supplier Documents); card & list views; toolbar (Upload / New Folder / Search / Filter); **compliance-matrix** view.
- **Detail** — viewer, metadata, **expiry tracking** (color by days remaining), **AI summary**, version history, related items, access log, comments.
- **Upload flow** (`upload-flow.jsx`) — drag-drop multi-file, per-file progress, post-upload metadata form, **OCR** + **AI summarize**.
- **Compliance dashboard** (`compliance-extra.jsx`) — overall score, per-standard scorecards (ISO 9001, IATF 16949, OSHA, ISO 14001), gap-analysis matrix, expiring-certificates widget.

## 2. Backend — ✅ done
`apps/api/src/documents/*`, `apps/api/src/files/*`, `apps/api/src/collab/*`.
- Documents: draft→pending→approved|rejected, approver-role + **self-approval four-eyes** + last-approved-version protection (all mutation-tested). `document_versions`. `expires_at` + **document-expiry reminder** job (shipped). AI **doc-summary** via governed AI gateway.
- **Files** (03 §7): presign → client PUT → complete (sha256 + AV-scan enqueue). Scan-gate download (non-`clean` = uploader only). `Storage` port (S3/MinIO + Fake). `disposition=inline|attachment` for preview vs download. File metadata (mime/size) on `DocumentDto`.
- **Collab (shipped this branch):** comments, access-log (`audit-events`), entity-links.

**Remaining backend:** **OCR** action, and the **compliance/gap-analysis aggregation** endpoint if the matrix needs server-side scoring (the per-standard rollup is arguably a query over documents+expiry — confirm whether to compute client-side from existing list data or add a `GET /v1/compliance/summary`). AV scanner + email providers are stub→real swaps (infra, not feature).

## 3. Frontend (maps to jsx)
- **Done (per PROGRESS):** library rail + views, upload+preview (inline PDF render fixed), file-type icons/sizes, compliance-matrix view, create dialog w/ file-first, detail tabs (preview/versions/approvals/links), Download.
- **Remaining FE:**
  - **Access-log** + **comments** tabs on detail (backends shipped, not yet surfaced).
  - **Entity-links** create/delete UI (list-only today).
  - Upload-flow **metadata form** + OCR/AI-summarize actions post-upload.
  - Compliance dashboard: per-standard scorecards + gap-analysis matrix + expiring-certs widget.
- **Hooks/keys:** `use-files.ts`, `apiQueries.documents/comments/auditEvents/entityLinks`.

## 4. Definition of Done
- [ ] Library, detail tabs (incl. comments + access-log + links CRUD), upload-flow metadata all per jsx.
- [ ] Expiry color-coding + AI summary shown; approvals four-eyes enforced in UI.
- [ ] Compliance dashboard scorecards + gap matrix + expiring-certs render real data.
- [ ] Scan-pending gate visible (uploader can preview; others blocked until clean).

## 5. Dependencies & open questions
- Files slice is shared by [P01](P01-inspections.md) (media), [P02](P02-ncr.md) (evidence), [P03](P03-8d.md).
- **Open:** compute compliance rollup client-side vs new summary endpoint; is OCR in scope now or a later AI slice?
