import type { Metadata } from "next";
import { TemplatesView } from "@/features/inspections/templates-view";

export const metadata: Metadata = { title: "Inspection Templates" };

export default function TemplatesPage(): React.ReactElement {
  return <TemplatesView />;
}
