import type { Metadata } from "next";
import { Truck } from "lucide-react";
import { ModulePlaceholder } from "@/components/module-placeholder";

export const metadata: Metadata = { title: "Suppliers" };

export default function Page(): React.ReactElement {
  return <ModulePlaceholder title="Suppliers" icon={Truck} />;
}
