"use client";

import { useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { INVITATION_TTL_MS } from "@kaenal/core";
import { PartnerInviteBody } from "@kaenal/types";
import { Button, useToast } from "@/components/ui";
import { AuthError } from "@/lib/auth";
import { useInvitePortalContact } from "@/hooks/use-portal-contacts";

const EXPIRY_DAYS = Math.round(INVITATION_TTL_MS / 86_400_000);

/**
 * Invite to supplier portal (binding canvas "InviteDialog"): a 480px dialog with
 * the contact-email field, a neutral Scope note, and — when the server refuses
 * (e.g. the address is an internal staff member, 409) — a red panel in the note's
 * place. Validation uses the shared `PartnerInviteBody` schema; the invite is
 * bound to this supplier server-side.
 */
export function SupplierPortalInviteDialog({
  supplierId,
  supplierName,
  open,
  onOpenChange,
}: {
  supplierId: string;
  supplierName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}): React.ReactElement {
  const toast = useToast();
  const invite = useInvitePortalContact(supplierId);
  const [email, setEmail] = useState("");
  const [fieldError, setFieldError] = useState("");
  const [serverError, setServerError] = useState("");

  const close = (next: boolean): void => {
    if (!next) {
      setEmail("");
      setFieldError("");
      setServerError("");
    }
    onOpenChange(next);
  };

  const submit = (e: React.FormEvent): void => {
    e.preventDefault();
    const parsed = PartnerInviteBody.safeParse({ email: email.trim() });
    if (!parsed.success) {
      setFieldError("Enter a valid email address");
      return;
    }
    setFieldError("");
    setServerError("");
    invite.mutate(parsed.data.email, {
      onSuccess: () => {
        toast.success(`Portal invitation sent to ${parsed.data.email}`);
        close(false);
      },
      onError: (err) => {
        setServerError(
          err instanceof AuthError && err.status === 409
            ? "This address belongs to a Kaenal staff member and cannot be invited as a supplier contact."
            : err instanceof AuthError
              ? err.message
              : "Something went wrong. Please try again.",
        );
      },
    });
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={close}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50" style={{ background: "rgba(24,24,27,0.45)" }} />
        <DialogPrimitive.Content
          className="fixed left-1/2 top-1/2 z-50 flex -translate-x-1/2 -translate-y-1/2 flex-col focus:outline-none"
          style={{
            width: "min(480px, calc(100% - 2rem))",
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 9,
            boxShadow: "0 16px 40px -12px rgba(24,24,27,0.16)",
            padding: 24,
            gap: 16,
          }}
        >
          <form onSubmit={submit} noValidate className="flex flex-col" style={{ gap: 16 }}>
            <div>
              <DialogPrimitive.Title style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
                Invite to supplier portal
              </DialogPrimitive.Title>
              <DialogPrimitive.Description
                style={{ margin: "6px 0 0", fontSize: 13, lineHeight: 1.5, color: "var(--text-muted)" }}
              >
                Give a contact at {supplierName} access to their SCARs and PPAP submissions. They set a password, then
                enrol two-factor on first sign-in.
              </DialogPrimitive.Description>
            </div>

            <div className="flex flex-col" style={{ gap: 6 }}>
              <label htmlFor="portal-invite-email" style={{ fontSize: 12, fontWeight: 600 }}>
                Contact email <span style={{ color: "var(--danger-700)" }}>*</span>
              </label>
              <input
                id="portal-invite-email"
                type="email"
                className="k-input"
                value={email}
                autoFocus
                aria-invalid={fieldError !== ""}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (fieldError !== "") setFieldError("");
                  if (serverError !== "") setServerError("");
                }}
                placeholder="quality@supplier.com"
                style={fieldError !== "" ? { boxShadow: "0 0 0 3px rgba(220,38,38,0.12)" } : undefined}
              />
              {fieldError !== "" && (
                <div role="alert" style={{ fontSize: 12, color: "var(--danger-700)" }}>
                  {fieldError}
                </div>
              )}
            </div>

            {serverError !== "" ? (
              <div
                role="alert"
                style={{
                  padding: "10px 12px",
                  background: "var(--danger-50)",
                  border: "1px solid var(--danger-100)",
                  borderRadius: 5,
                  fontSize: 12,
                  lineHeight: 1.5,
                  color: "var(--danger-700)",
                }}
              >
                {serverError}
              </div>
            ) : (
              <div
                className="flex"
                style={{
                  gap: 10,
                  padding: "10px 12px",
                  background: "var(--bg)",
                  border: "1px solid var(--border)",
                  borderRadius: 5,
                  fontSize: 12,
                  lineHeight: 1.5,
                  color: "var(--text-muted)",
                }}
              >
                <span style={{ fontWeight: 600, color: "var(--text)", whiteSpace: "nowrap" }}>Scope</span>
                <span>
                  Read and respond access to this supplier&apos;s records only. The link expires in {EXPIRY_DAYS} days;
                  re-inviting replaces it.
                </span>
              </div>
            )}

            <div className="flex justify-end" style={{ gap: 8, marginTop: 4 }}>
              <Button type="button" onClick={() => close(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" loading={invite.isPending}>
                Send invitation
              </Button>
            </div>
          </form>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
