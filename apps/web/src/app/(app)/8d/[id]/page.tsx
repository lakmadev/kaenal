import type { Metadata } from "next";
import { EightDDetail } from "@/features/eightd/eightd-detail";

export const metadata: Metadata = { title: "8D" };

export default async function EightDDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<React.ReactElement> {
  const { id } = await params;
  return <EightDDetail id={id} />;
}
