"use client";

import { useTemplate } from "@/hooks/use-inspections";
import { Spinner, EmptyState, Button } from "@/components/ui";
import { FileText } from "lucide-react";
import { useRouter } from "next/navigation";
import { TemplateEditor, type Draft } from "./template-editor";

/**
 * Loads an existing template and seeds the editor with its schema, plus the
 * `source` so Save & Publish updates the right row: a draft is edited in place,
 * a published one is versioned + superseded (see `useSaveTemplate`) — never a
 * silent duplicate.
 */
export function TemplateEditorLoader({ id }: { id: string }): React.ReactElement {
  const router = useRouter();
  const query = useTemplate(id);

  if (query.isLoading) {
    return (
      <div className="flex h-[calc(100vh-56px)] items-center justify-center">
        <Spinner />
      </div>
    );
  }
  if (query.isError || query.data === undefined) {
    return (
      <div className="k-surface m-6">
        <EmptyState
          icon={FileText}
          title="Couldn't load template"
          action={<Button variant="primary" onClick={() => router.push("/inspections/templates")}>Back to templates</Button>}
        />
      </div>
    );
  }

  const t = query.data;
  const initial: Draft = {
    name: t.name,
    version: t.version,
    sections: t.schema.sections.map((s) => ({ id: s.id, title: s.title, weight: s.weight, items: s.items })),
  };
  return <TemplateEditor initial={initial} source={{ id: t.id, status: t.status, lockVersion: t.lockVersion }} />;
}
