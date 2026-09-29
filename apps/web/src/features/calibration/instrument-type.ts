import type { InstrumentType } from "@kaenal/types";

/** The 7 instrument types (C1 AC1 — the exact set the jsx's `INSTRUMENTS`
 *  fixture uses: CMM, comparator, profilometer, NDT, caliper, torque, laser
 *  tracker). Shared by the add-instrument form's select and the register's
 *  type display. */
export const INSTRUMENT_TYPE_OPTIONS: { id: InstrumentType; label: string }[] = [
  { id: "cmm", label: "CMM" },
  { id: "comparator", label: "Comparator" },
  { id: "profilometer", label: "Profilometer" },
  { id: "ndt", label: "NDT" },
  { id: "caliper", label: "Caliper" },
  { id: "torque", label: "Torque" },
  { id: "laser_tracker", label: "Laser tracker" },
];

export const INSTRUMENT_TYPE_LABEL: Record<InstrumentType, string> = Object.fromEntries(
  INSTRUMENT_TYPE_OPTIONS.map((o) => [o.id, o.label]),
) as Record<InstrumentType, string>;
