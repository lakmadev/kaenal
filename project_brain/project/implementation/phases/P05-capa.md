# P05 — CAPA (end-to-end)

**Status:** Backend ✅ done · FE ✅ done (per PROGRESS Phase-1 web)
**Design jsx:** `capa.jsx`
**Spec:** 02 §4, 03 §3, FEATURES §8 · **Code:** `CAPA-YYYY-NNNN`
**Value:** closed-loop corrective/preventive programme tying NCRs, 8Ds, and audits to verified fixes.

## 1. Feature scope (from jsx)
- **List** + **My CAPAs** + **At-risk/Overdue** views.
- **Detail** with phased workflow (`CAPA_PHASES`: initiation → root_cause → … → closed), 7-phase stepper, per-phase panels, CAPA-action status flow, links to NCRs/8Ds, CAPA trend.

## 2. Backend — ✅ done
`apps/api/src/capa/*`. `capas` + `capa_actions`, `CapaPhase` enum, FORCED RLS, composite member FKs. **Forward-only `advance`** (one phase) + **audited `revert`** (earlier phase only, reason mandatory) — both mutation-tested over the full (from,to) matrix. Actions carry `pending→in_progress→done→verified`. Cursor pagination; `lockVersion`; audit per mutation.

## 3. Frontend — ✅ done
`apps/web/src/features/capa/*`. List (type chip, phase progress bar keyed on `CapaPhase`, OwnerCell, source, due, risk). Detail: header, **7-phase PhaseTracker**, phase panels, source card (links `sourceKind==='ncr'` to the NCR), **Advance** + reason-gated **Revert** (both send `lockVersion`), action status flow. Manage controls capability-gated.

## 4. Definition of Done — met
- [x] List + smart views; phase progress bar from real enum.
- [x] Advance/Revert honor machine + concurrency + audit.
- [x] Action status flow; links to NCR/8D.

> **This phase is the reference implementation** for the "backend→FE, exactly per jsx" pattern the
> other phases should follow. When a later phase is ambiguous about structure, mirror CAPA.

## 5. Dependencies & open questions
- Depends on: [P02](P02-ncr.md), [P03](P03-8d.md), [P04](P04-audits.md) (sources). None open.
