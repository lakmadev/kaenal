import type { Metadata } from "next";
import { InspectionList } from "@/features/inspections/inspection-list";

export const metadata: Metadata = { title: "Inspections" };

export default function InspectionsPage(): React.ReactElement {
  return <InspectionList />;
}
