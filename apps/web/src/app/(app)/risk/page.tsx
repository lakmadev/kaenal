import type { Metadata } from "next";
import { Suspense } from "react";
import { RiskRegisterPage } from "@/features/risk/risk-register-page";

export const metadata: Metadata = { title: "Risk register" };

export default function RiskPage(): React.ReactElement {
  return (
    <Suspense>
      <RiskRegisterPage />
    </Suspense>
  );
}
