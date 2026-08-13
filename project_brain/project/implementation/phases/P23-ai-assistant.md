# P23 — AI Assistant & Governance (end-to-end)

**Status:** Backend 🟡 (governed AI gateway ✅; SSE + more features new) · FE 🔴
**Design jsx:** `ai.jsx`, `ai-governance.jsx`, `eightd-agentic.jsx`
**Spec:** 06 (AI), FEATURES §1.11, §6, §16.1
**Value:** the AI that drafts 8D/NCR content, summarizes docs, and answers compliance Q&A — with provenance, confidence, and governance (a differentiator, and a governance requirement).

## 1. Feature scope (from jsx)
- **AI chat drawer** (`ai.jsx`): right-side, context-aware of current page/entity; capabilities root-cause analysis, doc summaries, compliance Q&A, report gen; response actions Copy / Pin-to-entity / Insert-into-field / Generate PDF; context selector to pin an NCR/8D/Inspection.
- **Agentic 8D copilot** (`eightd-agentic.jsx`): per-field draft controls, provenance strip, copilot rail, Generate Pack — see [P03](P03-8d.md).
- **AI Governance hub** (`ai-governance.jsx`): Data controls · Models & routing · PII redaction · AI audit trail · Cost & budgets · Evals & red-team.

## 2. Backend
- ✅ **Governed AI gateway** shipped (`apps/api/src/ai/*`, `POST /v1/ai/drafts` + summary acceptance, migration 0014); doc-summary feature live; **stub `AiProvider`** (real Anthropic-backed is a swap).
- 🟡 **New:**
  - **SSE streaming** for chat/draft responses (06 deferred) — streamed tokens to the drawer.
  - **Feature coverage:** root-cause draft (8D/NCR), **compliance Q&A** via `compliance_qa` **pgvector retrieval** (spec-noted), field-insert acceptance on business fields (audited).
  - **Governance surface:** AI **audit trail** (every prompt/completion logged — already audited; expose read views), **cost/budget** counters, **PII redaction** policy, model routing config. Build read/report views on real gateway logs first; policy-editing later.
- All AI writes stay **governed + audited**; provenance (`SourceChip`) + confidence (`ConfidenceMeter`) are first-class.

## 3. Frontend (maps to jsx)
- **Components:** AIChatDrawer (context pin, streamed responses, action buttons), reusable AI controls (draft controls, provenance strip, copilot rail, Generate-Pack) per FEATURES §19, AIGovernance hub tabs (read-first: audit trail, cost, models).
- **States:** streaming, empty, error, **"AI is advisory" disclosure**; accept/dismiss on every suggestion.

## 4. Definition of Done
- [ ] Chat drawer streams (SSE), is context-aware, and its actions (copy/pin/insert/PDF) work.
- [ ] Root-cause + doc-summary + compliance-Q&A backed by the governed gateway; acceptances audited.
- [ ] Governance hub shows real AI audit trail + cost from gateway logs.
- [ ] Provenance + confidence shown on every AI output.

## 5. Dependencies & open questions
- Depends on: [P03](P03-8d.md), [P02](P02-ncr.md), [P06](P06-documents.md); real `AiProvider` + pgvector are infra swaps.
- **Open (sign-off):** SSE timing; is compliance-Q&A retrieval in this phase or a later slice; how much of Governance is real vs deferred (much of §16.1 is admin-mock).
