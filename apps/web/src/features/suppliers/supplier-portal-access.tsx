"use client";

import { useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { UserPlus, Users } from "lucide-react";
import type { PortalContactDto, PortalContactStatus } from "@kaenal/types";
import { Button, EmptyState, Skeleton, useToast } from "@/components/ui";
import { AuthError } from "@/lib/auth";
import { shortDate } from "@/lib/format";
import {
  usePortalContacts,
  useResendPortalContact,
  useRevokePortalContact,
} from "@/hooks/use-portal-contacts";

/**
 * "Portal access" tab on the supplier detail (binding canvas "PortalAccess"):
 * the supplier's external contacts with status, two-factor state, last sign-in,
 * and Resend invite / Revoke actions — all wired to the real portal-contacts API.
 */

const GRID = "2.2fr 1fr 1fr 1.2fr 1.4fr";

const STATUS: Record<PortalContactStatus, { label: string; bg: string; fg: string }> = {
  active: { label: "Active", bg: "var(--success-100)", fg: "var(--success-700)" },
  enrolment_pending: { label: "Enrolment pending", bg: "var(--warning-100)", fg: "var(--warning-700)" },
  invited: { label: "Invited", bg: "var(--bg-subtle)", fg: "var(--slate-600)" },
  revoked: { label: "Revoked", bg: "var(--danger-100)", fg: "var(--danger-700)" },
};

function twoFactor(c: PortalContactDto): string {
  if (c.status === "invited") return "—";
  return c.mfaEnrolled ? "Enrolled" : "Not set up";
}

function lastSignIn(c: PortalContactDto): string {
  if (c.lastSignInAt === null) return "Never";
  const d = new Date(c.lastSignInAt);
  if (d.toDateString() !== new Date().toDateString()) return shortDate(c.lastSignInAt);
  return `Today, ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false })}`;
}

export function PortalAccessTab({
  supplierId,
  supplierName,
  onInvite,
}: {
  supplierId: string;
  supplierName: string;
  onInvite: () => void;
}): React.ReactElement {
  const toast = useToast();
  const contacts = usePortalContacts(supplierId);
  const resend = useResendPortalContact(supplierId);
  const revoke = useRevokePortalContact(supplierId);
  const [confirming, setConfirming] = useState<PortalContactDto | null>(null);

  const items = contacts.data?.pages.flatMap((p) => p.items) ?? [];

  const doResend = (c: PortalContactDto): void =>
    resend.mutate(c.id, {
      onSuccess: () => toast.success(`Invitation re-sent to ${c.email}`),
      onError: (e) => toast.error(e instanceof AuthError ? e.message : "Couldn’t re-send the invitation."),
    });

  const doRevoke = (c: PortalContactDto): void =>
    revoke.mutate(c.id, {
      onSuccess: () => {
        toast.success(`Access revoked for ${c.email}`);
        setConfirming(null);
      },
      onError: (e) => toast.error(e instanceof AuthError ? e.message : "Couldn’t revoke access."),
    });

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-4">
        <div>
          <div style={{ fontSize: 15, fontWeight: 700 }}>Portal access</div>
          <div className="text-muted" style={{ fontSize: 12.5, marginTop: 2 }}>
            Contacts who can sign in to the supplier portal for {supplierName}. Two-factor is required.
          </div>
        </div>
        <Button variant="primary" onClick={onInvite}>
          <UserPlus size={13} /> Invite to portal
        </Button>
      </div>

      <div className="k-surface overflow-hidden" style={{ borderRadius: 7 }}>
        {contacts.isLoading ? (
          <div className="p-4">
            <Skeleton style={{ height: 40 }} />
          </div>
        ) : contacts.isError ? (
          <EmptyState icon={Users} title="Couldn’t load portal contacts" body="Please try again in a moment." />
        ) : items.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No portal contacts yet"
            body="Invite a contact so this supplier can respond to SCARs and PPAP requests."
          />
        ) : (
          <>
            <div
              className="grid text-muted"
              style={{
                gridTemplateColumns: GRID,
                gap: 12,
                padding: "10px 16px",
                background: "var(--bg)",
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
              }}
            >
              <div>Contact</div>
              <div>Status</div>
              <div>Two-factor</div>
              <div>Last sign-in</div>
              <div style={{ textAlign: "right" }}>Actions</div>
            </div>
            {items.map((c) => {
              const st = STATUS[c.status];
              const pending = c.status === "invited" || c.status === "enrolment_pending";
              return (
                <div
                  key={c.id}
                  className="grid items-center"
                  style={{ gridTemplateColumns: GRID, gap: 12, padding: "12px 16px", borderTop: "1px solid var(--border)" }}
                >
                  <div className="min-w-0">
                    <div className="truncate" style={{ fontSize: 13, fontWeight: 600 }}>
                      {c.name ?? c.email.split("@")[0]}
                    </div>
                    <div className="mono truncate text-muted" style={{ fontSize: 12 }}>
                      {c.email}
                    </div>
                  </div>
                  <div>
                    <span
                      className="inline-flex items-center"
                      style={{
                        height: 22,
                        padding: "0 8px",
                        borderRadius: 9999,
                        fontSize: 11,
                        fontWeight: 600,
                        background: st.bg,
                        color: st.fg,
                      }}
                    >
                      {st.label}
                    </span>
                  </div>
                  <div className="text-muted" style={{ fontSize: 12.5 }}>
                    {twoFactor(c)}
                  </div>
                  <div className="text-muted" style={{ fontSize: 12.5 }}>
                    {lastSignIn(c)}
                  </div>
                  <div className="flex justify-end" style={{ gap: 6 }}>
                    {pending && (
                      <Button size="sm" onClick={() => doResend(c)} disabled={resend.isPending}>
                        Resend invite
                      </Button>
                    )}
                    {c.status !== "revoked" && (
                      <Button
                        size="sm"
                        onClick={() => setConfirming(c)}
                        style={{ borderColor: "var(--danger-100)", color: "var(--danger-700)" }}
                      >
                        Revoke
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
            {contacts.hasNextPage && (
              <div className="flex justify-center" style={{ padding: 12, borderTop: "1px solid var(--border)" }}>
                <Button size="sm" onClick={() => void contacts.fetchNextPage()} loading={contacts.isFetchingNextPage}>
                  Load more
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      <div className="text-muted" style={{ marginTop: 12, fontSize: 12 }}>
        Revoking ends the contact&apos;s sessions immediately and is recorded in the audit trail.
      </div>

      <DialogPrimitive.Root open={confirming !== null} onOpenChange={(o) => !o && setConfirming(null)}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-50" style={{ background: "rgba(24,24,27,0.45)" }} />
          <DialogPrimitive.Content
            className="k-surface fixed left-1/2 top-1/2 z-50 flex -translate-x-1/2 -translate-y-1/2 flex-col focus:outline-none"
            style={{ width: "min(420px, calc(100% - 2rem))", borderRadius: 9, padding: 24, gap: 16, boxShadow: "var(--shadow-xl)" }}
          >
            <div>
              <DialogPrimitive.Title style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
                Revoke portal access?
              </DialogPrimitive.Title>
              <DialogPrimitive.Description
                className="text-muted"
                style={{ margin: "6px 0 0", fontSize: 13, lineHeight: 1.5 }}
              >
                {confirming?.email} will be signed out immediately and can no longer sign in to the supplier portal.
              </DialogPrimitive.Description>
            </div>
            <div className="flex justify-end" style={{ gap: 8 }}>
              <Button type="button" onClick={() => setConfirming(null)}>
                Cancel
              </Button>
              <Button
                type="button"
                variant="danger"
                loading={revoke.isPending}
                onClick={() => confirming !== null && doRevoke(confirming)}
              >
                Revoke access
              </Button>
            </div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </div>
  );
}
