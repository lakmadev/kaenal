import type { Metadata } from "next";
import { PortalOverview } from "@/features/portal/portal-overview";

export const metadata: Metadata = { title: "Supplier portal" };

export default function PortalHomePage(): React.ReactElement {
  return <PortalOverview />;
}
