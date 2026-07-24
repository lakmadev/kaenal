"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Mail, TriangleAlert } from "lucide-react";
import { checkPasswordPolicy, MIN_PASSWORD_LENGTH } from "@kaenal/core";
import { acceptInvite, AuthError } from "@/lib/auth";
import { setActiveTenant } from "@/lib/tenant";
import { AuthShell } from "@/components/auth/auth-shell";
import { PasswordField } from "@/components/auth/password-field";
import { PasswordStrength } from "@/components/auth/password-strength";

/**
 * Accept a workspace invitation (04 §4, `auth.jsx` invite screen). Sets the
 * person's name + password and activates their membership, then sends them to
 * sign in. The prototype's inviter / role / team / email details are omitted —
 * there is no endpoint to fetch invite metadata before acceptance, and
 * fabricating it would be dishonest; the token itself carries the real grant.
 */
export function InviteForm({
  token,
  initialWorkspace,
}: {
  token: string;
  initialWorkspace: string;
}): React.ReactElement {
  const router = useRouter();
  const [workspace, setWorkspace] = useState(initialWorkspace);
  const [name, setName] = useState("");
  const [pw, setPw] = useState("");
  const [accept, setAccept] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const canSubmit =
    workspace.trim() !== "" && name.trim() !== "" && checkPasswordPolicy(pw).ok && accept;

  const submit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (!canSubmit) return;
    setErr("");
    setBusy(true);
    try {
      await acceptInvite({ tenant: workspace, token, name: name.trim(), password: pw });
      setActiveTenant(workspace);
      router.replace("/sign-in");
    } catch (error) {
      setBusy(false);
      setErr(
        error instanceof AuthError && error.status === 404
          ? "This invitation is invalid or has expired. Ask your admin to re-send it."
          : "Couldn't accept the invitation. Check the workspace and try again.",
      );
    }
  };

  return (
    <AuthShell>
      <div className="fade-in">
        <div
          className="mb-5 flex items-center gap-3 p-3.5"
          style={{ border: "1px solid var(--border)", borderRadius: "var(--r-md)", background: "var(--surface)" }}
        >
          <div
            className="flex items-center justify-center text-[18px] font-bold text-white"
            style={{ width: 40, height: 40, borderRadius: "var(--r-sm)", background: "var(--accent)" }}
          >
            {(workspace[0] ?? "K").toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13.5px] font-semibold">
              {workspace.trim() === "" ? "Your workspace" : `${workspace}.kaenal.app`}
            </div>
            <div className="text-[11px] text-muted">Kaenal workspace</div>
          </div>
          <span className="k-chip" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>
            <Mail size={11} /> Invited
          </span>
        </div>

        <h1 className="mb-1.5 text-[28px] font-bold" style={{ letterSpacing: "-0.01em" }}>
          You&rsquo;ve been invited
        </h1>
        <p className="mb-5 text-[13.5px] leading-relaxed text-muted">
          Set up your account to join the workspace. Your role and team were set by whoever invited you.
        </p>

        <form onSubmit={(e) => void submit(e)}>
          <label className="k-overline mb-1.5 block">Workspace</label>
          <input
            className="k-input mb-3.5"
            value={workspace}
            onChange={(e) => setWorkspace(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
            placeholder="your-company"
            style={{ height: 42 }}
          />

          <label className="k-overline mb-1.5 block">Full name</label>
          <input
            className="k-input mb-3.5"
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            autoComplete="name"
            style={{ height: 42 }}
          />

          <label className="k-overline mb-1.5 block">Create a password</label>
          <PasswordField value={pw} onChange={setPw} placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`} />
          <PasswordStrength password={pw} />

          <label className="mt-3.5 flex cursor-pointer items-start gap-2 text-[12px] leading-relaxed text-muted">
            <input
              type="checkbox"
              checked={accept}
              onChange={(e) => setAccept(e.target.checked)}
              style={{ accentColor: "var(--accent)", marginTop: 2 }}
            />
            <span>
              I agree to the <span className="k-link">Terms of Service</span> and{" "}
              <span className="k-link">Privacy Policy</span>.
            </span>
          </label>

          {err !== "" && (
            <div className="mt-2 flex items-center gap-1.5 text-[12px]" role="alert" style={{ color: "var(--danger-600)" }}>
              <TriangleAlert size={12} /> {err}
            </div>
          )}

          <button
            type="submit"
            disabled={busy || !canSubmit}
            className="k-btn k-btn-primary mt-4 w-full"
            style={{ height: 44, fontSize: 14 }}
          >
            {busy ? "Creating account…" : "Accept invite & join"}
          </button>
        </form>
      </div>
    </AuthShell>
  );
}
