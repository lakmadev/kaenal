import type { Metadata } from "next";
import { Suspense } from "react";
import { EcnListPage } from "@/features/ecn/ecn-list-page";

export const metadata: Metadata = { title: "Engineering change notices" };

export default function EcnPage(): React.ReactElement {
  return (
    <Suspense>
      <EcnListPage />
    </Suspense>
  );
}
