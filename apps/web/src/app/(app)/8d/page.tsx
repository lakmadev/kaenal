import type { Metadata } from "next";
import { GitBranch } from "lucide-react";
import { ModulePlaceholder } from "@/components/module-placeholder";

export const metadata: Metadata = { title: "8D Problem Solving" };

export default function Page(): React.ReactElement {
  return <ModulePlaceholder title="8D Problem Solving" icon={GitBranch} />;
}
