import type { Metadata } from "next";
import { DocumentDetail } from "@/features/documents/document-detail";

export const metadata: Metadata = { title: "Document" };

export default async function DocumentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<React.ReactElement> {
  const { id } = await params;
  return <DocumentDetail id={id} />;
}
