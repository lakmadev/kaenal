"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Copy, Download, FileText, Info, TriangleAlert } from "lucide-react";

/**
 * Shared MFA primitives, reproduced from the binding design (`src/mfa.jsx`): the
 * six-box verification-code input, the QR image, inline error/note strips, and the
 * recovery-codes grid with copy/download/print. Presentational only — every value
 * (QR, codes) is supplied by the API; nothing is generated in the client.
 */

/** Six single-digit boxes with auto-advance, arrow/backspace nav, and paste. */
export function CodeBoxes({
  value,
  onChange,
  len = 6,
  disabled = false,
  invalid = false,
  autoFocus = false,
  onComplete,
}: {
  value: string;
  onChange: (next: string) => void;
  len?: number;
  disabled?: boolean;
  invalid?: boolean;
  autoFocus?: boolean;
  onComplete?: (code: string) => void;
}): React.ReactElement {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const digits = value.padEnd(len).slice(0, len).split("");

  useEffect(() => {
    if (autoFocus) refs.current[0]?.focus();
  }, [autoFocus]);

  const setAt = (i: number, ch: string): void => {
    const arr = value.padEnd(len).slice(0, len).split("");
    arr[i] = ch;
    const next = arr.join("").replace(/\s+$/, "");
    onChange(next);
    if (ch !== "" && i < len - 1) refs.current[i + 1]?.focus();
    if (next.replace(/\s/g, "").length === len && onComplete) onComplete(next);
  };

  const onKey = (i: number, e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === "Backspace" && (digits[i]?.trim() ?? "") === "" && i > 0) refs.current[i - 1]?.focus();
    if (e.key === "ArrowLeft" && i > 0) refs.current[i - 1]?.focus();
    if (e.key === "ArrowRight" && i < len - 1) refs.current[i + 1]?.focus();
  };

  const onPaste = (e: React.ClipboardEvent<HTMLDivElement>): void => {
    e.preventDefault();
    const t = (e.clipboardData.getData("text") || "").replace(/\D/g, "").slice(0, len);
    if (t !== "") {
      onChange(t);
      refs.current[Math.min(t.length, len - 1)]?.focus();
      if (t.length === len && onComplete) onComplete(t);
    }
  };

  const borderColor = invalid ? "var(--danger-500)" : "var(--border-strong)";

  return (
    <div style={{ display: "flex", gap: 8 }} onPaste={onPaste}>
      {Array.from({ length: len }).map((_, i) => (
        <div key={i} style={{ display: "contents" }}>
          <input
            ref={(el) => {
              refs.current[i] = el;
            }}
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={1}
            disabled={disabled}
            aria-label={`Digit ${i + 1}`}
            aria-invalid={invalid}
            value={digits[i]?.trim() ?? ""}
            onChange={(e) => setAt(i, e.target.value.replace(/\D/g, "").slice(-1))}
            onKeyDown={(e) => onKey(i, e)}
            onFocus={(e) => {
              e.target.select();
              if (!invalid) e.target.style.borderColor = "var(--accent)";
            }}
            onBlur={(e) => {
              e.target.style.borderColor = borderColor;
            }}
            className="mono"
            style={{
              width: 52,
              height: 60,
              textAlign: "center",
              fontSize: 24,
              fontWeight: 600,
              border: `1.5px solid ${borderColor}`,
              borderRadius: "var(--r-md)",
              background: disabled ? "var(--bg-subtle)" : "var(--surface)",
              color: "var(--text)",
              outline: "none",
              transition: "all 120ms",
              caretColor: "var(--accent)",
              opacity: disabled ? 0.6 : 1,
            }}
          />
          {i === 2 && (
            <div style={{ display: "flex", alignItems: "center", color: "var(--text-subtle)", fontSize: 20, userSelect: "none" }}>
              –
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/** The authenticator QR — a PNG data-URI produced server-side at enrolment. */
export function QrImage({ dataUri, size = 160 }: { dataUri: string; size?: number }): React.ReactElement {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- data-URI, not a remote asset
    <img
      src={dataUri}
      alt="Authenticator QR code"
      width={size}
      height={size}
      style={{ display: "block", borderRadius: 6, width: size, height: size }}
    />
  );
}

export function MfaError({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <div
      className="fade-in"
      role="alert"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        marginTop: 14,
        padding: "9px 12px",
        background: "var(--danger-50)",
        border: "1px solid var(--danger-100)",
        borderRadius: "var(--r-md)",
        color: "var(--danger-700)",
        fontSize: 12.5,
        fontWeight: 500,
      }}
    >
      <TriangleAlert size={14} strokeWidth={2} />
      {children}
    </div>
  );
}

export function MfaNote({
  tone = "muted",
  icon = "info",
  children,
}: {
  tone?: "muted" | "warn";
  icon?: "info" | "alert";
  children: React.ReactNode;
}): React.ReactElement {
  const palette =
    tone === "warn"
      ? { bg: "var(--warning-50)", border: "rgba(245,158,11,0.25)", fg: "var(--warning-700)" }
      : { bg: "var(--bg-subtle)", border: "var(--border)", fg: "var(--text-muted)" };
  const IconEl = icon === "alert" ? TriangleAlert : Info;
  return (
    <div
      style={{
        display: "flex",
        gap: 9,
        alignItems: "flex-start",
        padding: "11px 13px",
        background: palette.bg,
        border: `1px solid ${palette.border}`,
        borderRadius: "var(--r-md)",
        fontSize: 12,
        lineHeight: 1.55,
        color: palette.fg,
      }}
    >
      <IconEl size={14} strokeWidth={2} style={{ flexShrink: 0, marginTop: 1 }} />
      <div>{children}</div>
    </div>
  );
}

/** The 10 recovery codes in a 2-column grid; spent ones render struck through. */
export function RecoveryCodesGrid({ codes, used = [] }: { codes: string[]; used?: number[] }): React.ReactElement {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(2, 1fr)",
        gap: 8,
        padding: 16,
        background: "var(--bg-subtle)",
        border: "1px solid var(--border)",
        borderRadius: "var(--r-md)",
      }}
    >
      {codes.map((c, i) => {
        const isUsed = used.includes(i);
        return (
          <div
            key={c}
            className="mono"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "8px 12px",
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: "var(--r-sm)",
              fontSize: 13.5,
              letterSpacing: "0.04em",
              color: isUsed ? "var(--text-subtle)" : "var(--text)",
              textDecoration: isUsed ? "line-through" : "none",
            }}
          >
            <span style={{ fontSize: 11, color: "var(--text-subtle)", width: 16 }}>{String(i + 1).padStart(2, "0")}</span>
            {c}
          </div>
        );
      })}
    </div>
  );
}

/** Copy / Download / Print for a saved set of recovery codes. */
export function RecoveryActions({ codes, workspace }: { codes: string[]; workspace: string }): React.ReactElement {
  const [copied, setCopied] = useState(false);
  const body = codes.join("\n");

  const copy = (): void => {
    void navigator.clipboard?.writeText(body).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const download = (): void => {
    try {
      const header = `Kaenal — Two-factor recovery codes\n${workspace}.kaenal.app · Generated ${new Date()
        .toISOString()
        .slice(0, 10)}\nEach code can be used once.\n\n`;
      const blob = new Blob([`${header}${body}\n`], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "kaenal-recovery-codes.txt";
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      /* download best-effort */
    }
  };

  const print = (): void => {
    setTimeout(() => {
      try {
        window.print();
      } catch {
        /* print best-effort */
      }
    }, 120);
  };

  return (
    <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
      <button type="button" onClick={copy} className="k-btn k-btn-ghost" style={{ flex: 1, justifyContent: "center" }}>
        {copied ? <Check size={13} /> : <Copy size={13} />}
        {copied ? "Copied" : "Copy"}
      </button>
      <button type="button" onClick={download} className="k-btn k-btn-ghost" style={{ flex: 1, justifyContent: "center" }}>
        <Download size={13} /> Download
      </button>
      <button type="button" onClick={print} className="k-btn k-btn-ghost" style={{ flex: 1, justifyContent: "center" }}>
        <FileText size={13} /> Print
      </button>
    </div>
  );
}
