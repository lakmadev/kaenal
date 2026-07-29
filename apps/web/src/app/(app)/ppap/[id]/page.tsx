import type { Metadata } from "next";
import { PpapDetail } from "@/features/ppap/ppap-detail";

export const metadata: Metadata = { title: "PPAP" };

export default async function PpapDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<React.ReactElement> {
  const { id } = await params;
  return <PpapDetail id={id} />;
}
