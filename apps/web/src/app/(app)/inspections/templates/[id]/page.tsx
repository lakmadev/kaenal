import type { Metadata } from "next";
import { TemplateEditorLoader } from "@/features/inspections/template-editor-loader";

export const metadata: Metadata = { title: "Edit Template" };

export default async function EditTemplatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<React.ReactElement> {
  const { id } = await params;
  return <TemplateEditorLoader id={id} />;
}
