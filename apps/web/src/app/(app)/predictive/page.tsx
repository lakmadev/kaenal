import type { Metadata } from "next";
import { Suspense } from "react";
import { PredictiveRiskPage } from "@/features/predictive/predictive-risk-page";

export const metadata: Metadata = { title: "Predictive risk" };

export default function Page(): React.ReactElement {
  return (
    <Suspense>
      <PredictiveRiskPage />
    </Suspense>
  );
}
