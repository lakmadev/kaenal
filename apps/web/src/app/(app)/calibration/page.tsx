import type { Metadata } from "next";
import { Suspense } from "react";
import { CalibrationRegisterPage } from "@/features/calibration/calibration-register-page";

export const metadata: Metadata = { title: "Calibration management" };

export default function CalibrationPage(): React.ReactElement {
  return (
    <Suspense>
      <CalibrationRegisterPage />
    </Suspense>
  );
}
