import type { Metadata } from "next";
import { Suspense } from "react";
import { GraphExplorer } from "@/features/graph/graph-explorer";

export const metadata: Metadata = { title: "Knowledge Graph" };

export default function GraphPage(): React.ReactElement {
  return (
    <Suspense>
      <GraphExplorer />
    </Suspense>
  );
}
