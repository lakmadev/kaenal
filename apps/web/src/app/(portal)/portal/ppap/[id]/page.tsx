import type { Metadata } from "next";
import { PortalPpapDetail } from "@/features/portal/portal-ppap-detail";

export const metadata: Metadata = { title: "PPAP · Portal" };

export default async function PortalPpapDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<React.ReactElement> {
  const { id } = await params;
  return <PortalPpapDetail id={id} />;
}
