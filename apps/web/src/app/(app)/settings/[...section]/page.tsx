import type { Metadata } from "next";
import { Settings } from "lucide-react";
import { ModulePlaceholder } from "@/components/module-placeholder";

export const metadata: Metadata = { title: "Settings" };

export default function Page(): React.ReactElement {
  return (
    <ModulePlaceholder
      title="Settings"
      icon={Settings}
      description="Personal, Workspace, Security, Compliance, Process, and Developer settings."
    />
  );
}
