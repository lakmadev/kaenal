import type { DocumentStatus, Role } from "@kaenal/types";
import { allow, deny } from "../result.js";
import { defineMachine, type Guard, type TransitionMap } from "./machine.js";

/**
 * Document lifecycle (02 §4):
 *   draft → pending → approved | rejected
 *   approved → archived
 *
 * A new version does not move this record backwards — it creates a new
 * `document_versions` row that starts at draft, so the approved version stays
 * approved and auditable while its successor is drafted.
 */
const DOCUMENT_TRANSITIONS: TransitionMap<DocumentStatus> = {
  draft: ["pending"],
  pending: ["approved", "rejected"],
  rejected: ["draft"],
  approved: ["archived"],
  archived: [],
};

export interface DocumentTransitionContext {
  readonly actorId: string;
  readonly actorRole: Role;
  /** Author of the version under review. */
  readonly ownerId?: string | null;
  /** Approved versions of this document other than the one in play. */
  readonly otherApprovedVersionCount: number;
}

/** Only admins and managers approve documents (03 §3). */
const requiresApproverRole: Guard<DocumentStatus, DocumentTransitionContext> = (ctx, _from, to) => {
  if (to !== "approved" && to !== "rejected") return allow();

  if (ctx.actorRole !== "admin" && ctx.actorRole !== "manager") {
    return deny("FORBIDDEN", "Only an admin or manager can approve or reject a document", {
      capability: "documents.approve",
      requiredRole: ["admin", "manager"],
    });
  }
  return allow();
};

/** Self-approval defeats the point of a controlled document. */
const forbidsSelfApproval: Guard<DocumentStatus, DocumentTransitionContext> = (ctx, _from, to) => {
  if (to !== "approved") return allow();

  if (ctx.ownerId != null && ctx.ownerId === ctx.actorId) {
    return deny("FORBIDDEN", "A document cannot be approved by its own author", {
      requires: "four_eyes",
    });
  }
  return allow();
};

/**
 * Archiving the only approved version would leave a controlled document with
 * no effective revision — people on the shop floor would be working to a
 * document that officially does not exist (03 §10).
 */
const keepsOneApprovedVersion: Guard<DocumentStatus, DocumentTransitionContext> = (ctx, from, to) => {
  if (to !== "archived") return allow();
  if (from !== "approved") return allow();

  if (ctx.otherApprovedVersionCount === 0) {
    return deny(
      "CONFLICT",
      "This is the only approved version of a controlled document and cannot be archived",
      { requires: "another_approved_version" },
    );
  }
  return allow();
};

export const documentMachine = defineMachine<DocumentStatus, DocumentTransitionContext>({
  transitions: DOCUMENT_TRANSITIONS,
  guards: [requiresApproverRole, forbidsSelfApproval, keepsOneApprovedVersion],
});
