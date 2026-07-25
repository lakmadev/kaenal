import type { Metadata } from "next";
import { CapaList } from "@/features/capa/capa-list";

export const metadata: Metadata = { title: "CAPA" };

export default function CapaPage(): React.ReactElement {
  return <CapaList />;
}
