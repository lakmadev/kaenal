"use client";

import * as RadixTooltip from "@radix-ui/react-tooltip";

/**
 * Tooltip (design deviation D-T1): the ink chip already used by Toast
 * (background `--text`, foreground `--surface`) with an 8px diamond arrow.
 * Wraps a single focusable child; also shown on keyboard focus.
 */
export function Tooltip({
  content,
  side = "bottom",
  children,
}: {
  content: React.ReactNode;
  side?: "top" | "bottom";
  children: React.ReactElement;
}): React.ReactElement {
  return (
    <RadixTooltip.Provider delayDuration={300}>
      <RadixTooltip.Root>
        <RadixTooltip.Trigger asChild>{children}</RadixTooltip.Trigger>
        <RadixTooltip.Portal>
          <RadixTooltip.Content
            side={side}
            sideOffset={8}
            className="z-[80] rounded-md px-2.5 py-1.5 text-[11.5px] font-medium shadow-lg"
            style={{ background: "var(--text)", color: "var(--surface)" }}
          >
            {content}
            <RadixTooltip.Arrow
              width={10}
              height={5}
              style={{ fill: "var(--text)" }}
            />
          </RadixTooltip.Content>
        </RadixTooltip.Portal>
      </RadixTooltip.Root>
    </RadixTooltip.Provider>
  );
}
