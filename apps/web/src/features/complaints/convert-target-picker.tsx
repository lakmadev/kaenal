"use client";

import { useState } from "react";
import Link from "next/link";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { ChevronDown, Search } from "lucide-react";
import type { CapaType, ComplaintConvertBody, ComplaintDto } from "@kaenal/types";
import { useCan } from "@/hooks/use-me";
import { useConvertComplaint } from "@/hooks/use-complaints";
import { useNcr, useNcrs } from "@/hooks/use-ncrs";
import { useEightD } from "@/hooks/use-eightd";
import { useCapa } from "@/hooks/use-capas";
import { Button, Dialog, DialogClose, DialogContent, useToast } from "@/components/ui";
import { apiErrorInfo } from "@/lib/api-error";
import { hasAnyConvertTarget, visibleConvertTargets } from "./convert-target-rules";

const CAPA_TYPE_OPTIONS: { id: CapaType; label: string }[] = [
  { id: "corrective", label: "Corrective" },
  { id: "preventive", label: "Preventive" },
];

/**
 * C4 — the register's/detail panel's convert-target picker (§0 B6f/B8c;
 * DESIGN-06 §4.3 `ComplaintConvertPicker.dc.html`). The jsx's own single
 * "Link / Create NCR" button (`qms-modules.jsx:411-413`, dead `kToast`)
 * becomes a real 4-way choice: create NCR / link an existing NCR / create 8D
 * / create CAPA — each shown ONLY if the caller actually holds that target's
 * own creation capability (`ncr:create`/`ncr:view`/`ncr:manage`/`capa:manage`,
 * §0 B6f — never rendering a control that would 403). A target already linked
 * (its id already set on the complaint) is never offered again.
 */
export function ConvertTargetPicker({
  complaint,
  size = "sm",
  fallback = null,
}: {
  complaint: ComplaintDto;
  size?: "sm" | "md";
  fallback?: React.ReactElement | null;
}): React.ReactElement | null {
  const toast = useToast();
  const convert = useConvertComplaint();
  const canManage = useCan("complaint:manage");
  const canCreateNcr = useCan("ncr:create");
  const canViewNcr = useCan("ncr:view");
  const canManage8d = useCan("ncr:manage");
  const canManageCapa = useCan("capa:manage");
  const [linkOpen, setLinkOpen] = useState(false);
  const [capaOpen, setCapaOpen] = useState(false);

  const offers = visibleConvertTargets(complaint, {
    complaintManage: canManage,
    ncrCreate: canCreateNcr,
    ncrView: canViewNcr,
    ncrManage: canManage8d,
    capaManage: canManageCapa,
  });

  if (!hasAnyConvertTarget(offers)) return fallback;

  function runConvert(body: ComplaintConvertBody): void {
    convert.mutate(
      { id: complaint.id, body },
      {
        onSuccess: (result) => {
          toast.success(`Linked to ${result.target.code}`);
          setLinkOpen(false);
          setCapaOpen(false);
        },
        onError: (e) => {
          const info = apiErrorInfo(e);
          if (info?.status === 409) {
            toast.error(info.message);
          } else {
            toast.error(info?.message ?? "Couldn't convert the complaint.");
          }
        },
      },
    );
  }

  return (
    <>
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <Button variant="ghost" size={size === "sm" ? "sm" : "md"} loading={convert.isPending}>
            Link / Create NCR <ChevronDown size={12} aria-hidden />
          </Button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content align="end" sideOffset={6} className="k-surface fade-in z-50 w-[220px] overflow-hidden p-1.5 shadow-xl">
            {offers.createNcr && (
              <DropdownMenu.Item
                onSelect={() => runConvert({ target: "ncr", lockVersion: complaint.lockVersion })}
                className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-[12.5px] hover:bg-bg-subtle"
              >
                Create NCR
              </DropdownMenu.Item>
            )}
            {offers.linkExistingNcr && (
              <DropdownMenu.Item
                onSelect={() => setLinkOpen(true)}
                className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-[12.5px] hover:bg-bg-subtle"
              >
                Link existing NCR
              </DropdownMenu.Item>
            )}
            {offers.createEightD && (
              <DropdownMenu.Item
                onSelect={() => runConvert({ target: "eight_d", lockVersion: complaint.lockVersion })}
                className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-[12.5px] hover:bg-bg-subtle"
              >
                Create 8D
              </DropdownMenu.Item>
            )}
            {offers.createCapa && (
              <DropdownMenu.Item
                onSelect={() => setCapaOpen(true)}
                className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-[12.5px] hover:bg-bg-subtle"
              >
                Create CAPA
              </DropdownMenu.Item>
            )}
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>

      {linkOpen && (
        <LinkExistingNcrDialog
          busy={convert.isPending}
          onClose={() => setLinkOpen(false)}
          onSelect={(existingNcrId) => runConvert({ target: "ncr", lockVersion: complaint.lockVersion, existingNcrId })}
        />
      )}

      {capaOpen && (
        <CreateCapaDialog
          busy={convert.isPending}
          onClose={() => setCapaOpen(false)}
          onSubmit={(type) => runConvert({ target: "capa", lockVersion: complaint.lockVersion, type })}
        />
      )}
    </>
  );
}

/** A small search-and-select over the caller's own visible NCRs (`ncr:view`)
 *  — mirrors `LinkPicker`'s search/select pattern, scoped to NCR only since
 *  the convert route's `existingNcrId` variant only ever targets one kind. */
function LinkExistingNcrDialog({
  busy,
  onClose,
  onSelect,
}: {
  busy: boolean;
  onClose: () => void;
  onSelect: (ncrId: string) => void;
}): React.ReactElement {
  const [query, setQuery] = useState("");
  const ncrs = useNcrs({ limit: 100 });
  const rows = (ncrs.data?.items ?? []).filter((n) => {
    const q = query.trim().toLowerCase();
    if (q === "") return true;
    return n.code.toLowerCase().includes(q) || n.title.toLowerCase().includes(q);
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent title="Link an existing NCR" description="Search by code or title — this links the complaint without creating a new NCR.">
        <div className="flex flex-col gap-3">
          <label className="flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5">
            <Search size={13} className="text-subtle" aria-hidden />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search NCRs…"
              className="w-full bg-transparent text-[12.5px] outline-none"
              autoFocus
            />
          </label>
          <div role="listbox" aria-label="NCRs" className="max-h-64 overflow-y-auto rounded-md border border-border">
            {ncrs.isPending ? (
              <div className="px-2.5 py-3 text-center text-[12px] text-subtle">Loading…</div>
            ) : rows.length === 0 ? (
              <div className="px-2.5 py-3 text-center text-[12px] text-subtle">No NCRs match.</div>
            ) : (
              rows.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  role="option"
                  disabled={busy}
                  onClick={() => onSelect(n.id)}
                  className="flex w-full flex-col items-start gap-0.5 px-2.5 py-1.5 text-left hover:bg-[var(--bg-subtle)] disabled:opacity-50"
                >
                  <span className="mono text-[11px]" style={{ color: "var(--accent)" }}>
                    {n.code}
                  </span>
                  <span className="truncate text-[12px]">{n.title}</span>
                </button>
              ))
            )}
          </div>
          <div className="flex justify-end">
            <DialogClose asChild>
              <Button variant="ghost">Cancel</Button>
            </DialogClose>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CreateCapaDialog({
  busy,
  onClose,
  onSubmit,
}: {
  busy: boolean;
  onClose: () => void;
  onSubmit: (type: CapaType) => void;
}): React.ReactElement {
  const [type, setType] = useState<CapaType>("corrective");
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent title="Create a CAPA" description="A CAPA has no complaint-derived type — choose one to continue.">
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1">
            <span className="k-overline">Type</span>
            <select className="k-input" value={type} onChange={(e) => setType(e.target.value as CapaType)}>
              {CAPA_TYPE_OPTIONS.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
          <div className="flex justify-end gap-2">
            <DialogClose asChild>
              <Button variant="ghost">Cancel</Button>
            </DialogClose>
            <Button variant="primary" loading={busy} onClick={() => onSubmit(type)}>
              Create CAPA
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** The register/detail-panel already-linked display — a plain accent link,
 *  matching the jsx's own `→ NCR-2026-0140` display exactly (`qms-modules.
 *  jsx:409-410`). Resolves the single most-advanced link (rank `capa` >
 *  `eight_d` > `ncr`, §0 B8d) via each target module's own detail hook. */
export function LinkedRecordLink({ complaint }: { complaint: ComplaintDto }): React.ReactElement | null {
  if (complaint.capaId !== null) return <LinkedCapa id={complaint.capaId} />;
  if (complaint.eightDId !== null) return <LinkedEightD id={complaint.eightDId} />;
  if (complaint.ncrId !== null) return <LinkedNcr id={complaint.ncrId} />;
  return null;
}

// Each of the three below is intentionally its own component (not inlined in
// a loop) so exactly one kind's own detail hook is called — only the kind
// actually linked is ever mounted, so no rules-of-hooks violation.

function LinkedNcr({ id }: { id: string }): React.ReactElement {
  const code = useNcr(id).data?.code;
  return (
    <Link href={`/ncrs/${id}`} className="mono text-[11px] underline" style={{ color: "var(--accent)" }}>
      → {code ?? `${id.slice(0, 8)}…`}
    </Link>
  );
}
function LinkedEightD({ id }: { id: string }): React.ReactElement {
  const code = useEightD(id).data?.code;
  return (
    <Link href={`/8d/${id}`} className="mono text-[11px] underline" style={{ color: "var(--accent)" }}>
      → {code ?? `${id.slice(0, 8)}…`}
    </Link>
  );
}
function LinkedCapa({ id }: { id: string }): React.ReactElement {
  const code = useCapa(id).data?.code;
  return (
    <Link href={`/capa/${id}`} className="mono text-[11px] underline" style={{ color: "var(--accent)" }}>
      → {code ?? `${id.slice(0, 8)}…`}
    </Link>
  );
}
