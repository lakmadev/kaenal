import type { Metadata } from "next";
import { FileText } from "lucide-react";
import { ModulePlaceholder } from "@/components/module-placeholder";

export const metadata: Metadata = { title: "Documents" };

export default function Page(): React.ReactElement {
  return <ModulePlaceholder title="Documents" icon={FileText} />;
}
