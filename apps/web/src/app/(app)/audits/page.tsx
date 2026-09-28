import type { Metadata } from "next";
import { Suspense } from "react";
import { AuditsPageShell } from "@/features/audits/audits-page-shell";

export const metadata: Metadata = { title: "Audits" };

export default function AuditsPage(): React.ReactElement {
  return (
    <Suspense>
      <AuditsPageShell />
    </Suspense>
  );
}
