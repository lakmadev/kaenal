"use client";

import { useState } from "react";
import { RefreshCw, Shield } from "lucide-react";
import { useMfaDisable, useMfaRegenerate } from "@/hooks/use-mfa";
import { CodeBoxes, MfaError } from "./mfa-bits";

/**
 * Confirm modal for the two destructive-ish account actions (binding design
 * `MfaConfirmModal`): regenerate recovery codes, or turn MFA off. Both require the
 * user to prove a current code first. `regenerate` hands the fresh codes back to
 * the caller (which shows them once); `disable` just closes on success.
 */
export function MfaConfirmModal({
  variant,
  onClose,
  onConfirm,
}: {
  variant: "regenerate" | "disable";
  onClose: () => void;
  onConfirm: (result: { recoveryCodes?: string[] }) => void;
}): React.ReactElement {
  const danger = variant === "disable";
  const [code, setCode] = useState("");
  const [invalid, setInvalid] = useState(false);
  const disable = useMfaDisable();
  const regenerate = useMfaRegenerate();
  const pending = disable.isPending || regenerate.isPending;

  const cfg = danger
    ? {
        Icon: Shield,
        title: "Turn off two-factor authentication",
        color: "var(--danger-600)",
        bg: "var(--danger-50)",
        border: "var(--danger-100)",
        body: "This removes the extra layer of protection on your account. Your workspace may require two-factor — turning it off could block your next sign-in.",
        cta: "Turn off two-factor",
        btnStyle: { background: "var(--danger-600)", color: "#fff" } as React.CSSProperties,
      }
    : {
        Icon: RefreshCw,
        title: "Regenerate recovery codes",
        color: "var(--accent)",
        bg: "var(--accent-soft)",
        border: "var(--border)",
        body: "This creates a new set of 10 codes and invalidates all of your current ones. Any codes you saved before will stop working.",
        cta: "Regenerate codes",
        btnStyle: {} as React.CSSProperties,
      };

  const go = (entered?: string): void => {
    const value = (entered ?? code).replace(/\s/g, "");
    if (value.length !== 6 || pending) return;
    setInvalid(false);
    if (danger) {
      disable.mutate(value, { onSuccess: () => onConfirm({}), onError: () => setInvalid(true) });
    } else {
      regenerate.mutate(value, {
        onSuccess: (res) => onConfirm({ recoveryCodes: res.recoveryCodes }),
        onError: () => setInvalid(true),
      });
    }
  };

  const { Icon } = cfg;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        background: "rgba(15,23,42,0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        backdropFilter: "blur(2px)",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="k-surface fade-in"
        role="dialog"
        aria-modal="true"
        aria-label={cfg.title}
        style={{ width: 420, maxWidth: "100%", boxShadow: "var(--shadow-xl)" }}
      >
        <div style={{ padding: 22 }}>
          <div
            style={{
              display: "inline-flex",
              padding: 11,
              borderRadius: "var(--r-md)",
              background: cfg.bg,
              color: cfg.color,
              marginBottom: 14,
              border: `1px solid ${cfg.border}`,
            }}
          >
            <Icon size={22} />
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>{cfg.title}</div>
          <div style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.6, marginBottom: 18 }}>{cfg.body}</div>
          <label className="k-overline" style={{ display: "block", marginBottom: 8 }}>
            Confirm with your current code
          </label>
          <CodeBoxes
            value={code}
            onChange={(v) => {
              setCode(v);
              if (invalid) setInvalid(false);
            }}
            disabled={pending}
            invalid={invalid}
            autoFocus
            onComplete={(v) => go(v)}
          />
          {invalid && <MfaError>That code isn&rsquo;t valid. Try again.</MfaError>}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 20 }}>
            <button onClick={onClose} className="k-btn k-btn-ghost">
              Cancel
            </button>
            <button
              onClick={() => go()}
              disabled={code.replace(/\s/g, "").length !== 6 || pending}
              className="k-btn k-btn-primary"
              style={{ minWidth: 150, justifyContent: "center", opacity: code.replace(/\s/g, "").length !== 6 || pending ? 0.6 : 1, ...cfg.btnStyle }}
            >
              {pending ? (
                <>
                  <span className="k-spin" style={{ width: 14, height: 14, border: "2px solid rgba(255,255,255,0.4)", borderTopColor: "#fff", borderRadius: "50%" }} />{" "}
                  Working…
                </>
              ) : (
                cfg.cta
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
