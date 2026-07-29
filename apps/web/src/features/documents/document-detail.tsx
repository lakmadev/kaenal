"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Send,
  Check,
  X,
  Archive,
  GitBranch,
  History,
  ShieldCheck,
  Sparkles,
  FileText,
  Clock,
  Eye,
  Download,
  Link2,
  ArrowRight,
} from "lucide-react";
import type { DocumentDto, DocumentVersionDto, EntityKind, EntityLinkDto, FileDto } from "@kaenal/types";
import { cn } from "@/lib/cn";
import { longDate } from "@/lib/format";
import { errorMessage } from "@/lib/api-error";
import { useMe, hasCapability } from "@/hooks/use-me";
import {
  useDocument,
  useDocumentVersions,
  useTransitionDocument,
  useReviewDocument,
  useNewDocumentVersion,
} from "@/hooks/use-documents";
import { useDownloadFile, usePreviewUrl } from "@/hooks/use-files";
import { useEntityLinks } from "@/hooks/use-entity-links";
import {
  Button,
  Dialog,
  DialogContent,
  Field,
  Input,
  Chip,
  Skeleton,
  EmptyState,
  useToast,
} from "@/components/ui";
import { DocStatus, UserCell, categoryLabel, fileTypeIcon, formatBytes } from "./document-bits";
import { FileDrop } from "./file-drop";

type Tab = "preview" | "versions" | "approvals" | "links";

/** Where each linkable entity kind lives in the web app (for "Open" on links). */
const ENTITY_ROUTE: Record<EntityKind, string> = {
  inspection: "inspections",
  ncr: "ncrs",
  eight_d: "8d",
  audit: "audits",
  capa: "capa",
  document: "documents",
  supplier: "suppliers",
};
const ENTITY_LABEL: Record<EntityKind, string> = {
  inspection: "Inspection",
  ncr: "NCR",
  eight_d: "8D",
  audit: "Audit",
  capa: "CAPA",
  document: "Document",
  supplier: "Supplier",
};

export function DocumentDetail({ id }: { id: string }): React.ReactElement {
  const router = useRouter();
  const { data: me } = useMe();
  const { data: doc, isLoading, isError } = useDocument(id);

  if (isLoading) return <DetailSkeleton />;
  if (isError || doc === undefined) {
    return (
      <div className="mx-auto max-w-5xl p-6">
        <BackLink onClick={() => router.push("/documents")} />
        <div className="k-surface mt-4">
          <EmptyState icon={FileText} title="Document not found" body="It may have been removed, or you may not have access." />
        </div>
      </div>
    );
  }

  return (
    <DocumentDetailView
      doc={doc}
      meId={me?.userId}
      canManage={hasCapability(me, "document:manage")}
      canApprove={hasCapability(me, "document:approve")}
    />
  );
}

function DocumentDetailView({
  doc,
  meId,
  canManage,
  canApprove,
}: {
  doc: DocumentDto;
  meId: string | undefined;
  canManage: boolean;
  canApprove: boolean;
}): React.ReactElement {
  const router = useRouter();
  const toast = useToast();
  const transition = useTransitionDocument();
  const review = useReviewDocument();
  const newVersion = useNewDocumentVersion();
  const download = useDownloadFile();
  const [tab, setTab] = useState<Tab>("preview");
  const [rejectOpen, setRejectOpen] = useState(false);
  const [versionOpen, setVersionOpen] = useState(false);

  const busy = transition.isPending || review.isPending || newVersion.isPending;
  // Four-eyes (07 §7): the author cannot approve their own document; the server
  // is the final guard, but we also hide the control (04 §6.6).
  const isAuthor = meId !== undefined && doc.ownerId === meId;
  const canReview = canApprove && !isAuthor;

  const runTransition = (to: "pending" | "draft" | "archived", okMsg: string): void => {
    transition.mutate(
      { id: doc.id, body: { to, version: doc.lockVersion } },
      { onSuccess: () => toast.success(okMsg), onError: (e) => toast.error(errorMessage(e)) },
    );
  };

  const approve = (): void =>
    review.mutate(
      { id: doc.id, body: { decision: "approve", version: doc.lockVersion } },
      { onSuccess: () => toast.success(`${doc.code} approved`), onError: (e) => toast.error(errorMessage(e)) },
    );

  const reject = (reason: string): void =>
    review.mutate(
      { id: doc.id, body: { decision: "reject", version: doc.lockVersion, ...(reason !== "" ? { reason } : {}) } },
      {
        onSuccess: () => {
          toast.success(`${doc.code} rejected`);
          setRejectOpen(false);
        },
        onError: (e) => toast.error(errorMessage(e)),
      },
    );

  const openVersion = (nextVersion: string, changelog: string, fileId: string | null): void =>
    newVersion.mutate(
      {
        id: doc.id,
        body: {
          nextVersion,
          version: doc.lockVersion,
          ...(changelog !== "" ? { changelog } : {}),
          ...(fileId !== null ? { fileId } : {}),
        },
      },
      {
        onSuccess: () => {
          toast.success(`Draft v${nextVersion} opened`);
          setVersionOpen(false);
        },
        onError: (e) => toast.error(errorMessage(e)),
      },
    );

  const doDownload = (): void => {
    if (doc.fileId === null) return;
    download.mutate(
      { id: doc.fileId, disposition: "attachment" },
      {
        onSuccess: (r) => window.open(r.url, "_blank", "noopener,noreferrer"),
        onError: (e) => toast.error(errorMessage(e)),
      },
    );
  };

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4 p-6">
      <BackLink onClick={() => router.push("/documents")} />

      {/* Header */}
      <div className="k-surface p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-2.5">
              <span className="mono text-[13px] font-semibold" style={{ color: "var(--accent)" }}>
                {doc.code}
              </span>
              <DocStatus status={doc.status} />
              <span className="mono text-[12px] text-muted">v{doc.version}</span>
              <span className="text-[12px] text-muted">· {categoryLabel(doc.category)}</span>
              {formatBytes(doc.fileSizeBytes) !== null && (
                <span className="text-[12px] text-muted">· {formatBytes(doc.fileSizeBytes)}</span>
              )}
            </div>
            <h1 className="text-[22px] font-bold tracking-tight">{doc.title}</h1>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {doc.fileId !== null && (
              <Button variant="ghost" loading={download.isPending} onClick={doDownload}>
                <Download size={14} /> Download
              </Button>
            )}
            {doc.status === "draft" && canManage && (
              <Button variant="primary" loading={busy} onClick={() => runTransition("pending", `${doc.code} submitted for review`)}>
                <Send size={14} /> Submit for review
              </Button>
            )}
            {doc.status === "pending" && canReview && (
              <>
                <Button variant="ghost" loading={busy} onClick={() => setRejectOpen(true)}>
                  <X size={14} /> Reject
                </Button>
                <Button variant="primary" loading={busy} onClick={approve}>
                  <Check size={14} /> Approve
                </Button>
              </>
            )}
            {doc.status === "pending" && !canReview && (
              <span className="inline-flex items-center gap-1.5 text-[12px] text-muted">
                <Clock size={13} /> Awaiting review
              </span>
            )}
            {doc.status === "rejected" && canManage && (
              <Button variant="primary" loading={busy} onClick={() => runTransition("draft", `${doc.code} reopened for editing`)}>
                Revise
              </Button>
            )}
            {doc.status === "approved" && canManage && (
              <>
                <Button variant="ghost" loading={busy} onClick={() => runTransition("archived", `${doc.code} archived`)}>
                  <Archive size={14} /> Archive
                </Button>
                <Button variant="primary" loading={busy} onClick={() => setVersionOpen(true)}>
                  <GitBranch size={14} /> New version
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Body: tabs + sidebar */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_300px]">
        <div>
          <div className="k-tabs mb-3.5">
            <button type="button" className={cn("k-tab", tab === "preview" && "active")} onClick={() => setTab("preview")}>
              <Eye size={13} /> Preview
            </button>
            <button type="button" className={cn("k-tab", tab === "versions" && "active")} onClick={() => setTab("versions")}>
              <History size={13} /> Versions
            </button>
            <button type="button" className={cn("k-tab", tab === "approvals" && "active")} onClick={() => setTab("approvals")}>
              <ShieldCheck size={13} /> Approvals
            </button>
            <button type="button" className={cn("k-tab", tab === "links" && "active")} onClick={() => setTab("links")}>
              <Link2 size={13} /> Linked records
            </button>
          </div>

          {tab === "preview" && <PreviewTab doc={doc} />}
          {tab === "versions" && <VersionsTab id={doc.id} currentVersion={doc.version} meId={meId} />}
          {tab === "approvals" && <ApprovalsTab doc={doc} meId={meId} />}
          {tab === "links" && <LinkedTab docId={doc.id} onOpen={(kind, id) => router.push(`/${ENTITY_ROUTE[kind]}/${id}`)} />}
        </div>

        {/* Sidebar */}
        <aside className="flex flex-col gap-4">
          <div className="k-surface p-4">
            <div className="k-overline mb-2.5">Properties</div>
            <div className="flex flex-col gap-2.5">
              <Meta label="Owner">
                <UserCell userId={doc.ownerId} meId={meId} />
              </Meta>
              <Meta label="Approver">
                <UserCell userId={doc.approverId} meId={meId} />
              </Meta>
              <Meta label="Category">
                <span className="text-[12.5px]">{categoryLabel(doc.category)}</span>
              </Meta>
              {doc.fileMime !== null && (
                <Meta label="File">
                  <span className="text-[12.5px]">
                    {fileTypeLabel(doc.fileMime)}
                    {formatBytes(doc.fileSizeBytes) !== null && ` · ${formatBytes(doc.fileSizeBytes)}`}
                  </span>
                </Meta>
              )}
              <Meta label="Version">
                <span className="mono text-[12px]">v{doc.version}</span>
              </Meta>
              <Meta label="Status">
                <DocStatus status={doc.status} />
              </Meta>
              <Meta label="Updated">
                <span className="mono text-[12px]">{longDate(doc.updatedAt)}</span>
              </Meta>
              <Meta label="Expires">
                <span className="mono text-[12px]">{longDate(doc.expiresAt)}</span>
              </Meta>
            </div>
          </div>

          <div className="k-surface p-4">
            <div className="k-overline mb-2.5">Compliance</div>
            {doc.frameworks.length === 0 ? (
              <p className="text-[12px] text-subtle">No frameworks tagged.</p>
            ) : (
              <div className="flex flex-col gap-1.5">
                {doc.frameworks.map((f) => (
                  <div
                    key={f}
                    className="flex items-center gap-2 rounded-[3px] px-2.5 py-1.5 text-[12px]"
                    style={{ background: "rgba(34,197,94,0.10)", color: "#15803d" }}
                  >
                    <ShieldCheck size={13} /> {f}
                  </div>
                ))}
              </div>
            )}
          </div>

          {doc.aiSummary !== null && doc.aiSummary !== "" && (
            <div className="k-surface p-4">
              <div className="k-overline mb-2.5 flex items-center gap-1.5">
                <Sparkles size={12} /> AI summary
              </div>
              <p className="text-[12.5px] leading-relaxed text-muted">{doc.aiSummary}</p>
            </div>
          )}
        </aside>
      </div>

      <RejectDialog open={rejectOpen} onOpenChange={setRejectOpen} loading={review.isPending} onConfirm={reject} />
      <NewVersionDialog open={versionOpen} onOpenChange={setVersionOpen} loading={newVersion.isPending} onConfirm={openVersion} />
    </div>
  );
}

function fileTypeLabel(mime: string): string {
  if (mime === "application/pdf") return "PDF";
  if (mime.startsWith("image/")) return `Image (${mime.slice(6).toUpperCase()})`;
  if (mime.includes("sheet") || mime.includes("excel")) return "Spreadsheet";
  if (mime.includes("word") || mime.includes("document")) return "Word document";
  return mime;
}

/**
 * Renders the attached file inline (04 §9 "viewer"). PDFs and images embed via a
 * short-TTL presigned URL fetched once when the tab opens (the fetch is the
 * audited download event, 07 §1); other types offer a download instead.
 */
function PreviewTab({ doc }: { doc: DocumentDto }): React.ReactElement {
  const { data, isLoading, isError } = usePreviewUrl(doc.fileId);

  if (doc.fileId === null) {
    return (
      <div className="k-surface">
        <EmptyState icon={FileText} title="No file attached" body="Attach a file by opening a new version of this document." />
      </div>
    );
  }
  if (isLoading) {
    return <Skeleton className="h-[520px] rounded-xl" />;
  }
  const url = data?.url ?? null;
  if (isError || url === null) {
    return (
      <div className="k-surface">
        <EmptyState icon={FileText} title="Preview unavailable" body="The file is still being scanned, or you don't have access to view it." />
      </div>
    );
  }

  const mime = doc.fileMime ?? "";
  const { Icon, color } = fileTypeIcon(doc.fileMime);
  return (
    <div className="k-surface overflow-hidden p-3">
      {mime === "application/pdf" ? (
        <iframe title="Document preview" src={url} className="h-[560px] w-full rounded-md border border-border" />
      ) : mime.startsWith("image/") ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={doc.title} className="mx-auto max-h-[560px] rounded-md" />
      ) : (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <span style={{ color }}>
            <Icon size={44} strokeWidth={1.5} />
          </span>
          <p className="text-[13px] text-muted">Inline preview isn&apos;t available for this file type.</p>
          <Button variant="primary" onClick={() => window.open(url, "_blank", "noopener,noreferrer")}>
            <Download size={14} /> Download to view
          </Button>
        </div>
      )}
    </div>
  );
}

function LinkedTab({
  docId,
  onOpen,
}: {
  docId: string;
  onOpen: (kind: EntityKind, id: string) => void;
}): React.ReactElement {
  const query = useEntityLinks("document", docId);
  if (query.isLoading) return <Skeleton className="h-40 rounded-xl" />;
  const links = query.data?.items ?? [];
  if (links.length === 0) {
    return (
      <div className="k-surface">
        <EmptyState icon={Link2} title="No linked records" body="Records that cite or reference this document appear here." />
      </div>
    );
  }
  // Show the end OPPOSITE this document.
  const other = (l: EntityLinkDto): { kind: EntityKind; id: string } =>
    l.fromKind === "document" && l.fromId === docId ? { kind: l.toKind, id: l.toId } : { kind: l.fromKind, id: l.fromId };

  return (
    <div className="flex flex-col gap-2">
      {links.map((l) => {
        const o = other(l);
        return (
          <div key={l.id} className="k-surface flex items-center gap-3 p-3">
            <div className="flex-1">
              <Chip bg="var(--bg-subtle)" fg="var(--text-muted)">
                {ENTITY_LABEL[o.kind]}
              </Chip>
              <span className="mono ml-2 text-[12px] text-muted">{o.id.slice(0, 8)}</span>
              <span className="ml-2 text-[12px] text-subtle">· {l.relation}</span>
            </div>
            <Button variant="ghost" onClick={() => onOpen(o.kind, o.id)}>
              Open <ArrowRight size={12} />
            </Button>
          </div>
        );
      })}
    </div>
  );
}

function VersionsTab({
  id,
  currentVersion,
  meId,
}: {
  id: string;
  currentVersion: string;
  meId: string | undefined;
}): React.ReactElement {
  const query = useDocumentVersions(id);
  if (query.isLoading) return <Skeleton className="h-48 rounded-xl" />;
  const versions = [...(query.data?.items ?? [])].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
  if (versions.length === 0) {
    return (
      <div className="k-surface">
        <EmptyState icon={History} title="No version history" body="Versions appear here as the document is revised." />
      </div>
    );
  }
  return (
    <div className="k-surface p-[18px]">
      <div className="flex flex-col">
        {versions.map((v, i) => (
          <VersionRow key={v.id} v={v} isCurrent={v.version === currentVersion} last={i === versions.length - 1} meId={meId} />
        ))}
      </div>
    </div>
  );
}

function VersionRow({
  v,
  isCurrent,
  last,
  meId,
}: {
  v: DocumentVersionDto;
  isCurrent: boolean;
  last: boolean;
  meId: string | undefined;
}): React.ReactElement {
  return (
    <div className="flex gap-3.5" style={{ paddingBottom: last ? 0 : 16, paddingTop: 4 }}>
      <div className="flex flex-col items-center gap-1.5">
        <span
          className="mono rounded-[3px] px-2.5 py-1 text-[12px] font-bold"
          style={{
            background: isCurrent ? "var(--accent)" : "var(--bg-subtle)",
            color: isCurrent ? "var(--accent-fg)" : "var(--text-muted)",
          }}
        >
          v{v.version}
        </span>
        {!last && <span className="w-0.5 flex-1" style={{ background: "var(--border)" }} />}
      </div>
      <div className="min-w-0 flex-1 pb-1">
        <div className="mb-1 flex flex-wrap items-center gap-2 text-[12px] text-muted">
          <span className="mono">{v.createdAt.slice(0, 10)}</span>
          {v.approvedAt !== null && (
            <span className="inline-flex items-center gap-1" style={{ color: "#15803d" }}>
              <Check size={12} /> approved by <UserCell userId={v.approvedBy} meId={meId} />
            </span>
          )}
          {isCurrent && <Chip bg="var(--accent-soft)" fg="var(--accent)">Current</Chip>}
        </div>
        <div className="text-[13px]" style={{ color: v.changelog !== null && v.changelog !== "" ? "var(--text)" : "var(--text-subtle)" }}>
          {v.changelog !== null && v.changelog !== "" ? v.changelog : "No changelog for this version."}
        </div>
      </div>
    </div>
  );
}

function ApprovalsTab({ doc, meId }: { doc: DocumentDto; meId: string | undefined }): React.ReactElement {
  const stages = [
    { label: "Author", user: doc.ownerId, done: true, hint: "Drafted the document" },
    {
      label: "Reviewer",
      user: doc.approverId,
      done: doc.status === "approved",
      hint:
        doc.status === "approved"
          ? "Approved"
          : doc.status === "rejected"
            ? "Rejected — returned for revision"
            : doc.status === "pending"
              ? "Awaiting review"
              : "Not yet submitted",
    },
  ];
  return (
    <div className="flex flex-col gap-3">
      {stages.map((s) => (
        <div
          key={s.label}
          className="k-surface flex items-center gap-3 p-4"
          style={{ background: s.done ? "rgba(34,197,94,0.06)" : "var(--surface)" }}
        >
          <div
            className="flex items-center justify-center rounded-full"
            style={{
              width: 28,
              height: 28,
              background: s.done ? "var(--success-500)" : "var(--bg-subtle)",
              color: s.done ? "white" : "var(--text-muted)",
            }}
          >
            {s.done ? <Check size={14} strokeWidth={2.5} /> : <Clock size={14} />}
          </div>
          <div className="flex-1">
            <div className="text-[13px] font-semibold">{s.label}</div>
            <div className="flex items-center gap-1.5 text-[12px] text-muted">
              <UserCell userId={s.user} meId={meId} emptyLabel="Unassigned" /> · {s.hint}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function RejectDialog({
  open,
  onOpenChange,
  loading,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  loading: boolean;
  onConfirm: (reason: string) => void;
}): React.ReactElement {
  const [reason, setReason] = useState("");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Reject document" description="The document returns to its author for revision. A reason is recorded on the audit trail.">
        <div className="flex flex-col gap-4">
          <Field label="Reason">
            {(a) => (
              <textarea
                {...a}
                className="k-input"
                rows={3}
                autoFocus
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="What needs to change before this can be approved?"
                style={{ height: "auto", padding: 10, resize: "vertical" }}
              />
            )}
          </Field>
          <div className="mt-1 flex justify-end gap-2">
            <Button type="button" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button variant="primary" loading={loading} onClick={() => onConfirm(reason.trim())}>
              Reject
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function NewVersionDialog({
  open,
  onOpenChange,
  loading,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  loading: boolean;
  onConfirm: (nextVersion: string, changelog: string, fileId: string | null) => void;
}): React.ReactElement {
  const [nextVersion, setNextVersion] = useState("");
  const [changelog, setChangelog] = useState("");
  const [file, setFile] = useState<FileDto | null>(null);

  const reset = (): void => {
    setNextVersion("");
    setChangelog("");
    setFile(null);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent
        title="Open a new version"
        description="Opens a fresh draft version. The current approved version stays approved and auditable until the new one is approved."
      >
        <div className="flex flex-col gap-4">
          <Field label="New version label" required>
            {(a) => (
              <Input {...a} autoFocus value={nextVersion} onChange={(e) => setNextVersion(e.target.value)} placeholder="e.g. 2.0" />
            )}
          </Field>
          <Field label="File" hint="Optional — the revised controlled file">
            {() => <FileDrop value={file} onChange={setFile} />}
          </Field>
          <Field label="Changelog">
            {(a) => (
              <textarea
                {...a}
                className="k-input"
                rows={3}
                value={changelog}
                onChange={(e) => setChangelog(e.target.value)}
                placeholder="What changed in this revision?"
                style={{ height: "auto", padding: 10, resize: "vertical" }}
              />
            )}
          </Field>
          <div className="mt-1 flex justify-end gap-2">
            <Button type="button" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              loading={loading}
              disabled={nextVersion.trim() === ""}
              onClick={() => onConfirm(nextVersion.trim(), changelog.trim(), file?.id ?? null)}
            >
              Open draft version
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Meta({ label, children }: { label: string; children: React.ReactNode }): React.ReactElement {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="k-overline">{label}</span>
      {children}
    </div>
  );
}

function BackLink({ onClick }: { onClick: () => void }): React.ReactElement {
  return (
    <button type="button" onClick={onClick} className="k-btn k-btn-plain self-start px-0 text-[13px] text-muted">
      <ArrowLeft size={14} /> Back to Documents
    </button>
  );
}

function DetailSkeleton(): React.ReactElement {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4 p-6">
      <Skeleton className="h-5 w-32" />
      <Skeleton className="h-28 rounded-xl" />
      <Skeleton className="h-64 rounded-xl" />
    </div>
  );
}
