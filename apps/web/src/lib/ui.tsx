import type { ReactNode } from "react";

/** Maps a domain status onto one of the four badge tones. */
const TONE: Record<string, string> = {
  scheduled: "info",
  in_progress: "warn",
  completed: "ok",
  cancelled: "neutral",
  draft: "neutral",
  published: "ok",
  archived: "neutral",
};

export function StatusBadge({ status }: { status: string }): ReactNode {
  const tone = TONE[status] ?? "neutral";
  return <span className={`badge ${tone}`}>{status.replace(/_/g, " ")}</span>;
}

export function formatDateTime(iso: string | null): string {
  if (iso === null) return "—";
  return new Date(iso).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
