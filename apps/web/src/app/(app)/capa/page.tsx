import type { Metadata } from "next";
import { ShieldCheck } from "lucide-react";
import { ModulePlaceholder } from "@/components/module-placeholder";

export const metadata: Metadata = { title: "CAPA" };

export default function Page(): React.ReactElement {
  return <ModulePlaceholder title="CAPA" icon={ShieldCheck} />;
}
