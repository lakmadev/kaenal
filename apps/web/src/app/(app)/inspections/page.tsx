import type { Metadata } from "next";
import { ClipboardCheck } from "lucide-react";
import { ModulePlaceholder } from "@/components/module-placeholder";

export const metadata: Metadata = { title: "Inspections" };

export default function Page(): React.ReactElement {
  return <ModulePlaceholder title="Inspections" icon={ClipboardCheck} />;
}
