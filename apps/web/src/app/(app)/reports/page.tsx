import type { Metadata } from "next";
import { BarChart3 } from "lucide-react";
import { ModulePlaceholder } from "@/components/module-placeholder";

export const metadata: Metadata = { title: "Reports" };

export default function Page(): React.ReactElement {
  return <ModulePlaceholder title="Reports" icon={BarChart3} />;
}
