import type { Metadata } from "next";
import { Network } from "lucide-react";
import { ModulePlaceholder } from "@/components/module-placeholder";

export const metadata: Metadata = { title: "Knowledge Graph" };

export default function Page(): React.ReactElement {
  return <ModulePlaceholder title="Knowledge Graph" icon={Network} />;
}
