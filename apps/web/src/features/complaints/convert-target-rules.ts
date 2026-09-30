import type { ComplaintDto } from "@kaenal/types";

/**
 * Pure capability-gating rules for the convert-target picker (SPRINT-06 §0
 * B6f/B8c): which of the 4 convert targets a caller may be offered for a
 * given complaint. A target already linked (its id already set) is never
 * offered again, and a target the caller lacks the real creation capability
 * for is never offered either — never a control that would 403 server-side.
 * Kept pure/exported (not inlined in the component) so this rule is
 * unit-testable without rendering.
 */
export interface ConvertCapabilities {
  complaintManage: boolean;
  ncrCreate: boolean;
  ncrView: boolean;
  ncrManage: boolean;
  capaManage: boolean;
}

export interface ConvertTargetOffers {
  createNcr: boolean;
  linkExistingNcr: boolean;
  createEightD: boolean;
  createCapa: boolean;
}

export function visibleConvertTargets(
  complaint: Pick<ComplaintDto, "ncrId" | "eightDId" | "capaId">,
  caps: ConvertCapabilities,
): ConvertTargetOffers {
  const ncrOpen = caps.complaintManage && complaint.ncrId === null;
  return {
    createNcr: ncrOpen && caps.ncrCreate,
    linkExistingNcr: ncrOpen && caps.ncrView,
    createEightD: caps.complaintManage && complaint.eightDId === null && caps.ncrManage,
    createCapa: caps.complaintManage && complaint.capaId === null && caps.capaManage,
  };
}

export function hasAnyConvertTarget(offers: ConvertTargetOffers): boolean {
  return offers.createNcr || offers.linkExistingNcr || offers.createEightD || offers.createCapa;
}
