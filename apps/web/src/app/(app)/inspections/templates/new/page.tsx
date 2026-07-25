import type { Metadata } from "next";
import { TemplateEditor } from "@/features/inspections/template-editor";

export const metadata: Metadata = { title: "New Template" };

export default function NewTemplatePage(): React.ReactElement {
  return <TemplateEditor />;
}
