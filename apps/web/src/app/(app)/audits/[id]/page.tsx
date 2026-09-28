import type { Metadata } from "next";
import { AuditDetailShell } from "@/features/audits/audit-detail-shell";

export const metadata: Metadata = { title: "Audits" };

export default async function AuditDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<React.ReactElement> {
  const { id } = await params;
  return <AuditDetailShell id={id} />;
}
