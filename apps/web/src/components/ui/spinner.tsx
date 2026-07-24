import { Loader2 } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * Inline spinner for buttons and small affordances only. Full-page loads use
 * skeletons, never a spinner (04 §6.1).
 */
export function Spinner({ size = 16, className }: { size?: number; className?: string }): React.ReactElement {
  return <Loader2 size={size} className={cn("animate-spin", className)} aria-hidden />;
}
