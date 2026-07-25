import type { Metadata } from "next";
import { CapaDetail } from "@/features/capa/capa-detail";

export const metadata: Metadata = { title: "CAPA" };

export default async function CapaDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<React.ReactElement> {
  const { id } = await params;
  return <CapaDetail id={id} />;
}
