"use client";

import { useState } from "react";
import { PartnerInviteBody } from "@kaenal/types";
import { Button, Dialog, DialogContent, Field, Input, useToast } from "@/components/ui";
import { AuthError, invitePortalContact } from "@/lib/auth";
import { errorMessage } from "@/lib/api-error";

/**
 * Invite a contact at this supplier to the supplier portal (P11). The invite is
 * bound to the supplier server-side; the contact accepts by email, sets a
 * password, then enrols two-factor on their first sign-in. Validation uses the
 * shared `PartnerInviteBody` schema.
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
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    const parsed = PartnerInviteBody.safeParse({ email: email.trim() });
    if (!parsed.success) {
      setError("Enter a valid email address");
      return;
    }
    setError("");
    setBusy(true);
    try {
      await invitePortalContact(supplierId, parsed.data.email);
      toast.success(`Portal invitation sent to ${parsed.data.email}`);
      setEmail("");
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof AuthError ? err.message : errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title="Invite to supplier portal"
        description={`Give a contact at ${supplierName} access to their SCARs and PPAP submissions. They will set a password and enrol two-factor on first sign-in.`}
      >
        <form onSubmit={(e) => void submit(e)} className="flex flex-col gap-4" noValidate>
          <Field label="Contact email" error={error === "" ? undefined : error} required>
            {(a) => (
              <Input
                {...a}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="quality@supplier.com"
                autoFocus
              />
            )}
          </Field>
          <div className="mt-1 flex justify-end gap-2">
            <Button type="button" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={busy}>
              Send invitation
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
