import type { Metadata } from "next";
import { Suspense } from "react";
import { MsaPage } from "@/features/msa/msa-page";

export const metadata: Metadata = { title: "MSA / Gauge R&R" };

export default function Msa(): React.ReactElement {
  return (
    <Suspense>
      <MsaPage />
    </Suspense>
  );
}
