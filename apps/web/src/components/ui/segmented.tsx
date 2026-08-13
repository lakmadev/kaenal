import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

export interface SegmentedOption<T extends string> {
  value: T;
  label?: string;
  icon?: LucideIcon;
}

/**
 * Segmented control (ported from the prototype's `Segmented`) — a compact
 * single-select toggle used for view switches (list/kanban) and inline filters.
 */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  size = "md",
  ariaLabel,
}: {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  size?: "sm" | "md";
  ariaLabel?: string;
}): React.ReactElement {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className="inline-flex max-w-full gap-0.5 overflow-x-auto rounded-md border border-border p-[3px] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      style={{ background: "var(--bg-subtle)" }}
    >
      {options.map((o) => {
        const active = o.value === value;
        const Icon = o.icon;
        return (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={active}
            aria-label={o.label !== undefined && o.label !== "" ? o.label : o.value}
            onClick={() => onChange(o.value)}
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 rounded-sm font-medium transition-colors",
              size === "sm" ? "px-2.5 py-1 text-[12px]" : "px-3 py-1.5 text-[13px]",
              active ? "text-text shadow-xs" : "text-muted hover:text-text",
            )}
            style={active ? { background: "var(--surface)" } : undefined}
          >
            {Icon && <Icon size={14} />}
            {o.label !== undefined && o.label !== "" && <span>{o.label}</span>}
          </button>
        );
      })}
    </div>
  );
}
