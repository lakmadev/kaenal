import type { Metadata } from "next";
import { Suspense } from "react";
import { SpcCharts } from "@/features/spc/spc-charts";

export const metadata: Metadata = { title: "SPC charts" };

export default function SpcPage(): React.ReactElement {
  return (
    <Suspense>
      <SpcCharts />
    </Suspense>
  );
}
