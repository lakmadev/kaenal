import type { Metadata } from "next";
import { Suspense } from "react";
import { NcrList } from "@/features/ncrs/ncr-list";

export const metadata: Metadata = { title: "NCRs" };

export default function NcrsPage(): React.ReactElement {
  return (
    <Suspense>
      <NcrList />
    </Suspense>
  );
}
