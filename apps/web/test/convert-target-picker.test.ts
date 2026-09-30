import { describe, expect, it } from "vitest";
import { hasAnyConvertTarget, visibleConvertTargets } from "../src/features/complaints/convert-target-rules";

const UNLINKED = { ncrId: null, eightDId: null, capaId: null };

describe("visibleConvertTargets (SPRINT-06 §0 B6f/B8c)", () => {
  it("admin (holds every capability) sees all 4 targets on an unconverted complaint", () => {
    const offers = visibleConvertTargets(UNLINKED, {
      complaintManage: true,
      ncrCreate: true,
      ncrView: true,
      ncrManage: true,
      capaManage: true,
    });
    expect(offers).toEqual({ createNcr: true, linkExistingNcr: true, createEightD: true, createCapa: true });
    expect(hasAnyConvertTarget(offers)).toBe(true);
  });

  it("auditor (ncr:create + ncr:view, but not ncr:manage/capa:manage) can create or link an NCR but not 8D/CAPA", () => {
    const offers = visibleConvertTargets(UNLINKED, {
      complaintManage: true,
      ncrCreate: true,
      ncrView: true,
      ncrManage: false,
      capaManage: false,
    });
    expect(offers).toEqual({ createNcr: true, linkExistingNcr: true, createEightD: false, createCapa: false });
  });

  it("a viewer (no complaint:manage) is offered nothing, regardless of target capabilities", () => {
    const offers = visibleConvertTargets(UNLINKED, {
      complaintManage: false,
      ncrCreate: true,
      ncrView: true,
      ncrManage: true,
      capaManage: true,
    });
    expect(hasAnyConvertTarget(offers)).toBe(false);
  });

  it("never re-offers a target that is already linked, even with full capabilities", () => {
    const offers = visibleConvertTargets(
      { ncrId: "11111111-1111-1111-1111-111111111111", eightDId: null, capaId: null },
      { complaintManage: true, ncrCreate: true, ncrView: true, ncrManage: true, capaManage: true },
    );
    expect(offers.createNcr).toBe(false);
    expect(offers.linkExistingNcr).toBe(false);
    // 8D/CAPA are unaffected by the NCR link — a complaint can carry more than
    // one linked record (§2 C4 UC).
    expect(offers.createEightD).toBe(true);
    expect(offers.createCapa).toBe(true);
  });

  it("hasAnyConvertTarget is false once every target is either linked or ungranted", () => {
    const offers = visibleConvertTargets(
      { ncrId: "1", eightDId: "2", capaId: "3" },
      { complaintManage: true, ncrCreate: true, ncrView: true, ncrManage: true, capaManage: true },
    );
    expect(hasAnyConvertTarget(offers)).toBe(false);
  });
});
