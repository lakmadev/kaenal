import type { Metadata } from "next";
import { ReportPage } from "@/features/reports/report-page";

export const metadata: Metadata = { title: "Report" };

export default async function Page({ params }: { params: Promise<{ id: string }> }): Promise<React.ReactElement> {
  const { id } = await params;
  return <ReportPage id={id} />;
}
