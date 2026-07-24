import type { Metadata } from "next";
import { Bell } from "lucide-react";
import { ModulePlaceholder } from "@/components/module-placeholder";

export const metadata: Metadata = { title: "Notifications" };

export default function Page(): React.ReactElement {
  return <ModulePlaceholder title="Notifications" icon={Bell} />;
}
