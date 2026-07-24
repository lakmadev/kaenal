import type { Metadata } from "next";
import { TriangleAlert } from "lucide-react";
import { ModulePlaceholder } from "@/components/module-placeholder";

export const metadata: Metadata = { title: "NCRs" };

export default function Page(): React.ReactElement {
  return <ModulePlaceholder title="NCRs" icon={TriangleAlert} />;
}
