"use client";

import { useMemo, useRef, useState } from "react";
import { Check, Search, Upload, X } from "lucide-react";
import type { MemberDto } from "@kaenal/types";
import { useMembers } from "@/hooks/use-members";
import { useCompetencies, useRecordTraining } from "@/hooks/use-training";
import { uploadFile } from "@/hooks/use-files";
import { Avatar } from "@/components/avatar";
import { Button, Dialog, DialogClose, DialogContent, Skeleton, useToast } from "@/components/ui";
import { apiErrorInfo } from "@/lib/api-error";

const todayIso = (): string => new Date().toISOString().slice(0, 10);

/**
 * Board 8 — the record-training dialog (T2). No jsx precedent — both call
 * sites ("Assign training", a gaps-list row's "Schedule") are `kToast` only
 * in the mock. Per T2's own resolved interpretation, "assign" and "record a
 * completion" are the same action this sprint (Q-T2) — one dialog, submitted
 * as one all-or-nothing batch (T2 AC1). The member multi-select follows
 * `AssigneePicker`'s search/select pattern, widened to multi (DESIGN-05 §4.8).
 */
export function RecordTrainingDialog({
  initialMemberIds = [],
  initialCompetencyId,
  onClose,
}: {
  initialMemberIds?: string[];
  initialCompetencyId?: string;
  onClose: () => void;
}): React.ReactElement {
  const toast = useToast();
  const members = useMembers();
  const competencies = useCompetencies({ limit: 200 });
  const record = useRecordTraining();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selected, setSelected] = useState<Set<string>>(new Set(initialMemberIds));
  const [query, setQuery] = useState("");
  const [competencyId, setCompetencyId] = useState(initialCompetencyId ?? "");
  const [completedAt, setCompletedAt] = useState(todayIso());
  const [evidenceFileId, setEvidenceFileId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [evidenceName, setEvidenceName] = useState<string | null>(null);
  const [err, setErr] = useState("");

  const memberList = useMemo(() => members.data?.items ?? [], [members.data]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q === "") return memberList;
    return memberList.filter((m) => m.name.toLowerCase().includes(q) || m.role.toLowerCase().includes(q));
  }, [memberList, query]);
  const byId = useMemo(() => new Map<string, MemberDto>(memberList.map((m) => [m.userId, m])), [memberList]);
  const activeCompetencies = competencies.data?.items ?? [];

  function toggle(userId: string): void {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  }

  async function pickFile(file: File): Promise<void> {
    setUploading(true);
    setErr("");
    try {
      const uploaded = await uploadFile(file, undefined, { entityKind: "training_batch" });
      setEvidenceFileId(uploaded.id);
      setEvidenceName(file.name);
    } catch {
      setErr("Couldn't upload the evidence file.");
    } finally {
      setUploading(false);
    }
  }

  function submit(): void {
    if (selected.size === 0) {
      setErr("Choose at least one member.");
      return;
    }
    if (competencyId === "") {
      setErr("Choose a competency.");
      return;
    }
    if (completedAt > todayIso()) {
      setErr("Completion date can't be in the future.");
      return;
    }
    setErr("");
    record.mutate(
      {
        memberIds: [...selected],
        competencyId,
        completedAt,
        evidenceFileId,
      },
      {
        onSuccess: (result) => {
          toast.success(`Recorded training for ${result.items.length} member${result.items.length === 1 ? "" : "s"}`);
          onClose();
        },
        onError: (e) => setErr(apiErrorInfo(e)?.message ?? "Couldn't record training."),
      },
    );
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent title="Record training" description="Pick members and a competency, then log the completion.">
        <div className="flex flex-col gap-3" style={{ maxHeight: "72vh", overflowY: "auto" }}>
          <div>
            <span className="k-overline mb-1 block">Members</span>
            {selected.size > 0 && (
              <div className="mb-1.5 flex flex-wrap gap-1.5">
                {[...selected].map((id) => (
                  <span key={id} className="k-chip" style={{ background: "var(--accent-soft)", display: "inline-flex", alignItems: "center", gap: 4 }}>
                    {byId.get(id)?.name ?? id.slice(0, 8)}
                    <button type="button" aria-label={`Remove ${byId.get(id)?.name ?? "member"}`} onClick={() => toggle(id)}>
                      <X size={10} aria-hidden />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <div className="flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5">
              <Search size={13} className="text-subtle" aria-hidden />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search members…"
                className="w-full bg-transparent text-[12.5px] outline-none"
              />
            </div>
            <div role="listbox" aria-multiselectable="true" aria-label="Members" className="mt-1 max-h-40 overflow-y-auto rounded-md border border-border">
              {members.isPending ? (
                <div className="p-2">
                  <Skeleton className="h-6 w-full" />
                </div>
              ) : filtered.length === 0 ? (
                <div className="px-2.5 py-3 text-center text-[12px] text-subtle">No members match</div>
              ) : (
                filtered.map((m) => {
                  const isSelected = selected.has(m.userId);
                  return (
                    <button
                      key={m.userId}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => toggle(m.userId)}
                      className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left hover:bg-[var(--bg-subtle)]"
                    >
                      <Avatar name={m.name} size={20} />
                      <span className="min-w-0 flex-1 truncate text-[12.5px]">{m.name}</span>
                      {isSelected && <Check size={13} className="text-accent" aria-hidden />}
                    </button>
                  );
                })
              )}
            </div>
          </div>

          <label className="flex flex-col gap-1">
            <span className="k-overline">Competency</span>
            <select className="k-input" value={competencyId} onChange={(e) => setCompetencyId(e.target.value)}>
              <option value="" disabled>
                Choose a competency…
              </option>
              {activeCompetencies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.mandatory ? "* " : ""}
                  {c.name}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span className="k-overline">Completed on</span>
            <input type="date" className="k-input" max={todayIso()} value={completedAt} onChange={(e) => setCompletedAt(e.target.value)} />
          </label>

          <div>
            <span className="k-overline mb-1 block">Evidence (optional)</span>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file !== undefined) void pickFile(file);
              }}
            />
            {evidenceFileId !== null ? (
              <div className="flex items-center gap-2 text-[12px]">
                <span className="k-chip" style={{ background: "var(--bg-subtle)" }}>
                  {evidenceName} · scan pending
                </span>
                <button type="button" className="k-btn-plain text-[11px] text-muted" onClick={() => (setEvidenceFileId(null), setEvidenceName(null))}>
                  Remove
                </button>
              </div>
            ) : (
              <Button variant="ghost" size="sm" loading={uploading} onClick={() => fileInputRef.current?.click()}>
                <Upload size={13} aria-hidden /> Upload evidence
              </Button>
            )}
          </div>

          {err !== "" && (
            <div className="text-[12px]" style={{ color: "var(--danger-600)" }}>
              {err}
            </div>
          )}

          <div className="mt-1 flex justify-end gap-2">
            <DialogClose asChild>
              <Button variant="ghost">Cancel</Button>
            </DialogClose>
            <Button variant="primary" loading={record.isPending} onClick={submit}>
              Record training
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
