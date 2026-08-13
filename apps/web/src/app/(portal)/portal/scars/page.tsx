import type { Metadata } from "next";
import { PortalScarList } from "@/features/portal/portal-scar-list";

export const metadata: Metadata = { title: "Corrective actions · Portal" };

export default function PortalScarsPage(): React.ReactElement {
  return <PortalScarList />;
}
