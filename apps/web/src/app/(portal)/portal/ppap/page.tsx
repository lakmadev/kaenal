import type { Metadata } from "next";
import { PortalPpapList } from "@/features/portal/portal-ppap-list";

export const metadata: Metadata = { title: "PPAP · Portal" };

export default function PortalPpapPage(): React.ReactElement {
  return <PortalPpapList />;
}
