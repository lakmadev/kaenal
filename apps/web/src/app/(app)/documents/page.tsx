import type { Metadata } from "next";
import { DocumentList } from "@/features/documents/document-list";

export const metadata: Metadata = { title: "Documents" };

export default function DocumentsPage(): React.ReactElement {
  return <DocumentList />;
}
