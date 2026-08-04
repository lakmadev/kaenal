"use client";

/**
 * Shared settings primitives, ported from `settings.jsx` (SettingsPage / Card /
 * Row / Toggle). Every section composes these so the whole area restyles from one
 * place and matches the design's spacing exactly.
 */

export function SettingsPage({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <div>
      <div className="flex flex-wrap items-start gap-5 px-6 pt-6">
        <div className="min-w-0 flex-1">
          <h1 className="m-0 text-[22px] font-bold tracking-[-0.02em]">{title}</h1>
          {subtitle !== undefined && <p className="m-0 mt-1 text-[13px] text-muted">{subtitle}</p>}
        </div>
        {actions !== undefined && <div className="flex items-center gap-2">{actions}</div>}
      </div>
      <div className="max-w-[920px] p-6">{children}</div>
    </div>
  );
}

export function SettingsCard({
  title,
  desc,
  footer,
  children,
}: {
  title?: string;
  desc?: string;
  footer?: React.ReactNode;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <div className="k-surface mb-4 p-0">
      {(title !== undefined || desc !== undefined) && (
        <div className="border-b border-border px-5 py-4">
          {title !== undefined && <div className="text-[14px] font-semibold">{title}</div>}
          {desc !== undefined && <div className="mt-0.5 text-[12px] text-muted">{desc}</div>}
        </div>
      )}
      <div className="p-5">{children}</div>
      {footer !== undefined && (
        <div className="flex justify-end gap-2 border-t border-border px-5 py-3" style={{ background: "var(--bg-subtle)" }}>
          {footer}
        </div>
      )}
    </div>
  );
}

export function SettingsRow({
  label,
  hint,
  align = "center",
  children,
}: {
  label: string;
  hint?: string;
  align?: "center" | "start";
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <div
      className="grid gap-6 border-b border-border py-3.5 last:border-b-0"
      style={{ gridTemplateColumns: "200px 1fr", alignItems: align === "start" ? "flex-start" : "center" }}
    >
      <div>
        <div className="text-[13px] font-medium">{label}</div>
        {hint !== undefined && <div className="mt-0.5 text-[11px] text-muted">{hint}</div>}
      </div>
      <div>{children}</div>
    </div>
  );
}

export function Toggle({ on, onChange }: { on: boolean; onChange?: (next: boolean) => void }): React.ReactElement {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange?.(!on)}
      className="relative shrink-0 rounded-full transition-colors"
      style={{ width: 36, height: 20, background: on ? "var(--accent)" : "var(--border)" }}
    >
      <span
        className="absolute rounded-full bg-white transition-all"
        style={{ width: 16, height: 16, top: 2, left: on ? 18 : 2, boxShadow: "var(--shadow-sm)" }}
      />
    </button>
  );
}
