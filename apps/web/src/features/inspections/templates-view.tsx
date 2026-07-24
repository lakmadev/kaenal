"use client";

import { useState } from "react";
import { FileText, Eye } from "lucide-react";
import type { TemplateDto } from "@kaenal/types";
import { longDate, titleCase } from "@/lib/format";
import { useTemplates } from "@/hooks/use-inspections";
import { PageHeader } from "@/components/page-header";
import { Button, Chip, Dialog, DialogContent, EmptyState, Skeleton } from "@/components/ui";
import { InspectionForm } from "./form-renderer";

const STATUS_COLORS: Record<string, { bg: string; fg: string }> = {
  draft: { bg: "rgba(167,139,250,0.12)", fg: "#7c3aed" },
  published: { bg: "rgba(34,197,94,0.14)", fg: "#15803d" },
  archived: { bg: "rgba(100,116,139,0.16)", fg: "#475569" },
};

/**
 * Inspection templates (04 §5). Lists every template with its version, status and
 * usage, and previews the form schema read-only (reusing the dynamic renderer).
 * The drag-and-drop template editor (create/edit → publish a new immutable
 * version) is a later slice; this makes the schema and its lifecycle visible.
 */
export function TemplatesView(): React.ReactElement {
  const query = useTemplates();
  const [preview, setPreview] = useState<TemplateDto | null>(null);
  const rows = query.data?.items ?? [];

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4 p-6">
      <PageHeader title="Inspection Templates" description="The checklists inspections are created from." />

      {query.isLoading ? (
        <div className="k-surface flex flex-col gap-2 p-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-11" />
          ))}
        </div>
      ) : query.isError ? (
        <div className="k-surface">
          <EmptyState icon={FileText} title="Couldn't load templates" action={<Button variant="primary" onClick={() => void query.refetch()}>Retry</Button>} />
        </div>
      ) : rows.length === 0 ? (
        <div className="k-surface">
          <EmptyState icon={FileText} title="No templates yet" body="Templates define the inspection checklists; the editor lands in a later slice." />
        </div>
      ) : (
        <div className="k-surface overflow-x-auto p-0">
          <table className="k-table">
            <thead>
              <tr>
                <th>Name</th>
                <th style={{ width: 90 }}>Version</th>
                <th style={{ width: 120 }}>Status</th>
                <th style={{ width: 90 }}>Usage</th>
                <th style={{ width: 120 }}>Updated</th>
                <th style={{ width: 100 }} />
              </tr>
            </thead>
            <tbody>
              {rows.map((t) => {
                const c = STATUS_COLORS[t.status] ?? { bg: "var(--bg-subtle)", fg: "var(--text-muted)" };
                return (
                  <tr key={t.id}>
                    <td className="font-medium">{t.name}</td>
                    <td className="mono text-[12px] text-muted">v{t.version}</td>
                    <td>
                      <Chip bg={c.bg} fg={c.fg}>
                        {titleCase(t.status)}
                      </Chip>
                    </td>
                    <td className="mono text-[12px]">{t.usageCount}</td>
                    <td className="whitespace-nowrap text-[12px] text-muted">{longDate(t.updatedAt)}</td>
                    <td className="text-right">
                      <Button size="sm" onClick={() => setPreview(t)}>
                        <Eye size={13} /> Preview
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={preview !== null} onOpenChange={(o) => !o && setPreview(null)}>
        {preview !== null && (
          <DialogContent
            title={`${preview.name} · v${preview.version}`}
            description={`${preview.schema.sections.length} section(s) · ${titleCase(preview.status)}`}
            className="max-w-[720px]"
          >
            <div className="max-h-[70vh] overflow-y-auto">
              <InspectionForm schema={preview.schema} responses={{}} readOnly />
            </div>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
