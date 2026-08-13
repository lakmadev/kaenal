import type { Metadata } from "next";
import { ScarDetail } from "@/features/scar/scar-detail";

export const metadata: Metadata = { title: "SCAR" };

export default async function ScarDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<React.ReactElement> {
  const { id } = await params;
  return <ScarDetail id={id} />;
}
