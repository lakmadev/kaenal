import type { CalibrationResult } from "@kaenal/types";

/** History-table result cell (`qms-modules.jsx:284-293`'s "Pass — as found" /
 *  "Adjusted, pass" copy, generalized to the three real `CalibrationResult`
 *  values). Colour is never the only signal — the word itself always differs. */
export function CalibrationResultLabel({ result }: { result: CalibrationResult }): React.ReactElement {
  if (result === "fail") {
    return <span style={{ color: "var(--danger-600)", fontWeight: 600 }}>Fail — out of tol.</span>;
  }
  if (result === "adjusted") {
    return <span style={{ color: "var(--warning-700)", fontWeight: 600 }}>Adjusted, pass</span>;
  }
  return <span>Pass — as found</span>;
}
