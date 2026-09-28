import type { Metadata } from "next";
import { Suspense } from "react";
import { CapaList } from "@/features/capa/capa-list";

export const metadata: Metadata = { title: "CAPA" };

export default function CapaPage(): React.ReactElement {
  return (
    <Suspense>
      <CapaList />
    </Suspense>
  );
}
