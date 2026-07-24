import type { Metadata } from "next";
import { NcrDetail } from "@/features/ncrs/ncr-detail";

export const metadata: Metadata = { title: "NCR" };

export default async function NcrDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<React.ReactElement> {
  const { id } = await params;
  return <NcrDetail id={id} />;
}
