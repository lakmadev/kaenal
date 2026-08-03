import type { Metadata } from "next";
import { PortalScarDetail } from "@/features/portal/portal-scar-detail";

export const metadata: Metadata = { title: "Corrective action · Portal" };

export default async function PortalScarDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<React.ReactElement> {
  const { id } = await params;
  return <PortalScarDetail id={id} />;
}
