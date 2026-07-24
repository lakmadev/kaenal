"use client";

import { useEffect } from "react";
import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui";

/**
 * Segment error boundary (04 §6.3). Renders inside the shell, offers a retry, and
 * surfaces the request id (via `error.digest`) so a support request is
 * actionable. Real error reporting (Sentry) wires in here later.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}): React.ReactElement {
  useEffect(() => {
    // Placeholder until Sentry is wired (TECH_STACK §5 observability).
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto max-w-lg p-6">
      <div className="k-surface flex flex-col items-center gap-4 p-10 text-center">
        <div className="inline-flex rounded-full bg-bg-subtle p-4 text-danger">
          <TriangleAlert size={28} />
        </div>
        <div>
          <div className="text-[16px] font-semibold text-text">Something went wrong</div>
          <p className="mt-1 text-[13px] text-muted">An unexpected error occurred while loading this screen.</p>
          {error.digest !== undefined && (
            <p className="mono mt-2 text-[11px] text-subtle">Reference: {error.digest}</p>
          )}
        </div>
        <Button variant="primary" onClick={reset}>
          Try again
        </Button>
      </div>
    </div>
  );
}
