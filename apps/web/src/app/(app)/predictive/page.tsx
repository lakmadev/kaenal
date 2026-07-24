import type { Metadata } from "next";
import { LineChart } from "lucide-react";
import { ModulePlaceholder } from "@/components/module-placeholder";

export const metadata: Metadata = { title: "Predictive Analytics" };

export default function Page(): React.ReactElement {
  return <ModulePlaceholder title="Predictive Analytics" icon={LineChart} />;
}
