import type { Metadata } from "next";
import { ReportsHome } from "@/features/reports/reports-home";

export const metadata: Metadata = { title: "Reports" };

export default function Page(): React.ReactElement {
  return <ReportsHome />;
}
