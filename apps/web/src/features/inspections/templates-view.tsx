"use client";

import { useRef } from "react";
import { useRouter } from "next/navigation";
import { ClipboardCheck, Check, BarChart3, Plus, Upload, Clock, FileText } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { FormSchema, type TemplateDto } from "@kaenal/types";
import { shortDate, titleCase } from "@/lib/format";
import { useTemplates, useInspections } from "@/hooks/use-inspections";
import { PageHeader } from "@/components/page-header";
import { Button, EmptyState, Skeleton } from "@/components/ui";
import { useToast } from "@/components/ui/toast";

/**
 * Inspection templates (04 §5), matching template-editor.jsx's list: summary
 * stat cards + a card grid, each card opening the drag-drop editor. Stats are
 * computed from real data (published count, Σ usage, inspection completion
 * rate) — no fabricated figures. Import JSON seeds a new-template draft from a
 * schema file.
 */
export function TemplatesView(): React.ReactElement {
  const router = useRouter();
  const toast = useToast();
  const query = useTemplates();
  const inspections = useInspections();
  const fileRef = useRef<HTMLInputElement>(null);

  const rows = query.data?.items ?? [];
  const published = rows.filter((t) => t.status === "published").length;
  const totalUses = rows.reduce((n, t) => n + t.usageCount, 0);

  const insItems = inspections.data?.items ?? [];
  const completed = insItems.filter((i) => i.status === "completed").length;
  const completionRate = insItems.length > 0 ? Math.round((completed / insItems.length) * 100) : null;

  const onImport = (file: File): void => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = typeof reader.result === "string" ? reader.result : "";
        const raw = JSON.parse(text) as unknown;
        const candidate = (raw as { schema?: unknown }).schema ?? raw;
        const parsed = FormSchema.safeParse(candidate);
        if (!parsed.success) {
          toast.error("That file isn't a valid template schema.");
          return;
        }
        sessionStorage.setItem("kaenal:import-template", JSON.stringify({ schema: parsed.data, name: (raw as { name?: string }).name }));
        router.push("/inspections/templates/new");
      } catch {
        toast.error("Couldn't read that file as JSON.");
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-5 p-6">
      <PageHeader
        title="Inspection Templates"
        description="Reusable checklists, scoring rules, and field configurations"
        actions={
          <>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onImport(f);
                e.target.value = "";
              }}
            />
            <Button onClick={() => fileRef.current?.click()}>
              <Upload size={14} /> Import JSON
            </Button>
            <Button variant="primary" onClick={() => router.push("/inspections/templates/new")}>
              <Plus size={14} /> New template
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-3 gap-3.5 max-md:grid-cols-1">
        <Stat icon={ClipboardCheck} color="#2563eb" label="Active templates" value={query.isLoading ? "—" : String(published)} />
        <Stat icon={Check} color="#16a34a" label="Total uses (YTD)" value={query.isLoading ? "—" : String(totalUses)} />
        <Stat
          icon={BarChart3}
          color="#9333ea"
          label="Avg completion rate"
          value={completionRate === null ? "—" : `${completionRate}%`}
        />
      </div>

      {query.isLoading ? (
        <div className="grid grid-cols-3 gap-3.5 max-lg:grid-cols-2 max-md:grid-cols-1">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-[150px] rounded-xl" />
          ))}
        </div>
      ) : query.isError ? (
        <div className="k-surface">
          <EmptyState icon={FileText} title="Couldn't load templates" action={<Button variant="primary" onClick={() => void query.refetch()}>Retry</Button>} />
        </div>
      ) : rows.length === 0 ? (
        <div className="k-surface">
          <EmptyState
            icon={FileText}
            title="No templates yet"
            body="Templates define the inspection checklists inspections are created from."
            action={
              <Button variant="primary" onClick={() => router.push("/inspections/templates/new")}>
                <Plus size={14} /> New template
              </Button>
            }
          />
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-3.5 max-lg:grid-cols-2 max-md:grid-cols-1">
          {rows.map((t) => (
            <TemplateCard key={t.id} template={t} onOpen={() => router.push(`/inspections/templates/${t.id}`)} />
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({ icon: Icon, color, label, value }: { icon: LucideIcon; color: string; label: string; value: string }): React.ReactElement {
  return (
    <div className="k-surface flex items-center gap-3.5 p-4">
      <div
        className="flex items-center justify-center rounded-xl"
        style={{ width: 40, height: 40, background: `${color}18`, color }}
      >
        <Icon size={20} />
      </div>
      <div>
        <div className="text-[11px] font-semibold uppercase tracking-wide text-muted">{label}</div>
        <div className="text-[24px] font-bold leading-tight">{value}</div>
      </div>
    </div>
  );
}

function TemplateCard({ template: t, onOpen }: { template: TemplateDto; onOpen: () => void }): React.ReactElement {
  const items = t.schema.sections.reduce((n, s) => n + s.items.length, 0);
  return (
    <button onClick={onOpen} className="k-surface flex flex-col gap-2.5 p-[18px] text-left transition-shadow hover:shadow-sm">
      <div className="flex items-start justify-between">
        <div
          className="flex items-center justify-center rounded-xl"
          style={{ width: 40, height: 40, background: "var(--accent-soft)", color: "var(--accent)" }}
        >
          <ClipboardCheck size={20} />
        </div>
        <span className="mono text-[11px] text-muted">v{t.version}</span>
      </div>
      <div>
        <div className="mb-1 text-[15px] font-semibold">{t.name}</div>
        <div className="text-[11.5px] text-muted">
          {titleCase(t.status)} · {t.schema.sections.length} sections · {items} items
        </div>
      </div>
      <div className="flex items-center justify-between border-t border-border pt-2 text-[11px] text-muted">
        <span className="inline-flex items-center gap-1">
          <Clock size={11} /> {shortDate(t.updatedAt)}
        </span>
        <span className="inline-flex items-center gap-1">
          <Check size={11} /> {t.usageCount} uses
        </span>
      </div>
    </button>
  );
}
