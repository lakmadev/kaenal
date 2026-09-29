"use client";

import { useMemo, useState } from "react";
import { Search, Check, TriangleAlert } from "lucide-react";
import type { EntityKind } from "@kaenal/types";
import { useFmeas } from "@/hooks/use-fmea";
import { entityIcon } from "@/lib/entity-routes";
import { filterLinkPickerRecords, shouldShowKindChips, type LinkPickerRecord } from "@/lib/link-picker";
import { Dialog, DialogContent, Button, Spinner, Chip, EmptyState } from "@/components/ui";

export type { LinkPickerRecord };

/**
 * Cross-module link-creation picker (Sprint 04 R3 AC6, design audit §4.6 — no
 * web component previously called `POST /v1/entity-links`, only read it). Mirrors
 * `AssigneePicker`'s search/select pattern rather than inventing a new one.
 *
 * `kinds` is a prop so the component stays reusable for a future NCR/8D/audit/
 * supplier call site, but per the design audit's own flagged inconsistency
 * (`LinkPicker.dc.html` still drew 5 chips against a single-kind sprint scope),
 * a kind-filter chip row is a DEAD CONTROL when there is only one kind to filter
 * — so it is never rendered in that case, rather than shown with 4 disabled
 * chips. This sprint's only caller passes `kinds={["fmea"]}`.
 */
export function LinkPicker({
  open,
  onOpenChange,
  kinds,
  onSelect,
  busy = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kinds: EntityKind[];
  onSelect: (record: LinkPickerRecord) => void;
  busy?: boolean;
}): React.ReactElement {
  const [query, setQuery] = useState("");
  const [activeKind, setActiveKind] = useState<EntityKind>(kinds[0] ?? "fmea");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const showKindChips = shouldShowKindChips(kinds);
  const kind = showKindChips ? activeKind : (kinds[0] ?? "fmea");

  // Sprint 04 R3 AC: FMEA-only this sprint, backed by the existing unpaginated
  // `GET /v1/fmeas` list with client-side filtering — no new search-index work.
  const fmeas = useFmeas();
  const loading = kind === "fmea" && fmeas.isLoading;
  const isError = kind === "fmea" && fmeas.isError;

  const records: LinkPickerRecord[] = useMemo(() => {
    if (kind !== "fmea") return [];
    return (fmeas.data?.items ?? []).map((f) => ({
      kind: "fmea" as const,
      id: f.id,
      title: f.partCode,
      subtitle: f.partName,
    }));
  }, [kind, fmeas.data]);

  const filtered = useMemo(() => filterLinkPickerRecords(records, query), [records, query]);

  const reset = (): void => {
    setQuery("");
    setSelectedId(null);
  };

  const selected = filtered.find((r) => r.id === selectedId) ?? null;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent title="Link a record" description="Search and select a record to link.">
        <div className="flex flex-col gap-3">
          {showKindChips && (
            <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Filter by record type">
              {kinds.map((k) => (
                <button
                  key={k}
                  type="button"
                  role="tab"
                  aria-selected={k === activeKind}
                  onClick={() => {
                    setActiveKind(k);
                    setSelectedId(null);
                  }}
                >
                  <Chip
                    className={k === activeKind ? "border-accent bg-[var(--accent-soft)] text-accent" : ""}
                  >
                    {k}
                  </Chip>
                </button>
              ))}
            </div>
          )}

          <div className="flex items-center gap-1.5 rounded-md border border-border px-2.5 py-2">
            <Search size={13} className="text-subtle" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by code or name…"
              className="w-full bg-transparent text-[12.5px] outline-none placeholder:text-subtle"
              aria-label="Search records"
            />
          </div>

          <div className="max-h-72 overflow-y-auto rounded-md border border-border" role="listbox" aria-label="Search results">
            {loading ? (
              <div className="flex justify-center py-6">
                <Spinner size={16} />
              </div>
            ) : isError ? (
              <EmptyState
                icon={TriangleAlert}
                title="Couldn't load records"
                {...(fmeas.error instanceof Error ? { body: `Request ID: ${fmeas.error.message}` } : {})}
                action={
                  <Button variant="primary" size="sm" onClick={() => void fmeas.refetch()}>
                    Retry
                  </Button>
                }
              />
            ) : filtered.length === 0 ? (
              <div className="px-3 py-6 text-center text-[12.5px] text-subtle">No records match</div>
            ) : (
              filtered.map((r) => {
                const isSelected = r.id === selectedId;
                const Icon = entityIcon(r.kind);
                return (
                  <button
                    key={r.id}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => setSelectedId(r.id)}
                    className={
                      "flex w-full items-center gap-2.5 border-b border-border px-3 py-2 text-left last:border-b-0 hover:bg-[var(--bg-subtle)]" +
                      (isSelected ? " bg-[var(--accent-soft)]" : "")
                    }
                  >
                    <Icon size={16} className="shrink-0 text-subtle" aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[12.5px] font-medium text-text">{r.title}</span>
                      {r.subtitle !== undefined && (
                        <span className="block truncate text-[11px] text-muted">{r.subtitle}</span>
                      )}
                    </span>
                    {isSelected && <Check size={14} className="shrink-0 text-accent" aria-hidden />}
                  </button>
                );
              })
            )}
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              loading={busy}
              disabled={selected === null}
              onClick={() => {
                if (selected !== null) onSelect(selected);
              }}
            >
              Link
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
