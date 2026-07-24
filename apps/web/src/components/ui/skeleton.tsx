import { cn } from "@/lib/cn";

/**
 * Shimmer placeholder (the `.skeleton` token class). Compose these into the
 * shape of the final content — every list/detail shows a layout-matched skeleton
 * while loading, never a page spinner (04 §6.1).
 */
export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>): React.ReactElement {
  return <div className={cn("skeleton", className)} {...props} />;
}
