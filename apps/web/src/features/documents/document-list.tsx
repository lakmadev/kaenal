"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Search, FileText, Folder, Clock, Eye, List, LayoutGrid, Table, Check, ShieldCheck, Upload } from "lucide-react";
import type { DocumentDto, DocumentCategory, DocumentStatus } from "@kaenal/types";
import { shortDate } from "@/lib/format";
import { useMe, hasCapability } from "@/hooks/use-me";
import { useDocuments } from "@/hooks/use-documents";
import { PageHeader } from "@/components/page-header";
import { Button, Segmented, Chip, EmptyState, Skeleton } from "@/components/ui";
import {
  CATEGORIES,
  categoryLabel,
  fileTypeIcon,
  formatBytes,
  DocStatus,
  UserCell,
  UserAvatar,
} from "./document-bits";
import { DocumentCreateDialog } from "./document-create-dialog";

type CategoryFilter = "all" | DocumentCategory;
type StatusFilter = "all" | DocumentStatus;
type Smart = "expiring" | "review" | null;
type View = "list" | "grid" | "matrix";

const STATUS_TABS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "draft", label: "Draft" },
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "archived", label: "Archived" },
];

/** Days between now and an ISO date (negative = past). */
function daysUntil(iso: string): number {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);
}
function isExpiringSoon(iso: string | null): boolean {
  if (iso === null) return false;
  return daysUntil(iso) <= 90;
}

export function DocumentList(): React.ReactElement {
  const router = useRouter();
  const { data: me } = useMe();
  const canManage = hasCapability(me, "document:manage");

  const [category, setCategory] = useState<CategoryFilter>("all");
  const [smart, setSmart] = useState<Smart>(null);
  const [framework, setFramework] = useState<string | null>(null);
  const [status, setStatus] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");
  const [view, setView] = useState<View>("list");
  const [createOpen, setCreateOpen] = useState(false);
  const [createWithFile, setCreateWithFile] = useState(false);

  // The library spans every category/status, so we load one page and narrow it
  // client-side (mirrors the NCR/CAPA modules until virtualized paging).
  const query = useDocuments();
  const items = useMemo(() => query.data?.items ?? [], [query.data]);

  // Frameworks actually present on the loaded documents drive the rail's
  // Compliance filter — no hard-coded standards that don't match the data.
  const frameworks = useMemo(
    () => [...new Set(items.flatMap((d) => d.frameworks))].sort((a, b) => a.localeCompare(b)),
    [items],
  );

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter(
      (d) =>
        (smart !== "expiring" || (d.status === "approved" && isExpiringSoon(d.expiresAt))) &&
        (smart !== "review" || d.status === "pending") &&
        (category === "all" || d.category === category) &&
        (framework === null || d.frameworks.includes(framework)) &&
        (status === "all" || d.status === status) &&
        (q === "" || d.title.toLowerCase().includes(q) || d.code.toLowerCase().includes(q)),
    );
  }, [items, search, smart, category, framework, status]);

  // The compliance matrix is a cross-category, cross-framework lens, so it
  // ignores the folder (its row axis) and framework (its column axis), honouring
  // only search/status/smart.
  const matrixDocs = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter(
      (d) =>
        (smart !== "expiring" || (d.status === "approved" && isExpiringSoon(d.expiresAt))) &&
        (smart !== "review" || d.status === "pending") &&
        (status === "all" || d.status === status) &&
        (q === "" || d.title.toLowerCase().includes(q) || d.code.toLowerCase().includes(q)),
    );
  }, [items, search, smart, status]);

  const countFor = (id: CategoryFilter): number =>
    id === "all" ? items.length : items.filter((d) => d.category === id).length;

  const headerTitle =
    framework !== null
      ? framework
      : smart === "expiring"
        ? "Expiring soon"
        : smart === "review"
          ? "Pending review"
          : category === "all"
            ? "All Documents"
            : categoryLabel(category);

  const pickCategory = (id: CategoryFilter): void => {
    setCategory(id);
    setSmart(null);
    setFramework(null);
  };
  const pickSmart = (s: Exclude<Smart, null>): void => {
    setSmart((v) => (v === s ? null : s));
    setCategory("all");
    setFramework(null);
  };
  const pickFramework = (f: string): void => {
    setFramework((v) => (v === f ? null : f));
    setSmart(null);
  };

  const openCreate = (withFile: boolean): void => {
    setCreateWithFile(withFile);
    setCreateOpen(true);
  };

  return (
    <div className="fade-in flex h-[calc(100vh-56px)]">
      {/* Library rail */}
      <div className="w-[240px] shrink-0 overflow-y-auto border-r border-border bg-surface px-3 py-4">
        <div className="k-overline px-2 pb-2">Library</div>
        <RailItem icon={Folder} label="All Documents" count={countFor("all")} active={category === "all" && smart === null && framework === null} onClick={() => pickCategory("all")} />
        {CATEGORIES.map((c) => (
          <RailItem key={c.id} icon={c.icon} color={c.color} label={c.label} count={countFor(c.id)} active={category === c.id && smart === null && framework === null} onClick={() => pickCategory(c.id)} />
        ))}

        <div className="k-overline px-2 pb-2 pt-5">Smart views</div>
        <RailItem icon={Clock} color="var(--warning-600)" label="Expiring soon" active={smart === "expiring"} onClick={() => pickSmart("expiring")} />
        <RailItem icon={Eye} color="var(--info-600)" label="Pending review" active={smart === "review"} onClick={() => pickSmart("review")} />

        {frameworks.length > 0 && (
          <>
            <div className="k-overline px-2 pb-2 pt-5">Compliance</div>
            {frameworks.map((f) => (
              <RailItem key={f} icon={ShieldCheck} label={f} active={framework === f} onClick={() => pickFramework(f)} />
            ))}
          </>
        )}
      </div>

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="px-6 pt-6">
          <PageHeader
            title={headerTitle}
            description={`${rows.length} of ${items.length} documents`}
            actions={
              canManage ? (
                <>
                  <Button variant="ghost" onClick={() => openCreate(true)}>
                    <Upload size={14} /> Upload
                  </Button>
                  <Button variant="primary" onClick={() => openCreate(false)}>
                    <Plus size={14} /> New document
                  </Button>
                </>
              ) : undefined
            }
          />
        </div>

        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-2.5 px-6 py-3">
          <div className="relative max-w-[320px] flex-1">
            <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-subtle" />
            <input
              className="k-input"
              placeholder="Search documents…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ paddingLeft: 34 }}
            />
          </div>
          <Segmented options={STATUS_TABS} value={status} onChange={setStatus} ariaLabel="Filter by status" />
          <div className="ml-auto">
            <Segmented
              size="sm"
              ariaLabel="View"
              value={view}
              onChange={setView}
              options={[
                { value: "list", icon: List, label: "" },
                { value: "grid", icon: LayoutGrid, label: "" },
                { value: "matrix", icon: Table, label: "" },
              ]}
            />
          </div>
        </div>

        {/* Body */}
        <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6">
          {query.isLoading ? (
            <ListSkeleton />
          ) : query.isError ? (
            <ErrorCard onRetry={() => void query.refetch()} />
          ) : view === "matrix" ? (
            <ComplianceMatrix docs={matrixDocs} />
          ) : rows.length === 0 ? (
            <div className="k-surface">
              <EmptyState
                icon={FileText}
                title={search !== "" || status !== "all" || category !== "all" || smart !== null || framework !== null ? "No matching documents" : "No documents yet"}
                body="Create a controlled document to start managing it."
                action={
                  canManage ? (
                    <Button variant="primary" onClick={() => openCreate(false)}>
                      <Plus size={14} /> New document
                    </Button>
                  ) : undefined
                }
              />
            </div>
          ) : view === "list" ? (
            <DocTable rows={rows} meId={me?.userId} onOpen={(id) => router.push(`/documents/${id}`)} />
          ) : (
            <DocGrid rows={rows} onOpen={(id) => router.push(`/documents/${id}`)} />
          )}

          {query.data?.nextCursor != null && rows.length > 0 && (
            <p className="mt-4 text-center text-[12px] text-subtle">
              Showing the first {rows.length}. Pagination & virtualization land with the shared table.
            </p>
          )}
        </div>
      </div>

      <DocumentCreateDialog open={createOpen} onOpenChange={setCreateOpen} fileFirst={createWithFile} />
    </div>
  );
}

function RailItem({
  icon: Icon,
  color,
  label,
  count,
  active,
  onClick,
}: {
  icon: typeof Folder;
  color?: string;
  label: string;
  count?: number;
  active: boolean;
  onClick: () => void;
}): React.ReactElement {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mb-0.5 flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] font-medium"
      style={{
        background: active ? "var(--accent-soft)" : "transparent",
        color: active ? "var(--accent)" : "var(--text)",
      }}
    >
      <Icon size={15} className="shrink-0" style={{ color: active ? "var(--accent)" : color }} />
      <span className="flex-1 truncate text-left">{label}</span>
      {count !== undefined && <span className="text-[11px] font-semibold text-subtle">{count}</span>}
    </button>
  );
}

function FrameworkChips({ frameworks }: { frameworks: string[] }): React.ReactElement {
  if (frameworks.length === 0) return <span className="text-subtle">—</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {frameworks.slice(0, 2).map((f) => (
        <Chip key={f} bg="var(--bg-subtle)" fg="var(--text-muted)" style={{ fontSize: 10, height: 18, padding: "2px 6px" }}>
          {f}
        </Chip>
      ))}
      {frameworks.length > 2 && <span className="self-center text-[10px] text-subtle">+{frameworks.length - 2}</span>}
    </div>
  );
}

function DocTable({
  rows,
  meId,
  onOpen,
}: {
  rows: DocumentDto[];
  meId: string | undefined;
  onOpen: (id: string) => void;
}): React.ReactElement {
  return (
    <div className="k-surface overflow-x-auto p-0">
      <table className="k-table">
        <thead>
          <tr>
            <th>Name</th>
            <th style={{ width: 70 }}>Ver.</th>
            <th style={{ width: 110 }}>Status</th>
            <th style={{ width: 120 }}>Owner</th>
            <th style={{ width: 120 }}>Approver</th>
            <th style={{ width: 100 }}>Updated</th>
            <th style={{ width: 100 }}>Expires</th>
            <th style={{ width: 140 }}>Frameworks</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((d) => {
            const expiring = d.status === "approved" && isExpiringSoon(d.expiresAt);
            const { Icon, color } = fileTypeIcon(d.fileMime);
            const size = formatBytes(d.fileSizeBytes);
            return (
              <tr key={d.id} className="cursor-pointer" onClick={() => onOpen(d.id)}>
                <td>
                  <div className="flex items-center gap-2.5">
                    <span style={{ color }}>
                      <Icon size={20} strokeWidth={1.5} />
                    </span>
                    <div className="min-w-0">
                      <div className="truncate text-[13px] font-semibold" title={d.title}>
                        {d.title}
                      </div>
                      <div className="text-[11px] text-muted">
                        <span className="mono">{d.code}</span> · {categoryLabel(d.category)}
                        {size !== null && ` · ${size}`}
                        {expiring && <span className="ml-1.5 font-semibold" style={{ color: "var(--warning-600)" }}>● Expiring</span>}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="mono text-[12px] text-muted">v{d.version}</td>
                <td>
                  <DocStatus status={d.status} />
                </td>
                <td>
                  <UserCell userId={d.ownerId} meId={meId} />
                </td>
                <td>
                  <UserCell userId={d.approverId} meId={meId} />
                </td>
                <td className="whitespace-nowrap text-[12px] text-muted">{shortDate(d.updatedAt)}</td>
                <td
                  className="whitespace-nowrap text-[12px]"
                  style={{ color: expiring ? "var(--warning-700)" : "var(--text-muted)", fontWeight: expiring ? 600 : 400 }}
                >
                  {shortDate(d.expiresAt)}
                </td>
                <td>
                  <FrameworkChips frameworks={d.frameworks} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function DocGrid({ rows, onOpen }: { rows: DocumentDto[]; onOpen: (id: string) => void }): React.ReactElement {
  return (
    <div className="grid gap-3.5" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))" }}>
      {rows.map((d) => {
        const { Icon, color } = fileTypeIcon(d.fileMime);
        const size = formatBytes(d.fileSizeBytes);
        return (
          <button
            key={d.id}
            type="button"
            onClick={() => onOpen(d.id)}
            className="k-surface flex flex-col gap-3 p-4 text-left transition-shadow hover:shadow-md"
          >
            <div className="flex h-[100px] items-center justify-center rounded-md" style={{ background: "var(--bg-subtle)", color }}>
              <Icon size={42} strokeWidth={1.5} />
            </div>
            <div className="min-w-0">
              <div className="truncate text-[13px] font-semibold" title={d.title}>
                {d.title}
              </div>
              <div className="text-[11px] text-muted">
                v{d.version}
                {size !== null && ` · ${size}`} · {shortDate(d.updatedAt)}
              </div>
            </div>
            <div className="flex items-center justify-between">
              <DocStatus status={d.status} />
              <UserAvatar />
            </div>
          </button>
        );
      })}
    </div>
  );
}

/**
 * Compliance coverage matrix (the prototype's third view) — categories × the
 * frameworks actually present on the loaded documents, each cell the count of
 * docs in that category tagged with that framework, plus a per-category coverage
 * bar. Computed entirely from real `category`/`frameworks` data (no fabrication).
 */
function ComplianceMatrix({ docs }: { docs: DocumentDto[] }): React.ReactElement {
  const frameworks = useMemo(
    () => [...new Set(docs.flatMap((d) => d.frameworks))].sort((a, b) => a.localeCompare(b)),
    [docs],
  );

  if (frameworks.length === 0) {
    return (
      <div className="k-surface">
        <EmptyState
          icon={ShieldCheck}
          title="No compliance data yet"
          body="Tag documents with frameworks (e.g. IATF 16949, ISO 9001) to see coverage by category."
        />
      </div>
    );
  }

  return (
    <div className="k-surface overflow-x-auto p-0">
      <table className="k-table" style={{ minWidth: 640 }}>
        <thead>
          <tr>
            <th>Document category</th>
            {frameworks.map((f) => (
              <th key={f} style={{ textAlign: "center", width: 130 }}>
                {f}
              </th>
            ))}
            <th style={{ textAlign: "center", width: 120 }}>Coverage</th>
          </tr>
        </thead>
        <tbody>
          {CATEGORIES.map((cat) => {
            const catDocs = docs.filter((d) => d.category === cat.id);
            const covered = frameworks.filter((fw) => catDocs.some((d) => d.frameworks.includes(fw))).length;
            const pct = Math.round((covered / frameworks.length) * 100);
            const Icon = cat.icon;
            return (
              <tr key={cat.id}>
                <td>
                  <div className="flex items-center gap-2.5">
                    <span
                      className="flex items-center justify-center rounded-[3px]"
                      style={{ width: 28, height: 28, background: `${cat.color}18`, color: cat.color }}
                    >
                      <Icon size={14} />
                    </span>
                    <div>
                      <div className="text-[13px] font-semibold">{cat.label}</div>
                      <div className="text-[11px] text-muted">
                        {catDocs.length} {catDocs.length === 1 ? "document" : "documents"}
                      </div>
                    </div>
                  </div>
                </td>
                {frameworks.map((fw) => {
                  const n = catDocs.filter((d) => d.frameworks.includes(fw)).length;
                  return (
                    <td key={fw} style={{ textAlign: "center" }}>
                      {n > 0 ? (
                        <span
                          className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[12px] font-semibold"
                          style={{ background: "rgba(34,197,94,0.14)", color: "#15803d" }}
                        >
                          <Check size={12} strokeWidth={2.5} /> {n}
                        </span>
                      ) : (
                        <span className="text-[12px] text-subtle">—</span>
                      )}
                    </td>
                  );
                })}
                <td>
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-[60px] overflow-hidden rounded-full" style={{ background: "var(--bg-subtle)" }}>
                      <div
                        className="h-full"
                        style={{ width: `${pct}%`, background: pct === 100 ? "var(--success-500)" : "var(--accent)" }}
                      />
                    </div>
                    <span className="mono text-[12px] font-semibold">{pct}%</span>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ListSkeleton(): React.ReactElement {
  return (
    <div className="k-surface flex flex-col gap-2 p-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <Skeleton key={i} className="h-11" />
      ))}
    </div>
  );
}

function ErrorCard({ onRetry }: { onRetry: () => void }): React.ReactElement {
  return (
    <div className="k-surface">
      <EmptyState
        icon={FileText}
        title="Couldn't load documents"
        body="Something went wrong fetching the library."
        action={
          <Button variant="primary" onClick={onRetry}>
            Retry
          </Button>
        }
      />
    </div>
  );
}
