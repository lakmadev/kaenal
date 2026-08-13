import type { Metadata } from "next";
import { Suspense } from "react";
import { FmeaWorkbench } from "@/features/fmea/fmea-workbench";

export const metadata: Metadata = { title: "FMEA workbench" };

export default function FmeaPage(): React.ReactElement {
  return (
    <Suspense>
      <FmeaWorkbench />
    </Suspense>
  );
}
