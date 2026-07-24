import { cn } from "@/lib/cn";

/** Paper surface — 1px hairline border, no float (04 §2 shape). */
export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>): React.ReactElement {
  return <div className={cn("k-surface", className)} {...props} />;
}

export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>): React.ReactElement {
  return <div className={cn("flex items-center justify-between gap-3 px-5 py-4", className)} {...props} />;
}

export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>): React.ReactElement {
  return <h3 className={cn("text-[15px] font-semibold text-text", className)} {...props} />;
}

export function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>): React.ReactElement {
  return <div className={cn("px-5 pb-5", className)} {...props} />;
}
