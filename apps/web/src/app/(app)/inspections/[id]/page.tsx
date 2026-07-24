import type { Metadata } from "next";
import { InspectionDetail } from "@/features/inspections/inspection-detail";

export const metadata: Metadata = { title: "Inspection" };

export default async function InspectionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<React.ReactElement> {
  const { id } = await params;
  return <InspectionDetail id={id} />;
}
