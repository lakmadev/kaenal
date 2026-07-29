# P04 — Audits (end-to-end)

**Status:** Backend ✅ done · FE 🟡 partial
**Design jsx:** `audits.jsx`
**Spec:** 02 §2, 03 §3, 07, FEATURES §7 · **Code:** `AUD-YYYY-NNNN`
**Value:** the IATF/ISO audit programme — findings that spawn NCRs/CAPAs and prove conformance.

## 1. Feature scope (from jsx)
- **List** + **My Audits** + **Schedule** views.
- Audit types & standards (e.g., IATF 16949:2016 re-certification).
- **Detail** — scope, lead auditor + team, auditees, phase/progress, planned dates, **findings breakdown** (major/minor/opportunity), linked CAPAs, next activity, audit checklist.
- **Create-NCR-from-finding** linkage.

## 2. Backend — ✅ done
`apps/api/src/audits/*` (+ migration 0010). In place: `audits` (+ findings), `AuditType`/`AuditPhase` enums, fixed **phase machine**, FORCED RLS, composite member FKs (lead/team/auditees). Findings breakdown (major/minor/opportunity). **Raise-NCR / raise-CAPA** seams from findings. Cursor pagination; `lockVersion`; audit per mutation. Recurrence/scheduling via the shipped `scheduling` job.

**No backend work remains** unless the checklist rendering needs a field the contract doesn't expose.

## 3. Frontend (maps to jsx)
- **Routes:** `/audits`, `/audits/[id]`, `/audits/schedule`.
- **Done (per PROGRESS):** list header/badges/states.
- **Remaining FE:**
  - Detail: scope + team + auditees, **phase/progress** tracker, planned dates, **findings breakdown** cards, linked CAPAs, next activity, checklist.
  - **Create-NCR / Create-CAPA** from a finding (reuse the seam APIs).
  - My Audits + Schedule (calendar) views.
- **Hooks/keys:** `apiQueries.audits.*`; reuse `entityLinks`/`auditEvents`.

## 4. Definition of Done
- [ ] List + My Audits + Schedule match `audits.jsx`.
- [ ] Detail phase tracker, findings breakdown, linked CAPAs, checklist render real data.
- [ ] Raise-NCR and Raise-CAPA from a finding create linked records.
- [ ] Empty/loading/error/permission states present.

## 5. Dependencies & open questions
- Depends on: [P02](P02-ncr.md), [P05](P05-capa.md) (finding targets), [P08](P08-suppliers.md) (supplier audits link).
