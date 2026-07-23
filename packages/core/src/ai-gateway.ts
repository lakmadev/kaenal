import type { AiConfidence, AiFeature } from "@kaenal/types";

/**
 * AI gateway governance logic (06 §3) — the pure, model-free decisions that gate
 * and shape every AI call. The gateway is the ONE chokepoint for all model
 * calls; the parts that need no provider (entitlement/data-control/budget
 * gating, PII redaction, feature→model routing, provenance shape) live here so
 * they are unit- and mutation-testable in isolation. The service composes them
 * around the provider call and the invocation ledger.
 *
 * Getting this right is the point: RLS-respecting context assembly and
 * pre-flight redaction are the #1 data-leak vectors (06 §3.4), so the rules
 * fail closed — any ambiguity refuses the call rather than sending data.
 */

/** The add-on pack every AI feature requires (06 §3.1). */
export const INTELLIGENCE_PACK = "intelligence";

/**
 * Per-feature model choice + default output budget (06 §3.7): cheap/fast models
 * for bounded structuring, stronger ones for open-ended drafting. Model ids are
 * provider-agnostic labels the provider port maps to a concrete model.
 */
export interface FeatureRoute {
  readonly model: string;
  readonly defaultMaxTokens: number;
}
export const FEATURE_ROUTING: Record<AiFeature, FeatureRoute> = {
  doc_summary: { model: "fast", defaultMaxTokens: 512 },
  quicklog_structuring: { model: "fast", defaultMaxTokens: 512 },
  report_narrative: { model: "fast", defaultMaxTokens: 1024 },
  root_cause: { model: "strong", defaultMaxTokens: 1024 },
  eightd_draft: { model: "strong", defaultMaxTokens: 2048 },
  compliance_qa: { model: "strong", defaultMaxTokens: 1024 },
};

export function routeFeature(feature: AiFeature): FeatureRoute {
  return FEATURE_ROUTING[feature];
}

// --- Provenance (06 §3.6) --------------------------------------------------

/** A cited source behind a drafted value — the UI renders these as source chips. */
export interface AiSource {
  readonly kind: string;
  readonly id: string;
  readonly quote?: string;
}

/**
 * What a feature returns: never a raw string written to an entity, always a
 * draft the user must explicitly accept, carrying its confidence band and the
 * sources it drew on (06 §3.6).
 */
export interface AiDraft<T = string> {
  readonly value: T;
  readonly confidence: AiConfidence;
  readonly sources: readonly AiSource[];
}

// --- Budget (06 §3.1) ------------------------------------------------------

export interface AiBudget {
  readonly tokenLimit: number;
  readonly tokensUsed: number;
}

/** Tokens left in the period; never negative. */
export function budgetRemaining(budget: AiBudget): number {
  return Math.max(0, budget.tokenLimit - budget.tokensUsed);
}

/**
 * Would spending `estimatedTokens` more overrun the period budget? A request
 * that exactly reaches the limit is allowed; one that crosses it is not.
 */
export function wouldExceedBudget(budget: AiBudget, estimatedTokens: number): boolean {
  return budget.tokensUsed + estimatedTokens > budget.tokenLimit;
}

// --- Gate (06 §3.1–3.3) ----------------------------------------------------

/** Why a call was refused before ever reaching a model. */
export type AiBlockReason = "entitlement" | "ai_disabled" | "region" | "budget";

export type AiGateResult = { readonly ok: true } | { readonly ok: false; readonly reason: AiBlockReason };

export interface AiGateInput {
  /** The `intelligence` pack is active for the tenant (06 §3.1). */
  readonly packActive: boolean;
  /** Tenant data control: `allow_ai=false` kills every feature (06 §3.3). */
  readonly allowAi: boolean;
  /** Tenant residency lock (e.g. "eu"); null = unrestricted (06 §3, 07 §5). */
  readonly regionLock: string | null;
  /** The region the configured provider serves. */
  readonly providerRegion: string;
  /** Current period budget, or null when the tenant has no budget configured. */
  readonly budget: AiBudget | null;
  /** Tokens this call is expected to spend (input + max output). */
  readonly estimatedTokens: number;
}

/**
 * The pre-flight gate, evaluated in fail-closed order: entitlement, then the
 * kill switch, then residency, then budget. A tenant with no budget row is
 * treated as unmetered (budget governance is opt-in per tenant); a residency
 * lock that the provider's region doesn't satisfy refuses rather than routing
 * data cross-region.
 */
export function gateInvocation(input: AiGateInput): AiGateResult {
  if (!input.packActive) return { ok: false, reason: "entitlement" };
  if (!input.allowAi) return { ok: false, reason: "ai_disabled" };
  if (input.regionLock !== null && input.regionLock !== input.providerRegion) {
    return { ok: false, reason: "region" };
  }
  if (input.budget !== null && wouldExceedBudget(input.budget, input.estimatedTokens)) {
    return { ok: false, reason: "budget" };
  }
  return { ok: true };
}

// --- PII redaction (06 §3.2) ----------------------------------------------

/** Maps a placeholder token back to the original value it stands in for. */
export type RedactionMap = Readonly<Record<string, string>>;

export interface Redaction {
  readonly redacted: string;
  readonly map: RedactionMap;
}

// Deliberately conservative: better to over-mask than to leak. Emails first, then
// phone-like digit runs, then any caller-supplied terms (e.g. names of people not
// on the tenant's team).
const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const PHONE_RE = /\+?\d[\d\s().-]{7,}\d/g;

/**
 * Replace PII with reversible placeholders before text leaves for a model
 * (06 §3.2). Identical values collapse to the same token, so the reverse map
 * stays small and `rehydrate` restores them in the response. `extraTerms` masks
 * caller-supplied literals (non-team names) — matched literally, longest first,
 * so a full name is masked before either of its parts.
 */
export function redactPii(text: string, opts: { extraTerms?: readonly string[] } = {}): Redaction {
  const map: Record<string, string> = {};
  const seen = new Map<string, string>(); // original value → token
  let n = 0;

  const tokenFor = (original: string): string => {
    const existing = seen.get(original);
    if (existing !== undefined) return existing;
    n += 1;
    const token = `[[PII_${n}]]`;
    seen.set(original, token);
    map[token] = original;
    return token;
  };

  let out = text.replace(EMAIL_RE, (m) => tokenFor(m)).replace(PHONE_RE, (m) => tokenFor(m));

  const terms = [...(opts.extraTerms ?? [])]
    .filter((t) => t.trim() !== "")
    .sort((a, b) => b.length - a.length);
  for (const term of terms) {
    if (!out.includes(term)) continue;
    out = out.split(term).join(tokenFor(term));
  }

  return { redacted: out, map };
}

/** Restore redacted placeholders in model output (06 §3.2, reversible map). */
export function rehydrate(text: string, map: RedactionMap): string {
  let out = text;
  for (const [token, original] of Object.entries(map)) {
    out = out.split(token).join(original);
  }
  return out;
}

/** How many distinct values a redaction masked — recorded on the invocation. */
export function redactionCount(map: RedactionMap): number {
  return Object.keys(map).length;
}
